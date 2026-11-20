import { getWebhookSecret } from "@/lib/config";
import { getDb, type Db } from "@/lib/db/client";
import {
  applyPaymentSucceeded,
  getOrder,
  recordPaymentEvent,
} from "@/lib/orders";
import { verifySignature } from "@/lib/payments/signature";
import { paymentEventSchema } from "@/lib/payments/types";

export type WebhookResult =
  | { ok: true; outcome: "applied" | "duplicate" | "recorded" }
  | { ok: false; status: 400 | 404 | 422; error: string };

/**
 * Handles one webhook delivery from the payment provider. This is the only
 * path by which an order becomes paid: the browser returning from the payment
 * page proves nothing, a signed message from the provider does.
 *
 * Order of checks matters:
 *   1. signature, against the raw body, before parsing anything
 *   2. shape of the event
 *   3. the order exists, and the session and amount are the ones we opened
 *   4. apply once (the event id is unique in payment_events)
 */
export async function handlePaymentWebhook(
  rawBody: string,
  signatureHeader: string | null,
  deps: { db?: Db; secret?: string } = {},
): Promise<WebhookResult> {
  const db = deps.db ?? getDb();
  const secret = deps.secret ?? getWebhookSecret();

  if (!verifySignature(rawBody, signatureHeader, secret)) {
    return { ok: false, status: 400, error: "Invalid signature" };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "Body is not JSON" };
  }
  const parsed = paymentEventSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Not a payment event" };
  }
  const event = parsed.data;

  const order = await getOrder(event.data.orderId, db);
  if (!order) {
    return { ok: false, status: 404, error: "Unknown order" };
  }

  const record = {
    id: event.id,
    orderId: order.id,
    type: event.type,
    payload: rawBody,
  };

  if (event.type === "payment.failed") {
    // Kept for support and audit. The order stays open so the customer can
    // try another card.
    const outcome = await recordPaymentEvent(record, db);
    return { ok: true, outcome };
  }

  if (event.data.sessionId !== order.paymentSessionId) {
    return {
      ok: false,
      status: 422,
      error: "Event is for a payment session this order did not open",
    };
  }
  if (
    event.data.amountCents !== order.totalCents ||
    event.data.currency !== order.currency
  ) {
    return {
      ok: false,
      status: 422,
      error: "Paid amount does not match the order total",
    };
  }

  const outcome = await applyPaymentSucceeded(
    { ...record, card: event.data.card },
    db,
  );
  return { ok: true, outcome };
}
