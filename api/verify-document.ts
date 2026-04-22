import type { NextApiRequest, NextApiResponse } from 'next';
import vision from '@google-cloud/vision';

// -----------------------------
// INIT CLIENT (supports Vercel)
// -----------------------------
const client = new vision.ImageAnnotatorClient({
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    : undefined,
});

// -----------------------------
// GOOGLE OCR
// -----------------------------
const runOCR = async (imageUrl: string) => {
  try {
    const [result] = await client.textDetection(imageUrl);

    const text = result.fullTextAnnotation?.text || '';

    return {
      ok: true,
      text,
    };

  } catch (err: any) {
    return {
      ok: false,
      text: '',
      error: err.message,
    };
  }
};

// -----------------------------
// CLEAN TEXT
// -----------------------------
const cleanText = (text: string) =>
  text.replace(/\n/g, ' ').replace(/\s+/g, ' ').toUpperCase();

// -----------------------------
// NAME EXTRACTION
// -----------------------------
const STOP_WORDS = [
  'REPUBLIC', 'KENYA', 'IDENTITY', 'CARD',
  'NATIONAL', 'ID', 'NUMBER', 'SEX', 'DATE',
  'BIRTH', 'PLACE', 'ISSUE'
];

const extractNames = (text: string) => {
  const matches = text.match(/[A-Z]{2,}(?:\s[A-Z]{2,}){1,3}/g) || [];

  return matches.filter(n =>
    !STOP_WORDS.some(w => n.includes(w))
  );
};

// -----------------------------
// ID NUMBER
// -----------------------------
const extractId = (text: string) => {
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

  return score >= 0.6;
};

// -----------------------------
// HANDLER
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { imageUrls } = req.body;

    if (!Array.isArray(imageUrls)) {
      return res.status(400).json({ success: false });
    }

    // ✅ PARALLEL OCR
    const results = await Promise.all(
      imageUrls.map(async (url: string) => {
        const ocr = await runOCR(url);

        if (!ocr.ok) {
          return {
            success: false,
            text: '',
            names: [],
            id: null,
          };
        }

        const text = cleanText(ocr.text);
        const names = extractNames(text);
        const id = extractId(text);

        return {
          success: true,
          text,
          names,
          id,
        };
      })
    );

    // -----------------------------
    // COMPARE
    // -----------------------------
    const allNames = results.map(r => r.names).filter(n => n.length > 0);

    let nameMatch = false;

    if (allNames.length >= 2) {
      const base = allNames[0];
      nameMatch = allNames.slice(1).every(n => similarity(base, n));
    }

    const ids = results.map(r => r.id).filter(Boolean);
    const idMatch = ids.length >= 2 && ids.every(id => id === ids[0]);

    const success = nameMatch || idMatch;

    return res.status(200).json({
      success,
      message: success ? 'Documents verified' : 'Document mismatch',
      results,
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}