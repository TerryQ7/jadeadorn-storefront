import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import { getOrder, type Order } from "@/lib/orders";
import { payMockSession } from "@/lib/payments/mock-gateway";
import { signPayload } from "@/lib/payments/signature";
import { handlePaymentWebhook } from "@/lib/payments/webhook";
import {
  count,
  createTestDb,
  placeTestOrder,
  productId,
  TEST_SECRET,
} from "./helpers";

const APPROVED = { number: "4242 4242 4242 4242", expiry: "12/34", cvc: "123" };
const DECLINED = { ...APPROVED, number: "4000 0000 0000 0002" };
const INSUFFICIENT = { ...APPROVED, number: "4000 0000 0000 9995" };

let db: Db;
let order: Order;
let deps: { db: Db; secret: string };

beforeEach(async () => {
  db = createTestDb();
  deps = { db, secret: TEST_SECRET };
  order = await placeTestOrder(db, [
    { productId: productId(db, "sandalwood-prayer-mala"), quantity: 1 },
  ]);
});

function sessionStatus(): string {
  const row = db
    .prepare("SELECT status FROM mock_gateway_sessions WHERE id = ?")
    .get(order.paymentSessionId) as { status: string };
  return row.status;
}

async function reload(): Promise<Order> {
  const fresh = await getOrder(order.id, db);
  if (!fresh) throw new Error("order disappeared");
  return fresh;
}

function signedEvent(overrides: Record<string, unknown> = {}) {
  const body = JSON.stringify({
    id: "evt_test_1",
    type: "payment.succeeded",
    createdAt: new Date().toISOString(),
    data: {
      sessionId: order.paymentSessionId,
      orderId: order.id,
      amountCents: order.totalCents,
      currency: "usd",
      card: { brand: "Visa", last4: "4242" },
    },
    ...overrides,
  });
  return { body, signature: signPayload(body, TEST_SECRET) };
}

describe("mock payment gateway", () => {
  it("marks the order paid when the approved test card is used", async () => {
    const result = await payMockSession(order.paymentSessionId!, APPROVED, deps);

    expect(result).toEqual({ ok: true, orderId: order.id });
    const paid = await reload();
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).not.toBeNull();
    expect(paid).toMatchObject({ cardBrand: "Visa", cardLast4: "4242" });
  });

  it("leaves the order unpaid when the card is declined", async () => {
    const result = await payMockSession(order.paymentSessionId!, DECLINED, deps);

    expect(result).toMatchObject({ ok: false, code: "card_declined" });
    expect((await reload()).status).toBe("pending_payment");
  });

  it("reports insufficient funds for that test card", async () => {
    const result = await payMockSession(
      order.paymentSessionId!,
      INSUFFICIENT,
      deps,
    );

    expect(result).toMatchObject({ ok: false, code: "insufficient_funds" });
  });

  it("lets the customer pay with another card after a decline", async () => {
    await payMockSession(order.paymentSessionId!, DECLINED, deps);
    const retry = await payMockSession(order.paymentSessionId!, APPROVED, deps);

    expect(retry.ok).toBe(true);
    expect((await reload()).status).toBe("paid");
  });

  it("refuses any card number that is not a listed test card", async () => {
    const result = await payMockSession(
      order.paymentSessionId!,
      { ...APPROVED, number: "5555 5555 5555 4444" },
      deps,
    );

    expect(result).toMatchObject({ ok: false, code: "unsupported_card" });
    expect((await reload()).status).toBe("pending_payment");
  });

  it("refuses an expired card", async () => {
    const result = await payMockSession(
      order.paymentSessionId!,
      { ...APPROVED, expiry: "01/20" },
      deps,
    );

    expect(result).toMatchObject({ ok: false, code: "expired_card" });
  });

  it("refuses a malformed security code", async () => {
    const result = await payMockSession(
      order.paymentSessionId!,
      { ...APPROVED, cvc: "12" },
      deps,
    );

    expect(result).toMatchObject({ ok: false, code: "invalid_cvc" });
  });

  it("does not charge twice when an already-paid session is submitted again", async () => {
    await payMockSession(order.paymentSessionId!, APPROVED, deps);
    const again = await payMockSession(order.paymentSessionId!, APPROVED, deps);

    expect(again).toEqual({ ok: true, orderId: order.id });
    const succeeded = db
      .prepare("SELECT COUNT(*) AS n FROM payment_events WHERE type = 'payment.succeeded'")
      .get() as { n: number };
    expect(succeeded.n).toBe(1);
  });

  it("keeps the session open when the store rejects the payment notification", async () => {
    // The order total no longer matches what the session was opened for.
    db.prepare("UPDATE orders SET total_cents = total_cents + 100 WHERE id = ?").run(order.id);

    const result = await payMockSession(order.paymentSessionId!, APPROVED, deps);

    expect(result).toMatchObject({ ok: false, code: "processing_error" });
    expect(sessionStatus()).toBe("open");
    expect((await reload()).status).toBe("pending_payment");
  });

  it("keeps the session open when delivering the notification crashes", async () => {
    db.exec("ALTER TABLE payment_events RENAME TO payment_events_offline");

    const crashed = await payMockSession(order.paymentSessionId!, APPROVED, deps);
    db.exec("ALTER TABLE payment_events_offline RENAME TO payment_events");
    const retried = await payMockSession(order.paymentSessionId!, APPROVED, deps);

    expect(crashed).toMatchObject({ ok: false, code: "processing_error" });
    expect(retried).toEqual({ ok: true, orderId: order.id });
    expect((await reload()).status).toBe("paid");
  });

  it("reports an unknown payment session", async () => {
    const result = await payMockSession("mps_does_not_exist", APPROVED, deps);

    expect(result).toMatchObject({ ok: false, code: "session_not_found" });
  });

  it("never stores the card number", async () => {
    await payMockSession(order.paymentSessionId!, APPROVED, deps);

    const dump = JSON.stringify([
      db.prepare("SELECT * FROM orders").all(),
      db.prepare("SELECT * FROM payment_events").all(),
      db.prepare("SELECT * FROM mock_gateway_sessions").all(),
    ]);
    expect(dump).not.toContain("4242424242424242");
    expect(dump).not.toContain("4242 4242 4242 4242");
  });
});

describe("payment webhook", () => {
  it("marks the order paid for a correctly signed success event", async () => {
    const { body, signature } = signedEvent();

    const result = await handlePaymentWebhook(body, signature, deps);

    expect(result).toEqual({ ok: true, outcome: "applied" });
    expect((await reload()).status).toBe("paid");
  });

  it("rejects an event whose signature does not match and changes nothing", async () => {
    const { body } = signedEvent();
    const forged = signPayload(body, "attacker-guess");

    const result = await handlePaymentWebhook(body, forged, deps);

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect((await reload()).status).toBe("pending_payment");
    expect(count(db, "payment_events")).toBe(0);
  });

  it("rejects an unsigned event", async () => {
    const { body } = signedEvent();

    const result = await handlePaymentWebhook(body, null, deps);

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect((await reload()).status).toBe("pending_payment");
  });

  it("applies a redelivered event only once", async () => {
    const { body, signature } = signedEvent();

    await handlePaymentWebhook(body, signature, deps);
    const second = await handlePaymentWebhook(body, signature, deps);

    expect(second).toEqual({ ok: true, outcome: "duplicate" });
    expect(count(db, "payment_events")).toBe(1);
  });

  it("refuses to mark an order paid when the amount does not match its total", async () => {
    const { body, signature } = signedEvent({
      data: {
        sessionId: order.paymentSessionId,
        orderId: order.id,
        amountCents: 100,
        currency: "usd",
      },
    });

    const result = await handlePaymentWebhook(body, signature, deps);

    expect(result).toMatchObject({ ok: false, status: 422 });
    expect((await reload()).status).toBe("pending_payment");
  });

  it("refuses a success event that names a different payment session", async () => {
    const { body, signature } = signedEvent({
      data: {
        sessionId: "mps_some_other_session",
        orderId: order.id,
        amountCents: order.totalCents,
        currency: "usd",
      },
    });

    const result = await handlePaymentWebhook(body, signature, deps);

    expect(result).toMatchObject({ ok: false, status: 422 });
    expect((await reload()).status).toBe("pending_payment");
  });

  it("reports an event for an order that does not exist", async () => {
    const { body, signature } = signedEvent({
      data: {
        sessionId: "mps_x",
        orderId: "ord_missing",
        amountCents: 100,
        currency: "usd",
      },
    });

    const result = await handlePaymentWebhook(body, signature, deps);

    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects a signed body that is not a payment event", async () => {
    const body = JSON.stringify({ hello: "world" });

    const result = await handlePaymentWebhook(
      body,
      signPayload(body, TEST_SECRET),
      deps,
    );

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("records a failed-payment event without changing the order", async () => {
    const { body, signature } = signedEvent({
      id: "evt_test_failed",
      type: "payment.failed",
    });

    const result = await handlePaymentWebhook(body, signature, deps);

    expect(result).toEqual({ ok: true, outcome: "recorded" });
    expect((await reload()).status).toBe("pending_payment");
    expect(count(db, "payment_events")).toBe(1);
  });
});
