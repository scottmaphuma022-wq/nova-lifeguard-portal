import { useEffect, useState } from 'react';
import { Plus, Loader2, UploadCloud, CheckCircle, FileText, Clock, XCircle, ChevronRight, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';
import { Input } from '@/components/ui/input';

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

const statusColors: Record<string, string> = {
  approved: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  'under review': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  paid: 'bg-success/10 text-success border-success/20',
};

const StatusIcon = ({ status }: { status: string }) => {
  const s = status?.toLowerCase();
  if (s === 'approved' || s === 'paid') return <CheckCircle className="w-4 h-4 text-success" />;
  if (s === 'rejected') return <XCircle className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-warning" />;
};

const getCleanCoverName = (type: string) => {
  if (type === 'funeral') return 'Funeral Expenses Cover';
  if (type === 'loan') return 'Loan Guard Cover';
  if (type === 'disability') return 'Permanent Disability Cover';
  return type ? type.replace(/_/g, ' ').toUpperCase() : 'Insurance Cover';
};


/* ------------------ PDF → IMAGE ------------------ */
const convertPdfToImage = async (file: File, onProgress: any) => {
  try {
    onProgress(10);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false }).promise;
    onProgress(40);
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    onProgress(80);
    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        onProgress(100);
        resolve(new File([blob!], file.name.replace('.pdf', '.png'), { type: 'image/png' }));
      });
    });
  } catch (err) {
    onProgress(0);
    throw err;
  }
};

/* ─────────────────── COMPONENT ─────────────────── */
const CustomerClaims = () => {
  const { toast } = useToast();

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');

  // ── Existing claims ──
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Tracking modal ──
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [viewingClaim, setViewingClaim] = useState<any>(null);

  // ── New claim form ──
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

  /* ── Load existing claims ── */
  const loadClaims = async () => {
    setClaimsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setClaimsLoading(false);

    const { data } = await supabase
      .from('claims')
      .select('id, claim_number, claim_amount, claim_status, claim_reason, date_applied')
      .eq('user_id', user.id)
      .order('date_applied', { ascending: false });

    // Demo fallback if no real claims
    if (!data || data.length === 0) {
      setClaims([
        { id: 'demo-1', claim_number: 'CLM-2024-0003', claim_reason: 'Funeral Expenses', claim_amount: 50000, claim_status: 'pending', date_applied: '2024-05-10' },
        { id: 'demo-2', claim_number: 'CLM-2024-0002', claim_reason: 'Loan Guard Policy', claim_amount: 120000, claim_status: 'approved', date_applied: '2024-04-20' },
        { id: 'demo-3', claim_number: 'CLM-2024-0001', claim_reason: 'Permanent Disability', claim_amount: 250000, claim_status: 'paid', date_applied: '2024-02-15' },
      ]);
    } else {
      setClaims(data);
    }
    setClaimsLoading(false);
  };

  /* ── Load covers ── */
  const loadCovers = async () => {
    const { data } = await supabase.from('covers').select('*');
    if (data) {
      const unique = data.reduce((acc: any[], curr) => {
        if (!acc.find((item: any) => item.cover_type === curr.cover_type)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      setCovers(unique);
    } else {
      setCovers([]);
    }
  };

  useEffect(() => {
    loadClaims();
    loadCovers();
  }, []);

  const filteredClaims = claims.filter((c) => {
    const matchSearch =
      c.claim_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claim_reason?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterStatus === 'all' || c.claim_status === filterStatus;
    return matchSearch && matchFilter;
  });

  /* ── Calculate ── */
  const isValidReason = () => {
    if (!selectedCover || !reason) return false;
    return selectedCover.cover_name?.toLowerCase().includes(reason.split(' ')[0]);
  };

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
      setCalculatedAmount((selectedCover.price || 50000) * 0.75);
      setLoadingCalc(false);
      setStep(2);
    }, 2000);
  };

  /* ── File handling ── */
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



  const submitClaim = async () => {
    // ── Local validation ──
    const rules = CLAIM_RULES[reason];
    if (!rules) return;

    for (const req of rules.required) {
      if (!files[req]) {
        toast({ title: `Missing document: ${req}`, variant: 'destructive' });
        return;
      }
    }

    if (Object.keys(files).length < 2) {
      toast({
        title: 'Upload at least 2 documents',
        description: 'ID front + supporting document are required',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please log in again');

      // ── Upload all files to Supabase Storage in one pass ──
      const urls: string[] = [];
      const timestamp = Date.now();

      for (const [docName, file] of Object.entries(files)) {
        const safeName = docName.replace(/\s+/g, '_');
        const path = `${user.id}/claims/${timestamp}-${safeName}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('claim-documents')
          .upload(path, file, { upsert: true });

        if (uploadError) throw new Error(`Failed to upload ${docName}: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from('claim-documents')
          .getPublicUrl(path);

        urls.push(urlData.publicUrl);
      }

      // ── Get claims officers for assignment ──
      let assignedOfficerId = null;
      try {
        const { data: officersData } = await supabase
          .from('userprofile')
          .select('id')
          .eq('role', 'claims_officer');
          
        if (officersData && officersData.length > 0) {
          const randomIndex = Math.floor(Math.random() * officersData.length);
          assignedOfficerId = officersData[randomIndex].id;
        }
      } catch (err) {
        console.error('Failed to fetch claims officers for auto-assignment:', err);
      }

      // ── Insert claim record ──
      const claimNumber = `CLM-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { error: insertError } = await supabase.from('claims').insert({
        user_id: user.id,
        claim_number: claimNumber,
        claim_amount: calculatedAmount,
        claim_reason: reason,
        claim_status: 'pending',
        document_url: urls[0] ?? null,
        documents: urls,
        date_applied: new Date().toISOString(),
        officer_id: assignedOfficerId,
      });

      if (insertError) throw new Error(`Failed to save claim: ${insertError.message}`);

      toast({
        title: 'Claim submitted successfully 🎉',
        description: `Your claim ${claimNumber} is now under review.`,
      });

      // Reset form and refresh list
      setStep(0);
      setFiles({});
      setSelectedCover(null);
      setReason('');
      setCalculatedAmount(null);
      setActiveTab('list');
      await loadClaims();

    } catch (err: any) {
      toast({
        title: 'Submission failed',
        description: err.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };


  /* ─────────────── UI ─────────────── */
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Claims</h1>
            <p className="text-muted-foreground text-sm mt-0.5">View and manage your insurance claims</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit border border-border/50">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'list'
                ? 'bg-white shadow-sm text-foreground border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            My Claims
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'new'
                ? 'bg-white shadow-sm text-foreground border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            New Claim
          </button>
        </div>

        {/* ─────── MY CLAIMS TAB ─────── */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by claim ID or type..."
                  className="pl-9 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-44 h-9">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="under review">Under Review</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {claimsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
              </div>
            ) : filteredClaims.length === 0 ? (
              <Card className="shadow-sm border-border/50">
                <CardContent className="py-16 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">No claims found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {searchQuery || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Submit your first claim to get started'}
                  </p>
                  <Button
                    className="mt-4 bg-primary hover:bg-primary/90"
                    size="sm"
                    onClick={() => setActiveTab('new')}
                  >
                    <Plus className="w-4 h-4 mr-1" /> File a Claim
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm border-border/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground bg-muted/50 border-y border-border/50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-left">Claim ID</th>
                        <th className="px-4 py-3 font-medium text-left">Type</th>
                        <th className="px-4 py-3 font-medium text-left">Date Filed</th>
                        <th className="px-4 py-3 font-medium text-left">Amount</th>
                        <th className="px-4 py-3 font-medium text-left">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClaims.map((claim, i) => (
                        <tr key={claim.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-primary">{claim.claim_number}</td>
                          <td className="px-4 py-3.5 capitalize">{claim.claim_reason}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            {new Date(claim.date_applied).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3.5 font-medium">
                            KES {Number(claim.claim_amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <StatusIcon status={claim.claim_status} />
                              <Badge
                                variant="outline"
                                className={`capitalize text-xs ${statusColors[claim.claim_status?.toLowerCase()] || ''}`}
                              >
                                {claim.claim_status === 'pending' ? 'Pending Docs' : claim.claim_status}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setViewingClaim(claim);
                                setStatusDialogOpen(true);
                              }}
                              className="text-xs text-primary hover:underline font-medium flex items-center ml-auto gap-0.5"
                            >
                              Track Status <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-border/50 text-xs text-muted-foreground">
                  Showing {filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ─────── NEW CLAIM TAB ─────── */}
        {activeTab === 'new' && (
          <div className="space-y-4">

            {/* STEP 0 — Select Cover & Reason */}
            {step === 0 && (
              <Card className="shadow-sm border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Step 1: Claim Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select onValueChange={(val) => {
                    const cover = covers.find(c => c.id.toString() === val);
                    setSelectedCover(cover);
                  }}>
                    <SelectTrigger id="cover-select"><SelectValue placeholder="Select your cover" /></SelectTrigger>
                    <SelectContent>
                      {covers.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {getCleanCoverName(c.cover_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select onValueChange={setReason}>
                    <SelectTrigger id="reason-select"><SelectValue placeholder="Claim reason" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(CLAIM_RULES).map(r => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button id="calculate-claim-btn" onClick={calculateClaim} className="w-full bg-primary hover:bg-primary/90">
                    Calculate Eligible Amount
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Loading */}
            {loadingCalc && (
              <div className="flex flex-col items-center py-16 gap-3">
                <Loader2 className="animate-spin h-10 w-10 text-primary" />
                <p className="text-muted-foreground text-sm">Calculating your eligible amount...</p>
              </div>
            )}

            {/* PDF Converting */}
            {converting && (
              <Card className="shadow-sm border-border/50">
                <CardContent className="p-6 text-center space-y-3">
                  <p className="font-medium text-sm">Converting PDF to image...</p>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{progress}%</p>
                </CardContent>
              </Card>
            )}

            {/* STEP 2 — Upload Documents */}
            {step === 2 && (
              <div className="space-y-4">
                <Card className="shadow-sm border-border/50 bg-success/5 border-success/20">
                  <CardContent className="p-5 text-center">
                    <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">You qualify for</p>
                    <p className="text-3xl font-bold mt-1">KES {calculatedAmount?.toLocaleString()}</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Step 2: Upload Required Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200/60 p-4 text-sm">
                      <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1.5">Required Documents:</p>
                      <ul className="space-y-1 text-blue-700 dark:text-blue-400 list-disc ml-4">
                        {CLAIM_RULES[reason]?.required.map((doc: string) => (
                          <li key={doc}>{doc}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        Minimum 3 uploads required (Front ID, Back ID + supporting document)
                      </p>
                    </div>

                    <div className="space-y-2">
                      {CLAIM_RULES[reason]?.required.map((doc: string) => (
                        <div key={doc} className="flex items-center justify-between p-3 border border-border/60 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${files[doc] ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                            <span className="text-sm font-medium">{doc}</span>
                          </div>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                handleFile(doc, file);
                              }}
                            />
                            <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                              files[doc]
                                ? 'bg-success/10 text-success border border-success/30 hover:bg-success/20'
                                : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                            }`}>
                              {files[doc] ? (
                                <><CheckCircle className="w-3 h-3" /> Uploaded</>
                              ) : (
                                <><UploadCloud className="w-3 h-3" /> Upload</>
                              )}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>

                    <Button id="submit-claim-btn" onClick={submitClaim} className="w-full bg-primary hover:bg-primary/90">
                      {verifying ? (
                        <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Verifying & Submitting...</>
                      ) : (
                        <><UploadCloud className="mr-2 w-4 h-4" /> Submit Claim</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Track Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Claim Status Tracker</DialogTitle>
            <DialogDescription>
              Details for claim {viewingClaim?.claim_number}
            </DialogDescription>
          </DialogHeader>
          {viewingClaim && (
            <div className="py-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`mt-1 capitalize text-sm ${statusColors[viewingClaim.claim_status?.toLowerCase()] || ''}`}>
                    {viewingClaim.claim_status === 'pending' ? 'Pending Docs' : viewingClaim.claim_status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg">KES {Number(viewingClaim.claim_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="relative border-l-2 border-muted ml-3 space-y-6">
                <div className="relative">
                  <span className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full ${['pending', 'under review', 'approved', 'paid', 'rejected'].includes(viewingClaim.claim_status) ? 'bg-primary ring-4 ring-background' : 'bg-muted'}`} />
                  <p className="font-medium text-sm pl-4">Claim Submitted</p>
                  <p className="text-xs text-muted-foreground pl-4">{new Date(viewingClaim.date_applied).toLocaleDateString()}</p>
                </div>
                <div className="relative">
                  <span className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full ${['under review', 'approved', 'paid', 'rejected'].includes(viewingClaim.claim_status) ? 'bg-primary ring-4 ring-background' : 'bg-muted'}`} />
                  <p className="font-medium text-sm pl-4">Under Review</p>
                  <p className="text-xs text-muted-foreground pl-4">Our team is verifying documents.</p>
                </div>
                <div className="relative">
                  <span className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full ${['approved', 'paid'].includes(viewingClaim.claim_status) ? 'bg-success ring-4 ring-background' : viewingClaim.claim_status === 'rejected' ? 'bg-destructive ring-4 ring-background' : 'bg-muted'}`} />
                  <p className="font-medium text-sm pl-4">Decision Made</p>
                  <p className="text-xs text-muted-foreground pl-4">{viewingClaim.claim_status === 'rejected' ? 'Claim rejected' : 'Claim approved'}</p>
                </div>
                {['approved', 'paid'].includes(viewingClaim.claim_status) && (
                  <div className="relative">
                    <span className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full ${viewingClaim.claim_status === 'paid' ? 'bg-success ring-4 ring-background' : 'bg-muted'}`} />
                    <p className="font-medium text-sm pl-4">Paid</p>
                    <p className="text-xs text-muted-foreground pl-4">Funds disbursed.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CustomerClaims;