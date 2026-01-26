import { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Calendar,
  Banknote,
  Link as LinkIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';

/* ------------------ types ------------------ */
interface Claim {
  id: string;
  amount: string;
  status: 'Submitted' | 'Pending' | 'Approved' | 'Rejected';
  date: string;
  reason: string;
  documentUrl: string;
}

/* ------------------ status config ------------------ */
const statusConfig = {
  Submitted: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
  Pending: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  Approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  Rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
};

const formatCurrency = (amount: number) => `KSH ${amount.toLocaleString()}`;

const mapStatus = (status: string): Claim['status'] => {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'pending') return 'Pending';
  return 'Submitted';
};

/* ------------------ component ------------------ */
const CustomerClaims = () => {
  const { toast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  /* ------------------ load claims ------------------ */
  useEffect(() => {
    const loadClaims = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('user_id', user.id)
        .order('date_applied', { ascending: false });

      if (error) {
        toast({ title: 'Failed to load claims', variant: 'destructive' });
        console.error('Load Claims Error:', error);
        return;
      }

      setClaims(
        (data || []).map((c) => ({
          id: c.claim_number,
          amount: formatCurrency(Number(c.claim_amount)),
          status: mapStatus(c.claim_status),
          date: new Date(c.date_applied).toISOString().split('T')[0],
          reason: c.claim_reason,
          documentUrl: c.document_url,
        }))
      );
    };

    loadClaims();
  }, [toast]);

  /* ------------------ submit claim ------------------ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'You must be logged in', variant: 'destructive' });
      return;
    }
    if (!files?.length) {
      toast({ title: 'Please select a file', variant: 'destructive' });
      return;
    }

    const file = files[0];

    // ---------------- strictly sanitize file name ----------------
    const safeFileName = file.name
      .normalize("NFKD")            // normalize unicode
      .replace(/[^\w.-]/g, "_");    // only letters, numbers, _, ., -

    const filePath = `${user.id}/${Date.now()}-${safeFileName}`;

    // ---------------- upload to Supabase ----------------
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('claim-documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      toast({ title: 'File upload failed', variant: 'destructive' });
      console.error('Upload Error:', uploadError);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('claim-documents')
      .getPublicUrl(filePath);

    // ---------------- insert claim into table ----------------
    const claimNumber = `CLM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { error } = await supabase.from('claims').insert({
      user_id: user.id,
      claim_number: claimNumber,
      claim_amount: Number(amount),
      claim_reason: reason,
      document_url: urlData.publicUrl,
    });

    if (error) {
      toast({ title: 'Failed to submit claim', variant: 'destructive' });
      console.error('Insert Claim Error:', error);
      return;
    }

    toast({ title: 'Claim submitted', description: 'Your claim has been successfully submitted.' });
    setIsDialogOpen(false);
    setAmount('');
    setReason('');
    setFiles(null);

    // reload claims
    const { data: newClaims } = await supabase
      .from('claims')
      .select('*')
      .eq('user_id', user.id)
      .order('date_applied', { ascending: false });

    setClaims(
      (newClaims || []).map((c) => ({
        id: c.claim_number,
        amount: formatCurrency(Number(c.claim_amount)),
        status: mapStatus(c.claim_status),
        date: new Date(c.date_applied).toISOString().split('T')[0],
        reason: c.claim_reason,
        documentUrl: c.document_url,
      }))
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Claims</h1>
            <p className="text-muted-foreground">Submit and track your insurance claims</p>
          </div>

          {/* New Claim Modal */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Claim</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit New Claim</DialogTitle>
                <DialogDescription>Provide claim amount, reason, and supporting documents.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Claim Amount</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>

                <div>
                  <Label>Reason for Claim</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required />
                </div>

                <div>
                  <Label>Supporting Document</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles(e.target.files)} required />
                </div>

                <Button type="submit" className="w-full">Submit Claim</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Claims List */}
        <div className="space-y-4">
          {claims.map((claim) => {
            const status = statusConfig[claim.status];
            const StatusIcon = status.icon;

            return (
              <Card key={claim.id} className="shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${status.bg} ${status.color}`}>
                          <StatusIcon className="h-4 w-4 mr-1" />
                          {claim.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{claim.id}</span>
                      </div>
                      <p className="text-sm">{claim.reason}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{claim.date}</span>
                        <span className="flex items-center gap-1"><Banknote className="h-4 w-4" />{claim.amount}</span>
                        <a href={claim.documentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <LinkIcon className="h-4 w-4" />Document
                        </a>
                      </div>
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
