import { beforeEach, describe, expect, it } from "vitest";
import { placeOrder, quoteCart } from "@/lib/checkout";
import type { Db } from "@/lib/db/client";
import { getOrder } from "@/lib/orders";
import { createMockProvider } from "@/lib/payments/mock-gateway";
import type { PaymentProvider } from "@/lib/payments/types";
import { FLAT_SHIPPING_CENTS } from "@/lib/pricing";
import { checkoutInput, count, createTestDb, productId } from "./helpers";

let db: Db;
let deps: { db: Db; provider: PaymentProvider };
let mala: number; // $58.00
let onyx: number; // $42.00
let wood: number; // $29.00

beforeEach(() => {
  db = createTestDb();
  deps = { db, provider: createMockProvider(db) };
  mala = productId(db, "sandalwood-prayer-mala");
  onyx = productId(db, "black-onyx-bead-bracelet");
  wood = productId(db, "minimal-wood-bead-bracelet");
});

describe("placeOrder", () => {
  it("persists a pending order with a snapshot of each line", async () => {
    const result = await placeOrder(
      checkoutInput([
        { productId: mala, quantity: 1 },
        { productId: wood, quantity: 2 },
      ]),
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await getOrder(result.orderId, db);
    expect(order).toMatchObject({
      status: "pending_payment",
      email: "mei.lin@example.com",
      subtotalCents: 5800 + 2 * 2900,
      shipping: { name: "Mei Lin", city: "Brooklyn", state: "NY", country: "US" },
    });
    expect(order?.items).toMatchObject([
      { productName: "Sandalwood Prayer Mala", unitPriceCents: 5800, quantity: 1 },
      { productName: "Minimal Wood Bead Bracelet", unitPriceCents: 2900, quantity: 2 },
    ]);
  });

  it("prices from the catalog and ignores any price sent by the browser", async () => {
    const tampered = checkoutInput([
      { productId: mala, quantity: 1, priceCents: 1, unitPriceCents: 1 } as never,
    ]);

    const result = await placeOrder({ ...tampered, totalCents: 1 }, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await getOrder(result.orderId, db);
    expect(order?.subtotalCents).toBe(5800);
    expect(order?.totalCents).toBe(5800 + FLAT_SHIPPING_CENTS);
  });

  it("adds flat-rate shipping to an order under $100", async () => {
    const result = await placeOrder(
      checkoutInput([{ productId: onyx, quantity: 1 }]),
      deps,
    );

    if (!result.ok) throw new Error("expected success");
    const order = await getOrder(result.orderId, db);
    expect(order?.shippingCents).toBe(FLAT_SHIPPING_CENTS);
    expect(order?.totalCents).toBe(4200 + FLAT_SHIPPING_CENTS);
  });

  it("ships free once the subtotal reaches $100", async () => {
    const result = await placeOrder(
      checkoutInput([
        { productId: mala, quantity: 1 },
        { productId: onyx, quantity: 1 },
      ]),
      deps,
    );

    if (!result.ok) throw new Error("expected success");
    const order = await getOrder(result.orderId, db);
    expect(order?.subtotalCents).toBe(10000);
    expect(order?.shippingCents).toBe(0);
    expect(order?.totalCents).toBe(10000);
  });

  it("opens a payment session for exactly the order total", async () => {
    const result = await placeOrder(
      checkoutInput([{ productId: onyx, quantity: 1 }]),
      deps,
    );

    if (!result.ok) throw new Error("expected success");
    const order = await getOrder(result.orderId, db);
    const session = db
      .prepare("SELECT order_id, amount_cents, status FROM mock_gateway_sessions WHERE id = ?")
      .get(order?.paymentSessionId);
    expect(session).toEqual({
      order_id: result.orderId,
      amount_cents: order?.totalCents,
      status: "open",
    });
    expect(result.paymentUrl).toBe(`/mock-pay/${order?.paymentSessionId}`);
  });

  it("gives each order an unguessable id and a short readable number", async () => {
    const result = await placeOrder(
      checkoutInput([{ productId: onyx, quantity: 1 }]),
      deps,
    );

    if (!result.ok) throw new Error("expected success");
    const order = await getOrder(result.orderId, db);
    expect(order?.id).toMatch(/^ord_[A-Za-z0-9_-]{22}$/);
    expect(order?.number).toMatch(/^JA-[2-9A-HJ-NP-Z]{6}$/);
  });

  it("returns the same order when the same checkout is submitted twice", async () => {
    const input = checkoutInput([{ productId: onyx, quantity: 1 }]);

    const first = await placeOrder(input, deps);
    const second = await placeOrder(input, deps);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.orderId).toBe(first.orderId);
    expect(second.paymentUrl).toBe(first.paymentUrl);
    expect(count(db, "orders")).toBe(1);
    expect(count(db, "mock_gateway_sessions")).toBe(1);
  });

  it("treats the same bag listed in a different order as the same checkout", async () => {
    const input = checkoutInput([
      { productId: onyx, quantity: 1 },
      { productId: wood, quantity: 2 },
    ]);

    const first = await placeOrder(input, deps);
    const second = await placeOrder(
      { ...input, items: [...input.items].reverse() },
      deps,
    );

    expect(first.ok && second.ok).toBe(true);
    expect(count(db, "orders")).toBe(1);
  });

  it("refuses an idempotency key that comes back with different details", async () => {
    const input = checkoutInput([{ productId: onyx, quantity: 1 }]);

    await placeOrder(input, deps);
    const reused = await placeOrder(
      { ...input, items: [{ productId: mala, quantity: 3 }] },
      deps,
    );

    expect(reused).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "idempotency_key_reused" },
    });
    expect(count(db, "orders")).toBe(1);
  });

  it("keeps the price paid on the order when the catalog price changes later", async () => {
    const result = await placeOrder(
      checkoutInput([{ productId: onyx, quantity: 1 }]),
      deps,
    );
    db.prepare("UPDATE products SET price_cents = 9900 WHERE id = ?").run(onyx);

    if (!result.ok) throw new Error("expected success");
    const order = await getOrder(result.orderId, db);
    expect(order?.items[0].unitPriceCents).toBe(4200);
  });

  it("refuses an order containing a product that is no longer sold", async () => {
    db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(onyx);

    const result = await placeOrder(
      checkoutInput([
        { productId: onyx, quantity: 1 },
        { productId: mala, quantity: 1 },
      ]),
      deps,
    );

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: { code: "items_unavailable", unavailableProductIds: [onyx] },
    });
    expect(count(db, "orders")).toBe(0);
  });

  it("rejects invalid details with a message per field and saves nothing", async () => {
    const result = await placeOrder(
      checkoutInput([{ productId: onyx, quantity: 1 }], { email: "nope" }),
      deps,
    );

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: { code: "invalid_request" },
    });
    if (result.ok) return;
    expect(result.error.fields?.email).toBeDefined();
    expect(count(db, "orders")).toBe(0);
  });

  it("can be retried after the payment provider fails, without a second order", async () => {
    const input = checkoutInput([{ productId: onyx, quantity: 1 }]);
    const failingProvider: PaymentProvider = {
      name: "failing",
      createSession: async () => {
        throw new Error("provider is down");
      },
    };

    const failed = await placeOrder(input, { db, provider: failingProvider });
    const retried = await placeOrder(input, deps);

    expect(failed).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "payment_unavailable" },
    });
    expect(retried.ok).toBe(true);
    expect(count(db, "orders")).toBe(1);
  });
});

describe("quoteCart", () => {
  it("prices the bag from the catalog", async () => {
    const result = await quoteCart(
      [
        { productId: mala, quantity: 1 },
        { productId: wood, quantity: 1 },
      ],
      { db },
    );

    expect(result).toMatchObject({
      ok: true,
      quote: { subtotalCents: 8700, shippingCents: FLAT_SHIPPING_CENTS },
      unavailableProductIds: [],
    });
  });

  it("leaves out products that are no longer sold and says which", async () => {
    db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(wood);

    const result = await quoteCart(
      [
        { productId: mala, quantity: 1 },
        { productId: wood, quantity: 1 },
      ],
      { db },
    );

    expect(result).toMatchObject({
      ok: true,
      quote: { subtotalCents: 5800 },
      unavailableProductIds: [wood],
    });
  });

  it("rejects a malformed bag", async () => {
    const result = await quoteCart([{ productId: mala, quantity: 0 }], { db });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
