import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ShieldCheck, FileText, Camera, CheckCircle2, XCircle,
  Clock, Loader2, AlertCircle, ArrowRight, RefreshCw, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

type VerificationStep = 'intro' | 'waiting' | 'result';
type KycDecision = 'Approved' | 'Declined' | 'Resubmission_Required' | null;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called immediately when Didit returns Approved */
  onVerified?: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? '';

/* ─── API helpers ───────────────────────────────────────────────────────────── */
async function createSession(userId: string) {
  const r = await fetch(`${BACKEND_URL}/api/didit-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Server error ${r.status}`);
  return body as { sessionId: string; verificationUrl: string };
}

async function checkStatus(sessionId: string): Promise<KycDecision> {
  try {
    const r = await fetch(`${BACKEND_URL}/api/didit-session?sessionId=${encodeURIComponent(sessionId)}`);
    if (!r.ok) return null;
    const body = await r.json();
    // Didit may return { status } at root level OR nested under { decision: { status } }
    const raw: string | undefined = body?.status ?? body?.decision?.status ?? body?.kyc_decision;
    if (!raw || raw === 'In_Progress' || raw === 'in_progress') return null;
    if (raw === 'Approved' || raw === 'approved') return 'Approved';
    if (raw === 'Declined' || raw === 'declined') return 'Declined';
    if (raw === 'Resubmission_Required') return 'Resubmission_Required';
    return null;
  } catch {
    return null;
  }
}

async function saveKycStatus(userId: string, sessionId: string, decision: KycDecision) {
  const kycStatus =
    decision === 'Approved' ? 'approved'
    : decision === 'Declined' ? 'declined'
    : decision === 'Resubmission_Required' ? 'resubmission_required'
    : 'pending';
  try {
    await supabase.from('userprofile').update({
      kyc_status: kycStatus,
      kyc_session_id: sessionId,
      ...(kycStatus === 'approved' ? { kyc_verified_at: new Date().toISOString() } : {}),
    }).eq('id', userId);
  } catch {
    // Silently skip if columns don't exist yet — status still shows in UI via local state
  }
}

/* ─── Component ─────────────────────────────────────────────────────────────── */
export default function DiditVerificationModal({ open, onClose, onVerified }: Props) {
  const [step, setStep] = useState<VerificationStep>('intro');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [decision, setDecision] = useState<KycDecision>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [popupClosed, setPopupClosed] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const userIdRef = useRef<string | null>(null);

  /* ── Reset everything when modal is closed ── */
  useEffect(() => {
    if (!open) {
      popupRef.current?.close();
      const t = setTimeout(() => {
        setStep('intro');
        setSessionId(null);
        setVerificationUrl(null);
        setDecision(null);
        setLoading(false);
        setError(null);
        setPollCount(0);
        setPopupClosed(false);
        popupRef.current = null;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* ── Core: detect popup close + poll status ── */
  useEffect(() => {
    if (step !== 'waiting' || !sessionId) return;

    let done = false;

    const finish = async (d: KycDecision) => {
      if (done) return;
      done = true;
      popupRef.current?.close();
      if (userIdRef.current) await saveKycStatus(userIdRef.current, sessionId, d);
      setDecision(d);
      setStep('result');
      if (d === 'Approved') onVerified?.();
    };

    // 1) Poll Didit every 6 seconds
    const pollInterval = setInterval(async () => {
      if (done) return;
      const d = await checkStatus(sessionId);
      setPollCount((c) => c + 1);
      if (d !== null) {
        clearInterval(pollInterval);
        clearInterval(popupCheckInterval);
        await finish(d);
      }
    }, 6000);

    // 2) Detect when the popup window closes
    const popupCheckInterval = setInterval(() => {
      if (done) return;
      if (popupRef.current?.closed) {
        setPopupClosed(true);
        // Don't auto-close modal — user may have closed popup early; keep polling
      }
    }, 1000);

    // 3) Check status when user focuses back on this tab
    const onFocus = async () => {
      if (done) return;
      const d = await checkStatus(sessionId);
      if (d !== null) {
        clearInterval(pollInterval);
        clearInterval(popupCheckInterval);
        await finish(d);
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(pollInterval);
      clearInterval(popupCheckInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, [step, sessionId, onVerified]);

  /* ── Handlers ── */
  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to verify.');
      userIdRef.current = user.id;

      const { sessionId: sid, verificationUrl: url } = await createSession(user.id);
      setSessionId(sid);
      setVerificationUrl(url);

      // Open popup — centre it on screen
      const w = 540, h = 700;
      const left = Math.round((window.screen.width - w) / 2);
      const top = Math.round((window.screen.height - h) / 4);
      const popup = window.open(url, 'didit_kyc', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`);
      if (popup) {
        popup.focus();
        popupRef.current = popup;
      }

      // Save pending status without blocking the UI
      saveKycStatus(user.id, sid, null).catch(() => {});

      setPopupClosed(false);
      setStep('waiting');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReopenPopup = () => {
    if (!verificationUrl) return;
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
    } else {
      const w = 540, h = 700;
      const left = Math.round((window.screen.width - w) / 2);
      const top = Math.round((window.screen.height - h) / 4);
      const p = window.open(verificationUrl, 'didit_kyc', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`);
      if (p) { p.focus(); popupRef.current = p; setPopupClosed(false); }
    }
  };

  const handleCheckNow = async () => {
    if (!sessionId) return;
    setLoading(true);
    const d = await checkStatus(sessionId);
    setLoading(false);
    if (d !== null) {
      popupRef.current?.close();
      if (userIdRef.current) await saveKycStatus(userIdRef.current, sessionId, d);
      setDecision(d);
      setStep('result');
      if (d === 'Approved') onVerified?.();
    }
  };

  const handleRetry = () => {
    popupRef.current?.close();
    setStep('intro');
    setSessionId(null);
    setVerificationUrl(null);
    setDecision(null);
    setPollCount(0);
    setPopupClosed(false);
    popupRef.current = null;
  };

  const handleClose = useCallback(() => {
    popupRef.current?.close();
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click to close only on intro/result, not while waiting */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={step === 'waiting' ? undefined : handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="didit-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 id="didit-title" className="font-semibold text-sm text-foreground">Identity Verification</h2>
                <p className="text-xs text-muted-foreground">Powered by Didit KYC</p>
              </div>
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mr-8">
              {(['intro', 'waiting', 'result'] as VerificationStep[]).map((s, i) => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${
                  s === step ? 'w-6 bg-primary'
                  : (step === 'result' && i < 2) || (step === 'waiting' && i === 0) ? 'w-1.5 bg-primary/50'
                  : 'w-1.5 bg-border'
                }`} />
              ))}
            </div>
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close verification modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">

            {/* ─── INTRO ──────────────────────────────────────────────────── */}
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
                    A government-issued ID and a quick face scan are required to process your claims securely. It only takes a minute.
                  </p>
                </div>

                <div className="w-full space-y-2">
                  {[
                    { icon: FileText, label: 'National ID or Passport', desc: 'Front and back if applicable', cls: 'text-primary bg-primary/10' },
                    { icon: Camera,   label: 'Face Verification',        desc: 'A quick selfie to match your ID',  cls: 'text-success bg-success/10' },
                    { icon: ShieldCheck, label: 'Instant Decision',      desc: 'Usually approved in seconds',       cls: 'text-warning bg-warning/10' },
                  ].map(({ icon: Icon, label, desc, cls }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
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
                    className="w-full h-11 font-semibold gap-2 bg-primary hover:bg-primary/90"
                    onClick={handleStart}
                    disabled={loading}
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                      : <><ShieldCheck className="w-4 h-4" /> Start Verification <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    A small window will open — complete it and return here automatically
                  </p>
                </div>
              </div>
            )}

            {/* ─── WAITING ────────────────────────────────────────────────── */}
            {step === 'waiting' && (
              <div className="flex flex-col items-center text-center gap-5 py-2">
                {/* Animated rings */}
                <div className="relative flex items-center justify-center w-28 h-28">
                  <div className="absolute w-28 h-28 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute w-20 h-20 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
                  <div className="absolute w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1.5">
                    {popupClosed ? 'Verification Window Closed' : 'Waiting for Verification…'}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {popupClosed
                      ? `Complete your verification in the Didit window. If you closed it by mistake, reopen it below.`
                      : `Complete your ID and face scan in the Didit window. This page will update automatically once done.`}
                  </p>
                </div>

                {/* Live status */}
                <div className="w-full rounded-xl bg-muted/30 border border-border/40 divide-y divide-border/30">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Verification window</span>
                    <span className={`text-xs font-medium flex items-center gap-1.5 ${popupClosed ? 'text-warning' : 'text-success'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${popupClosed ? 'bg-warning' : 'bg-success animate-pulse'}`} />
                      {popupClosed ? 'Closed' : 'Open'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Status checks</span>
                    <span className="text-xs font-medium text-foreground">{pollCount} completed</span>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      id="didit-reopen-btn"
                      variant="outline"
                      className="flex-1 gap-1.5 text-sm"
                      onClick={handleReopenPopup}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Reopen Window
                    </Button>
                    <Button
                      id="didit-check-now-btn"
                      variant="outline"
                      className="flex-1 gap-1.5 text-sm"
                      onClick={handleCheckNow}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Check Now
                    </Button>
                  </div>
                  <Button id="didit-cancel-waiting-btn" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Keep this page open — it auto-updates when verification is complete
                </p>
              </div>
            )}

            {/* ─── RESULT ─────────────────────────────────────────────────── */}
            {step === 'result' && (
              <div className="flex flex-col items-center text-center gap-5">

                {decision === 'Approved' && (
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
                        Your identity has been verified. You now have full access to claim processing — no additional ID uploads needed.
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
                    <Button id="didit-done-btn" className="w-full h-11 font-semibold bg-success hover:bg-success/90" onClick={handleClose}>
                      Continue to Dashboard
                    </Button>
                  </>
                )}

                {(decision === 'Declined' || decision === 'Resubmission_Required') && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">
                        {decision === 'Resubmission_Required' ? 'Resubmission Required' : 'Verification Unsuccessful'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {decision === 'Resubmission_Required'
                          ? `Some documents were unclear. Please retry with clear, well-lit photos.`
                          : `We couldn't verify your identity. Please ensure you're using a valid government-issued ID and camera is allowed.`}
                      </p>
                    </div>
                    <div className="w-full flex gap-2">
                      <Button id="didit-retry-btn" variant="outline" className="flex-1 gap-2" onClick={handleRetry}>
                        <RefreshCw className="w-4 h-4" /> Try Again
                      </Button>
                      <Button id="didit-close-declined-btn" variant="ghost" className="flex-1" onClick={handleClose}>Close</Button>
                    </div>
                  </>
                )}

                {decision === null && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-warning/10 border-2 border-warning/20 flex items-center justify-center">
                      <Clock className="w-10 h-10 text-warning" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">Under Review</h3>
                      <p className="text-sm text-muted-foreground">
                        Your documents have been submitted and are under review. This usually takes up to 24 hours — we'll update your status automatically.
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 border border-warning/20 px-3 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Review in progress
                    </span>
                    <Button id="didit-close-review-btn" className="w-full h-11" onClick={handleClose}>Got it</Button>
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
