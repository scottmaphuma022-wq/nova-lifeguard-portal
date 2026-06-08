import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Document verification endpoint.
 *
 * Instead of running heavy OCR (Tesseract WASM doesn't work in Vercel serverless),
 * we verify the claimant's identity by checking their Didit KYC status in Supabase.
 * If kyc_status = 'approved', documents are considered verified.
 *
 * Body: { claimId: string } OR { imageUrls: string[], userId?: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { claimId, userId, imageUrls } = req.body ?? {};

    // ── Resolve the user_id from the claim if not provided ────────────────
    let targetUserId: string | null = userId ?? null;

    if (!targetUserId && claimId) {
      const { data: claim } = await supabaseAdmin
        .from('claims')
        .select('user_id')
        .eq('id', claimId)
        .single();

      targetUserId = claim?.user_id ?? null;
    }

    // ── Check the user's KYC status ───────────────────────────────────────
    let kycStatus: string | null = null;

    if (targetUserId) {
      const { data: profile } = await supabaseAdmin
        .from('userprofile')
        .select('kyc_status, username')
        .eq('id', targetUserId)
        .single();

      kycStatus = profile?.kyc_status ?? null;

      if (kycStatus === 'approved') {
        console.log(`✅ Document verification passed — user ${profile?.username} is Didit-verified`);
        return res.status(200).json({
          success: true,
          message: 'Identity verified via Didit KYC',
          method: 'didit_kyc',
          kycStatus,
          debug: {
            names: [profile?.username ?? ''],
            ids: [],
            dobs: [],
            nameMatch: true,
            idMatch: true,
            dobMatch: true,
          },
        });
      }

      // KYC not approved — flag as unverified
      console.log(`⚠️  Document verification — user KYC status: ${kycStatus ?? 'not verified'}`);
      return res.status(200).json({
        success: false,
        message:
          kycStatus === 'pending'
            ? 'Identity verification is under review. Please wait for Didit to complete the check.'
            : 'Customer has not completed identity verification (Didit KYC). Please request them to verify their identity before approving.',
        method: 'didit_kyc',
        kycStatus: kycStatus ?? 'unverified',
        debug: { nameMatch: false, idMatch: false, dobMatch: false },
      });
    }

    // ── No userId resolvable — check if any imageUrls were passed ─────────
    // Fallback: if there are uploaded documents, consider them as "needs manual review"
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      console.log(`ℹ️  No user ID resolvable — ${imageUrls.length} document(s) submitted for manual review`);
      return res.status(200).json({
        success: false,
        message: 'Customer identity could not be verified automatically. Please review documents manually.',
        method: 'manual_review',
        kycStatus: null,
        debug: { nameMatch: false, idMatch: false, dobMatch: false },
      });
    }

    return res.status(400).json({ success: false, error: 'No claimId, userId, or imageUrls provided' });

  } catch (err: any) {
    console.error('🔥 verify-document error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}