import { useState } from 'react';
import { FileText, CheckCircle, AlertTriangle, Forward, Eye, Search, Filter } from 'lucide-react';
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

interface Claim {
  id: string;
  customer: string;
  email: string;
  type: string;
  amount: string;
  status: 'Pending Review' | 'Missing Docs' | 'Verified' | 'Forwarded';
  date: string;
  description: string;
  documents: { name: string; verified: boolean }[];
}

const assignedClaims: Claim[] = [
  { id: 'CLM-154', customer: 'Mary Muthoni', email: 'mary@email.com', type: 'Disability', amount: 'KSH 180,000', status: 'Pending Review', date: '2024-01-24', description: 'Permanent disability from accident', documents: [{ name: 'medical_report.pdf', verified: false }, { name: 'id_copy.pdf', verified: true }] },
  { id: 'CLM-151', customer: 'David Mutua', email: 'david@email.com', type: 'Disability', amount: 'KSH 200,000', status: 'Pending Review', date: '2024-01-21', description: 'Work-related disability', documents: [{ name: 'medical.pdf', verified: false }, { name: 'employer_letter.pdf', verified: false }] },
  { id: 'CLM-149', customer: 'Lucy Wambui', email: 'lucy@email.com', type: 'Funeral Expenses', amount: 'KSH 300,000', status: 'Missing Docs', date: '2024-01-19', description: 'Funeral expenses for spouse', documents: [{ name: 'death_cert.pdf', verified: true }] },
  { id: 'CLM-147', customer: 'Samuel Otieno', email: 'samuel@email.com', type: 'Loan Guard', amount: 'KSH 450,000', status: 'Verified', date: '2024-01-17', description: 'Outstanding home loan', documents: [{ name: 'loan_statement.pdf', verified: true }, { name: 'death_cert.pdf', verified: true }] },
  { id: 'CLM-145', customer: 'Faith Njeri', email: 'faith@email.com', type: 'Funeral Expenses', amount: 'KSH 180,000', status: 'Verified', date: '2024-01-15', description: 'Burial expenses', documents: [{ name: 'death_cert.pdf', verified: true }, { name: 'receipts.pdf', verified: true }] },
];

const officers = [
  { id: 1, name: 'John Processor' },
  { id: 2, name: 'Jane Handler' },
];

const statusColors: Record<string, string> = {
  'Pending Review': 'bg-warning/10 text-warning',
  'Missing Docs': 'bg-destructive/10 text-destructive',
  'Verified': 'bg-success/10 text-success',
  'Forwarded': 'bg-info/10 text-info',
};

const OfficerClaims = () => {
  const [claims, setClaims] = useState(assignedClaims);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const { toast } = useToast();

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch = 
      claim.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarkVerified = (claim: Claim) => {
    setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'Verified' as const } : c));
    toast({
      title: 'Claim Verified',
      description: `Claim ${claim.id} has been marked as verified.`,
    });
  };

  const handleMarkMissingDocs = (claim: Claim) => {
    setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'Missing Docs' as const } : c));
    toast({
      title: 'Missing Documents',
      description: `Claim ${claim.id} marked as missing documents. Customer will be notified.`,
      variant: 'destructive',
    });
  };

  const handleForward = () => {
    if (!selectedOfficer || !selectedClaim) return;
    
    setClaims(claims.map(c => c.id === selectedClaim.id ? { ...c, status: 'Forwarded' as const } : c));
    toast({
      title: 'Claim Forwarded',
      description: `Claim ${selectedClaim.id} has been forwarded to ${officers.find(o => o.id.toString() === selectedOfficer)?.name}.`,
    });
    setIsForwardDialogOpen(false);
    setSelectedOfficer('');
  };

  return (
    <AdminLayout role="officer">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Claims Processing</h1>
          <p className="text-muted-foreground">Verify documents and process assigned claims</p>
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
          {filteredClaims.map((claim) => (
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
                      
                      {/* Documents */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {claim.documents.map((doc) => (
                          <span
                            key={doc.name}
                            className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 ${
                              doc.verified ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <FileText className="h-3 w-3" />
                            {doc.name}
                            {doc.verified && <CheckCircle className="h-3 w-3" />}
                          </span>
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
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{doc.name}</span>
                      </div>
                      <span className={`text-xs ${doc.verified ? 'text-success' : 'text-muted-foreground'}`}>
                        {doc.verified ? '✓ Verified' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
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
                  <SelectItem key={officer.id} value={officer.id.toString()}>
                    {officer.name}
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
