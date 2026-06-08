import { useEffect, useState, useCallback } from 'react';
import { CreditCard, CheckCircle, Send, User, Phone, FileText, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface ApprovedClaim {
  id: string;           // uuid
  claim_number: string;
  claim_amount: number;
  claim_reason: string;
  claim_status: string; // 'approved' | 'paid'
  user_id: string;
  approved_date: string;
  customer_name: string;
  customer_phone: string;
}

const statusColors: Record<string, string> = {
  approved:  'bg-warning/10 text-warning',
  paid:      'bg-success/10 text-success',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const OfficerPayments = () => {
  const { toast } = useToast();

  const [claims, setClaims]         = useState<ApprovedClaim[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [officerId, setOfficerId]   = useState<string | null>(null);

  const [selectedClaim, setSelectedClaim]     = useState<ApprovedClaim | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber]         = useState('');
  const [paying, setPaying]                   = useState(false);

  /* ─── Fetch approved + paid claims for this officer ───────────────────── */
  const fetchClaims = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      let uid = officerId;
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser();
        uid = userData?.user?.id ?? null;
        if (!uid) { setLoading(false); setRefreshing(false); return; }
        setOfficerId(uid);
      }

      // Step 1: Fetch approved/paid claims assigned to this officer
      const { data, error } = await supabase
        .from('claims')
        .select(`
          id,
          claim_number,
          claim_amount,
          claim_reason,
          claim_status,
          created_at,
          user_id,
          userprofile!claims_user_id_fkey ( username )
        `)
        .eq('officer_id', uid)
        .in('claim_status', ['approved', 'paid'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('OfficerPayments fetch error:', error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Step 2: Fetch phone numbers separately to avoid aliased-table column issues
      const userIds = [...new Set((data ?? []).map((c: any) => c.user_id).filter(Boolean))];
      const phoneMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('userprofile')
          .select('id, phone')
          .in('id', userIds);
        profiles?.forEach((p: any) => { phoneMap[p.id] = p.phone ?? '—'; });
      }

      const mapped: ApprovedClaim[] = (data ?? []).map((c: any) => ({
        id:            c.id,
        claim_number:  c.claim_number,
        claim_amount:  Number(c.claim_amount),
        claim_reason:  c.claim_reason,
        claim_status:  c.claim_status,
        user_id:       c.user_id,
        approved_date: c.created_at,
        customer_name: c.userprofile?.username ?? '—',
        customer_phone: phoneMap[c.user_id] ?? '—',
      }));

      setClaims(mapped);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [officerId]);

  useEffect(() => { fetchClaims(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Realtime: re-fetch when claims change ───────────────────────────── */
  useEffect(() => {
    if (!officerId) return;
    const channel = supabase
      .channel('officer-payments-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'claims',
        filter: `officer_id=eq.${officerId}`,
      }, () => fetchClaims(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [officerId, fetchClaims]);

  /* ─── Mark claim as paid — updates claim_status to 'paid' ─────────────── */
  const handleProcessPayment = async () => {
    if (!selectedClaim) return;
    setPaying(true);

    const { error } = await supabase
      .from('claims')
      .update({ claim_status: 'paid' })
      .eq('id', selectedClaim.id);

    if (error) {
      toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
    } else {
      setClaims(prev =>
        prev.map(c => c.id === selectedClaim.id ? { ...c, claim_status: 'paid' } : c)
      );
      toast({
        title: 'Payment Processed ✓',
        description: `KSH ${selectedClaim.claim_amount.toLocaleString()} marked as paid for ${selectedClaim.customer_name}.`,
      });
      setIsPaymentDialogOpen(false);
      setPhoneNumber('');
    }
    setPaying(false);
  };

  /* ─── Stats derived from live data ───────────────────────────────────── */
  const pendingPayments   = claims.filter(c => c.claim_status === 'approved').length;
  const completedPayments = claims.filter(c => c.claim_status === 'paid').length;
  const totalPaid         = claims
    .filter(c => c.claim_status === 'paid')
    .reduce((sum, c) => sum + c.claim_amount, 0);

  return (
    <AdminLayout role="officer">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">B2C Payments</h1>
            <p className="text-muted-foreground">Process M-Pesa payouts for approved claims</p>
          </div>
          <Button
            variant="outline" size="icon"
            onClick={() => fetchClaims(true)}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payout</p>
                <p className="text-2xl font-bold">{loading ? '—' : pendingPayments}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid Out</p>
                <p className="text-2xl font-bold">{loading ? '—' : completedPayments}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid Out</p>
                <p className="text-2xl font-bold">
                  {loading ? '—' : `KSH ${totalPaid.toLocaleString()}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Approved Claims — Ready for Payout</CardTitle>
            <CardDescription>Process B2C M-Pesa payments for approved claims</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading claims…</p>
              </div>
            ) : claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">No approved claims pending payout</p>
                <p className="text-sm text-muted-foreground/70">Claims approved by the manager will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Claim ID</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-4 px-4 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map(claim => (
                      <tr key={claim.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono font-medium text-xs">{claim.claim_number}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {claim.customer_name}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {claim.customer_phone}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-muted-foreground">{claim.claim_reason}</td>
                        <td className="py-4 px-4 font-semibold text-primary">
                          KSH {claim.claim_amount.toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[claim.claim_status] ?? 'bg-muted text-muted-foreground'}`}>
                            {claim.claim_status === 'paid' ? 'Paid Out' : 'Pending Payout'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {claim.claim_status === 'paid' ? (
                            <span className="text-sm text-success flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" /> Paid
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedClaim(claim);
                                setPhoneNumber(claim.customer_phone !== '—' ? claim.customer_phone : '');
                                setIsPaymentDialogOpen(true);
                              }}
                            >
                              <Send className="h-4 w-4 mr-1" /> Pay
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment confirmation dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process B2C Payment</DialogTitle>
            <DialogDescription>
              Confirm M-Pesa payout for claim {selectedClaim?.claim_number}
            </DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedClaim.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Claim Type</p>
                    <p className="font-medium">{selectedClaim.claim_reason}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-muted-foreground text-sm">Payout Amount</p>
                  <p className="text-2xl font-bold text-primary">
                    KSH {selectedClaim.claim_amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="0712345678"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline" className="flex-1"
                  onClick={() => setIsPaymentDialogOpen(false)}
                  disabled={paying}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleProcessPayment} disabled={paying}>
                  {paying ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Sending…</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Send Payment</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default OfficerPayments;
