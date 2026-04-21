import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import FormData from 'form-data';
import formidable from 'formidable';
import fs from 'fs';

// 🚨 disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const form = formidable();

    const [fields, files]: any = await form.parse(req);

    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.filepath));

    const response = await fetch('https://api.optiic.dev/process', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPTIC_OCR_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();

    return res.status(200).json({
      success: true,
      text: data.text || data,
    });

  } catch (err) {
    console.error('OCR ERROR:', err);
    return res.status(500).json({ error: 'OCR failed' });
  }
}