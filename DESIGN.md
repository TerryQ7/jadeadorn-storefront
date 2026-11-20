# JadeAdorn storefront: design note

## What I chose

**Brand: JadeAdorn. Platform: a mobile-friendly web app.** A $24–$89 purchase is a quick, often phone-first decision, so a fast guest checkout in the browser fits it better than an app someone must install. A web app also gives YABEI one codebase for phone and desktop, and no app-store review. JadeAdorn's free-shipping threshold gave me a real pricing rule to build and test.

## Tech choices

| Choice | Why |
| --- | --- |
| **Next.js 16 + React 19 + TypeScript** | Pages and API in one project and one process. Product pages are rendered on the server, so they load fast on a phone and are readable by search engines. |
| **SQLite, plain SQL** (`better-sqlite3`) | No database to install: the reviewer runs two commands. The schema is one readable file. All queries sit behind two modules, `catalog.ts` and `orders.ts`. |
| **Mock payment gateway behind a `PaymentProvider` interface** | Runs with no account or keys, and cannot take a real card. It copies Stripe Checkout's shape: hosted payment page, then a signed webhook. |
| **zod** for input validation; **Vitest** and **Playwright** for tests | 98 fast tests on the money and order logic, 8 browser tests on the purchase itself. |
| **Plain CSS**, phone-first | The design tokens in `shopify/DESIGN.md` (black canvas for browsing, cream for buying, pill buttons) are CSS variables. No UI framework to learn or ship. |

## Data model

- **categories**, **products**: the catalog. Prices are integer cents. Products are retired with an `active` flag, never deleted, so old orders keep their link.
- **orders**: contact, address, the four totals, and `status` (`pending_payment` → `paid`). The id is a random 128-bit string because it appears in the confirmation URL; a short number (`JA-7K3M9Q`) is for people. A unique `idempotency_key` plus a hash of the request means one checkout attempt makes at most one order.
- **order_items**: one row per line, with the product name and unit price **copied at purchase time**. A later price change never rewrites a past order.
- **payment_events**: every webhook accepted, keyed by the provider's event id. That key is what makes a redelivered webhook harmless.

The browser holds only product ids and quantities. The server reads prices from the database when it creates the order, and an order becomes `paid` only through a signed webhook whose amount matches the order total.

## Handing over to IT

- **Hosting and HTTPS.** A standard Node app: `npm run build && npm start` behind a reverse proxy or load balancer that terminates TLS, or a container on any Node host. HTTPS is required before real payments.
- **Database.** Move to managed Postgres for backups and more than one app instance. Apart from the mock gateway, only `src/lib/db`, `catalog.ts` and `orders.ts` contain SQL, and their functions are already async, so callers do not change. Add a migration tool at the same time.
- **Payments.** Write a Stripe implementation of `PaymentProvider` (`checkout.sessions.create`), verify Stripe's signature in `/api/webhooks/payment`, and set `PAYMENT_WEBHOOK_SECRET` and `PAYMENT_PROVIDER=stripe`, which switches the mock gateway off. Order creation, the paid transition and the confirmation page stay as they are.
- **Inventory.** Add a stock count to `products`, reserve stock inside the same transaction that creates the order, and release it when a pending order expires.
- **Order handling.** The webhook's paid transition is the single hook for a confirmation email, a fulfilment queue and an admin order list. Pending orders older than a day should be expired by a scheduled job.
- **Before launch.** Sales tax (e.g. Stripe Tax), rate limiting on the checkout endpoint, error monitoring, a privacy policy, and verified product copy.

## With more time

1. The Stripe adapter, tested against Stripe test mode.
2. Confirmation emails and an order-lookup page (order number + email).
3. Inventory with reservation, then a small admin view for orders.
4. Search and sort, real photos through `next/image`, catalog caching, and a screen-reader accessibility pass.

## What I cut

Stripe itself, search/filter/sort, accounts, emails, tax, wishlist and newsletter. Each is listed with its reason in the README.
