import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, Forward, Eye, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';

interface Claim {
  id: string;
  dbId: string;
  customer: string;
  email: string;
  type: string;
  amount: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  date: string;
  description: string;
  documents: string[];
}

const statusColors: Record<string, string> = {
  Approved: 'bg-success/10 text-success',
  Pending: 'bg-warning/10 text-warning',
  'Under Review': 'bg-info/10 text-info',
  Rejected: 'bg-destructive/10 text-destructive',
};

const PAGE_SIZE = 6;

const ManagerClaims = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { toast } = useToast();

  useEffect(() => {
    fetchClaims();
    fetchOfficers();
  }, [page]);

  const formatStatus = (s: string) => {
    if (s === 'approved') return 'Approved';
    if (s === 'pending') return 'Pending';
    if (s === 'rejected') return 'Rejected';
    if (s === 'under_review') return 'Under Review';
    return s;
  };

  const fetchClaims = async () => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from('claims')
      .select(`
  *,
  userprofile!claims_user_id_fkey(username,email)
`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!data) return;

    const mapped = data.map((c: any) => ({
      id: c.claim_number,
      dbId: c.id,
      customer: c.userprofile?.username || 'Unknown',
      email: c.userprofile?.email || '',
      type: c.claim_reason,
      amount: `KSH ${Number(c.claim_amount).toLocaleString()}`,
      status: formatStatus(c.claim_status),
      date: new Date(c.created_at).toISOString().split('T')[0],
      description: c.claim_reason,
      documents: c.documents || [],
    }));

    setClaims(mapped);
    setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));
  };

  const fetchOfficers = async () => {
    const { data } = await supabase
      .from('userprofile')
      .select('id, username')
      .eq('role', 'claims_officer');

    setOfficers(data || []);
  };

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch =
      claim.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (claim: Claim) => {
    await supabase.from('claims')
      .update({ claim_status: 'approved' })
      .eq('id', claim.dbId);

    fetchClaims();

    toast({
      title: 'Claim Approved',
      description: `Claim ${claim.id} has been approved successfully.`,
    });
  };

  const handleReject = async (claim: Claim) => {
    await supabase.from('claims')
      .update({ claim_status: 'rejected' })
      .eq('id', claim.dbId);

    fetchClaims();

    toast({
      title: 'Claim Rejected',
      description: `Claim ${claim.id} has been rejected.`,
      variant: 'destructive',
    });
  };

  const handleForward = async () => {
    if (!selectedOfficer || !selectedClaim) return;

    await supabase.from('claims')
      .update({ officer_id: selectedOfficer })
      .eq('id', selectedClaim.dbId);

    toast({
      title: 'Claim Forwarded',
      description: `Claim ${selectedClaim.id} assigned successfully.`,
    });

    setIsForwardDialogOpen(false);
    setSelectedOfficer('');
    fetchClaims();
  };

  const getPublicUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage
      .from('claim-documents')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Claims Management</h1>
          <p className="text-muted-foreground">Review, approve, or reject customer claims</p>
        </div>

        {/* FILTERS */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* TABLE */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-0">
            <table className="w-full">
              <tbody>
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="border-b hover:bg-muted/30">
                    <td className="p-4">{claim.id}</td>
                    <td className="p-4">{claim.customer}</td>
                    <td className="p-4">{claim.type}</td>
                    <td className="p-4">{claim.amount}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded ${statusColors[claim.status]}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="p-4">{claim.date}</td>
                    <td className="p-4 flex gap-2">

                      <Button size="icon" variant="ghost"
                        onClick={() => { setSelectedClaim(claim); setIsViewDialogOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>

                      {claim.status === 'Pending' && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(claim)}>
                            <CheckCircle className="h-4 w-4 text-success" />
                          </Button>

                          <Button size="icon" variant="ghost" onClick={() => handleReject(claim)}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>

                          <Button size="icon" variant="ghost"
                            onClick={() => { setSelectedClaim(claim); setIsForwardDialogOpen(true); }}>
                            <Forward className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div className="flex justify-end gap-2 p-4">
              <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span>Page {page} / {totalPages}</span>
              <Button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* VIEW DIALOG */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedClaim?.id}</DialogTitle>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-3">
              <p>{selectedClaim.description}</p>

              <div className="flex flex-wrap gap-2">
                {selectedClaim.documents.map((doc) => (
                  <a
                    key={doc}
                    href={getPublicUrl(doc)}
                    target="_blank"
                    className="px-3 py-1 bg-muted rounded flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    View Document
                  </a>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FORWARD DIALOG */}
      <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
        <DialogContent>
          <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
            <SelectTrigger>
              <SelectValue placeholder="Select officer" />
            </SelectTrigger>
            <SelectContent>
              {officers.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleForward}>Forward</Button>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
};

export default ManagerClaims;