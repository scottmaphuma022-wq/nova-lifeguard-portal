import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DIDIT_API_KEY = process.env.DIDIT_API_KEY!;

// Admin Supabase client — can bypass RLS
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Verify this is a genuine Didit webhook ────────────────────────────────
  // Didit sends the API key in the Authorization header as "Bearer <key>"
  const authHeader = req.headers['authorization'] ?? req.headers['x-api-key'];
  const receivedKey = typeof authHeader === 'string'
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : null;

  if (!receivedKey || receivedKey !== DIDIT_API_KEY) {
    console.warn('Didit webhook: invalid auth header', authHeader);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Parse the payload ─────────────────────────────────────────────────────
  const payload = req.body;
  console.log('Didit webhook received:', JSON.stringify(payload));

  // Didit webhook payload shape (v3):
  // {
  //   session_id: string,
  //   status: 'Approved' | 'Declined' | 'Resubmission_Required',
  //   vendor_data: string  ← this is the userId we passed when creating the session
  //   decision?: { status: string }
  // }
  const sessionId: string = payload?.session_id ?? payload?.sessionId;
  const vendorData: string = payload?.vendor_data ?? payload?.vendorData; // userId
  const rawStatus: string  = payload?.status ?? payload?.decision?.status ?? '';

  if (!sessionId || !vendorData || !rawStatus) {
    console.error('Didit webhook: missing fields', { sessionId, vendorData, rawStatus });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Map Didit status → our kyc_status
  const kycStatus =
    rawStatus === 'Approved'                ? 'approved'
    : rawStatus === 'Declined'              ? 'declined'
    : rawStatus === 'Resubmission_Required' ? 'resubmission_required'
    : 'under_review';

  // ── Update userprofile in Supabase ────────────────────────────────────────
  try {
    const { error } = await supabaseAdmin
      .from('userprofile')
      .update({
        kyc_status: kycStatus,
        kyc_session_id: sessionId,
        ...(kycStatus === 'approved' ? { kyc_verified_at: new Date().toISOString() } : {}),
      })
      .eq('id', vendorData);

    if (error) {
      console.error('Supabase update error:', error);
      // Still return 200 so Didit doesn't retry forever
    } else {
      console.log(`KYC updated: user=${vendorData} status=${kycStatus}`);
    }
  } catch (err) {
    console.error('Unexpected error updating Supabase:', err);
  }

  // Always return 200 to acknowledge receipt
  return res.status(200).json({ received: true, kycStatus });
}
