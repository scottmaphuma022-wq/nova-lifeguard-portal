-- =========================================================
-- Nova Lifeguard Portal — Notifications System
-- Run this ONCE in the Supabase SQL Editor
-- =========================================================

-- 1. Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  type        text NOT NULL DEFAULT 'info',   -- 'info' | 'success' | 'warning' | 'error'
  read        boolean NOT NULL DEFAULT false,
  claim_id    uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies — users can only see and update their own notifications
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can insert (for triggers and server-side writes)
CREATE POLICY "Service role insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 4. Enable Realtime on the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5. Trigger function — fires on claim INSERT or claim_status UPDATE
CREATE OR REPLACE FUNCTION public.handle_claim_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text;
  v_body  text;
  v_type  text;
BEGIN
  -- ── New claim submitted ─────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_title := 'Claim Submitted';
    v_body  := 'Your claim ' || COALESCE(NEW.claim_number, 'N/A') || ' has been submitted and is awaiting review. We will notify you of any updates.';
    v_type  := 'info';

  -- ── Status changed ──────────────────────────────────────
  ELSIF TG_OP = 'UPDATE' AND NEW.claim_status IS DISTINCT FROM OLD.claim_status THEN
    CASE NEW.claim_status
      WHEN 'approved' THEN
        v_title := 'Claim Approved 🎉';
        v_body  := 'Great news! Your claim ' || COALESCE(NEW.claim_number, 'N/A') || ' has been approved. KES ' || COALESCE(NEW.claim_amount::text, '0') || ' will be disbursed shortly.';
        v_type  := 'success';
      WHEN 'rejected' THEN
        v_title := 'Claim Rejected';
        v_body  := 'Unfortunately, your claim ' || COALESCE(NEW.claim_number, 'N/A') || ' was rejected. Please contact our support team for assistance.';
        v_type  := 'error';
      WHEN 'paid' THEN
        v_title := 'Payment Disbursed 💰';
        v_body  := 'Your claim ' || COALESCE(NEW.claim_number, 'N/A') || ' payment of KES ' || COALESCE(NEW.claim_amount::text, '0') || ' has been processed and sent to your account.';
        v_type  := 'success';
      WHEN 'under_review' THEN
        v_title := 'Claim Under Review';
        v_body  := 'Your claim ' || COALESCE(NEW.claim_number, 'N/A') || ' is now under review by our team. This typically takes 1–3 business days.';
        v_type  := 'info';
      ELSE
        -- Unknown status change — skip notification
        RETURN NEW;
    END CASE;
  ELSE
    -- Not a relevant change
    RETURN NEW;
  END IF;

  -- Insert the notification for the claim owner
  INSERT INTO public.notifications (user_id, title, body, type, claim_id)
  VALUES (NEW.user_id, v_title, v_body, v_type, NEW.id);

  RETURN NEW;
END;
$$;

-- 6. Attach the trigger to the claims table
DROP TRIGGER IF EXISTS claim_notification_trigger ON public.claims;
CREATE TRIGGER claim_notification_trigger
  AFTER INSERT OR UPDATE OF claim_status ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_claim_notification();
