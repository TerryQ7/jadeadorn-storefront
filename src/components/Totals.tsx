import { formatCents } from "@/lib/money";

/** Subtotal, shipping and total. Used in the bag, at checkout and on the order page. */
export function Totals({
  subtotalCents,
  shippingCents,
  totalCents,
  totalLabel = "Total",
}: {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  totalLabel?: string;
}) {
  return (
    <div className="totals">
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCents(subtotalCents)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{shippingCents === 0 ? "Free" : formatCents(shippingCents)}</dd>
        </div>
        <div className="totals__total">
          <dt>{totalLabel}</dt>
          <dd>{formatCents(totalCents)}</dd>
        </div>
      </dl>
      <p className="totals__note">Sales tax is not collected in this demo.</p>
    </div>
  );
}
