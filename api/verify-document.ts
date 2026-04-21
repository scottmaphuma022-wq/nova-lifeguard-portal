import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

// 🚨 disable Next.js body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// -----------------------------
// Parse FormData safely
// -----------------------------
const parseForm = (req: NextApiRequest) =>
  new Promise<{ fields: any; files: any }>((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

// -----------------------------
// Handler
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { files } = await parseForm(req);

    // flexible file extraction (array OR single)
    const uploaded = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploaded) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // file validation
    const buffer = fs.readFileSync(uploaded.filepath);

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Empty file received',
      });
    }

    // convert to base64 (most OCR APIs expect this more reliably than multipart)
    const base64Image = buffer.toString('base64');

    const apiKey = process.env.OPTIC_OCR_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing OCR API key',
      });
    }

    // -----------------------------
    // Call Optiic OCR API
    // -----------------------------
    const response = await fetch('https://api.optiic.dev/process', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
      }),
    });

    const raw = await response.text();

    // handle HTTP errors first
    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: 'OCR API error',
        details: raw,
      });
    }

    // safe JSON parsing
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON from OCR API',
        raw,
      });
    }

    return res.status(200).json({
      success: true,
      text: data?.text || data,
    });
  } catch (err: any) {
    console.error('OCR ERROR:', err);

    return res.status(500).json({
      success: false,
      error: 'OCR processing failed',
      message: err?.message || 'Unknown error',
    });
  }
}