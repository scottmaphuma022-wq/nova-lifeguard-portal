import { useEffect, useState } from 'react';
import { Plus, Loader2, UploadCloud, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';

/* ------------------ helpers ------------------ */
const CLAIM_REASONS = [
  'permanent disability',
  'funeral expense',
  'loan emergency',
];

const REQUIRED_DOCS: Record<string, string[]> = {
  'permanent disability': ['ID Front', 'ID Back', 'Disability Certificate'],
  'funeral expense': ['ID Front', 'ID Back', 'Death Certificate', 'Burial Permit'],
  'loan emergency': ['ID Front', 'ID Back', 'Loan Statement'],
};

/* ------------------ component ------------------ */
const CustomerClaims = () => {
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [covers, setCovers] = useState<any[]>([]);
  const [selectedCover, setSelectedCover] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [reason, setReason] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);

  const [files, setFiles] = useState<Record<string, File>>({});

  /* ------------------ load paid covers ------------------ */
  useEffect(() => {
    const loadPayments = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('payments')
        .select('*, covers(*)')
        .eq('user_id', user.id)
        .eq('payment_status', 'completed');

      setCovers(data || []);
    };

    loadPayments();
  }, []);

  /* ------------------ calculate claim ------------------ */
  const calculateClaim = async () => {
    if (!selectedCover || !selectedPlan || !reason) {
      toast({ title: 'Complete all fields', variant: 'destructive' });
      return;
    }

    setLoadingCalc(true);
    setStep(1);

    setTimeout(() => {
      const payment = covers.find((c) => c.id === selectedCover);
      const amountPaid = payment?.amount_paid || 0;

      const award = amountPaid * 0.75;
      setCalculatedAmount(award);

      setLoadingCalc(false);
      setStep(2);
    }, 3000);
  };

  /* ------------------ OCR VERIFY ------------------ */
  const verifyDocuments = async () => {
    setVerifying(true);

    try {
      for (const key of Object.keys(files)) {
        const file = files[key];

        const formData = new FormData();
formData.append('file', file);

const res = await fetch('/api/verify-document', {
  method: 'POST',
  body: formData,
});

        const result = await res.json();

        if (!result.success) {
          throw new Error(`Failed verifying ${key}`);
        }
      }

      setVerifying(false);
      return true;
    } catch (err) {
      console.error(err);
      setVerifying(false);
      toast({ title: 'Document verification failed', variant: 'destructive' });
      return false;
    }
  };

  /* ------------------ SUBMIT CLAIM ------------------ */
  const submitClaim = async () => {
    const valid = await verifyDocuments();
    if (!valid) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // upload files
    let uploadedUrls: string[] = [];

    for (const key of Object.keys(files)) {
      const file = files[key];
      const filePath = `${user.id}/${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from('claim-documents')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('claim-documents')
        .getPublicUrl(filePath);

      uploadedUrls.push(data.publicUrl);
    }

    const claimNumber = `CLM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await supabase.from('claims').insert({
      user_id: user.id,
      claim_number: claimNumber,
      claim_amount: calculatedAmount,
      claim_reason: reason,
      document_url: uploadedUrls[0],
      documents: uploadedUrls,
    });

    toast({ title: 'Claim submitted successfully 🎉' });

    setStep(0);
    setCalculatedAmount(null);
    setFiles({});
  };

  /* ------------------ UI ------------------ */
  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* HEADER */}
        <div className="flex justify-between">
          <div>
            <h1 className="text-2xl font-bold">Claims</h1>
            <p className="text-muted-foreground">Smart claim submission</p>
          </div>

          <Button onClick={() => setStep(0)}>
            <Plus className="mr-2 h-4 w-4" />
            New Claim
          </Button>
        </div>

        {/* STEP 0: SELECT */}
        {step === 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">

              <Select onValueChange={setSelectedCover}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Cover" />
                </SelectTrigger>
                <SelectContent>
                  {covers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.covers?.cover_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Plan Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>

              <Select onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Claim Reason" />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={calculateClaim} className="w-full">
                Calculate Claim
              </Button>

            </CardContent>
          </Card>
        )}

        {/* STEP 1: LOADING */}
        {loadingCalc && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin h-10 w-10 text-primary" />
            <p className="mt-4 text-muted-foreground">Calculating your benefit...</p>
          </div>
        )}

        {/* STEP 2: RESULT + DOCS */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-6">

              <div className="text-center">
                <h2 className="text-xl font-bold">You qualify for</h2>
                <p className="text-3xl font-bold text-primary">
                  KSH {calculatedAmount?.toLocaleString()}
                </p>
              </div>

              <div className="space-y-4">
                <p className="font-medium">Upload Required Documents</p>

                {REQUIRED_DOCS[reason]?.map((doc) => (
                  <input
                    key={doc}
                    type="file"
                    onChange={(e) =>
                      setFiles((prev) => ({
                        ...prev,
                        [doc]: e.target.files?.[0],
                      }))
                    }
                  />
                ))}
              </div>

              <Button onClick={submitClaim} className="w-full">
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Verifying Documents...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Submit Claim
                  </>
                )}
              </Button>

            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
};

export default CustomerClaims;