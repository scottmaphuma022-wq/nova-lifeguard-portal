import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import sharp from 'sharp';

// -----------------------------
// Normalize + COMPRESS Image
// -----------------------------
const normalizeImage = async (buffer: Buffer) => {
  const beforeSize = buffer.length;

  const compressed = await sharp(buffer)
    .rotate()
    .resize({
      width: 1200,
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 65,
    })
    .toBuffer();

  return {
    buffer: compressed,
    meta: {
      beforeKB: (beforeSize / 1024).toFixed(2),
      afterKB: (compressed.length / 1024).toFixed(2),
      reduction: `${((1 - compressed.length / beforeSize) * 100).toFixed(1)}%`,
    },
  };
};

// -----------------------------
// OCR CALL
// -----------------------------
const runOCR = async (buffer: Buffer, apiKey: string) => {
  const base64Image = buffer.toString('base64');

  try {
    const response = await fetch('https://api.optiic.dev/process', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: `data:image/jpeg;base64,${base64Image}`,
      }),
    });

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
      raw: err.message,
      parsed: null,
    };
  }
};

// -----------------------------
// OCR RETRY (NEW)
// -----------------------------
const runOCRWithRetry = async (buffer: Buffer, apiKey: string, retries = 3) => {
  let last;

  for (let i = 0; i < retries; i++) {
    const res = await runOCR(buffer, apiKey);
    if (res.ok && res.parsed) return res;

    last = res;
    await new Promise(r => setTimeout(r, 500));
  }

  return last;
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
    ocr?.lines?.map((l: any) => l.text).join(' ') ||
    ocr?.words?.map((w: any) => w.text).join(' ') ||
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
// ID NUMBER EXTRACTION (NEW)
// -----------------------------
const extractIdNumber = (text: string) => {
  const match = text.match(/\b\d{6,10}\b/);
  return match ? match[0] : null;
};

// -----------------------------
// TOKEN-BASED SIMILARITY (FIXED)
// -----------------------------
const similarity = (a: string[], b: string[]) => {
  const tokenize = (arr: string[]) =>
    arr.flatMap(name => name.split(' '));

  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

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

    debug.urlCount = imageUrls?.length;

    if (!imageUrls || !Array.isArray(imageUrls)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid imageUrls',
        debug,
      });
    }

    const apiKey = process.env.OPTIC_OCR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing OCR API key',
        debug,
      });
    }

    let results: any[] = [];

    debug.step = 'processing_images';

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const fileDebug: any = { index: i, url };

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed ${response.status}`);

        const originalBuffer = Buffer.from(await response.arrayBuffer());

        const { buffer, meta } = await normalizeImage(originalBuffer);
        fileDebug.compression = meta;

        const ocr = await runOCRWithRetry(buffer, apiKey);

        fileDebug.ocrStatus = ocr.status;
        fileDebug.ocrRaw = ocr.raw?.slice(0, 500);

        // 🔥 DO NOT FAIL — continue gracefully
        if (!ocr.ok || !ocr.parsed) {
          results.push({
            success: false,
            text: '',
            nameCandidates: [],
            idNumber: null,
            debug: fileDebug,
          });
          continue;
        }

        const text = extractAllText(ocr.parsed);
        const nameCandidates = extractNameCandidates(text);
        const idNumber = extractIdNumber(text);

        fileDebug.extractedText = text.slice(0, 200);
        fileDebug.nameCandidates = nameCandidates;
        fileDebug.idNumber = idNumber;

        results.push({
          success: true,
          text,
          nameCandidates,
          idNumber,
          debug: fileDebug,
        });

      } catch (err: any) {
        fileDebug.error = err.message;

        results.push({
          success: false,
          text: '',
          nameCandidates: [],
          idNumber: null,
          debug: fileDebug,
        });
      }
    }

    // -----------------------------
    // NAME COMPARISON
    // -----------------------------
    const allNames = results
      .map(r => r.nameCandidates)
      .filter(arr => arr && arr.length > 0);

    let nameMatch = false;
    let comparisons: any[] = [];

    if (allNames.length >= 2) {
      const base = allNames[0];

      comparisons = allNames.slice(1).map(other => ({
        base,
        comparedWith: other,
        ...similarity(base, other),
      }));

      nameMatch = comparisons.every(c => c.match);
    }

    // -----------------------------
    // ID COMPARISON (STRONG SIGNAL)
    // -----------------------------
    const ids = results.map(r => r.idNumber).filter(Boolean);

    let idMatch = false;

    if (ids.length >= 2) {
      idMatch = ids.every(id => id === ids[0]);
    }

    // -----------------------------
    // FINAL DECISION
    // -----------------------------
    const finalMatch = nameMatch || idMatch;

    debug.step = 'completed';
    debug.allNames = allNames;
    debug.comparisons = comparisons;
    debug.idMatch = idMatch;

    return res.status(200).json({
      success: finalMatch,
      message: finalMatch
        ? 'Documents verified'
        : 'Document mismatch detected',
      results,
      debug,
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
      debug,
    });
  }
}