import { describe, expect, it } from "vitest";
import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_QUANTITY_PER_LINE,
  priceCart,
} from "@/lib/pricing";
import type { Product } from "@/lib/catalog";

function product(id: number, priceCents: number): Product {
  return {
    id,
    slug: `product-${id}`,
    name: `Product ${id}`,
    brand: "TEST",
    categorySlug: "natural-stone",
    categoryName: "Natural Stone",
    priceCents,
    description: "",
    badge: null,
    artShape: "beads",
    artTone: "#829b78",
  };
}

describe("priceCart", () => {
  it("multiplies unit price by quantity for each line", () => {
    const quote = priceCart([
      { product: product(1, 4800), quantity: 2 },
      { product: product(2, 2900), quantity: 1 },
    ]);

    expect(quote.lines.map((l) => l.lineTotalCents)).toEqual([9600, 2900]);
    expect(quote.subtotalCents).toBe(12500);
  });

  it("charges flat-rate shipping below the free-shipping threshold", () => {
    const quote = priceCart([{ product: product(1, 4800), quantity: 1 }]);

    expect(quote.shippingCents).toBe(FLAT_SHIPPING_CENTS);
    expect(quote.totalCents).toBe(4800 + FLAT_SHIPPING_CENTS);
  });

  it("ships free when the subtotal is exactly the threshold", () => {
    const quote = priceCart([
      { product: product(1, FREE_SHIPPING_THRESHOLD_CENTS), quantity: 1 },
    ]);

    expect(quote.shippingCents).toBe(0);
    expect(quote.totalCents).toBe(FREE_SHIPPING_THRESHOLD_CENTS);
  });

  it("charges shipping one cent below the threshold", () => {
    const quote = priceCart([
      { product: product(1, FREE_SHIPPING_THRESHOLD_CENTS - 1), quantity: 1 },
    ]);

    expect(quote.shippingCents).toBe(FLAT_SHIPPING_CENTS);
  });

  it("reports how much more is needed for free shipping", () => {
    const quote = priceCart([{ product: product(1, 5800), quantity: 1 }]);

    expect(quote.freeShippingRemainingCents).toBe(
      FREE_SHIPPING_THRESHOLD_CENTS - 5800,
    );
  });

  it("reports nothing remaining once shipping is free", () => {
    const quote = priceCart([{ product: product(1, 8400), quantity: 2 }]);

    expect(quote.freeShippingRemainingCents).toBe(0);
  });

  it("totals subtotal, shipping and tax", () => {
    const quote = priceCart([{ product: product(1, 3800), quantity: 2 }]);

    expect(quote.totalCents).toBe(
      quote.subtotalCents + quote.shippingCents + quote.taxCents,
    );
  });

  it("prices an empty cart at zero with no shipping charge", () => {
    const quote = priceCart([]);

    expect(quote).toMatchObject({
      lines: [],
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });

  it("refuses a quantity above the per-line maximum", () => {
    expect(() =>
      priceCart([
        { product: product(1, 4800), quantity: MAX_QUANTITY_PER_LINE + 1 },
      ]),
    ).toThrow(RangeError);
  });

  it("refuses a fractional quantity", () => {
    expect(() =>
      priceCart([{ product: product(1, 4800), quantity: 1.5 }]),
    ).toThrow(RangeError);
  });
});
