import { useState, useEffect, useCallback } from 'react';
import {
  X, ShieldCheck, FileText, Camera, CheckCircle2, XCircle,
  Clock, Loader2, AlertCircle, ArrowRight, RefreshCw, ShieldAlert,
} from 'lucide-react';
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

/* ─── Backend helpers ───────────────────────────────────────────────────────── */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

async function createDiditSession(userId: string) {
  const res = await fetch(`${BACKEND_URL}/api/didit-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  return res.json() as Promise<{ sessionId: string; verificationUrl: string }>;
}

async function pollDiditSession(sessionId: string): Promise<{ status: VerificationStatus }> {
  const res = await fetch(`${BACKEND_URL}/api/didit-session?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Failed to check session status');
  const data = await res.json();
  return { status: data?.decision?.status ?? data?.status ?? null };
}

/* ─── Component ─────────────────────────────────────────────────────────────── */
export default function DiditVerificationModal({ open, onClose, onVerified }: Props) {
  const [step, setStep] = useState<VerificationStep>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  /* Reset on close */
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('intro');
        setSessionId(null);
        setVerificationUrl(null);
        setStatus(null);
        setError(null);
        setIframeLoaded(false);
        setLoading(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* Poll session while verifying */
  useEffect(() => {
    if (step !== 'verifying' || !sessionId) return;
    const interval = setInterval(async () => {
      try {
        const result = await pollDiditSession(sessionId);
        if (result.status && result.status !== 'In_Progress') {
          clearInterval(interval);
          setStatus(result.status);
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
      } catch { /* keep polling */ }
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

  const handleRetry = () => {
    setStep('intro');
    setSessionId(null);
    setVerificationUrl(null);
    setStatus(null);
    setIframeLoaded(false);
  };

  const handleClose = useCallback(() => { onClose(); }, [onClose]);

  if (!open) return null;

  /* ─── Full-screen verification iframe view ──────────────────────────────── */
  if (step === 'verifying') {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="dialog" aria-modal="true">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">Identity Verification</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Powered by Didit — do not close this window</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Monitoring…
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe — fills everything below the top bar */}
        <div className="relative flex-1 overflow-hidden">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Loading verification…</p>
                <p className="text-xs text-muted-foreground mt-1">Please allow camera access when prompted</p>
              </div>
            </div>
          )}
          {verificationUrl && (
            <iframe
              id="didit-verification-iframe"
              src={verificationUrl}
              className="w-full h-full border-0"
              allow="camera; microphone; geolocation"
              onLoad={() => setIframeLoaded(true)}
              title="Didit Identity Verification"
            />
          )}
        </div>
      </div>
    );
  }

  /* ─── Intro & Result: centered card modal ───────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="didit-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
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
            {/* Step pills */}
            <div className="flex items-center gap-1.5 mr-8">
              {['intro', 'verifying', 'result'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? 'w-6 bg-primary'
                    : (step === 'result' || (step !== 'intro' && i === 0)) ? 'w-1.5 bg-primary/40'
                    : 'w-1.5 bg-border'
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
          <div className="p-6">

            {/* ── Intro step ───────────────────────────────────────────────── */}
            {step === 'intro' && (
              <div className="flex flex-col items-center text-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-primary" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1.5">Verify Your Identity</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We need to verify your identity using a government-issued ID and a quick face scan to process your claims securely.
                  </p>
                </div>

                <div className="w-full space-y-2.5">
                  {[
                    { icon: FileText, label: 'National ID or Passport', desc: 'Front and back if applicable', color: 'text-primary bg-primary/10' },
                    { icon: Camera, label: 'Face Verification', desc: 'A quick selfie to match your ID', color: 'text-success bg-success/10' },
                    { icon: ShieldCheck, label: 'Instant Decision', desc: 'Usually approved in seconds', color: 'text-warning bg-warning/10' },
                  ].map(({ icon: Icon, label, desc, color }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="w-full flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-left">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="w-full flex flex-col gap-2">
                  <Button
                    id="didit-start-btn"
                    className="w-full bg-primary hover:bg-primary/90 h-11 font-semibold gap-2"
                    onClick={handleStartVerification}
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Setting up verification…</>
                    ) : (
                      <><ShieldCheck className="w-4 h-4" /> Start Verification <ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Encrypted &amp; secure — we never store your ID images
                  </p>
                </div>
              </div>
            )}

            {/* ── Result step ──────────────────────────────────────────────── */}
            {step === 'result' && (
              <div className="flex flex-col items-center text-center gap-5">
                {status === 'Approved' && (
                  <>
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-success/15 border-2 border-success/30 flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-success" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-success/20 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">Identity Verified! 🎉</h3>
                      <p className="text-sm text-muted-foreground">
                        Your identity has been successfully verified. You now have full access to all claim processing features.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <span className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> ID Verified
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-success bg-success/10 border border-success/20 px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Face Match Passed
                      </span>
                    </div>
                    <Button id="didit-done-btn" className="w-full bg-success hover:bg-success/90 h-11 font-semibold" onClick={handleClose}>
                      Done — Continue to Dashboard
                    </Button>
                  </>
                )}

                {(status === 'Declined' || status === 'Resubmission_Required') && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">
                        {status === 'Resubmission_Required' ? 'Documents Need Resubmission' : 'Verification Unsuccessful'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {status === 'Resubmission_Required'
                          ? `Some documents were unclear or incomplete. Please try again with clear, well-lit photos.`
                          : `We were unable to verify your identity. Please ensure you're using a valid government-issued ID.`}
                      </p>
                    </div>
                    <div className="w-full flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20 text-left">
                      <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground">
                        Make sure your ID is fully visible, well-lit, and not blurry. Check that camera permissions are enabled.
                      </p>
                    </div>
                    <div className="w-full flex gap-2">
                      <Button id="didit-retry-btn" variant="outline" className="flex-1 gap-2" onClick={handleRetry}>
                        <RefreshCw className="w-4 h-4" /> Try Again
                      </Button>
                      <Button id="didit-close-declined-btn" variant="ghost" className="flex-1" onClick={handleClose}>
                        Close
                      </Button>
                    </div>
                  </>
                )}

                {status === null && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-warning/10 border-2 border-warning/20 flex items-center justify-center">
                      <Clock className="w-10 h-10 text-warning" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">Under Review</h3>
                      <p className="text-sm text-muted-foreground">
                        Your documents have been submitted and are being reviewed. This usually takes up to 24 hours.
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/20 px-3 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Review in progress
                    </span>
                    <Button id="didit-close-review-btn" className="w-full h-11" onClick={handleClose}>
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
}
