import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch'; // ✅ ensure fetch works in all runtimes

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
      maxFileSize: 10 * 1024 * 1024, // 10MB
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

    console.log("FILES RECEIVED:", files);

    // flexible extraction
    const uploaded = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploaded) {
      console.log("❌ No file field found");
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    console.log("FILE INFO:", {
      filepath: uploaded.filepath,
      mimetype: uploaded.mimetype,
      size: uploaded.size,
    });

    // read file
    const buffer = fs.readFileSync(uploaded.filepath);

    if (!buffer || buffer.length === 0) {
      console.log("❌ Empty file buffer");
      return res.status(400).json({
        success: false,
        error: 'Empty file received',
      });
    }

    console.log("✅ File read success. Size:", buffer.length);

    // convert to base64
    const base64Image = buffer.toString('base64');

    const apiKey = process.env.OPTIC_OCR_API_KEY;

    if (!apiKey) {
      console.log("❌ Missing OCR API key");
      return res.status(500).json({
        success: false,
        error: 'Missing OCR API key',
      });
    }

    console.log("🚀 Sending OCR request...");

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

    // 🔥 DEBUG LOGS (THIS IS WHAT YOU NEED)
    console.log("🔍 OCR STATUS:", response.status);
    console.log("🔍 OCR RAW RESPONSE:", raw);

    // handle HTTP errors
    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: 'OCR API error',
        status: response.status,
        details: raw,
      });
    }

    // safe JSON parsing
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.log("❌ JSON parse failed");
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON from OCR API',
        raw,
      });
    }

    console.log("✅ OCR SUCCESS");

    return res.status(200).json({
      success: true,
      text: data?.text || data,
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