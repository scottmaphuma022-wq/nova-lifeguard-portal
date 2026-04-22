import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import sharp from 'sharp';

// -----------------------------
// Normalize + COMPRESS Image 🔥
// -----------------------------
const normalizeImage = async (buffer: Buffer) => {
  const beforeSize = buffer.length;

  const compressed = await sharp(buffer)
    .rotate()
    .resize({
      width: 1000,
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 55,
      chromaSubsampling: '4:2:0',
    })
    .toBuffer();

  const afterSize = compressed.length;

  return {
    buffer: compressed,
    meta: {
      beforeKB: (beforeSize / 1024).toFixed(2),
      afterKB: (afterSize / 1024).toFixed(2),
    },
  };
};

// -----------------------------
// Extract Name
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
// OCR CALL (FULL DEBUG)
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

  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed: response.ok ? JSON.parse(raw) : null,
  };
};

// -----------------------------
// Normalize Name
// -----------------------------
const normalizeName = (name: string) => {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .split(' ')
    .filter(Boolean);
};

// -----------------------------
// Compare Names
// -----------------------------
const compareNames = (nameA: string, nameB: string) => {
  const tokensA = normalizeName(nameA);
  const tokensB = normalizeName(nameB);

  let matches = 0;

  tokensA.forEach(a => {
    if (tokensB.includes(a)) matches++;
  });

  const confidence = Math.max(
    matches / tokensA.length,
    matches / tokensB.length
  );

  return {
    match: confidence >= 0.6,
    confidence,
    tokensA,
    tokensB,
  };
};

// -----------------------------
// Handler
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let debug: any = { step: 'init' };

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', debug });
  }

  try {
    const { imageUrls } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid imageUrls',
      });
    }

    const apiKey = process.env.OPTIC_OCR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing OCR API key',
      });
    }

    let results: any[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];

      let fileDebug: any = { index: i, url };

      try {
        // Fetch image
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch image');

        let originalBuffer = Buffer.from(await response.arrayBuffer());

        fileDebug.originalSizeKB = (originalBuffer.length / 1024).toFixed(2);

        // Compress
        const { buffer, meta } = await normalizeImage(originalBuffer);
        fileDebug.compression = meta;

        if (buffer.length > 1.5 * 1024 * 1024) {
          throw new Error('Still too large after compression');
        }

        // OCR
        const ocr = await runOCR(buffer, apiKey);

        fileDebug.ocrStatus = ocr.status;
        fileDebug.ocrRaw = ocr.raw.slice(0, 500); // prevent huge logs

        if (!ocr.ok) {
          throw new Error(`OCR API failed (${ocr.status})`);
        }

        const text = (ocr.parsed?.text || '').toLowerCase();
        const name = extractName(text);

        fileDebug.textSample = text.slice(0, 200);
        fileDebug.extractedName = name;

        results.push({
          success: true,
          name,
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

    const names = results.map(r => r.name).filter(Boolean);

    let allMatch = false;
    let comparisons: any[] = [];

    if (names.length >= 2) {
      const base = names[0];

      comparisons = names.slice(1).map(n => ({
        base,
        comparedWith: n,
        ...compareNames(base, n),
      }));

      allMatch = comparisons.every(c => c.match);
    }

    return res.status(200).json({
      success: allMatch,
      results,
      debug: {
        names,
        comparisons,
      },
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}