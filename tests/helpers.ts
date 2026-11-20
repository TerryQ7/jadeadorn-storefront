import { openDatabase, type Db } from "@/lib/db/client";
import { placeOrder } from "@/lib/checkout";
import { createMockProvider } from "@/lib/payments/mock-gateway";
import { getOrder, type Order } from "@/lib/orders";

export const TEST_SECRET = "whsec_test_secret";

/** A fresh in-memory database with the schema applied and the catalog seeded. */
export function createTestDb(): Db {
  return openDatabase(":memory:");
}

export function productId(db: Db, slug: string): number {
  const row = db.prepare("SELECT id FROM products WHERE slug = ?").get(slug) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`No seeded product with slug "${slug}"`);
  return row.id;
}

export function count(db: Db, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}

let keyCounter = 0;
export function checkoutInput(
  items: { productId: number; quantity: number }[],
  overrides: Record<string, unknown> = {},
) {
  keyCounter += 1;
  return {
    items,
    email: "mei.lin@example.com",
    shipping: {
      name: "Mei Lin",
      line1: "12 Orchard St",
      line2: "Apt 4",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
    },
    idempotencyKey: `test-key-${String(keyCounter).padStart(12, "0")}`,
    ...overrides,
  };
}

/** Places a real order through the checkout service and returns it. */
export async function placeTestOrder(
  db: Db,
  items: { productId: number; quantity: number }[],
): Promise<Order> {
  const result = await placeOrder(checkoutInput(items), {
    db,
    provider: createMockProvider(db),
  });
  if (!result.ok) throw new Error(`placeOrder failed: ${result.error.code}`);
  const order = await getOrder(result.orderId, db);
  if (!order) throw new Error("order was not persisted");
  return order;
}
