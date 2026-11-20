import { formatCents } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/pricing";

const BEADS = 10;

/**
 * Progress toward free shipping, drawn as beads on a cord: ten beads, one for
 * each tenth of the threshold. The band behind it changes from pistachio to
 * aloe once shipping is free.
 */
export function ShippingStrand({
  subtotalCents,
  remainingCents,
}: {
  subtotalCents: number;
  remainingCents: number;
}) {
  const filled = Math.min(
    BEADS,
    Math.floor((subtotalCents / FREE_SHIPPING_THRESHOLD_CENTS) * BEADS),
  );
  const message =
    remainingCents === 0
      ? "Your order ships free."
      : `Add ${formatCents(remainingCents)} more for free shipping.`;

  return (
    <div className="shipping" data-free={remainingCents === 0 || undefined}>
      <p className="shipping__message" role="status">
        {message}
      </p>
      <div className="shipping__beads" aria-hidden="true">
        {Array.from({ length: BEADS }, (_, i) => (
          <span key={i} className={i < filled ? "is-filled" : undefined} />
        ))}
      </div>
    </div>
  );
}
