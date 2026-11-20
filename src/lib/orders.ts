import { getDb, type Db } from "@/lib/db/client";
import { orderNumber, randomId } from "@/lib/ids";
import type { PaymentSession } from "@/lib/payments/types";
import type { Quote } from "@/lib/pricing";

// Order storage. As in catalog.ts, the functions are async so a networked
// database can replace SQLite without touching callers.

export type OrderStatus = "pending_payment" | "paid";

export type ShippingAddress = {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type OrderItem = {
  productId: number;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  // Looked up from the live catalog, for display only.
  slug: string | null;
  artShape: string | null;
  artTone: string | null;
};

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  /** Hash of the checkout details this order was created from. */
  requestHash: string;
  email: string;
  shipping: ShippingAddress;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentSessionId: string | null;
  paymentUrl: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

type OrderRow = {
  id: string;
  number: string;
  status: OrderStatus;
  request_hash: string;
  email: string;
  ship_name: string;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string;
  ship_zip: string;
  ship_country: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  payment_provider: string | null;
  payment_session_id: string | null;
  payment_url: string | null;
  card_brand: string | null;
  card_last4: string | null;
  created_at: string;
  paid_at: string | null;
};

function isUniqueViolation(error: unknown, column: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
    error.message.includes(column)
  );
}

function loadOrder(db: Db, where: "id" | "idempotency_key", value: string) {
  const row = db
    .prepare(`SELECT * FROM orders WHERE ${where} = ?`)
    .get(value) as OrderRow | undefined;
  if (!row) return null;

  const items = db
    .prepare(
      `SELECT oi.product_id       AS productId,
              oi.product_name     AS productName,
              oi.unit_price_cents AS unitPriceCents,
              oi.quantity,
              oi.line_total_cents AS lineTotalCents,
              p.slug,
              p.art_shape         AS artShape,
              p.art_tone          AS artTone
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.id`,
    )
    .all(row.id) as OrderItem[];

  const order: Order = {
    id: row.id,
    number: row.number,
    status: row.status,
    requestHash: row.request_hash,
    email: row.email,
    shipping: {
      name: row.ship_name,
      line1: row.ship_line1,
      line2: row.ship_line2,
      city: row.ship_city,
      state: row.ship_state,
      zip: row.ship_zip,
      country: row.ship_country,
    },
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    paymentProvider: row.payment_provider,
    paymentSessionId: row.payment_session_id,
    paymentUrl: row.payment_url,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    items,
  };
  return order;
}

export async function getOrder(
  id: string,
  db: Db = getDb(),
): Promise<Order | null> {
  return loadOrder(db, "id", id);
}

export async function getOrderByIdempotencyKey(
  key: string,
  db: Db = getDb(),
): Promise<Order | null> {
  return loadOrder(db, "idempotency_key", key);
}

export type NewOrder = {
  idempotencyKey: string;
  requestHash: string;
  email: string;
  shipping: Omit<ShippingAddress, "country">;
  quote: Quote;
};

/**
 * Saves the order and its lines in one transaction, as "pending_payment".
 * If an order with this idempotency key already exists (a retry, or two
 * requests racing), that order is returned instead of creating another.
 */
export async function createOrder(
  input: NewOrder,
  db: Db = getDb(),
): Promise<Order> {
  const insertOrder = db.prepare(
    `INSERT INTO orders
       (id, number, status, idempotency_key, request_hash, email,
        ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_zip,
        subtotal_cents, shipping_cents, tax_cents, total_cents, created_at)
     VALUES
       (@id, @number, 'pending_payment', @idempotencyKey, @requestHash, @email,
        @name, @line1, @line2, @city, @state, @zip,
        @subtotalCents, @shippingCents, @taxCents, @totalCents, @createdAt)`,
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items
       (order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const save = db.transaction((id: string, number: string) => {
    insertOrder.run({
      id,
      number,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      email: input.email,
      ...input.shipping,
      subtotalCents: input.quote.subtotalCents,
      shippingCents: input.quote.shippingCents,
      taxCents: input.quote.taxCents,
      totalCents: input.quote.totalCents,
      createdAt: new Date().toISOString(),
    });
    for (const line of input.quote.lines) {
      insertItem.run(
        id,
        line.productId,
        line.name,
        line.unitPriceCents,
        line.quantity,
        line.lineTotalCents,
      );
    }
  });

  // An order number is 6 random characters, so a clash is rare but possible.
  // The UNIQUE constraint catches it and we draw again.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomId("ord");
    try {
      save(id, orderNumber());
      return loadOrder(db, "id", id)!;
    } catch (error) {
      if (isUniqueViolation(error, "orders.idempotency_key")) {
        return loadOrder(db, "idempotency_key", input.idempotencyKey)!;
      }
      if (!isUniqueViolation(error, "orders.number")) throw error;
    }
  }
  throw new Error("Could not allocate a unique order number");
}

export async function attachPaymentSession(
  orderId: string,
  session: PaymentSession,
  db: Db = getDb(),
): Promise<void> {
  db.prepare(
    `UPDATE orders
        SET payment_provider = ?, payment_session_id = ?, payment_url = ?
      WHERE id = ?`,
  ).run(session.provider, session.sessionId, session.paymentUrl, orderId);
}

export type RecordedEvent = {
  id: string;
  orderId: string;
  type: string;
  payload: string;
};

/**
 * Stores a provider event. Returns "duplicate" when this event id was already
 * stored, which is how a redelivered webhook becomes a no-op.
 */
export async function recordPaymentEvent(
  event: RecordedEvent,
  db: Db = getDb(),
): Promise<"recorded" | "duplicate"> {
  const { changes } = db
    .prepare(
      `INSERT INTO payment_events (id, order_id, type, payload, received_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
    )
    .run(
      event.id,
      event.orderId,
      event.type,
      event.payload,
      new Date().toISOString(),
    );
  return changes === 1 ? "recorded" : "duplicate";
}

/**
 * The only place an order becomes "paid". Storing the event and updating the
 * order happen in one transaction, so there is never a paid order without its
 * event or an event without its effect.
 */
export async function applyPaymentSucceeded(
  event: RecordedEvent & { card?: { brand: string; last4: string } },
  db: Db = getDb(),
): Promise<"applied" | "duplicate"> {
  const apply = db.transaction((): "applied" | "duplicate" => {
    const inserted = db
      .prepare(
        `INSERT INTO payment_events (id, order_id, type, payload, received_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
      )
      .run(
        event.id,
        event.orderId,
        event.type,
        event.payload,
        new Date().toISOString(),
      );
    if (inserted.changes === 0) return "duplicate";

    // The status guard means a second, different success event for an order
    // that is already paid is stored for the audit trail but changes nothing.
    const updated = db
      .prepare(
        `UPDATE orders
            SET status = 'paid', paid_at = ?, card_brand = ?, card_last4 = ?
          WHERE id = ? AND status = 'pending_payment'`,
      )
      .run(
        new Date().toISOString(),
        event.card?.brand ?? null,
        event.card?.last4 ?? null,
        event.orderId,
      );
    return updated.changes === 1 ? "applied" : "duplicate";
  });
  return apply.immediate();
}
