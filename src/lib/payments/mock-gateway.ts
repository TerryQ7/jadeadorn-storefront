import { getWebhookSecret } from "@/lib/config";
import { getDb, type Db } from "@/lib/db/client";
import { randomId } from "@/lib/ids";
import { signPayload } from "@/lib/payments/signature";
import { TEST_CARDS } from "@/lib/payments/test-cards";
import type { PaymentEvent, PaymentProvider } from "@/lib/payments/types";
import { handlePaymentWebhook } from "@/lib/payments/webhook";

// ---------------------------------------------------------------------------
// MOCK PAYMENT GATEWAY. No money moves and no real card is ever accepted.
//
// It stands in for a hosted payment page such as Stripe Checkout and behaves
// like one from the store's point of view:
//   1. the store asks it to open a session for an amount
//   2. the customer enters card details on the gateway's page, not the store's
//   3. the gateway reports the result back with a signed webhook
//
// Everything in this file would run on the provider's servers in production.
// ---------------------------------------------------------------------------

export type MockSession = {
  id: string;
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  status: "open" | "paid";
};

export function createMockProvider(db: Db = getDb()): PaymentProvider {
  return {
    name: "mock",
    async createSession({ orderId, orderNumber, amountCents, currency }) {
      const sessionId = randomId("mps");
      db.prepare(
        `INSERT INTO mock_gateway_sessions
           (id, order_id, order_number, amount_cents, currency, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      ).run(
        sessionId,
        orderId,
        orderNumber,
        amountCents,
        currency,
        new Date().toISOString(),
      );
      return {
        provider: "mock",
        sessionId,
        paymentUrl: `/mock-pay/${sessionId}`,
      };
    },
  };
}

export async function getMockSession(
  sessionId: string,
  db: Db = getDb(),
): Promise<MockSession | null> {
  const row = db
    .prepare(
      `SELECT id,
              order_id     AS orderId,
              order_number AS orderNumber,
              amount_cents AS amountCents,
              currency,
              status
         FROM mock_gateway_sessions
        WHERE id = ?`,
    )
    .get(sessionId) as MockSession | undefined;
  return row ?? null;
}

export type CardInput = { number: string; expiry: string; cvc: string };

export type PayResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      code: string;
      message: string;
      field?: "number" | "expiry" | "cvc";
    };

function isExpired(expiry: string, now: Date): boolean | null {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return null;
  // A card is valid through the last day of its expiry month.
  const firstInvalidDay = new Date(Date.UTC(year, month, 1));
  return now >= firstInvalidDay;
}

export async function payMockSession(
  sessionId: string,
  card: CardInput,
  deps: { db?: Db; secret?: string; now?: Date } = {},
): Promise<PayResult> {
  const db = deps.db ?? getDb();
  const secret = deps.secret ?? getWebhookSecret();

  const session = await getMockSession(sessionId, db);
  if (!session) {
    return {
      ok: false,
      code: "session_not_found",
      message: "This payment link is not valid.",
    };
  }
  if (session.status === "paid") {
    return { ok: true, orderId: session.orderId };
  }

  const number = card.number.replace(/[\s-]/g, "");
  if (!/^\d{12,19}$/.test(number)) {
    return {
      ok: false,
      code: "invalid_number",
      message: "Enter the full card number.",
      field: "number",
    };
  }
  const expired = isExpired(card.expiry, deps.now ?? new Date());
  if (expired === null) {
    return {
      ok: false,
      code: "invalid_expiry",
      message: "Enter the expiry date as MM/YY.",
      field: "expiry",
    };
  }
  if (expired) {
    return {
      ok: false,
      code: "expired_card",
      message: "This card has expired.",
      field: "expiry",
    };
  }
  if (!/^\d{3,4}$/.test(card.cvc.trim())) {
    return {
      ok: false,
      code: "invalid_cvc",
      message: "Enter the 3 or 4 digit security code.",
      field: "cvc",
    };
  }

  const testCard = TEST_CARDS.find((c) => c.number === number);
  if (!testCard) {
    return {
      ok: false,
      code: "unsupported_card",
      message:
        "This is a test checkout. It only accepts the test cards listed on this page.",
      field: "number",
    };
  }

  const deliver = (event: PaymentEvent) => {
    const rawBody = JSON.stringify(event);
    return handlePaymentWebhook(rawBody, signPayload(rawBody, secret), {
      db,
      secret,
    });
  };
  const baseEvent = {
    id: randomId("evt"),
    createdAt: new Date().toISOString(),
    data: {
      sessionId: session.id,
      orderId: session.orderId,
      amountCents: session.amountCents,
      currency: session.currency,
    },
  };

  if (testCard.outcome === "declined") {
    await deliver({
      ...baseEvent,
      type: "payment.failed",
      data: { ...baseEvent.data, failureCode: testCard.code },
    });
    return { ok: false, code: testCard.code, message: testCard.message };
  }

  // Claim the session atomically. If two submissions race, only one of them
  // flips it from open to paid; the other sees zero rows changed.
  const claimed = db
    .prepare(
      `UPDATE mock_gateway_sessions
          SET status = 'paid', paid_at = ?
        WHERE id = ? AND status = 'open'`,
    )
    .run(new Date().toISOString(), session.id);
  if (claimed.changes === 0) {
    return { ok: true, orderId: session.orderId };
  }

  let delivered = false;
  try {
    const delivery = await deliver({
      ...baseEvent,
      type: "payment.succeeded",
      data: {
        ...baseEvent.data,
        // Only the brand and last four digits leave the gateway. The full
        // number is never written anywhere.
        card: { brand: testCard.brand, last4: number.slice(-4) },
      },
    });
    delivered = delivery.ok;
  } catch (error) {
    console.error("Mock gateway could not deliver the payment webhook", error);
  }

  if (!delivered) {
    // The store did not record the payment (it refused the event, or the
    // delivery crashed). A real gateway would keep the charge and retry the
    // webhook; the mock has no retry queue, so it reopens the session. That
    // way the gateway never says "paid" while the store says "unpaid".
    db.prepare(
      "UPDATE mock_gateway_sessions SET status = 'open', paid_at = NULL WHERE id = ?",
    ).run(session.id);
    return {
      ok: false,
      code: "processing_error",
      message: "The payment could not be completed. Try again.",
    };
  }
  return { ok: true, orderId: session.orderId };
}
