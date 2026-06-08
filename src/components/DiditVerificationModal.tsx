import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ShieldCheck, FileText, Camera, CheckCircle2, XCircle,
  Clock, Loader2, AlertCircle, ArrowRight, RefreshCw, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

type Step = 'intro' | 'waiting' | 'result';
type Decision = 'approved' | 'declined' | 'resubmission_required' | 'under_review' | null;

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? '';

async function createSession(userId: string) {
  const r = await fetch(`${BACKEND_URL}/api/didit-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Error ${r.status}`);
  return body as { sessionId: string; verificationUrl: string };
}

function openPopup(url: string, name = 'didit_kyc') {
  const w = 540, h = 720;
  const left = Math.round((window.screen.width - w) / 2);
  const top  = Math.round((window.screen.height - h) / 4);
  return window.open(url, name, `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
}

export default function DiditVerificationModal({ open, onClose, onVerified }: Props) {
  const [step, setStep]                   = useState<Step>('intro');
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [decision, setDecision]           = useState<Decision>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [popupOpen, setPopupOpen]         = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const userIdRef    = useRef<string | null>(null);
  const popupRef     = useRef<Window | null>(null);

  /* ── Reset when modal hides ── */
  useEffect(() => {
    if (!open) {
      popupRef.current?.close();
      const t = setTimeout(() => {
        setStep('intro');
        setVerificationUrl(null);
        setDecision(null);
        setLoading(false);
        setError(null);
        setPopupOpen(false);
        sessionIdRef.current = null;
        popupRef.current = null;
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* ── Supabase Realtime: auto-detect when webhook updates kyc_status ── */
  useEffect(() => {
    if (step !== 'waiting' || !userIdRef.current) return;

    const channel = supabase
      .channel(`kyc_status:${userIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'userprofile',
          filter: `id=eq.${userIdRef.current}`,
        },
        (payload) => {
          const newStatus: string = payload.new?.kyc_status;
          if (!newStatus || newStatus === 'pending') return;

          const d = newStatus as Decision;
          popupRef.current?.close();
          setDecision(d);
          setStep('result');
          if (d === 'approved') onVerified?.();
        }
      )
      .subscribe();

    /* Popup-closed watcher — shows UI hint but does NOT close modal */
    const popupWatcher = setInterval(() => {
      if (popupRef.current?.closed) {
        setPopupOpen(false);
        clearInterval(popupWatcher);
      }
    }, 800);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(popupWatcher);
    };
  }, [step, onVerified]);

  /* ── Start verification ── */
  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to verify.');
      userIdRef.current = user.id;

      const { sessionId, verificationUrl: url } = await createSession(user.id);
      sessionIdRef.current = sessionId;
      setVerificationUrl(url);

      /* Save pending status to Supabase so Realtime subscription picks up future updates */
      supabase.from('userprofile').update({
        kyc_status: 'pending',
        kyc_session_id: sessionId,
      }).eq('id', user.id).then(() => {});

      const popup = openPopup(url);
      if (popup) { popup.focus(); popupRef.current = popup; setPopupOpen(true); }

      setStep('waiting');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = () => {
    if (!verificationUrl) return;
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
    } else {
      const p = openPopup(verificationUrl);
      if (p) { p.focus(); popupRef.current = p; setPopupOpen(true); }
    }
  };

  const handleRetry = () => {
    popupRef.current?.close();
    setStep('intro');
    setVerificationUrl(null);
    setDecision(null);
    setPopupOpen(false);
    sessionIdRef.current = null;
    popupRef.current = null;
  };

  const handleClose = useCallback(() => {
    popupRef.current?.close();
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={step === 'waiting' ? undefined : handleClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="didit-title"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 id="didit-title" className="font-semibold text-sm text-foreground">Identity Verification</h2>
                <p className="text-xs text-muted-foreground">Powered by Didit KYC</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mr-8">
              {(['intro', 'waiting', 'result'] as Step[]).map((s, i) => (
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
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">

            {/* ── INTRO ─────────────────────────────────────────────── */}
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
                    One-time identity check using your government ID and a face scan. Takes under 2 minutes — and you'll never need to upload ID again.
                  </p>
                </div>

                <div className="w-full space-y-2">
                  {[
                    { icon: FileText, label: 'Government-Issued ID', desc: 'National ID or Passport (front & back)', cls: 'text-primary bg-primary/10' },
                    { icon: Camera,   label: 'Face Verification',    desc: 'A quick selfie for liveness check',     cls: 'text-success bg-success/10' },
                    { icon: ShieldCheck, label: 'Done — Permanently Verified', desc: 'No more ID uploads on future claims', cls: 'text-warning bg-warning/10' },
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
                    A secure verification window will open — complete it and this page updates automatically
                  </p>
                </div>
              </div>
            )}

            {/* ── WAITING (auto-updates via Supabase Realtime) ─────── */}
            {step === 'waiting' && (
              <div className="flex flex-col items-center text-center gap-5 py-2">
                {/* Animated rings */}
                <div className="relative flex items-center justify-center w-28 h-28">
                  <div className="absolute w-28 h-28 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute w-20 h-20 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.5s' }} />
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1.5">
                    {popupOpen ? 'Complete Verification in the Window' : 'Verification Window Closed'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {popupOpen
                      ? 'Scan your ID and complete the face check in the Didit window. This page will update automatically — no button needed.'
                      : `If you completed the verification, your result will appear here shortly. If not, reopen the window below.`}
                  </p>
                </div>

                {/* Status indicator */}
                <div className="w-full rounded-xl bg-muted/30 border border-border/40 divide-y divide-border/30">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Verification window</span>
                    <span className={`text-xs font-medium flex items-center gap-1.5 ${popupOpen ? 'text-success' : 'text-warning'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${popupOpen ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                      {popupOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">Auto-detection</span>
                    <span className="text-xs font-medium text-success flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-2">
                  <Button id="didit-reopen-btn" variant="outline" className="w-full gap-2" onClick={handleReopen}>
                    <ExternalLink className="w-4 h-4" />
                    {popupOpen ? 'Focus Verification Window' : 'Reopen Verification Window'}
                  </Button>
                  <Button id="didit-cancel-btn" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Keep this page open — it updates automatically when Didit processes your result
                </p>
              </div>
            )}

            {/* ── RESULT ───────────────────────────────────────────── */}
            {step === 'result' && (
              <div className="flex flex-col items-center text-center gap-5">
                {decision === 'approved' && (
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
                        You're permanently verified. Future claims only need the specific claim document — no ID copies ever again.
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

                {(decision === 'declined' || decision === 'resubmission_required') && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">
                        {decision === 'resubmission_required' ? 'Resubmission Required' : 'Verification Unsuccessful'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {decision === 'resubmission_required'
                          ? `Documents were unclear. Please retry with well-lit, high-quality photos.`
                          : `We couldn't verify your identity. Use a valid government-issued ID and ensure camera access is allowed.`}
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

                {(decision === 'under_review' || decision === null) && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-warning/10 border-2 border-warning/20 flex items-center justify-center">
                      <Clock className="w-10 h-10 text-warning" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1.5">Under Review</h3>
                      <p className="text-sm text-muted-foreground">
                        Your documents are being reviewed. This typically takes up to 24 hours. Your status will update automatically.
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
