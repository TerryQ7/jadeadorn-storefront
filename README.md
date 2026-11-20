# JadeAdorn storefront

A working storefront for **JadeAdorn**, the everyday beaded-jewelry brand: browse by category, view a product, add it to a bag, check out, pay, and land on a confirmation page backed by a saved order.

It is a **mobile-friendly web app**, not a native app. A phone browser is where a $24–$89 purchase most often starts, a web app needs no install or app-store review, and you can run and review it with nothing but Node. The layout is built phone-first and widens to tablet and desktop.

Payment uses a **clearly labelled mock payment gateway**. No account, keys, or real card is involved. The reasoning and the path to Stripe are in the one-page design note, [DESIGN.md](DESIGN.md) (also as [docs/design-note.pdf](docs/design-note.pdf)).

## Run it

You need **Node.js 22 or newer** (`node -v`) and npm. There is nothing else to set up: no environment file, no database to create.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On the first request the app creates `data/store.db` (SQLite) and loads the 18-product JadeAdorn catalog from the prototype.

To try it on a real phone on the same Wi-Fi, use the production build, which accepts connections from other devices:

```bash
npm run build && npm start     # then open http://<your-computer's-ip>:3000
```

## A two-minute tour

1. **Browse.** Pick a category chip, e.g. *Buddhist Mala*.
2. **View a product** and choose **Add to bag**.
3. **Open the bag.** Change quantities. The row of beads fills as you approach free shipping: add items until the subtotal reaches $100 and shipping drops from $6.95 to free.
4. **Check out.** Enter an email and a U.S. address. Try a 4-digit ZIP to see server-side validation.
5. **Pay** on the mock gateway page (yellow "Test mode" banner). Tap a test card to fill the form:

   | Card number | Result |
   | --- | --- |
   | `4242 4242 4242 4242` | Payment succeeds |
   | `4000 0000 0000 0002` | Card is declined |
   | `4000 0000 0000 9995` | Insufficient funds |

   Any future expiry and any 3-digit code work. Every other card number is refused.
6. **Confirmation.** You get an order number such as `JA-7K3M9Q`. Reload the page: the order is read back from the database. You can also look directly:

   ```bash
   sqlite3 data/store.db "SELECT number, status, total_cents, email FROM orders;"
   ```

Screenshots of each step are in [docs/screenshots](docs/screenshots).

## Tests

```bash
npm test                          # 98 unit and integration tests, under a second
npx playwright install chromium   # once, downloads the test browser
npm run test:e2e                  # 8 browser tests at phone size, against a production build
npm run lint && npm run typecheck
```

The unit and integration tests run the real checkout code against an in-memory SQLite database. They cover pricing and the free-shipping boundary, input validation, order creation, duplicate-submission handling, the mock gateway's card outcomes, and webhook signature checks. The browser tests drive the whole purchase, a declined-then-successful payment, and the webhook endpoint over HTTP.

## How a purchase works

```text
Browser                         Store server                    Payment gateway (mock)
   |  POST /api/checkout            |                                   |
   |  ids, quantities, address ---> |  validate, read prices from DB    |
   |                                |  save order: pending_payment      |
   |                                |  open payment session ----------> |
   |  <--- paymentUrl               |                                   |
   |                                                                    |
   |  customer enters card on the gateway's page ---------------------> |
   |                                |  <--- signed webhook: succeeded   |
   |                                |  verify signature and amount      |
   |                                |  order: paid                      |
   |  <--- redirect to /orders/:id  |                                   |
```

Four rules shape the code:

- **The server sets the price.** The browser sends product ids and quantities only. Prices are read from the database when the order is created, so editing the request cannot change the total.
- **An order is paid only when the gateway says so**, through a signed webhook. Returning from the payment page proves nothing on its own.
- **Card numbers never reach the store's API or database.** They go to the gateway's endpoint, which hands back only the brand and last four digits.
- **Retries are safe.** Each checkout attempt carries an idempotency key, and each webhook event is stored under its unique id, so a double tap or a redelivered webhook cannot create a second order or a second payment. A key that comes back with different details is refused.

The mock gateway is on by default so the demo needs no setup. Setting `PAYMENT_PROVIDER` to anything other than `mock` turns its page and endpoint off (they answer 404), so a deployment configured for a real provider cannot be paid with a test card.

## Where things are

```text
src/
  app/
    (store)/
      (browse)/         black canvas: home, category, product
      (buy)/            cream canvas: bag, checkout, order
    (gateway)/mock-pay/ the mock gateway's hosted payment page
    api/
      quote/            price a bag for display
      checkout/         create the order and its payment session
      webhooks/payment/ receive signed payment results
      mock-gateway/     the mock gateway's own endpoint (the only one that sees a card)
  components/           React components
  lib/
    pricing.ts          subtotal, shipping, total: the business rules
    checkout.ts         quoteCart() and placeOrder(): the use cases
    catalog.ts          product queries
    orders.ts           order storage and the pending -> paid transition
    validation.ts       request schemas (zod)
    payments/           provider interface, mock gateway, webhook handler, signatures
    db/                 SQLite connection, schema, seed data
    cart.ts             the browser-side bag (localStorage)
tests/                  unit and integration tests (Vitest)
e2e/                    browser tests (Playwright)
```

Start reading at `src/lib/checkout.ts`, then `src/lib/payments/webhook.ts`.

## Look and feel

The visual design follows [shopify/DESIGN.md](shopify/DESIGN.md). Its main rule is two canvases that never mix:

- **Browsing is black.** Home, category and product pages use thin display type, white-stroked pill buttons, and product pictures in black frames.
- **Buying is cream.** Bag, checkout and order pages use white cards, filled black pill buttons, and the two greens: pistachio for the free-shipping band, aloe once shipping is free and on a confirmed order.

Every button is a pill. The typeface is Inter, shipped with the app in `src/app/fonts/` (SIL Open Font License), so nothing is fetched from a font service. The tokens are CSS variables at the top of `src/app/globals.css`.

Two things differ from DESIGN.md on purpose. The header keeps "Shop" and "Bag" visible on a phone instead of a hamburger menu, because both fit. Form fields have a darker border than the hairline it specifies, so the edge of a field is easy to see. The mock gateway page keeps its own plain look: it stands in for a payment provider's page, not the store's.

## What I built and what I cut

Built, end to end: category browsing, product pages, bag with quantity editing, shipping rule, guest checkout with validation, mock payment with success and decline paths, persisted orders, confirmation page, responsive layout.

Cut, on purpose, to keep the core flow solid:

- **Real Stripe integration.** The mock follows Stripe Checkout's shape so the swap is contained (see DESIGN.md), but no Stripe code is included because I could not exercise it without keys.
- **Search, price filter and sort** from the prototype. Category browsing was the requirement.
- **Customer accounts and order history.** Checkout is guest-only; the confirmation link is the receipt.
- **Confirmation emails.** The page says so rather than pretending one was sent.
- **Sales tax.** Shown as not collected. It needs a tax service and the business's nexus rules.
- **Wishlist and newsletter** from the prototype, and anything listed as out of scope in the brief (hosting, photos, inventory, admin).

## Known limitations

- **Unknown product or order links answer HTTP 200 with the "not found" page.** The page frame is streamed before the database lookup finishes, so the status code is already sent. Fine for people, less so for search engines and monitoring; resolving the lookup before streaming would fix it.
- **Unpaid orders stay in the database forever.** Nothing expires an abandoned `pending_payment` order yet.
- **No rate limiting or request-size limit** on the checkout and quote endpoints.
- **The bag is per browser.** It lives in `localStorage`, so it does not follow a customer to another device.

## Assumptions to confirm

- **Flat-rate shipping is $6.95.** The prototype states only that U.S. orders over $100 ship free; the paid rate is my placeholder (`src/lib/pricing.ts`).
- **Free shipping starts at exactly $100.00.** "Over $100" could mean strictly more; I chose the reading that favors the customer.
- **U.S. addresses only**, since the shipping offer is U.S.-specific.
- **Product descriptions are placeholder copy** I wrote for the demo. As the prototype itself notes, materials and cultural descriptions need verifying per item before sale.
- **Each bag line is capped at 10 units**, as a sanity limit in the absence of inventory.

## Other commands

```bash
npm run db:reset                       # delete the local database; it is recreated on next request
node scripts/capture-screenshots.mjs   # regenerate docs/screenshots (app must be running)
```

Optional settings are described in [.env.example](.env.example).
