// api/payments/Callback.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const callbackPayload = req.body;

    // Safaricom sends the STK callback in callbackPayload.Body.stkCallback
    const stkCallback = callbackPayload?.Body?.stkCallback;
    if (!stkCallback) {
      console.log('Invalid callback payload:', callbackPayload);
      return res.status(400).json({ error: 'Invalid callback payload' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // Store the callback in mpesa_callbacks table
    const { error: cbError } = await supabase
      .from('mpesa_callbacks')
      .insert([
        {
          checkout_request_id: CheckoutRequestID,
          result_code: ResultCode,
          result_description: ResultDesc,
          callback_payload: callbackPayload,
        },
      ]);

    if (cbError) {
      console.error('Failed to insert callback:', cbError);
      return res.status(500).json({ error: 'Failed to store callback' });
    }

    console.log(`STK Callback stored for CheckoutRequestID: ${CheckoutRequestID}`);

    // Optional: update mpesa_transactions if ResultCode == 0 (success)
    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const amountItem = CallbackMetadata.Item.find((i: any) => i.Name === 'Amount');
      const mpesaReceiptItem = CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber');
      const phoneItem = CallbackMetadata.Item.find((i: any) => i.Name === 'PhoneNumber');

      if (amountItem && mpesaReceiptItem && phoneItem) {
        const amount = amountItem.Value;
        const receipt = mpesaReceiptItem.Value;
        const phone = phoneItem.Value;

        // Optionally, insert a new transaction record
        const { error: txError } = await supabase
          .from('mpesa_transactions')
          .insert([
            {
              user_id: null, // You can map to user if you store CheckoutRequestID with payment
              phone_number: phone.toString(),
              amount,
              checkout_request_id: CheckoutRequestID,
              mpesa_receipt_number: receipt,
              transaction_type: 'CustomerPayBillOnline',
              transaction_status: 'completed',
            },
          ]);

        if (txError) console.error('Failed to insert transaction:', txError);
        else console.log('MPESA transaction recorded:', receipt);
      }
    }

    // Must respond 200 OK to M-Pesa
    return res.status(200).json({ message: 'Callback received successfully' });
  } catch (error: any) {
    console.error('Callback handler error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
