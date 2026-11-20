import { handlePaymentWebhook } from "@/lib/payments/webhook";

// POST /api/webhooks/payment
// Where a payment provider reports results. The body is read as raw text
// because the signature is computed over the exact bytes that were sent;
// parsing and re-serialising the JSON first would break verification.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-payment-signature");

  const result = await handlePaymentWebhook(rawBody, signature);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  // 2xx tells the provider to stop retrying, including for duplicates.
  return Response.json({ received: true, outcome: result.outcome });
}
