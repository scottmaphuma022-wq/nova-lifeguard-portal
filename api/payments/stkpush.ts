import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  return res.data.access_token;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, amount, cover_id } = req.body;

    if (!phone || !amount || !cover_id) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/\s+/g, '');
    if (normalizedPhone.startsWith('07')) normalizedPhone = '254' + normalizedPhone.substring(1);
    if (normalizedPhone.startsWith('01')) normalizedPhone = '254' + normalizedPhone.substring(1);

    const token = await getAccessToken();

    // Timestamp in Nairobi timezone
    const timestamp = dayjs().tz('Africa/Nairobi').format('YYYYMMDDHHmmss');
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const response = await axios.post(
      `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: normalizedPhone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: normalizedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: 'Insurance Payment',
        TransactionDesc: 'Premium Payment',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.status(200).json(response.data);
  } catch (err: any) {
    console.error('STK Push Error:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'STK Push failed',
      details: err.response?.data || err.message,
    });
  }
}
