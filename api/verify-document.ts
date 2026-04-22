import type { NextApiRequest, NextApiResponse } from 'next';
import vision from '@google-cloud/vision';

// -----------------------------
// INIT CLIENT (Vercel-safe)
// -----------------------------
const client = new vision.ImageAnnotatorClient({
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    : undefined,
});

// -----------------------------
// GOOGLE OCR (DOCUMENT MODE 🔥)
// -----------------------------
const runOCR = async (imageUrl: string) => {
  try {
    const [result] = await client.documentTextDetection(imageUrl);

    const fullText = result.fullTextAnnotation?.text || '';

    return {
      ok: true,
      text: fullText,
    };
  } catch (err: any) {
    console.error('❌ OCR ERROR:', err.message);
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
  text.replace(/\r/g, '').replace(/\t/g, '');

// -----------------------------
// 🔥 KENYAN ID FIELD EXTRACTION
// -----------------------------
const extractKenyanIDFields = (raw: string) => {
  const text = raw.toUpperCase();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let name = '';
  let idNumber: string | null = null;
  let dob: string | null = null;

  // -----------------------------
  // ID NUMBER (robust)
  // -----------------------------
  const idMatch = text.match(/\b\d{7,9}\b/);
  if (idMatch) idNumber = idMatch[0];

  // -----------------------------
  // DOB (multiple formats)
  // -----------------------------
  const dobMatch =
    text.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/) || // 12/05/1990
    text.match(/\b\d{2}\s[A-Z]{3}\s\d{4}\b/);       // 12 MAY 1990

  if (dobMatch) dob = dobMatch[0];

  // -----------------------------
  // NAME (layout-aware 🔥)
  // Look for lines between ID NO and SEX or DOB
  // -----------------------------
  let capture = false;
  let nameParts: string[] = [];

  for (const line of lines) {
    if (
      line.includes('ID NO') ||
      line.includes('IDENTITY NO') ||
      line.includes('ID NUMBER')
    ) {
      capture = true;
      continue;
    }

    if (
      line.includes('SEX') ||
      line.includes('DATE OF BIRTH') ||
      line.includes('DOB')
    ) {
      capture = false;
    }

    if (capture) {
      // filter noise
      if (
        line.length > 2 &&
        !/\d/.test(line) &&
        !line.includes('REPUBLIC') &&
        !line.includes('KENYA')
      ) {
        nameParts.push(line);
      }
    }
  }

  // fallback if layout fails
  if (nameParts.length === 0) {
    const fallback = text.match(/[A-Z]{2,}(?:\s[A-Z]{2,}){1,3}/g);
    if (fallback) nameParts = [fallback[0]];
  }

  name = nameParts.join(' ').trim();

  return {
    name,
    idNumber,
    dob,
  };
};

// -----------------------------
// NAME SIMILARITY
// -----------------------------
const nameSimilarity = (a: string, b: string) => {
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));

  let match = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) match++;
  });

  const score = match / Math.max(tokensA.size, tokensB.size, 1);

  return score >= 0.7;
};

// -----------------------------
// HANDLER
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debug: any = {
    step: 'start',
    time: new Date().toISOString(),
  };

  try {
    const { imageUrls } = req.body;

    if (!Array.isArray(imageUrls)) {
      return res.status(400).json({ success: false });
    }

    console.log('📥 INPUT URLS:', imageUrls);

    // -----------------------------
    // PARALLEL OCR
    // -----------------------------
    const results = await Promise.all(
      imageUrls.map(async (url: string, index: number) => {
        const log: any = { index, url };

        const ocr = await runOCR(url);

        if (!ocr.ok) {
          log.error = ocr.error;
          console.error('❌ OCR FAIL:', log);

          return {
            success: false,
            fields: null,
            debug: log,
          };
        }

        const cleaned = cleanText(ocr.text);

        const fields = extractKenyanIDFields(cleaned);

        log.preview = cleaned.slice(0, 200);
        log.fields = fields;

        console.log('📄 OCR RESULT:', log);

        return {
          success: true,
          fields,
          debug: log,
        };
      })
    );

    // -----------------------------
    // COMPARE
    // -----------------------------
    const names = results
      .map(r => r.fields?.name)
      .filter(Boolean);

    const ids = results
      .map(r => r.fields?.idNumber)
      .filter(Boolean);

    const dobs = results
      .map(r => r.fields?.dob)
      .filter(Boolean);

    let nameMatch = false;
    let idMatch = false;
    let dobMatch = false;

    if (names.length >= 2) {
      const base = names[0];
      nameMatch = names.slice(1).every(n => nameSimilarity(base, n));
    }

    if (ids.length >= 2) {
      idMatch = ids.every(id => id === ids[0]);
    }

    if (dobs.length >= 2) {
      dobMatch = dobs.every(d => d === dobs[0]);
    }

    const finalMatch = idMatch || (nameMatch && dobMatch);

    const response = {
      success: finalMatch,
      message: finalMatch ? 'Documents verified' : 'Document mismatch',
      results,
      debug: {
        names,
        ids,
        dobs,
        nameMatch,
        idMatch,
        dobMatch,
      },
    };

    console.log('✅ FINAL RESULT:', JSON.stringify(response, null, 2));

    return res.status(200).json(response);

  } catch (err: any) {
    console.error('🔥 SERVER ERROR:', err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}