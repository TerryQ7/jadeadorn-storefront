"use client";

import Link from "next/link";
import { ProductArt } from "@/components/ProductArt";
import { QuantityStepper } from "@/components/QuantityStepper";
import { ShippingStrand } from "@/components/ShippingStrand";
import { Totals } from "@/components/Totals";
import { cart, useCartLines, useHydrated } from "@/lib/cart";
import { formatCents } from "@/lib/money";
import { useQuote } from "@/lib/use-quote";

export function CartView() {
  const hydrated = useHydrated();
  const lines = useCartLines();
  const { quote, loading, failed, removedCount, retry } = useQuote(
    lines,
    hydrated,
  );

  // The bag is only known in the browser, so the server-rendered page shows
  // a neutral placeholder instead of guessing "empty".
  if (!hydrated) {
    return <p className="muted" aria-busy="true">Loading your bag…</p>;
  }

  const removedNotice = removedCount > 0 && (
    <p className="notice" role="status">
      {removedCount === 1
        ? "One item is no longer available and was removed from your bag."
        : `${removedCount} items are no longer available and were removed from your bag.`}
    </p>
  );

  if (lines.length === 0) {
    return (
      <>
        {removedNotice}
        <div className="empty">
          <p>Your bag is empty.</p>
          <Link href="/#shop" className="button button--primary">
            Browse the collection
          </Link>
        </div>
      </>
    );
  }

  if (failed && !quote) {
    return (
      <div className="empty">
        <p>We couldn&apos;t load your bag. Check your connection.</p>
        <button type="button" className="button button--primary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  if (!quote) {
    return <p className="muted" aria-busy="true">Loading your bag…</p>;
  }

  // Quantities come straight from the bag so the steppers respond instantly.
  // Every amount of money comes from the server's quote, which catches up a
  // moment later; until it does, the amounts are shown dimmed.
  const quantityOf = new Map(lines.map((l) => [l.productId, l.quantity]));
  const visible = quote.lines.filter((l) => quantityOf.has(l.productId));
  const outOfDate = loading || failed;

  return (
    <div className="cart" data-out-of-date={outOfDate || undefined}>
      <div className="cart__lines">
        {removedNotice}
        <ul className="lines">
          {visible.map((line) => {
            const quantity = quantityOf.get(line.productId)!;
            return (
              <li key={line.productId} className="line">
                <Link
                  href={`/products/${line.slug}`}
                  className="art art--thumb"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <ProductArt shape={line.artShape} tone={line.artTone} />
                </Link>
                <div className="line__body">
                  <Link href={`/products/${line.slug}`} className="line__name">
                    {line.name}
                  </Link>
                  <p className="muted">{formatCents(line.unitPriceCents)} each</p>
                  <div className="line__controls">
                    <QuantityStepper
                      value={quantity}
                      onChange={(next) => cart.setQuantity(line.productId, next)}
                      label={line.name}
                    />
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => cart.remove(line.productId)}
                      aria-label={`Remove ${line.name}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="line__total price">
                  {formatCents(line.lineTotalCents)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="summary" aria-label="Order summary" aria-busy={loading}>
        <ShippingStrand
          subtotalCents={quote.subtotalCents}
          remainingCents={quote.freeShippingRemainingCents}
        />
        <Totals
          subtotalCents={quote.subtotalCents}
          shippingCents={quote.shippingCents}
          totalCents={quote.totalCents}
          totalLabel="Estimated total"
        />
        {failed ? (
          <>
            <p className="notice notice--error" role="alert">
              We couldn&apos;t update your total. Check your connection.
            </p>
            <button
              type="button"
              className="button button--primary button--block"
              onClick={retry}
            >
              Try again
            </button>
          </>
        ) : (
          <Link href="/checkout" className="button button--primary button--block">
            Checkout
          </Link>
        )}
        <Link href="/#shop" className="summary__back">
          Keep shopping
        </Link>
      </aside>
    </div>
  );
}
