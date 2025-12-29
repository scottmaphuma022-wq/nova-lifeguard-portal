import { useState } from 'react';
import { Plus, FileText, Upload, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';

interface Claim {
  id: string;
  type: string;
  amount: string;
  status: 'Submitted' | 'Pending' | 'Approved' | 'Rejected';
  date: string;
  description: string;
}

const claims: Claim[] = [
  { id: 'CLM-001', type: 'Funeral Expenses', amount: 'KSH 150,000', status: 'Approved', date: '2024-01-15', description: 'Funeral expenses for family member' },
  { id: 'CLM-002', type: 'Loan Guard', amount: 'KSH 200,000', status: 'Pending', date: '2024-01-20', description: 'Outstanding car loan coverage' },
  { id: 'CLM-003', type: 'Disability', amount: 'KSH 100,000', status: 'Submitted', date: '2024-01-22', description: 'Permanent disability claim' },
  { id: 'CLM-004', type: 'Funeral Expenses', amount: 'KSH 80,000', status: 'Rejected', date: '2024-01-10', description: 'Insufficient documentation' },
];

const statusConfig = {
  Submitted: { icon: Clock, color: 'text-info', bg: 'bg-info/10', label: 'Submitted' },
  Pending: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', label: 'Pending Review' },
  Approved: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'Approved' },
  Rejected: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Rejected' },
};

const CustomerClaims = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [claimType, setClaimType] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    toast({
      title: 'Claim Submitted!',
      description: 'Your claim has been submitted successfully. We will review it shortly.',
    });
    
    setIsDialogOpen(false);
    setClaimType('');
    setAmount('');
    setDescription('');
    setFiles(null);
  };

  const getStatusTimeline = (status: Claim['status']) => {
    const steps = ['Submitted', 'Pending', 'Approved'];
    const currentIndex = steps.indexOf(status === 'Rejected' ? 'Pending' : status);
    
    return (
      <div className="flex items-center gap-2 mt-4">
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const isRejected = status === 'Rejected' && step === 'Pending';
          
          return (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  isRejected
                    ? 'bg-destructive text-destructive-foreground'
                    : isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-1 ${
                    index < currentIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Claims</h1>
            <p className="text-muted-foreground">Submit and track your insurance claims</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Claim
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Submit New Claim</DialogTitle>
                <DialogDescription>
                  Fill in the details below to submit a new insurance claim.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="claimType">Claim Type</Label>
                  <Select value={claimType} onValueChange={setClaimType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select claim type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funeral">Funeral Expenses</SelectItem>
                      <SelectItem value="loan">Loan Guard</SelectItem>
                      <SelectItem value="disability">Permanent Disability</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Claim Amount (KSH)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide details about your claim..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documents">Supporting Documents</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                    <Input
                      id="documents"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setFiles(e.target.files)}
                    />
                    <label htmlFor="documents" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {files ? `${files.length} file(s) selected` : 'Click to upload PDF or images'}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Submit Claim
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Claims', value: claims.length, color: 'primary' },
            { label: 'Approved', value: claims.filter(c => c.status === 'Approved').length, color: 'success' },
            { label: 'Pending', value: claims.filter(c => c.status === 'Pending' || c.status === 'Submitted').length, color: 'warning' },
            { label: 'Rejected', value: claims.filter(c => c.status === 'Rejected').length, color: 'destructive' },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Claims List */}
        <div className="space-y-4">
          {claims.map((claim) => {
            const status = statusConfig[claim.status];
            const StatusIcon = status.icon;
            
            return (
              <Card key={claim.id} className="border-0 shadow-card">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center`}>
                        <StatusIcon className={`h-6 w-6 ${status.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{claim.type}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {claim.id} • Submitted on {claim.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{claim.amount}</p>
                      {getStatusTimeline(claim.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomerClaims;
