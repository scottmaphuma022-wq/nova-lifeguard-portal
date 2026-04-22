import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import sharp from 'sharp'; // ✅ image optimization

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
      maxFileSize: 10 * 1024 * 1024,
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

// -----------------------------
// Normalize Image for OCR 🔥
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
// Handler
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseForm(req);

    const uploaded = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    const docType = fields?.docType || 'unknown';

    if (!uploaded) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    // -----------------------------
    // ONLY ALLOW IMAGES ✅
    // -----------------------------
    if (!uploaded.mimetype?.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'Only image uploads are allowed. Convert PDF before upload.',
      });
    }

    let buffer: Buffer = fs.readFileSync(uploaded.filepath);

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Empty file received',
      });
    }

    // -----------------------------
    // Normalize for OCR 🔥
    // -----------------------------
    buffer = await normalizeImage(buffer);

    const base64Image = buffer.toString('base64');

    const apiKey = process.env.OPTIC_OCR_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing OCR API key',
      });
    }

    // -----------------------------
    // OCR REQUEST
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

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: 'OCR API error',
        status: response.status,
        details: raw,
      });
    }

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

    const text = (data?.text || '').toLowerCase();

    // -----------------------------
    // BASIC VALIDATION 🔥
    // -----------------------------
    let valid = true;

    if (docType.toLowerCase().includes('id')) {
      if (!text.includes('id') && !text.includes('republic')) {
        valid = false;
      }
    }

    if (docType.toLowerCase().includes('certificate')) {
      if (!text.includes('certificate')) {
        valid = false;
      }
    }

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: valid,
      extractedText: text,
      docType,
    });

  } catch (err: any) {
    console.error('💥 OCR ERROR:', err);

    return res.status(500).json({
      success: false,
      error: 'OCR processing failed',
      message: err?.message || 'Unknown error',
    });
  }
}