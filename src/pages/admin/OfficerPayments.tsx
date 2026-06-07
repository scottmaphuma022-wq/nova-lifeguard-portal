import { useEffect, useState, useCallback } from 'react';
import { CreditCard, CheckCircle, Send, User, Phone, FileText, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

interface ApprovedClaim {
  id: string;
  claim_number: string;
  claim_amount: number;
  claim_reason: string;
  claim_status: string;
  payment_status: string | null;   // nullable — not all claims have a payment record yet
  approved_date: string;
  customer_name: string;
  customer_phone: string;
}

const paymentStatusColors: Record<string, string> = {
  pending:   'bg-warning/10 text-warning',
  processing: 'bg-info/10 text-info',
  paid:       'bg-success/10 text-success',
  completed:  'bg-success/10 text-success',
};

const OfficerPayments = () => {
  const { toast } = useToast();

  const [claims, setClaims] = useState<ApprovedClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [officerId, setOfficerId] = useState<string | null>(null);

  const [selectedClaim, setSelectedClaim] = useState<ApprovedClaim | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paying, setPaying] = useState(false);

  /* ─── Fetch approved claims for this officer ──────────────────────────── */
  const fetchApprovedClaims = useCallback(async (silent = false) => {
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

      // Fetch approved claims assigned to this officer,
      // joining the customer profile for name + phone via user_id FK
      const { data, error } = await supabase
        .from('claims')
        .select(`
          id,
          claim_number,
          claim_amount,
          claim_reason,
          claim_status,
          payment_status,
          created_at,
          userprofile!claims_user_id_fkey (
            username,
            phone
          )
        `)
        .eq('officer_id', uid)
        .eq('claim_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('OfficerPayments fetch error:', error.message);
      } else if (data) {
        const mapped: ApprovedClaim[] = data.map((c: any) => ({
          id: c.id,
          claim_number: c.claim_number,
          claim_amount: Number(c.claim_amount),
          claim_reason: c.claim_reason,
          claim_status: c.claim_status,
          payment_status: c.payment_status ?? 'pending',
          approved_date: c.created_at,
          customer_name: c.userprofile?.username ?? '—',
          customer_phone: c.userprofile?.phone ?? '—',
        }));
        setClaims(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch approved claims:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [officerId]);

  useEffect(() => { fetchApprovedClaims(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Realtime: refresh when a claim is updated ───────────────────────── */
  useEffect(() => {
    if (!officerId) return;
    const channel = supabase
      .channel('officer-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims', filter: `officer_id=eq.${officerId}` }, () => {
        fetchApprovedClaims(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [officerId, fetchApprovedClaims]);

  /* ─── Process payment — update payment_status in DB ──────────────────── */
  const handleProcessPayment = async () => {
    if (!selectedClaim) return;
    setPaying(true);

    const { error } = await supabase
      .from('claims')
      .update({ payment_status: 'paid' })
      .eq('id', selectedClaim.id);

    if (error) {
      toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
    } else {
      // Optimistically update local state
      setClaims(prev =>
        prev.map(c => c.id === selectedClaim.id ? { ...c, payment_status: 'paid' } : c)
      );
      toast({
        title: 'Payment Processed ✓',
        description: `KSH ${selectedClaim.claim_amount.toLocaleString()} sent to ${phoneNumber || selectedClaim.customer_phone}.`,
      });
      setIsPaymentDialogOpen(false);
      setPhoneNumber('');
    }
    setPaying(false);
  };

  /* ─── Derived stats ───────────────────────────────────────────────────── */
  const pendingPayments   = claims.filter(c => c.payment_status !== 'paid' && c.payment_status !== 'completed').length;
  const completedPayments = claims.filter(c => c.payment_status === 'paid' || c.payment_status === 'completed').length;
  const totalPaid         = claims
    .filter(c => c.payment_status === 'paid' || c.payment_status === 'completed')
    .reduce((sum, c) => sum + c.claim_amount, 0);

  return (
    <AdminLayout role="officer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">B2C Payments</h1>
            <p className="text-muted-foreground">Process payments for approved claims</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchApprovedClaims(true)}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payments</p>
                  <p className="text-2xl font-bold">{loading ? '—' : pendingPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{loading ? '—' : completedPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid Out</p>
                  <p className="text-2xl font-bold">
                    {loading ? '—' : `KSH ${totalPaid.toLocaleString()}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Approved Claims — Ready for Payment</CardTitle>
            <CardDescription>Process B2C payments for verified and approved claims</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading approved claims…</p>
              </div>
            ) : claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">No approved claims pending payment</p>
                <p className="text-sm text-muted-foreground/70">Approved claims will appear here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Claim ID</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr key={claim.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{claim.claim_number}</span>
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
                        <td className="py-4 px-4">{claim.claim_reason}</td>
                        <td className="py-4 px-4 font-semibold text-primary">
                          KSH {claim.claim_amount.toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${paymentStatusColors[claim.payment_status ?? 'pending'] ?? 'bg-muted text-muted-foreground'}`}>
                            {claim.payment_status ?? 'pending'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {claim.payment_status === 'paid' || claim.payment_status === 'completed' ? (
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

      {/* Payment Confirmation Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process B2C Payment</DialogTitle>
            <DialogDescription>
              Confirm payment details for claim {selectedClaim?.claim_number}
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
                  <p className="text-muted-foreground text-sm">Payment Amount</p>
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
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsPaymentDialogOpen(false)} disabled={paying}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleProcessPayment} disabled={paying}>
                  {paying ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Sending…</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Send Payment</>
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
