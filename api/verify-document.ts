import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import sharp from 'sharp';

// 🚨 disable Next.js body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// -----------------------------
// Parse FormData (MULTIPLE FILES)
// -----------------------------
const parseForm = (req: NextApiRequest) =>
  new Promise<{ fields: any; files: any }>((resolve, reject) => {
    const form = formidable({
      multiples: true, // ✅ IMPORTANT
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024,
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

// -----------------------------
// Normalize Image
// -----------------------------
const normalizeImage = async (buffer: Buffer) => {
  return await sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
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
    .replace(/[^A-Z\s]/g, '') // remove noise
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
    match: confidence >= 0.6, // 🔥 threshold (tunable)
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
    debug.step = 'parse_form';

    const { files } = await parseForm(req);

    if (!files || !files.file) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        debug,
      });
    }

    const uploadedFiles = Array.isArray(files.file)
      ? files.file
      : [files.file];

    debug.totalFiles = uploadedFiles.length;

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
    // PROCESS EACH FILE
    // -----------------------------
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      let fileDebug: any = {
        index: i,
        mimetype: file.mimetype,
        size: file.size,
      };

      if (!file.mimetype?.startsWith('image/')) {
        fileDebug.error = 'invalid_type';
        results.push({ success: false, debug: fileDebug });
        continue;
      }

      let buffer = fs.readFileSync(file.filepath);

      buffer = await normalizeImage(buffer);

      try {
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

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
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