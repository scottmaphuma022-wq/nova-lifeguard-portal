// api/payments/stkpush.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import dayjs from "dayjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/* ============================
   MPESA CONFIG
============================ */
const MPESA_ENV = process.env.MPESA_ENVIRONMENT || "sandbox";

const BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE!;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY!;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL!;

/* ============================
   ACCESS TOKEN
============================ */
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  return data.access_token;
}

/* ============================
   HANDLER
============================ */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { phone, amount, user_id, cover_id, plan_tier } = req.body;

    if (!phone || !amount || !user_id || !cover_id || !plan_tier) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    /* ============================
       NORMALIZE PHONE
    ============================ */
    let normalizedPhone = String(phone).trim();
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = `254${normalizedPhone.slice(1)}`;
    }
    if (normalizedPhone.startsWith("+")) {
      normalizedPhone = normalizedPhone.slice(1);
    }

    /* ============================
       1️⃣ CREATE PAYMENT FIRST
    ============================ */
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id,
        cover_id,
        plan_tier,
        amount_paid: amount,
        payment_status: "initiated",
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("Payment creation failed:", paymentError);
      throw new Error("Failed to create payment");
    }

    /* ============================
       2️⃣ IDEMPOTENT MPESA TX
    ============================ */
    const { data: existingTx } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("payment_id", payment.id)
      .maybeSingle();

    let txRow = existingTx;

    if (!txRow) {
      const { data, error } = await supabase
        .from("mpesa_transactions")
        .insert({
          user_id,
          payment_id: payment.id,
          phone_number: normalizedPhone,
          amount,
          transaction_type: "insurance_payment",
          transaction_status: "initiated",
        })
        .select()
        .single();

      if (error || !data) {
        console.error("MPESA TX creation failed:", error);
        throw new Error("Failed to create mpesa transaction");
      }

      txRow = data;
    }

    /* ============================
       3️⃣ MPESA ACCESS TOKEN
    ============================ */
    const accessToken = await getAccessToken();

    /* ============================
       4️⃣ STK PUSH
    ============================ */
    const timestamp = dayjs().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkRes = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Number(amount),
        PartyA: normalizedPhone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: normalizedPhone,
        CallBackURL: MPESA_CALLBACK_URL,
        AccountReference: payment.id,
        TransactionDesc: "Insurance Payment",
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    /* ============================
       5️⃣ UPDATE MPESA TX
    ============================ */
    await supabase
      .from("mpesa_transactions")
      .update({
        merchant_request_id: stkRes.data.MerchantRequestID,
        checkout_request_id: stkRes.data.CheckoutRequestID,
      })
      .eq("id", txRow.id);

    /* ============================
       6️⃣ RESPONSE
    ============================ */
    return res.status(200).json({
      success: true,
      checkoutRequestID: stkRes.data.CheckoutRequestID,
    });
  } catch (err: any) {
    console.error(
      "❌ STK PUSH ERROR:",
      err?.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      message: "STK Push failed",
      error: err?.response?.data || err.message,
    });
  }
}
