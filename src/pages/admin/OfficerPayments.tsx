import { useState } from 'react';
import { CreditCard, CheckCircle, Send, User, Phone, FileText } from 'lucide-react';
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

interface ApprovedClaim {
  id: string;
  customer: string;
  phone: string;
  type: string;
  amount: string;
  approvedDate: string;
  paymentStatus: 'Pending' | 'Processing' | 'Completed';
}

const approvedClaims: ApprovedClaim[] = [
  { id: 'CLM-147', customer: 'Samuel Otieno', phone: '0712345678', type: 'Loan Guard', amount: 'KSH 450,000', approvedDate: '2024-01-25', paymentStatus: 'Pending' },
  { id: 'CLM-145', customer: 'Faith Njeri', phone: '0723456789', type: 'Funeral Expenses', amount: 'KSH 180,000', approvedDate: '2024-01-24', paymentStatus: 'Pending' },
  { id: 'CLM-140', customer: 'James Odhiambo', phone: '0734567890', type: 'Loan Guard', amount: 'KSH 500,000', approvedDate: '2024-01-20', paymentStatus: 'Completed' },
  { id: 'CLM-138', customer: 'Alice Wanjiku', phone: '0745678901', type: 'Funeral Expenses', amount: 'KSH 250,000', approvedDate: '2024-01-18', paymentStatus: 'Completed' },
];

const paymentStatusColors: Record<string, string> = {
  Pending: 'bg-warning/10 text-warning',
  Processing: 'bg-info/10 text-info',
  Completed: 'bg-success/10 text-success',
};

const OfficerPayments = () => {
  const [claims, setClaims] = useState(approvedClaims);
  const [selectedClaim, setSelectedClaim] = useState<ApprovedClaim | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const { toast } = useToast();

  const handleProcessPayment = () => {
    if (!selectedClaim) return;

    setClaims(claims.map(c => 
      c.id === selectedClaim.id ? { ...c, paymentStatus: 'Completed' as const } : c
    ));

    toast({
      title: 'Payment Processed',
      description: `B2C payment of ${selectedClaim.amount} sent to ${phoneNumber || selectedClaim.phone}.`,
    });

    setIsPaymentDialogOpen(false);
    setPhoneNumber('');
  };

  const pendingPayments = claims.filter(c => c.paymentStatus === 'Pending').length;
  const completedPayments = claims.filter(c => c.paymentStatus === 'Completed').length;
  const totalPaid = claims
    .filter(c => c.paymentStatus === 'Completed')
    .reduce((sum, c) => sum + parseInt(c.amount.replace(/[^0-9]/g, '')), 0);

  return (
    <AdminLayout role="officer">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">B2C Payments</h1>
          <p className="text-muted-foreground">Process payments for approved claims</p>
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
                  <p className="text-2xl font-bold">{pendingPayments}</p>
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
                  <p className="text-2xl font-bold">{completedPayments}</p>
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
                  <p className="text-2xl font-bold">KSH {totalPaid.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Approved Claims - Ready for Payment</CardTitle>
            <CardDescription>Process B2C payments for verified and approved claims</CardDescription>
          </CardHeader>
          <CardContent>
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
                          <span className="font-medium">{claim.id}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {claim.customer}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {claim.phone}
                        </div>
                      </td>
                      <td className="py-4 px-4">{claim.type}</td>
                      <td className="py-4 px-4 font-semibold text-primary">{claim.amount}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStatusColors[claim.paymentStatus]}`}>
                          {claim.paymentStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {claim.paymentStatus === 'Pending' ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setPhoneNumber(claim.phone);
                              setIsPaymentDialogOpen(true);
                            }}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        ) : (
                          <span className="text-sm text-success flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Confirmation Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process B2C Payment</DialogTitle>
            <DialogDescription>
              Confirm payment details for claim {selectedClaim?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedClaim.customer}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Claim Type</p>
                    <p className="font-medium">{selectedClaim.type}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-muted-foreground text-sm">Payment Amount</p>
                  <p className="text-2xl font-bold text-primary">{selectedClaim.amount}</p>
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
                <Button variant="outline" className="flex-1" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleProcessPayment}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Payment
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
