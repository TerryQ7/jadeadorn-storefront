import type { Product } from "@/lib/catalog";

// Business rules. The free-shipping threshold comes from the JadeAdorn
// prototype; the flat rate is an assumption to confirm with the business.
export const FREE_SHIPPING_THRESHOLD_CENTS = 100_00;
export const FLAT_SHIPPING_CENTS = 6_95;
export const MAX_QUANTITY_PER_LINE = 10;
export const MAX_LINES_PER_ORDER = 50;

export type PricedLine = {
  productId: number;
  slug: string;
  name: string;
  brand: string;
  artShape: string;
  artTone: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type Quote = {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  /** Always 0 in this build: sales tax needs a tax provider (see README). */
  taxCents: number;
  totalCents: number;
  freeShippingRemainingCents: number;
};

/**
 * The single source of truth for what an order costs. Both the cart preview
 * and order creation call this with products freshly read from the database,
 * so a price sent by the browser is never used.
 */
export function priceCart(
  items: { product: Product; quantity: number }[],
): Quote {
  const lines = items.map(({ product, quantity }) => {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_LINE
    ) {
      throw new RangeError(
        `Quantity for "${product.name}" must be a whole number from 1 to ${MAX_QUANTITY_PER_LINE}`,
      );
    }
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      artShape: product.artShape,
      artTone: product.artTone,
      unitPriceCents: product.priceCents,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const qualifiesForFreeShipping =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const shippingCents =
    lines.length === 0 || qualifiesForFreeShipping ? 0 : FLAT_SHIPPING_CENTS;
  const taxCents = 0;

  return {
    lines,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
    freeShippingRemainingCents: qualifiesForFreeShipping
      ? 0
      : FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents,
  };
}
