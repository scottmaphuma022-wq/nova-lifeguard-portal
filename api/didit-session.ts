import type { VercelRequest, VercelResponse } from '@vercel/node';

const DIDIT_API_KEY = process.env.DIDIT_API_KEY!;
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID!;
const DIDIT_BASE_URL = 'https://verification.didit.me';

// ─── Create a Didit KYC session ──────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: Poll session status ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId query param required' });
    }

    try {
      const response = await fetch(`${DIDIT_BASE_URL}/v3/session/${sessionId}/decision/`, {
        headers: {
          'X-API-KEY': DIDIT_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Didit status error:', response.status, errText);
        return res.status(response.status).json({ error: 'Failed to get session status' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (err: any) {
      console.error('Didit GET error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Create a new session ───────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!DIDIT_API_KEY || !DIDIT_WORKFLOW_ID) {
    console.error('Missing DIDIT_API_KEY or DIDIT_WORKFLOW_ID env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const payload = {
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: userId,
    };

    console.log('Creating Didit session for user:', userId);

    const response = await fetch(`${DIDIT_BASE_URL}/v3/session/`, {
      method: 'POST',
      headers: {
        'X-API-KEY': DIDIT_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Didit session creation error:', response.status, errText);
      return res.status(response.status).json({
        error: 'Failed to create verification session',
        detail: errText,
      });
    }

    const session = await response.json();
    console.log('Didit session created:', session.session_id);

    return res.status(200).json({
      sessionId: session.session_id,
      verificationUrl: session.url,
    });
  } catch (err: any) {
    console.error('Didit create session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
