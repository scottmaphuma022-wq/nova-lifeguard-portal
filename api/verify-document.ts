import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import sharp from 'sharp';

// -----------------------------
// Normalize + COMPRESS Image 🔥
// -----------------------------
const normalizeImage = async (buffer: Buffer) => {
  const compressed = await sharp(buffer)
    .rotate() // fix orientation
    .resize({
      width: 1000, // 🔥 limit size
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 55, // 🔥 strong compression
      chromaSubsampling: '4:2:0',
    })
    .toBuffer();

  return compressed;
};

// -----------------------------
// Extract Name (simple heuristic)
// -----------------------------
const extractName = (text: string) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const words = line.split(' ');
    if (words.length >= 2 && words.length <= 4) {
      if (line === line.toUpperCase()) {
        return line;
      }
    }
  }

  return null;
};

// -----------------------------
// OCR CALL
// -----------------------------
const runOCR = async (buffer: Buffer, apiKey: string) => {
  const base64Image = buffer.toString('base64');

  const response = await fetch('https://api.optiic.dev/process', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: base64Image }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`OCR failed: ${raw}`);
  }

  return JSON.parse(raw);
};

// -----------------------------
// Normalize Name → tokens
// -----------------------------
const normalizeName = (name: string) => {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .split(' ')
    .filter(Boolean);
};

// -----------------------------
// Compare Names (SMART MATCH)
// -----------------------------
const compareNames = (nameA: string, nameB: string) => {
  const tokensA = normalizeName(nameA);
  const tokensB = normalizeName(nameB);

  let matches = 0;

  tokensA.forEach(a => {
    if (tokensB.includes(a)) {
      matches++;
    }
  });

  const scoreA = matches / tokensA.length;
  const scoreB = matches / tokensB.length;

  const confidence = Math.max(scoreA, scoreB);

  return {
    match: confidence >= 0.6,
    confidence,
    tokensA,
    tokensB,
  };
};

// -----------------------------
// Handler (URL BASED)
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let debug: any = { step: 'init' };

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', debug });
  }

  try {
    debug.step = 'read_body';

    const { imageUrls } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image URLs provided',
        debug,
      });
    }

    debug.totalFiles = imageUrls.length;

    const apiKey = process.env.OPTIC_OCR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing OCR API key',
        debug,
      });
    }

    let results: any[] = [];

    // -----------------------------
    // PROCESS EACH IMAGE URL
    // -----------------------------
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];

      let fileDebug: any = {
        index: i,
        url,
      };

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch image');

        let buffer = Buffer.from(await response.arrayBuffer());

        // 🔥 COMPRESS IMAGE
        buffer = await normalizeImage(buffer);

        // 🔥 SAFETY LIMIT (avoid payload errors)
        if (buffer.length > 1.5 * 1024 * 1024) {
          throw new Error('Image too large even after compression');
        }

        const ocrData = await runOCR(buffer, apiKey);
        const text = (ocrData?.text || '').toLowerCase();

        const name = extractName(text);

        fileDebug.textSample = text.slice(0, 200);
        fileDebug.extractedName = name;

        results.push({
          success: true,
          name,
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
    // SMART NAME MATCHING 🔥
    // -----------------------------
    const names = results
      .map(r => r.name)
      .filter(Boolean);

    let allMatch = false;
    let comparisons: any[] = [];

    if (names.length >= 2) {
      const base = names[0];

      comparisons = names.slice(1).map((n) => {
        const result = compareNames(base, n);
        return {
          base,
          comparedWith: n,
          ...result,
        };
      });

      allMatch = comparisons.every(c => c.match);
    }

    debug.names = names;
    debug.comparisons = comparisons;
    debug.matching = allMatch;

    return res.status(200).json({
      success: allMatch,
      message: allMatch
        ? 'All document names match'
        : 'Document names do NOT match',
      results,
      debug,
    });

  } catch (err: any) {
    debug.error = err.message;

    return res.status(500).json({
      success: false,
      error: 'Verification failed',
      debug,
    });
  }
}