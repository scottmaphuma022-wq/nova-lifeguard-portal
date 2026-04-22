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
      width: 700, // 🔥 even smaller for OCR safety
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 35, // 🔥 very aggressive compression
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
// OCR CALL (ROBUST + DEBUG)
// -----------------------------
const runOCR = async (buffer: Buffer, apiKey: string) => {
  const base64Image = buffer.toString('base64');

  const payloadSizeKB = Buffer.byteLength(base64Image, 'utf8') / 1024;

  console.log("📦 OCR Payload size KB:", payloadSizeKB.toFixed(2));

  if (payloadSizeKB > 900) {
    return {
      ok: false,
      status: 413,
      raw: "Payload too large after compression",
      parsed: null,
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
      payloadSizeKB: payloadSizeKB.toFixed(2),
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
// EXTRACT ALL TEXT (NOT JUST NAME)
// -----------------------------
const extractAllText = (text: string) => {
  return text
    .replace(/\s+/g, ' ')
    .trim();
};

// -----------------------------
// SMART TEXT SIMILARITY (NEW CORE LOGIC)
// -----------------------------
const textSimilarity = (a: string, b: string) => {
  const A = a.toUpperCase();
  const B = b.toUpperCase();

  const wordsA = A.split(' ').filter(Boolean);
  const wordsB = B.split(' ').filter(Boolean);

  let matches = 0;

  wordsA.forEach(w => {
    if (wordsB.includes(w)) matches++;
  });

  const score = Math.max(
    matches / wordsA.length,
    matches / wordsB.length
  );

  return {
    match: score >= 0.6,
    confidence: score,
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

        fileDebug.originalSizeKB = (originalBuffer.length / 1024).toFixed(2);

        const { buffer, meta } = await normalizeImage(originalBuffer);
        fileDebug.compression = meta;

        const ocr = await runOCR(buffer, apiKey);

        fileDebug.ocrStatus = ocr.status;
        fileDebug.ocrRaw = ocr.raw;

        if (!ocr.ok || !ocr.parsed) {
          throw new Error(`OCR failed (${ocr.status})`);
        }

        const text = extractAllText(ocr.parsed?.text || '');

        fileDebug.extractedText = text.slice(0, 300);

        results.push({
          success: true,
          text,
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
    // FINAL BULLETPROOF COMPARISON
    // -----------------------------
    const texts = results.map(r => r.text).filter(Boolean);

    let allMatch = false;
    let comparisons: any[] = [];

    if (texts.length >= 2) {
      const base = texts[0];

      comparisons = texts.slice(1).map(t => ({
        base,
        comparedWith: t,
        ...textSimilarity(base, t),
      }));

      allMatch = comparisons.every(c => c.match);
    }

    debug.step = 'completed';
    debug.texts = texts;
    debug.comparisons = comparisons;

    return res.status(200).json({
      success: allMatch,
      message: allMatch
        ? 'All documents match (text verified)'
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