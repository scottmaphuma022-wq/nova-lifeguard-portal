import { useState, useEffect, useCallback } from 'react';
import { X, ShieldCheck, FileText, Camera, CheckCircle2, XCircle, Clock, Loader2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type VerificationStep = 'intro' | 'verifying' | 'result';
type VerificationStatus = 'Approved' | 'Declined' | 'Resubmission_Required' | 'In_Progress' | null;

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

/* ─── Helper: call backend ──────────────────────────────────────────────────── */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

async function createDiditSession(userId: string): Promise<{ sessionId: string; verificationUrl: string }> {
  const res = await fetch(`${BACKEND_URL}/api/didit-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create verification session');
  }
  return res.json();
}

async function pollDiditSession(sessionId: string): Promise<{ status: VerificationStatus }> {
  const res = await fetch(`${BACKEND_URL}/api/didit-session?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Failed to check session status');
  const data = await res.json();
  // Didit returns { decision: { status: 'Approved' | 'Declined' | ... } }
  return { status: data?.decision?.status ?? data?.status ?? null };
}

/* ─── Component ─────────────────────────────────────────────────────────────── */
const DiditVerificationModal = ({ open, onClose, onVerified }: Props) => {
  const [step, setStep] = useState<VerificationStep>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('intro');
        setSessionId(null);
        setVerificationUrl(null);
        setStatus(null);
        setError(null);
        setIframeLoaded(false);
        setLoading(false);
      }, 300);
    }
  }, [open]);

  // Poll for session status while on verifying step
  useEffect(() => {
    if (step !== 'verifying' || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const result = await pollDiditSession(sessionId);
        if (result.status && result.status !== 'In_Progress') {
          clearInterval(interval);
          setStatus(result.status);

          // Update Supabase
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const kycStatus = result.status === 'Approved' ? 'approved'
              : result.status === 'Declined' ? 'declined'
              : result.status === 'Resubmission_Required' ? 'resubmission_required'
              : 'under_review';

            await supabase.from('userprofile').update({
              kyc_status: kycStatus,
              kyc_session_id: sessionId,
              ...(kycStatus === 'approved' ? { kyc_verified_at: new Date().toISOString() } : {}),
            }).eq('id', user.id);
          }

          setStep('result');
          if (result.status === 'Approved') onVerified?.();
        }
      } catch {
        // Silently ignore polling errors, keep trying
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [step, sessionId, onVerified]);

  const handleStartVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to verify your identity.');

      const { sessionId: sid, verificationUrl: url } = await createDiditSession(user.id);
      setSessionId(sid);
      setVerificationUrl(url);

      // Save pending session to Supabase immediately
      await supabase.from('userprofile').update({
        kyc_status: 'pending',
        kyc_session_id: sid,
      }).eq('id', user.id);

      setStep('verifying');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={step !== 'verifying' ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
          style={{ maxHeight: step === 'verifying' ? '90vh' : 'auto', minHeight: step === 'verifying' ? '70vh' : 'auto' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="didit-modal-title"
        >
          {/* Header */}
          <div className="relative flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 id="didit-modal-title" className="font-semibold text-sm text-foreground">
                  Identity Verification
                </h2>
                <p className="text-xs text-muted-foreground">Powered by Didit KYC</p>
              </div>
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mr-8">
              {(['intro', 'verifying', 'result'] as VerificationStep[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? 'w-6 bg-primary' : step === 'result' || (step === 'verifying' && i === 0) ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto">

            {/* ── Step 1: Intro ─────────────────────────────────────────────── */}
            {step === 'intro' && (
              <div className="p-8 flex flex-col items-center text-center gap-6">
                {/* Hero */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-12 h-12 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                </div>

                <div className="max-w-md">
                  <h3 className="text-xl font-bold text-foreground mb-2">Verify Your Identity</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    To process claims and ensure your security, we need to verify your identity using a government-issued ID and a quick face scan.
                  </p>
                </div>

                {/* Steps */}
                <div className="w-full max-w-sm space-y-3 text-left">
                  {[
                    { icon: FileText, label: 'National ID or Passport', desc: 'Front and back if applicable', color: 'text-primary bg-primary/10' },
                    { icon: Camera, label: 'Face Verification', desc: 'A quick selfie to match your ID', color: 'text-success bg-success/10' },
                    { icon: ShieldCheck, label: 'Instant Decision', desc: 'Usually approved in seconds', color: 'text-warning bg-warning/10' },
                  ].map(({ icon: Icon, label, desc, color }) => (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="w-full max-w-sm flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-left">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="w-full max-w-sm flex flex-col gap-2">
                  <Button
                    id="didit-start-btn"
                    className="w-full bg-primary hover:bg-primary/90 h-11 font-semibold text-sm gap-2"
                    onClick={handleStartVerification}
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Setting up verification…</>
                    ) : (
                      <><ShieldCheck className="w-4 h-4" /> Start Verification <ArrowRight className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Your data is encrypted and processed securely by Didit. <br />
                    We never store your ID images.
                  </p>
                </div>
              </div>
            )}

            {/* ── Step 2: Embedded Didit Verification ───────────────────────── */}
            {step === 'verifying' && (
              <div className="relative flex flex-col h-full" style={{ minHeight: '60vh' }}>
                {/* Loading skeleton */}
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card z-10">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Loading verification…</p>
                      <p className="text-xs text-muted-foreground mt-1">Please allow camera access when prompted</p>
                    </div>
                    {/* Skeleton lines */}
                    <div className="w-64 space-y-2 mt-2">
                      <div className="h-2 bg-muted rounded-full animate-pulse" />
                      <div className="h-2 bg-muted rounded-full animate-pulse w-4/5 mx-auto" />
                    </div>
                  </div>
                )}

                {/* Didit iframe */}
                {verificationUrl && (
                  <iframe
                    id="didit-verification-iframe"
                    src={verificationUrl}
                    className="w-full flex-1 border-0"
                    style={{ minHeight: '60vh' }}
                    allow="camera; microphone; geolocation"
                    onLoad={() => setIframeLoaded(true)}
                    title="Didit Identity Verification"
                  />
                )}

                {/* Bottom bar */}
                <div className="shrink-0 px-6 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    <p className="text-xs text-muted-foreground">Verification in progress — do not close this window</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Monitoring…</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Result ─────────────────────────────────────────────── */}
            {step === 'result' && (
              <div className="p-8 flex flex-col items-center text-center gap-6">
                {status === 'Approved' && (
                  <>
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-success/15 border-2 border-success/30 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-success" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-success/20 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Identity Verified! 🎉</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Your identity has been successfully verified. You now have full access to all claim processing features.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center">
                      <div className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> ID Verified
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Face Match Passed
                      </div>
                    </div>
                    <Button id="didit-done-btn" className="bg-success hover:bg-success/90 h-11 px-8 font-semibold" onClick={handleClose}>
                      Done — Continue to Dashboard
                    </Button>
                  </>
                )}

                {(status === 'Declined' || status === 'Resubmission_Required') && (
                  <>
                    <div className="w-24 h-24 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center">
                      <XCircle className="w-12 h-12 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {status === 'Resubmission_Required' ? 'Documents Need Resubmission' : 'Verification Unsuccessful'}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {status === 'Resubmission_Required'
                          ? 'Some documents were unclear or incomplete. Please try again with clear, well-lit photos.'
                          : `We were unable to verify your identity at this time. Please ensure you're using a valid government-issued ID.`}
                      </p>
                    </div>
                    <div className="w-full max-w-sm space-y-2">
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20 text-left">
                        <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">
                          Make sure your ID is fully visible, well-lit, and not blurry. Check your camera permissions are enabled.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        id="didit-retry-btn"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setStep('intro');
                          setSessionId(null);
                          setVerificationUrl(null);
                          setStatus(null);
                          setIframeLoaded(false);
                        }}
                      >
                        <RefreshCw className="w-4 h-4" /> Try Again
                      </Button>
                      <Button id="didit-close-declined-btn" variant="ghost" onClick={handleClose}>
                        Close
                      </Button>
                    </div>
                  </>
                )}

                {status === null && (
                  <>
                    <div className="w-24 h-24 rounded-full bg-warning/10 border-2 border-warning/20 flex items-center justify-center">
                      <Clock className="w-12 h-12 text-warning" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">Under Review</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Your documents have been submitted and are being reviewed by our team. This usually takes up to 24 hours.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/20 px-3 py-1.5 rounded-full">
                      <Clock className="w-3 h-3" /> Review in progress
                    </div>
                    <Button id="didit-close-review-btn" className="h-11 px-8" onClick={handleClose}>
                      Got it — I'll wait
                    </Button>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
};

export default DiditVerificationModal;
