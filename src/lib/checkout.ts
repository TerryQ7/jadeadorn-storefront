import { createHash } from "node:crypto";
import { getProductsByIds } from "@/lib/catalog";
import { getDb, type Db } from "@/lib/db/client";
import {
  attachPaymentSession,
  createOrder,
  getOrderByIdempotencyKey,
  type Order,
} from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/payments/types";
import { priceCart, type Quote } from "@/lib/pricing";
import {
  parseCartItems,
  parseCheckout,
  type CartItemInput,
  type CheckoutInput,
} from "@/lib/validation";

// The checkout use cases, free of HTTP and React so they can be tested
// directly. Route handlers are thin wrappers around these two functions.

export type CheckoutError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
  unavailableProductIds?: number[];
};

export type QuoteResult =
  | { ok: true; quote: Quote; unavailableProductIds: number[] }
  | { ok: false; status: 400; error: CheckoutError };

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; paymentUrl: string }
  | { ok: false; status: 400 | 409 | 502; error: CheckoutError };

async function loadLines(items: CartItemInput[], db: Db) {
  const products = await getProductsByIds(
    items.map((item) => item.productId),
    db,
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  const available = [];
  const unavailableProductIds: number[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (product) available.push({ product, quantity: item.quantity });
    else unavailableProductIds.push(item.productId);
  }
  return { available, unavailableProductIds };
}

/** Prices a bag for display. Items no longer sold are left out and reported. */
export async function quoteCart(
  input: unknown,
  deps: { db?: Db } = {},
): Promise<QuoteResult> {
  const db = deps.db ?? getDb();
  const parsed = parseCartItems(input);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: { code: "invalid_request", message: parsed.message },
    };
  }
  const { available, unavailableProductIds } = await loadLines(parsed.data, db);
  return { ok: true, quote: priceCart(available), unavailableProductIds };
}

/**
 * A stable hash of what the customer submitted. Items are sorted so the same
 * bag in a different order is still the same request.
 */
function requestHash(checkout: CheckoutInput): string {
  const items = [...checkout.items]
    .sort((a, b) => a.productId - b.productId)
    .map((item) => [item.productId, item.quantity]);
  const { name, line1, line2, city, state, zip } = checkout.shipping;
  return createHash("sha256")
    .update(
      JSON.stringify([items, checkout.email, name, line1, line2, city, state, zip]),
    )
    .digest("hex");
}

const KEY_REUSED: PlaceOrderResult = {
  ok: false,
  status: 409,
  error: {
    code: "idempotency_key_reused",
    message:
      "This checkout was already submitted with different details. Reload the page and try again.",
  },
};

async function withPaymentSession(
  order: Order,
  provider: PaymentProvider,
  db: Db,
): Promise<PlaceOrderResult> {
  if (order.status === "paid") {
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
      paymentUrl: `/orders/${order.id}`,
    };
  }
  if (order.paymentUrl) {
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
      paymentUrl: order.paymentUrl,
    };
  }
  try {
    const session = await provider.createSession({
      orderId: order.id,
      orderNumber: order.number,
      amountCents: order.totalCents,
      currency: order.currency,
    });
    await attachPaymentSession(order.id, session, db);
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.number,
      paymentUrl: session.paymentUrl,
    };
  } catch (error) {
    console.error("Payment provider could not open a session", error);
    // The order stays saved as pending. Retrying with the same idempotency
    // key lands in the branch above and tries the provider again.
    return {
      ok: false,
      status: 502,
      error: {
        code: "payment_unavailable",
        message: "We couldn't reach the payment service. Try again in a moment.",
      },
    };
  }
}

/**
 * Turns a submitted checkout into a saved order awaiting payment, and opens a
 * payment session for its total.
 *
 * The browser supplies product ids, quantities and contact details. It does
 * not supply prices: those are read from the catalog here, so the total cannot
 * be influenced by editing the request.
 */
export async function placeOrder(
  input: unknown,
  deps: { db?: Db; provider?: PaymentProvider } = {},
): Promise<PlaceOrderResult> {
  const db = deps.db ?? getDb();
  const provider = deps.provider ?? getPaymentProvider(db);

  const parsed = parseCheckout(input);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "invalid_request",
        message: "Check the highlighted fields and try again.",
        fields: parsed.fields,
      },
    };
  }
  const checkout = parsed.data;

  const hash = requestHash(checkout);

  // A repeat of a request we have already handled (double tap, retry after a
  // dropped connection): answer with the order that request created.
  const existing = await getOrderByIdempotencyKey(checkout.idempotencyKey, db);
  if (existing) {
    if (existing.requestHash !== hash) return KEY_REUSED;
    return withPaymentSession(existing, provider, db);
  }

  const { available, unavailableProductIds } = await loadLines(
    checkout.items,
    db,
  );
  if (unavailableProductIds.length > 0) {
    return {
      ok: false,
      status: 409,
      error: {
        code: "items_unavailable",
        message: "Some items in your bag are no longer available.",
        unavailableProductIds,
      },
    };
  }

  const order = await createOrder(
    {
      idempotencyKey: checkout.idempotencyKey,
      requestHash: hash,
      email: checkout.email,
      shipping: checkout.shipping,
      quote: priceCart(available),
    },
    db,
  );
  // createOrder returns the existing order if another request with this key
  // got there first, so the details are compared once more.
  if (order.requestHash !== hash) return KEY_REUSED;
  return withPaymentSession(order, provider, db);
}
