import { useEffect, useState } from 'react';
import { Plus, Loader2, UploadCloud, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';

// ✅ FIXED WORKER (Vite compatible)
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/* ------------------ CLAIM RULES ------------------ */
const CLAIM_RULES: any = {
  'permanent disability': {
    required: ['ID Front', 'ID Back', 'Disability Certificate'],
    optional: ['Passport'],
  },
  'funeral expense': {
    required: ['ID Front', 'ID Back', 'Burial Permit or Death Certificate'],
  },
  'loan emergency': {
    required: ['ID Front', 'ID Back', 'Loan Statement or Application Form'],
  },
};

/* ------------------ PDF → IMAGE ------------------ */
const convertPdfToImage = async (file: File, onProgress: any) => {
  try {
    onProgress(10);

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
    }).promise;

    onProgress(40);

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    onProgress(80);

    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        onProgress(100); // ✅ always completes
        resolve(
          new File([blob!], file.name.replace('.pdf', '.png'), {
            type: 'image/png',
          })
        );
      });
    });
  } catch (err) {
    onProgress(0);
    throw err;
  }
};

/* ------------------ COMPONENT ------------------ */
const CustomerClaims = () => {
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);

  const [covers, setCovers] = useState<any[]>([]);
  const [selectedCover, setSelectedCover] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);

  const [files, setFiles] = useState<Record<string, File>>({});

  /* ------------------ LOAD COVERS ------------------ */
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('payments')
        .select('*, covers(*)')
        .eq('user_id', user.id)
        .eq('payment_status', 'completed');

      setCovers(data || []);
    };

    load();
  }, []);

  /* ------------------ VALIDATE COVER ↔ REASON ------------------ */
  const isValidReason = () => {
    if (!selectedCover || !reason) return false;

    const coverName = selectedCover.covers?.cover_name?.toLowerCase();

    return coverName?.includes(reason.split(' ')[0]);
  };

  /* ------------------ CALCULATE ------------------ */
  const calculateClaim = () => {
    if (!selectedCover || !reason) {
      return toast({ title: 'Complete all fields', variant: 'destructive' });
    }

    if (!isValidReason()) {
      return toast({
        title: 'Invalid claim',
        description: 'This claim does not match your cover',
        variant: 'destructive',
      });
    }

    setLoadingCalc(true);
    setStep(1);

    setTimeout(() => {
      const amountPaid = selectedCover.amount_paid || 0;
      setCalculatedAmount(amountPaid * 0.75);

      setLoadingCalc(false);
      setStep(2);
    }, 2000);
  };

  /* ------------------ HANDLE FILE ------------------ */
  const handleFile = async (doc: string, file: File) => {
    if (file.type === 'application/pdf') {
      setConverting(true);
      setProgress(0);

      const converted = await convertPdfToImage(file, setProgress);

      setConverting(false);
      setFiles((prev) => ({ ...prev, [doc]: converted }));
    } else {
      setFiles((prev) => ({ ...prev, [doc]: file }));
    }
  };

  /* ------------------ VALIDATE DOCS ------------------ */
  const validateDocs = () => {
    const rules = CLAIM_RULES[reason];
    if (!rules) return false;

    for (const req of rules.required) {
      if (!files[req]) {
        toast({ title: `${req} is required`, variant: 'destructive' });
        return false;
      }
    }

    // ✅ minimum 3 docs enforced
    if (Object.keys(files).length < 3) {
      toast({
        title: 'Minimum 3 documents required',
        description: 'Upload ID front, ID back and a supporting document',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  /* ------------------ OCR VERIFY ------------------ */
const verifyDocuments = async () => {
if (!validateDocs()) return false;

setVerifying(true);

try {
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error("User not authenticated");


let uploadedUrls: string[] = [];

// 🔥 Upload FIRST to Supabase Storage
for (const key of Object.keys(files)) {
  const file = files[key];
  const path = `${user.id}/verification/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase
    .storage
    .from('claim-documents')
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data } = supabase
    .storage
    .from('claim-documents')
    .getPublicUrl(path);

  uploadedUrls.push(data.publicUrl);
}

console.log("UPLOADED URLS:", uploadedUrls);

// 🔥 Send ONLY URLs to API
const res = await fetch('/api/verify-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageUrls: uploadedUrls }),
});

const result = await res.json();

console.log("VERIFY RESPONSE:", result);

if (!result.success) {
  throw new Error(result.error || 'Verification failed');
}

setVerifying(false);
return true;


} catch (err: any) {
setVerifying(false);


toast({
  title: 'Verification failed',
  description: err.message || 'Unknown error',
  variant: 'destructive',
});

return false;


}
};


  /* ------------------ SUBMIT ------------------ */
  const submitClaim = async () => {
    const ok = await verifyDocuments();
    if (!ok) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let urls: string[] = [];

    for (const key of Object.keys(files)) {
      const file = files[key];
      const path = `${user.id}/${Date.now()}-${file.name}`;

      await supabase.storage.from('claim-documents').upload(path, file);
      const { data } = supabase.storage.from('claim-documents').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    const claimNumber = `CLM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await supabase.from('claims').insert({
      user_id: user.id,
      claim_number: claimNumber,
      claim_amount: calculatedAmount,
      claim_reason: reason,
      document_url: urls[0],
      documents: urls,
    });

    toast({ title: 'Claim submitted 🎉' });

    setStep(0);
    setFiles({});
  };

  /* ------------------ UI ------------------ */
  return (
    <DashboardLayout>
      <div className="space-y-6">

        <div className="flex justify-between">
          <h1 className="text-2xl font-bold">Claims</h1>
          <Button onClick={() => setStep(0)}>
            <Plus className="mr-2" /> New Claim
          </Button>
        </div>

        {/* STEP 0 */}
        {step === 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">

              <Select onValueChange={(val) => {
                const cover = covers.find(c => c.id === val);
                setSelectedCover(cover);
              }}>
                <SelectTrigger><SelectValue placeholder="Select Cover" /></SelectTrigger>
                <SelectContent>
                  {covers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.covers?.cover_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Claim Reason" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(CLAIM_RULES).map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={calculateClaim} className="w-full">
                Calculate Claim
              </Button>

            </CardContent>
          </Card>
        )}

        {/* LOADING */}
        {loadingCalc && (
          <div className="flex flex-col items-center py-20">
            <Loader2 className="animate-spin h-10 w-10" />
            <p>Calculating...</p>
          </div>
        )}

        {/* CONVERTING */}
        {converting && (
          <div className="p-6 text-center space-y-3">
            <p className="font-medium">Converting PDF to image...</p>

            <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-sm text-gray-500">{progress}%</p>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-6">

              <div className="text-center">
                <h2>You qualify for</h2>
                <p className="text-3xl font-bold">
                  KSH {calculatedAmount?.toLocaleString()}
                </p>
              </div>

              <div className="space-y-4">
                <p className="font-medium text-lg">Upload Required Documents</p>

                <div className="bg-blue-50 border rounded p-4 text-sm">
                  <p className="font-semibold mb-2">Required:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    {CLAIM_RULES[reason]?.required.map((doc: string) => (
                      <li key={doc}>{doc}</li>
                    ))}
                  </ul>

                  <p className="mt-3 text-gray-600">
                    Minimum 3 uploads required (Front ID, Back ID + Supporting document)
                  </p>
                </div>

                {CLAIM_RULES[reason]?.required.map((doc: string) => (
                  <div key={doc} className="border p-3 rounded flex items-center justify-between">
                    <span>{doc}</span>

                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        handleFile(doc, file);
                      }}
                    />

                    {files[doc] && (
                      <CheckCircle className="text-green-500 ml-2" />
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={submitClaim} className="w-full">
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2" />
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