import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import sharp from 'sharp';

// -----------------------------
// Normalize + COMPRESS Image 🔥 (ULTRA SAFE)
// -----------------------------
const normalizeImage = async (buffer: Buffer) => {
  const beforeSize = buffer.length;

  const compressed = await sharp(buffer)
    .rotate()
    .resize({
      width: 650, // slightly smaller for OCR stability
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 30, // aggressive but stable
      chromaSubsampling: '4:2:0',
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
// OCR CALL (HARDENED)
// -----------------------------
const runOCR = async (buffer: Buffer, apiKey: string) => {
  const base64Image = buffer.toString('base64');

  const payloadSizeKB = Buffer.byteLength(base64Image, 'utf8') / 1024;

  console.log("📦 OCR Payload size KB:", payloadSizeKB.toFixed(2));

  if (payloadSizeKB > 850) {
    return {
      ok: false,
      status: 413,
      raw: "Payload too large after compression",
      parsed: null,
      payloadSizeKB,
    };
  }

  try {
    const response = await fetch('https://api.optiic.dev/process', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    const raw = await response.text();

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      raw: raw.slice(0, 2000),
      parsed,
      payloadSizeKB,
    };

  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      raw: err.message,
      parsed: null,
      payloadSizeKB,
    };
  }
};

// -----------------------------
// SAFE TEXT EXTRACTION (FIXED)
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
// EXTRACT NAME CANDIDATES (IMPORTANT FIX)
// -----------------------------
const extractNameCandidates = (text: string) => {
  const matches = text.match(/[A-Z]{2,}(?:\s[A-Z]{2,}){0,4}/g);
  return matches || [];
};

// -----------------------------
// SET-BASED SIMILARITY (ROBUST)
// -----------------------------
const similarity = (a: string[], b: string[]) => {
  const setA = new Set(a);
  const setB = new Set(b);

  let intersection = 0;

  setA.forEach(v => {
    if (setB.has(v)) intersection++;
  });

  const score = intersection / Math.max(setA.size, setB.size, 1);

  return {
    match: score >= 0.5,
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

    // -----------------------------
    // PROCESS IMAGES
    // -----------------------------
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];

      const fileDebug: any = { index: i, url };

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed ${response.status}`);

        const originalBuffer = Buffer.from(await response.arrayBuffer());

        fileDebug.originalSizeKB = (originalBuffer.length / 1024).toFixed(2);

        const { buffer, meta } = await normalizeImage(originalBuffer);
        fileDebug.compression = meta;

        const ocr = await runOCR(buffer, apiKey);

        fileDebug.ocrStatus = ocr.status;
        fileDebug.ocrRaw = ocr.raw;

        if (!ocr.ok) {
          fileDebug.ocrError = ocr.raw;
          throw new Error(`OCR failed (${ocr.status})`);
        }

        const text = extractAllText(ocr.parsed);

        fileDebug.extractedText = text.slice(0, 300);

        const nameCandidates = extractNameCandidates(text);
        fileDebug.nameCandidates = nameCandidates;

        results.push({
          success: true,
          text,
          nameCandidates,
          debug: fileDebug,
        });

      } catch (err: any) {
        fileDebug.error = err.message;

        results.push({
          success: false,
          debug: fileDebug,
        });
      }
    }

    // -----------------------------
    // FINAL COMPARISON (FIXED CORE LOGIC)
    // -----------------------------
    const allNames = results
      .map(r => r.nameCandidates)
      .filter(arr => arr && arr.length > 0);

    let allMatch = false;
    let comparisons: any[] = [];

    if (allNames.length >= 2) {
      const base = allNames[0];

      comparisons = allNames.slice(1).map((other) => ({
        base,
        comparedWith: other,
        ...similarity(base, other),
      }));

      allMatch = comparisons.every(c => c.match);
    }

    debug.step = 'completed';
    debug.allNames = allNames;
    debug.comparisons = comparisons;

    return res.status(200).json({
      success: allMatch,
      message: allMatch
        ? 'All documents verified successfully'
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