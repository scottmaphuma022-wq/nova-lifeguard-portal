// api/payments/callback.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

type MpesaRaw = any;

/* ============================
   SAFE PAYLOAD EXTRACTION
============================ */
function extractCallback(payload: MpesaRaw) {
  const cb =
    payload?.Body?.stkCallback ??
    payload?.body?.stkCallback ??
    payload?.stkCallback ??
    payload;

  const ResultCode = Number(cb?.ResultCode ?? -1);
  const ResultDesc = cb?.ResultDesc ?? "";

  const CheckoutRequestID: string | null =
    cb?.CheckoutRequestID ?? null;

  const MerchantRequestID: string | null =
    cb?.MerchantRequestID ?? null;

  const items =
    cb?.CallbackMetadata?.Item ??
    cb?.callbackMetadata?.Item ??
    [];

  const findItem = (name: string) => {
    if (!Array.isArray(items)) return null;
    const it = items.find((i: any) => i?.Name === name);
    return it?.Value ?? null;
  };

  const Amount = Number(findItem("Amount") ?? 0);
  const MpesaReceiptNumber = findItem("MpesaReceiptNumber");
  const PhoneNumber = findItem("PhoneNumber");
  const TransactionDateRaw = findItem("TransactionDate");

  let TransactionDate: Date | null = null;
  if (typeof TransactionDateRaw === "string" && /^\d{14}$/.test(TransactionDateRaw)) {
    const t = TransactionDateRaw;
    TransactionDate = new Date(
      `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(
        8,
        10
      )}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`
    );
  }

  return {
    CheckoutRequestID,
    MerchantRequestID,
    ResultCode,
    ResultDesc,
    Amount,
    MpesaReceiptNumber,
    PhoneNumber,
    TransactionDate,
    raw: payload,
  };
}

/* ============================
   MAIN PROCESSOR
============================ */
async function processMpesaCallback(rawPayload: MpesaRaw) {
  const {
    CheckoutRequestID,
    MerchantRequestID,
    ResultCode,
    ResultDesc,
    Amount,
    MpesaReceiptNumber,
    TransactionDate,
    raw,
  } = extractCallback(rawPayload);

  if (!CheckoutRequestID) {
    throw new Error("Missing CheckoutRequestID");
  }

  /* ============================
     FETCH MPESA TRANSACTION
  ============================ */
  const { data: tx, error: txError } = await supabase
    .from("mpesa_transactions")
    .select("*")
    .eq("checkout_request_id", CheckoutRequestID)
    .single();

  if (txError || !tx) {
    throw new Error("Mpesa transaction not found");
  }

  /* ============================
     IDEMPOTENCY CHECK
  ============================ */
  if (tx.transaction_status === "completed") {
    return;
  }

  const status = ResultCode === 0 ? "completed" : "failed";

  /* ============================
     UPDATE MPESA TRANSACTION
  ============================ */
  await supabase
    .from("mpesa_transactions")
    .update({
      transaction_status: status,
      mpesa_receipt_number: MpesaReceiptNumber,
      merchant_request_id: MerchantRequestID,
      transaction_date: TransactionDate ?? new Date(),
    })
    .eq("id", tx.id);

  /* ============================
     UPDATE PAYMENT RECORD
  ============================ */
  if (tx.payment_id) {
    await supabase
      .from("payments")
      .update({
        payment_status: status,
        amount_paid: Amount,
        payment_date: TransactionDate ?? new Date(),
      })
      .eq("id", tx.payment_id);
  }

  /* ============================
     STORE CALLBACK (AUDIT)
  ============================ */
  await supabase.from("mpesa_callbacks").insert({
    checkout_request_id: CheckoutRequestID,
    result_code: ResultCode,
    result_description: ResultDesc,
    callback_payload: raw,
  });
}

/* ============================
   VERCEL HANDLER
============================ */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    await processMpesaCallback(req.body);

    // SAFARICOM MUST ALWAYS RECEIVE 200
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  } catch (err: any) {
    console.error("❌ MPESA CALLBACK ERROR:", err);

    // Still return 200 to avoid retries storm
    return res.status(200).json({
      ResultCode: 1,
      ResultDesc: err?.message ?? "Failed",
    });
  }
}
