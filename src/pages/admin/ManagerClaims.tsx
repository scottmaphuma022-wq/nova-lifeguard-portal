import { useState } from 'react';
import { FileText, CheckCircle, XCircle, Forward, Eye, Search, Filter } from 'lucide-react';
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
  status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  date: string;
  description: string;
  documents: string[];
}

const allClaims: Claim[] = [
  { id: 'CLM-156', customer: 'Alice Wanjiku', email: 'alice@email.com', type: 'Funeral Expenses', amount: 'KSH 250,000', status: 'Pending', date: '2024-01-25', description: 'Funeral expenses for parent', documents: ['death_cert.pdf', 'id_copy.pdf'] },
  { id: 'CLM-155', customer: 'James Odhiambo', email: 'james@email.com', type: 'Loan Guard', amount: 'KSH 500,000', status: 'Approved', date: '2024-01-24', description: 'Outstanding mortgage loan', documents: ['loan_statement.pdf'] },
  { id: 'CLM-154', customer: 'Mary Muthoni', email: 'mary@email.com', type: 'Disability', amount: 'KSH 180,000', status: 'Under Review', date: '2024-01-24', description: 'Permanent disability from accident', documents: ['medical_report.pdf', 'id_copy.pdf'] },
  { id: 'CLM-153', customer: 'Peter Kamau', email: 'peter@email.com', type: 'Funeral Expenses', amount: 'KSH 120,000', status: 'Pending', date: '2024-01-23', description: 'Burial expenses', documents: ['death_cert.pdf'] },
  { id: 'CLM-152', customer: 'Grace Akinyi', email: 'grace@email.com', type: 'Loan Guard', amount: 'KSH 350,000', status: 'Rejected', date: '2024-01-22', description: 'Car loan protection', documents: ['loan_docs.pdf'] },
  { id: 'CLM-151', customer: 'David Mutua', email: 'david@email.com', type: 'Disability', amount: 'KSH 200,000', status: 'Pending', date: '2024-01-21', description: 'Work-related disability', documents: ['medical.pdf', 'employer_letter.pdf'] },
];

const officers = [
  { id: 1, name: 'Sarah Claims' },
  { id: 2, name: 'John Processor' },
  { id: 3, name: 'Jane Handler' },
];

const statusColors: Record<string, string> = {
  Approved: 'bg-success/10 text-success',
  Pending: 'bg-warning/10 text-warning',
  'Under Review': 'bg-info/10 text-info',
  Rejected: 'bg-destructive/10 text-destructive',
};

const ManagerClaims = () => {
  const [claims, setClaims] = useState(allClaims);
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

  const handleApprove = (claim: Claim) => {
    setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'Approved' as const } : c));
    toast({
      title: 'Claim Approved',
      description: `Claim ${claim.id} has been approved successfully.`,
    });
  };

  const handleReject = (claim: Claim) => {
    setClaims(claims.map(c => c.id === claim.id ? { ...c, status: 'Rejected' as const } : c));
    toast({
      title: 'Claim Rejected',
      description: `Claim ${claim.id} has been rejected.`,
      variant: 'destructive',
    });
  };

  const handleForward = () => {
    if (!selectedOfficer || !selectedClaim) return;
    
    toast({
      title: 'Claim Forwarded',
      description: `Claim ${selectedClaim.id} has been assigned to ${officers.find(o => o.id.toString() === selectedOfficer)?.name}.`,
    });
    setIsForwardDialogOpen(false);
    setSelectedOfficer('');
  };

  return (
    <AdminLayout role="manager">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Claims Management</h1>
          <p className="text-muted-foreground">Review, approve, or reject customer claims</p>
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
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card className="border-0 shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Claim ID</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.map((claim) => (
                    <tr key={claim.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-4 px-4 font-medium">{claim.id}</td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium">{claim.customer}</p>
                          <p className="text-sm text-muted-foreground">{claim.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">{claim.type}</td>
                      <td className="py-4 px-4 font-semibold">{claim.amount}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[claim.status]}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">{claim.date}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedClaim(claim); setIsViewDialogOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {claim.status === 'Pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-success hover:text-success"
                                onClick={() => handleApprove(claim)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleReject(claim)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setSelectedClaim(claim); setIsForwardDialogOpen(true); }}
                              >
                                <Forward className="h-4 w-4" />
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
          </CardContent>
        </Card>
      </div>

      {/* View Claim Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Claim Details - {selectedClaim?.id}</DialogTitle>
            <DialogDescription>Review the claim information and documents</DialogDescription>
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
                <div className="flex flex-wrap gap-2">
                  {selectedClaim.documents.map((doc) => (
                    <span key={doc} className="px-3 py-1.5 rounded-lg bg-muted text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc}
                    </span>
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
              Assign claim {selectedClaim?.id} to a claims officer for processing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger>
                <SelectValue placeholder="Select claims officer" />
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

export default ManagerClaims;
