// api/payments/callback.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

type MpesaRaw = any;

function extractCallback(payload: MpesaRaw) {
  const cb =
    payload?.Body?.stkCallback ?? payload?.body?.stkCallback ?? payload?.stkCallback ?? payload;

  const ResultCode = Number(cb?.ResultCode ?? cb?.resultCode ?? cb?.Result ?? -1);
  const ResultDesc = cb?.ResultDesc ?? cb?.resultDesc ?? cb?.ResultDescription ?? "";

  const CheckoutRequestID = cb?.CheckoutRequestID ?? cb?.checkoutRequestID ?? null;
  const MerchantRequestID = cb?.MerchantRequestID ?? cb?.merchantRequestID ?? null;

  const items = cb?.CallbackMetadata?.Item ?? cb?.callbackMetadata?.Item ?? cb?.CallbackMetadata ?? [];

  const findItem = (name: string) => {
    if (!Array.isArray(items)) return undefined;
    const it = items.find((x: any) => (x?.Name ?? x?.name) === name);
    return it?.Value ?? it?.value;
  };

  const Amount = Number(cb?.Amount ?? findItem("Amount") ?? 0);
  const MpesaReceiptNumber = cb?.MpesaReceiptNumber ?? findItem("MpesaReceiptNumber") ?? findItem("ReceiptNumber") ?? null;
  const PhoneNumber = cb?.PhoneNumber ?? findItem("PhoneNumber") ?? findItem("MSISDN") ?? null;
  const TransactionDateRaw = cb?.TransactionDate ?? findItem("TransactionDate") ?? findItem("Transaction") ?? null;

  let TransactionDate: Date | null = null;
  if (typeof TransactionDateRaw === "string" && /^\d{14}$/.test(TransactionDateRaw)) {
    const t = TransactionDateRaw;
    TransactionDate = new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z`);
  } else if (TransactionDateRaw) {
    const d = new Date(TransactionDateRaw);
    TransactionDate = isNaN(d.getTime()) ? null : d;
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

async function processMpesaCallback(rawPayload: MpesaRaw) {
  const {
    CheckoutRequestID,
    ResultCode,
    ResultDesc,
    Amount,
    MpesaReceiptNumber,
    PhoneNumber,
    TransactionDate,
    raw,
  } = extractCallback(rawPayload);

  if (!CheckoutRequestID) {
    console.error("Missing CheckoutRequestID in callback:", rawPayload);
    throw new Error("Missing CheckoutRequestID");
  }

  // 1️⃣ Fetch MPESA transaction
  const { data: txRow, error: txError } = await supabase
    .from("mpesa_transactions")
    .select("*")
    .eq("checkout_request_id", CheckoutRequestID)
    .single();

  if (txError || !txRow) {
    console.error("MPESA transaction not found:", CheckoutRequestID, txError);
    throw new Error("MPESA transaction not found");
  }

  // 2️⃣ Determine status
  const status = ResultCode === 0 ? "success" : "failed";

  let paymentId: string | null = null;

  // 3️⃣ Create insurance payment if successful
  if (status === "success") {
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: txRow.user_id,
        cover_id: txRow.payment_id ? txRow.payment_id : txRow.id, // If we already know cover_id, adjust accordingly
        plan_tier: txRow.transaction_type === "insurance_payment" ? txRow.transaction_type : "standard", // adapt as needed
        amount_paid: Amount,
        payment_status: "completed",
        payment_date: TransactionDate ?? new Date(),
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("Failed to create payment record:", paymentError);
      throw paymentError || new Error("Failed to create payment record");
    }

    paymentId = payment.id;
  }

  // 4️⃣ Update MPESA transaction row
  await supabase
    .from("mpesa_transactions")
    .update({
      transaction_status: status,
      mpesa_receipt_number: MpesaReceiptNumber,
      merchant_request_id: MerchantRequestID,
      transaction_date: TransactionDate ?? new Date(),
      payment_id: paymentId,
    })
    .eq("id", txRow.id);

  // 5️⃣ Optional: log callback
  await supabase.from("mpesa_callbacks").insert({
    checkout_request_id: CheckoutRequestID,
    result_code: ResultCode,
    result_description: ResultDesc,
    callback_payload: raw,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    await processMpesaCallback(req.body);

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  } catch (err: any) {
    console.error("MPESA CALLBACK ERROR:", err);

    return res.status(200).json({
      ResultCode: 1,
      ResultDesc: err?.message ?? "Failed",
    });
  }
}
