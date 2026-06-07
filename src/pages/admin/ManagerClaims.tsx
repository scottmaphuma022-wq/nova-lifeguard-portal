import { useState, useEffect, useCallback } from 'react';
import {
  FileText, CheckCircle, XCircle, Eye, Search,
  Filter, UserCheck, RefreshCw, UserX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Officer {
  id: string;
  username: string;
}

interface Claim {
  id: string;          // claim_number (display)
  dbId: string;        // uuid (DB)
  customer: string;
  type: string;
  amount: string;
  rawAmount: number;
  status: string;
  date: string;
  officerId: string | null;
  officerName: string;
  documents: string[];
  description: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const statusColors: Record<string, string> = {
  Approved:      'bg-success/10 text-success border-success/20',
  Pending:       'bg-warning/10 text-warning border-warning/20',
  'Under Review':'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Rejected:      'bg-destructive/10 text-destructive border-destructive/20',
};

const formatStatus = (s: string) => {
  if (s === 'approved')    return 'Approved';
  if (s === 'pending')     return 'Pending';
  if (s === 'rejected')    return 'Rejected';
  if (s === 'under_review') return 'Under Review';
  return s;
};

const PAGE_SIZE = 8;

/* ═══════════════════════════════════════════════════════════════════════════ */
const ManagerClaims = () => {
  const { toast } = useToast();

  const [claims, setClaims]           = useState<Claim[]>([]);
  const [officers, setOfficers]       = useState<Officer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [assigning, setAssigning]     = useState<string | null>(null); // dbId being assigned

  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [officerFilter, setOfficerFilter] = useState('all');

  const [page, setPage]               = useState(1);
  const [totalCount, setTotalCount]   = useState(0);

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isViewOpen, setIsViewOpen]   = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  /* ── Fetch the two fixed officers (role = claims_officer) ──────────────── */
  const fetchOfficers = useCallback(async () => {
    const { data } = await supabase
      .from('userprofile')
      .select('id, username')
      .eq('role', 'claims_officer')
      .limit(2);                         // only ever two
    setOfficers(data ?? []);
  }, []);

  /* ── Fetch paginated claims ────────────────────────────────────────────── */
  const fetchClaims = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const from = (page - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, count, error } = await supabase
      .from('claims')
      .select(`
        id,
        claim_number,
        claim_amount,
        claim_reason,
        claim_status,
        created_at,
        officer_id,
        documents,
        userprofile!claims_user_id_fkey ( username, email )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('ManagerClaims fetch error:', error.message);
    } else if (data) {
      setClaims(
        data.map((c: any) => ({
          id:           c.claim_number,
          dbId:         c.id,
          customer:     c.userprofile?.username ?? 'Unknown',
          type:         c.claim_reason,
          amount:       `KSH ${Number(c.claim_amount).toLocaleString()}`,
          rawAmount:    Number(c.claim_amount),
          status:       formatStatus(c.claim_status),
          date:         new Date(c.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
          officerId:    c.officer_id ?? null,
          officerName:  '',    // resolved below
          documents:    c.documents ?? [],
          description:  c.claim_reason,
        }))
      );
      setTotalCount(count ?? 0);
    }

    setLoading(false);
    setRefreshing(false);
  }, [page]);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  /* ── Resolve officer names after both lists are ready ──────────────────── */
  const claimsWithOfficers: Claim[] = claims.map(c => ({
    ...c,
    officerName: officers.find(o => o.id === c.officerId)?.username ?? '—',
  }));

  /* ── Client-side filtering (search + status + officer) ─────────────────── */
  const filtered = claimsWithOfficers.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || c.id.toLowerCase().includes(q) || c.customer.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchOfficer =
      officerFilter === 'all'          ? true :
      officerFilter === 'unassigned'   ? c.officerId === null :
      c.officerId === officerFilter;
    return matchSearch && matchStatus && matchOfficer;
  });

  /* ── Assign officer ────────────────────────────────────────────────────── */
  const handleAssign = async (claim: Claim, officerId: string) => {
    setAssigning(claim.dbId);

    const { error } = await supabase
      .from('claims')
      .update({ officer_id: officerId === 'unassigned' ? null : officerId })
      .eq('id', claim.dbId);

    if (error) {
      toast({ title: 'Assignment failed', description: error.message, variant: 'destructive' });
    } else {
      const name = officers.find(o => o.id === officerId)?.username ?? 'Unassigned';
      toast({
        title: 'Officer assigned ✓',
        description: `${claim.id} → ${officerId === 'unassigned' ? 'Unassigned' : name}`,
      });
      await fetchClaims(true);
    }
    setAssigning(null);
  };

  /* ── Approve / Reject ──────────────────────────────────────────────────── */
  const handleApprove = async (claim: Claim) => {
    await supabase.from('claims').update({ claim_status: 'approved' }).eq('id', claim.dbId);
    toast({ title: 'Claim Approved ✓', description: `${claim.id} has been approved.` });
    fetchClaims(true);
  };

  const handleReject = async (claim: Claim) => {
    await supabase.from('claims').update({ claim_status: 'rejected' }).eq('id', claim.dbId);
    toast({ title: 'Claim Rejected', description: `${claim.id} has been rejected.`, variant: 'destructive' });
    fetchClaims(true);
  };

  /* ── Document URL helper ───────────────────────────────────────────────── */
  const getPublicUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return supabase.storage.from('claim-documents').getPublicUrl(path).data.publicUrl;
  };

  /* ── Summary stats ─────────────────────────────────────────────────────── */
  const unassigned = claimsWithOfficers.filter(c => !c.officerId).length;

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Claims Management</h1>
            <p className="text-muted-foreground">Review, approve, reject, and assign claims to officers</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => fetchClaims(true)} disabled={refreshing} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Officer assignment summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Unassigned banner */}
          <Card className={`border-0 shadow-card ${unassigned > 0 ? 'ring-2 ring-warning/40' : ''}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <UserX className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unassigned Claims</p>
                <p className="text-2xl font-bold">{unassigned}</p>
              </div>
            </CardContent>
          </Card>

          {/* Per-officer workload */}
          {officers.map(o => {
            const count = claimsWithOfficers.filter(c => c.officerId === o.id).length;
            return (
              <Card key={o.id} className="border-0 shadow-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{o.username}</p>
                    <p className="text-2xl font-bold">{count} <span className="text-sm font-normal text-muted-foreground">assigned</span></p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claim ID or customer…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
              </SelectContent>
            </Select>

            <Select value={officerFilter} onValueChange={v => { setOfficerFilter(v); setPage(1); }}>
              <SelectTrigger className="w-48">
                <UserCheck className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Officer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Officers</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {officers.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Claims table */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">
              Claims <span className="text-muted-foreground font-normal text-sm">({totalCount} total)</span>
            </CardTitle>
            <CardDescription>Use the dropdown in the "Assigned To" column to assign or reassign any claim</CardDescription>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading claims…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground">No claims match the current filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Claim ID</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Assigned To</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(claim => (
                      <tr key={claim.dbId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-xs">{claim.id}</td>
                        <td className="py-3 px-4">{claim.customer}</td>
                        <td className="py-3 px-4 text-muted-foreground">{claim.type}</td>
                        <td className="py-3 px-4 font-semibold">{claim.amount}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-xs ${statusColors[claim.status] ?? ''}`}>
                            {claim.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{claim.date}</td>

                        {/* ── Assign officer dropdown ── */}
                        <td className="py-3 px-4">
                          <Select
                            value={claim.officerId ?? 'unassigned'}
                            onValueChange={val => handleAssign(claim, val)}
                            disabled={assigning === claim.dbId}
                          >
                            <SelectTrigger className={`h-8 text-xs w-44 ${!claim.officerId ? 'border-warning/60 text-warning' : 'border-primary/30 text-primary'}`}>
                              {assigning === claim.dbId
                                ? <span className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Saving…</span>
                                : <SelectValue />
                              }
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <UserX className="h-3.5 w-3.5" /> Unassigned
                                </span>
                              </SelectItem>
                              {officers.map(o => (
                                <SelectItem key={o.id} value={o.id}>
                                  <span className="flex items-center gap-2">
                                    <UserCheck className="h-3.5 w-3.5 text-primary" /> {o.username}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* ── Actions ── */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => { setSelectedClaim(claim); setIsViewOpen(true); }}
                              title="View documents"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {claim.status === 'Pending' && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => handleApprove(claim)} title="Approve">
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleReject(claim)} title="Reject">
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-border/50">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View documents dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedClaim?.id}</DialogTitle>
            <DialogDescription>
              Customer: {selectedClaim?.customer} · {selectedClaim?.amount} · {selectedClaim?.status}
            </DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedClaim.description}</p>
              {selectedClaim.documents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedClaim.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={getPublicUrl(doc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-muted rounded-lg flex items-center gap-2 text-sm hover:bg-muted/80 transition-colors"
                    >
                      <FileText className="h-4 w-4" /> Document {i + 1}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">No documents attached.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ManagerClaims;