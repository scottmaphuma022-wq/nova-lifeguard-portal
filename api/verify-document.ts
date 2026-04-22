import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

// -----------------------------
// FETCH WITH TIMEOUT ⏱️
// -----------------------------
const fetchWithTimeout = async (url: string, options: any, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
};

// -----------------------------
// OCR CALL (URL)
// -----------------------------
const runOCR = async (imageUrl: string, apiKey: string) => {
  try {
    const response = await fetchWithTimeout(
      'https://api.optiic.dev/process',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: imageUrl }),
      },
      5000 // ⏱️ hard timeout
    );

    const raw = await response.text();

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {}

    return {
      ok: response.ok,
      status: response.status,
      raw,
      parsed,
    };

  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      raw: err.name === 'AbortError' ? 'Timeout' : err.message,
      parsed: null,
    };
  }
};

// -----------------------------
// TEXT EXTRACTION
// -----------------------------
const extractAllText = (ocr: any) => {
  const text =
    ocr?.text ||
    ocr?.data?.text ||
    ocr?.result?.text ||
    ocr?.output?.text ||
    '';

  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

// -----------------------------
// NAME EXTRACTION
// -----------------------------
const STOP_WORDS = [
  'REPUBLIC', 'KENYA', 'IDENTITY', 'CARD',
  'NATIONAL', 'ID', 'NUMBER', 'SEX', 'DATE',
  'BIRTH', 'PLACE', 'ISSUE'
];

const extractNameCandidates = (text: string) => {
  const matches = text.match(/[A-Z]{2,}(?:\s[A-Z]{2,}){1,3}/g) || [];

  return matches.filter(name =>
    !STOP_WORDS.some(word => name.includes(word))
  );
};

// -----------------------------
// ID NUMBER
// -----------------------------
const extractIdNumber = (text: string) => {
  const match = text.match(/\b\d{6,10}\b/);
  return match ? match[0] : null;
};

// -----------------------------
// SIMILARITY
// -----------------------------
const similarity = (a: string[], b: string[]) => {
  const tokensA = new Set(a.flatMap(n => n.split(' ')));
  const tokensB = new Set(b.flatMap(n => n.split(' ')));

  let matchCount = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) matchCount++;
  });

  const score = matchCount / Math.max(tokensA.size, tokensB.size, 1);

  return {
    match: score >= 0.6,
    confidence: Number(score.toFixed(3)),
  };
};

// -----------------------------
// HANDLER
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debug: any = {
    step: 'init',
    time: new Date().toISOString(),
  };

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', debug });
  }

  try {
    const { imageUrls } = req.body;

    if (!Array.isArray(imageUrls)) {
      return res.status(400).json({ success: false, error: 'Invalid imageUrls' });
    }

    const apiKey = process.env.OPTIC_OCR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Missing OCR API key' });
    }

    debug.step = 'parallel_ocr';

    // ✅ PARALLEL EXECUTION (KEY FIX)
    const results = await Promise.all(
      imageUrls.map(async (url: string, i: number) => {
        const fileDebug: any = { index: i, url };

        const ocr = await runOCR(url, apiKey);

        fileDebug.ocrStatus = ocr.status;
        fileDebug.ocrRaw = ocr.raw?.slice(0, 200);

        if (!ocr.ok || !ocr.parsed) {
          return {
            success: false,
            text: '',
            nameCandidates: [],
            idNumber: null,
            debug: fileDebug,
          };
        }

        const text = extractAllText(ocr.parsed);
        const nameCandidates = extractNameCandidates(text);
        const idNumber = extractIdNumber(text);

        fileDebug.text = text.slice(0, 100);

        return {
          success: true,
          text,
          nameCandidates,
          idNumber,
          debug: fileDebug,
        };
      })
    );

    // -----------------------------
    // COMPARE
    // -----------------------------
    const allNames = results
      .map(r => r.nameCandidates)
      .filter(arr => arr.length > 0);

    let nameMatch = false;
    let comparisons: any[] = [];

    if (allNames.length >= 2) {
      const base = allNames[0];

      comparisons = allNames.slice(1).map(other => ({
        ...similarity(base, other),
      }));

      nameMatch = comparisons.every(c => c.match);
    }

    const ids = results.map(r => r.idNumber).filter(Boolean);
    const idMatch = ids.length >= 2 && ids.every(id => id === ids[0]);

    const finalMatch = nameMatch || idMatch;

    return res.status(200).json({
      success: finalMatch,
      message: finalMatch ? 'Documents verified' : 'Document mismatch detected',
      results,
      debug: {
        ...debug,
        allNames,
        comparisons,
        idMatch,
      },
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}