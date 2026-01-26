// api/payments/stkpush.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import dayjs from "dayjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BASE_URL = process.env.MPESA_BASE_URL!;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE!;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY!;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL!;

async function getAccessToken() {
  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      auth: {
        username: process.env.MPESA_CONSUMER_KEY!,
        password: process.env.MPESA_CONSUMER_SECRET!,
      },
    }
  );
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { phone, amount, user_id, cover_id, plan_tier } = req.body;

    if (!phone || !amount || !user_id || !cover_id || !plan_tier) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Normalize Kenyan phone number
    let normalizedPhone = String(phone).trim();
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = `254${normalizedPhone.slice(1)}`;
    }
    if (normalizedPhone.startsWith("+")) {
      normalizedPhone = normalizedPhone.slice(1);
    }

    /**
     * 1️⃣ IDEMPOTENCY CHECK
     * Prevent duplicate MPESA transactions if request is sent twice
     */
    const { data: existing } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("user_id", user_id)
      .eq("amount", amount)
      .eq("transaction_status", "initiated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let transactionRow = existing;

    /**
     * 2️⃣ CREATE MPESA TRANSACTION ROW (ONLY IF NONE EXISTS)
     */
    if (!transactionRow) {
      const { data, error } = await supabase
        .from("mpesa_transactions")
        .insert({
          user_id,
          phone_number: normalizedPhone,
          amount: amount,
          transaction_type: "insurance_payment",
          transaction_status: "initiated",
        })
        .select()
        .single();

      if (error || !data) {
        console.error("Failed to create MPESA transaction:", error);
        throw error || new Error("Could not create MPESA transaction");
      }

      transactionRow = data;
    }

    console.log("Using MPESA transaction row:", transactionRow.id);

    /**
     * 3️⃣ GENERATE MPESA ACCESS TOKEN
     */
    const accessToken = await getAccessToken();

    /**
     * 4️⃣ PREPARE STK PUSH REQUEST
     */
    const timestamp = dayjs().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkResponse = await axios.post(
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
        AccountReference: transactionRow.id,
        TransactionDesc: "Insurance Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const checkoutRequestID = stkResponse.data.CheckoutRequestID;

    /**
     * 5️⃣ UPDATE TRANSACTION ROW WITH CHECKOUT REQUEST ID
     */
    await supabase
      .from("mpesa_transactions")
      .update({ checkout_request_id: checkoutRequestID })
      .eq("id", transactionRow.id);

    console.log("Updated MPESA transaction with CheckoutRequestID:", checkoutRequestID);

    /**
     * 6️⃣ RETURN RESPONSE TO FRONTEND
     */
    return res.status(200).json({
      success: true,
      checkoutRequestID,
    });
  } catch (err: any) {
    console.error("STK Push error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}
