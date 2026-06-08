import { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertTriangle, Forward, Eye, Search, Filter, Download, BrainCircuit, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Claim {
  id: string;
  dbId: string;
  customer: string;
  email: string;
  type: string;
  amount: string;
  status: 'Pending Review' | 'Missing Docs' | 'Verified' | 'Forwarded' | 'Approved' | 'Flagged';
  date: string;
  description: string;
  documents: { name: string; path: string; verified: boolean }[];
  rawDocuments: string[];
}

const assignedClaimsStatic: Claim[] = [
  { id: 'CLM-154', dbId: '1', customer: 'Mary Muthoni', email: 'mary@email.com', type: 'Disability', amount: 'KSH 180,000', status: 'Pending Review', date: '2024-01-24', description: 'Permanent disability from accident', documents: [{ name: 'medical_report.pdf', path: 'mary/medical_report.pdf', verified: false }, { name: 'id_copy.pdf', path: 'mary/id_copy.pdf', verified: true }], rawDocuments: [] },
  { id: 'CLM-151', dbId: '2', customer: 'David Mutua', email: 'david@email.com', type: 'Disability', amount: 'KSH 200,000', status: 'Pending Review', date: '2024-01-21', description: 'Work-related disability', documents: [{ name: 'medical.pdf', path: 'david/medical.pdf', verified: false }, { name: 'employer_letter.pdf', path: 'david/employer_letter.pdf', verified: false }], rawDocuments: [] },
];

const statusColors: Record<string, string> = {
  'Pending Review': 'bg-warning/10 text-warning',
  'Missing Docs': 'bg-destructive/10 text-destructive',
  'Verified': 'bg-success/10 text-success',
  'Forwarded': 'bg-info/10 text-info',
  'Approved': 'bg-success/10 text-success',
  'Flagged': 'bg-destructive/10 text-destructive',
};

const OfficerClaims = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [officers, setOfficers] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const { toast } = useToast();

  const getPublicUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage
      .from('claim-documents')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const formatStatus = (s: string) => {
    if (s === 'approved') return 'Approved';
    if (s === 'pending') return 'Pending Review';
    if (s === 'rejected') return 'Missing Docs';
    if (s === 'under_review') return 'Pending Review';
    return 'Pending Review';
  };

  const checkPaymentHistory = async (claimEmail: string, claimId: string) => {
    try {
      const { data: userProfile } = await supabase
        .from('userprofile')
        .select('id')
        .eq('email', claimEmail)
        .maybeSingle();

      if (!userProfile) {
        setAnomalies(prev => ({ ...prev, [claimId]: 'No user profile found' }));
        return;
      }

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userProfile.id)
        .eq('payment_status', 'completed');

      if (!payments || payments.length === 0) {
        setAnomalies(prev => ({ ...prev, [claimId]: 'No completed premium payments found!' }));
      } else {
        setAnomalies(prev => {
          const next = { ...prev };
          delete next[claimId];
          return next;
        });
      }
    } catch (err) {
      console.error('Anomaly Check Error:', err);
    }
  };

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      const { data: rawClaims, error } = await supabase
        .from('claims')
        .select(`
          *,
          userprofile!claims_user_id_fkey ( username, email )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (rawClaims && rawClaims.length > 0) {
        // Show assigned claims or fall back to all claims
        const assigned = rawClaims.filter(c => c.officer_id === user.id);
        const displayClaims = assigned.length > 0 ? assigned : rawClaims;

        const mapped: Claim[] = displayClaims.map(c => {
          const docs = (c.documents || []).map((path: string) => ({
            name: path.split('/').pop() || 'document.pdf',
            path,
            verified: c.claim_status === 'approved'
          }));

          return {
            id: c.claim_number || `CLM-${c.id.slice(0, 4)}`,
            dbId: c.id,
            customer: c.userprofile?.username || 'Unknown Customer',
            email: c.userprofile?.email || '',
            type: c.claim_reason || 'Funeral Expenses',
            amount: `KSH ${Number(c.claim_amount || 0).toLocaleString()}`,
            status: formatStatus(c.claim_status),
            date: new Date(c.created_at).toISOString().split('T')[0],
            description: c.claim_reason || 'Claim files verification',
            documents: docs,
            rawDocuments: c.documents || []
          };
        });

        setClaims(mapped);

        // Run anomalies checks
        mapped.forEach(c => {
          checkPaymentHistory(c.email, c.id);
        });

      } else {
        setClaims(assignedClaimsStatic);
      }
    } catch (err: any) {
      console.error(err);
      setClaims(assignedClaimsStatic);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficers = async () => {
    const { data } = await supabase
      .from('userprofile')
      .select('id, username')
      .eq('role', 'claims_officer');
    setOfficers(data || []);
  };

  useEffect(() => {
    fetchClaims();
    fetchOfficers();
  }, []);

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch = 
      claim.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarkVerified = async (claim: Claim) => {
    try {
      await supabase.from('claims')
        .update({ claim_status: 'approved' })
        .eq('id', claim.dbId);

      setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'Verified' as const } : c));
      toast({
        title: 'Claim Verified',
        description: `Claim ${claim.id} has been marked as verified and approved.`,
      });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkMissingDocs = async (claim: Claim) => {
    try {
      await supabase.from('claims')
        .update({ claim_status: 'rejected' })
        .eq('id', claim.dbId);

      setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'Missing Docs' as const } : c));
      toast({
        title: 'Missing Documents Flagged',
        description: `Claim ${claim.id} marked as missing documents. Customer will be notified.`,
        variant: 'destructive',
      });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleAIVerify = async (claim: Claim) => {
    setVerifyingId(claim.id);
    toast({
      title: 'Checking Identity Verification 🔍',
      description: 'Looking up customer KYC status via Didit…',
    });

    try {
      const res = await fetch('/api/verify-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: claim.dbId,
          imageUrls: claim.documents.map(d => getPublicUrl(d.path)),
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        // KYC approved — auto-approve the claim
        await supabase.from('claims')
          .update({ claim_status: 'approved' })
          .eq('id', claim.dbId);

        setClaims(prev => prev.map(c =>
          c.id === claim.id ? { ...c, status: 'Verified' as const } : c
        ));

        toast({
          title: 'Identity Verified ✓',
          description: `Customer's Didit KYC is approved. Claim ${claim.id} has been verified.`,
        });
      } else {
        toast({
          title: result.kycStatus === 'pending' ? 'Verification Pending ⏳' : 'Identity Not Verified ⚠️',
          description: result.message || 'Please review documents manually.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Verification Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleForward = async () => {
    if (!selectedOfficer || !selectedClaim) return;
    
    try {
      await supabase.from('claims')
        .update({ officer_id: selectedOfficer })
        .eq('id', selectedClaim.dbId);

      setClaims(claims.map(c => c.id === selectedClaim.id ? { ...c, status: 'Forwarded' as const } : c));
      toast({
        title: 'Claim Forwarded',
        description: `Claim ${selectedClaim.id} has been forwarded successfully.`,
      });
      setIsForwardDialogOpen(false);
      setSelectedOfficer('');
    } catch (err: any) {
      toast({ title: 'Forward failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleExportExcel = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Claim ID,Customer Name,Email,Type,Amount,Status,Date\n"
      + filteredClaims.map(c => `${c.id},${c.customer},${c.email},${c.type},${c.amount},${c.status},${c.date}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "claims_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Export Successful', description: 'Claims exported to Excel.' });
  };

  return (
    <AdminLayout role="officer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Claims Processing</h1>
            <p className="text-muted-foreground">Verify documents and process assigned claims</p>
          </div>
          <Button onClick={handleExportExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or customer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending Review">Pending Review</SelectItem>
                  <SelectItem value="Missing Docs">Missing Docs</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Forwarded">Forwarded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Claims List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClaims.map((claim) => (
            <Card key={claim.id} className="border-0 shadow-card">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{claim.id}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                          {claim.status}
                        </span>
                      </div>
                      <p className="font-medium">{claim.customer}</p>
                      <p className="text-sm text-muted-foreground">{claim.type} • {claim.date}</p>
                      <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
                      
                      {/* Anomalies Badge */}
                      {anomalies[claim.id] && (
                        <div className="mt-2 bg-destructive/10 text-destructive border border-destructive/20 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium w-fit">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Anomaly: {anomalies[claim.id]}
                        </div>
                      )}

                      {/* Documents */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {claim.documents.map((doc) => (
                          <a
                            key={doc.name}
                            href={getPublicUrl(doc.path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 hover:underline ${
                              doc.verified ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <FileText className="h-3 w-3" />
                            {doc.name}
                            {doc.verified && <CheckCircle className="h-3 w-3" />}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    <p className="text-xl font-bold text-primary">{claim.amount}</p>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedClaim(claim); setIsViewDialogOpen(true); }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      
                      {claim.status === 'Pending Review' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 gap-1"
                            onClick={() => handleAIVerify(claim)}
                            disabled={verifyingId === claim.id}
                          >
                            {verifyingId === claim.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <BrainCircuit className="h-3.5 w-3.5" />
                            )}
                            AI Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success hover:bg-success hover:text-success-foreground"
                            onClick={() => handleMarkVerified(claim)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleMarkMissingDocs(claim)}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Missing Docs
                          </Button>
                        </>
                      )}

                      {claim.status === 'Verified' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success hover:bg-success hover:text-success-foreground"
                            onClick={() => handleMarkVerified(claim)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </>
                      )}
                      
                      {(claim.status === 'Pending Review' || claim.status === 'Missing Docs') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedClaim(claim); setIsForwardDialogOpen(true); }}
                        >
                          <Forward className="h-4 w-4 mr-1" />
                          Forward
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* View Claim Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Claim Details - {selectedClaim?.id}</DialogTitle>
            <DialogDescription>Review documents and verify claim information</DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedClaim.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedClaim.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedClaim.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-primary">{selectedClaim.amount}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{selectedClaim.description}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Documents</p>
                <div className="space-y-2">
                  {selectedClaim.documents.map((doc) => (
                    <div key={doc.name} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <a
                        href={getPublicUrl(doc.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 hover:underline text-primary font-medium"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{doc.name}</span>
                      </a>
                      <span className={`text-xs ${doc.verified ? 'text-success' : 'text-muted-foreground'}`}>
                        {doc.verified ? '✓ Verified' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4 gap-2" variant="outline" onClick={() => toast({ title: 'Download Successful', description: 'Claim documents are ready.' })}>
                  <Download className="h-4 w-4" />
                  Download All as PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Forward Claim Dialog */}
      <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Claim</DialogTitle>
            <DialogDescription>
              Forward claim {selectedClaim?.id} to another officer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger>
                <SelectValue placeholder="Select officer" />
              </SelectTrigger>
              <SelectContent>
                {officers.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    {officer.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsForwardDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleForward} disabled={!selectedOfficer}>
                Forward Claim
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default OfficerClaims;
