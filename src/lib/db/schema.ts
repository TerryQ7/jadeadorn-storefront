// The whole data model in one place. Every statement is idempotent
// (IF NOT EXISTS), so it is safe to run on each start.
//
// Conventions:
//   - money is INTEGER cents, never a float
//   - timestamps are ISO-8601 UTC strings
//   - order ids are random strings because they appear in customer URLs
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  brand        TEXT    NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  price_cents  INTEGER NOT NULL CHECK (price_cents > 0),
  description  TEXT    NOT NULL,
  badge        TEXT,
  -- Placeholder artwork until real photos exist: which illustration to draw
  -- and in what colour.
  art_shape    TEXT    NOT NULL,
  art_tone     TEXT    NOT NULL,
  -- Products are retired by flag, never deleted, so old orders keep their link.
  active       INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS products_by_category ON products(category_id, sort_order);

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  number              TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid')),
  -- One checkout attempt = one key = at most one order. The hash is of the
  -- submitted details, so a key that comes back with different details is
  -- refused instead of silently answered with the first order.
  idempotency_key     TEXT NOT NULL UNIQUE,
  request_hash        TEXT NOT NULL,
  email               TEXT NOT NULL,
  ship_name           TEXT NOT NULL,
  ship_line1          TEXT NOT NULL,
  ship_line2          TEXT,
  ship_city           TEXT NOT NULL,
  ship_state          TEXT NOT NULL,
  ship_zip            TEXT NOT NULL,
  ship_country        TEXT NOT NULL DEFAULT 'US',
  subtotal_cents      INTEGER NOT NULL,
  shipping_cents      INTEGER NOT NULL,
  tax_cents           INTEGER NOT NULL,
  total_cents         INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'usd',
  payment_provider    TEXT,
  payment_session_id  TEXT,
  payment_url         TEXT,
  card_brand          TEXT,
  card_last4          TEXT,
  created_at          TEXT NOT NULL,
  paid_at             TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id                INTEGER PRIMARY KEY,
  order_id          TEXT    NOT NULL REFERENCES orders(id),
  product_id        INTEGER NOT NULL REFERENCES products(id),
  -- Name and price are copied at purchase time; later catalog edits must not
  -- rewrite what a customer was charged.
  product_name      TEXT    NOT NULL,
  unit_price_cents  INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_by_order ON order_items(order_id);

-- Every webhook delivery we accepted. The provider's event id is the primary
-- key, which is what makes redelivery harmless.
CREATE TABLE IF NOT EXISTS payment_events (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id),
  type         TEXT NOT NULL,
  payload      TEXT NOT NULL,
  received_at  TEXT NOT NULL
);

-- State that belongs to the MOCK payment gateway, not to the store. With a
-- real provider this table lives on their side and is deleted from ours.
CREATE TABLE IF NOT EXISTS mock_gateway_sessions (
  id            TEXT PRIMARY KEY,
  order_id      TEXT    NOT NULL,
  order_number  TEXT    NOT NULL,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT    NOT NULL,
  status        TEXT    NOT NULL CHECK (status IN ('open', 'paid')),
  created_at    TEXT    NOT NULL,
  paid_at       TEXT
);
`;
