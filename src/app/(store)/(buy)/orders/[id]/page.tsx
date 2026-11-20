import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FinishCheckout } from "@/components/FinishCheckout";
import { ProductArt } from "@/components/ProductArt";
import { Totals } from "@/components/Totals";
import { formatCents } from "@/lib/money";
import { getOrder } from "@/lib/orders";

type Props = { params: Promise<{ id: string }> };

// Order pages hold a name and an address. The id in the URL is a long random
// string, and search engines are told to stay out.
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

export default function OrderPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="muted" aria-busy="true">Loading your order…</p>}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

// Shown in U.S. Eastern time, where the business operates.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

async function OrderDetail({ params }: Props) {
  await connection();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const paid = order.status === "paid";
  const { shipping } = order;

  return (
    <div className="order">
      {paid && <FinishCheckout orderId={order.id} />}

      <header className={paid ? "order__head order__head--paid" : "order__head"}>
        {paid ? (
          <>
            <h1>Thank you. Your order is confirmed.</h1>
            <p>
              Order <strong data-testid="order-number">{order.number}</strong>,
              placed {dateFormat.format(new Date(order.createdAt))}.
            </p>
            <p className="muted">
              Keep this page&apos;s link to look up your order. This demo does
              not send confirmation emails.
            </p>
          </>
        ) : (
          <>
            <h1>This order hasn&apos;t been paid yet.</h1>
            <p>
              Order <strong data-testid="order-number">{order.number}</strong>{" "}
              is saved and waiting for payment.
            </p>
            {order.paymentUrl && (
              // A plain link: the payment page is outside the store.
              <a href={order.paymentUrl} className="button button--primary">
                Complete payment
              </a>
            )}
          </>
        )}
      </header>

      <div className="order__grid">
        <section aria-labelledby="order-items">
          <h2 id="order-items">Items</h2>
          <ul className="lines">
            {order.items.map((item) => (
              <li key={item.productId} className="line">
                <div className="art art--thumb" aria-hidden="true">
                  {item.artShape && item.artTone && (
                    <ProductArt shape={item.artShape} tone={item.artTone} />
                  )}
                </div>
                <div className="line__body">
                  <p className="line__name">{item.productName}</p>
                  <p className="muted">
                    {formatCents(item.unitPriceCents)} × {item.quantity}
                  </p>
                </div>
                <p className="line__total price">
                  {formatCents(item.lineTotalCents)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="summary">
          <Totals
            subtotalCents={order.subtotalCents}
            shippingCents={order.shippingCents}
            totalCents={order.totalCents}
            totalLabel={paid ? "Total paid" : "Total due"}
          />

          <h2>Shipping to</h2>
          <address>
            {shipping.name}
            <br />
            {shipping.line1}
            {shipping.line2 && (
              <>
                <br />
                {shipping.line2}
              </>
            )}
            <br />
            {shipping.city}, {shipping.state} {shipping.zip}
          </address>

          <h2>Contact</h2>
          <p>{order.email}</p>

          {paid && order.cardLast4 && (
            <>
              <h2>Payment</h2>
              <p>
                {order.cardBrand} ending in {order.cardLast4}
                <span className="muted"> (test payment)</span>
              </p>
            </>
          )}
        </aside>
      </div>

      {paid && (
        <Link href="/#shop" className="button button--outline order__back">
          Keep shopping
        </Link>
      )}
    </div>
  );
}
