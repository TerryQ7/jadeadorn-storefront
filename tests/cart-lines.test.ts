import { describe, expect, it } from "vitest";
import {
  addLine,
  parseStoredCart,
  quantityOf,
  removeLine,
  setLineQuantity,
} from "@/lib/cart-lines";
import { MAX_LINES_PER_ORDER, MAX_QUANTITY_PER_LINE } from "@/lib/pricing";

describe("bag lines", () => {
  it("adds a product that is not in the bag yet", () => {
    expect(addLine([], 4, 1)).toEqual([{ productId: 4, quantity: 1 }]);
  });

  it("raises the quantity when the product is already in the bag", () => {
    const lines = addLine([{ productId: 4, quantity: 1 }], 4, 2);

    expect(lines).toEqual([{ productId: 4, quantity: 3 }]);
  });

  it("keeps other products untouched when adding", () => {
    const lines = addLine([{ productId: 4, quantity: 1 }], 9, 1);

    expect(lines).toEqual([
      { productId: 4, quantity: 1 },
      { productId: 9, quantity: 1 },
    ]);
  });

  it("caps a line at the per-line maximum", () => {
    const lines = addLine(
      [{ productId: 4, quantity: MAX_QUANTITY_PER_LINE }],
      4,
      1,
    );

    expect(lines[0].quantity).toBe(MAX_QUANTITY_PER_LINE);
  });

  it("sets a line to a chosen quantity", () => {
    const lines = setLineQuantity([{ productId: 4, quantity: 1 }], 4, 5);

    expect(lines).toEqual([{ productId: 4, quantity: 5 }]);
  });

  it("never lets a quantity drop below one", () => {
    const lines = setLineQuantity([{ productId: 4, quantity: 2 }], 4, 0);

    expect(lines[0].quantity).toBe(1);
  });

  it("removes a line", () => {
    const lines = removeLine(
      [
        { productId: 4, quantity: 1 },
        { productId: 9, quantity: 2 },
      ],
      4,
    );

    expect(lines).toEqual([{ productId: 9, quantity: 2 }]);
  });

  it("reports how many of a product are in the bag", () => {
    const lines = [
      { productId: 4, quantity: 3 },
      { productId: 9, quantity: 1 },
    ];

    expect(quantityOf(lines, 4)).toBe(3);
    expect(quantityOf(lines, 7)).toBe(0);
  });

  it("does not modify the list it was given", () => {
    const original = [{ productId: 4, quantity: 1 }];

    addLine(original, 4, 1);

    expect(original).toEqual([{ productId: 4, quantity: 1 }]);
  });
});

describe("parseStoredCart", () => {
  it("reads back a saved bag", () => {
    const raw = JSON.stringify([{ productId: 4, quantity: 2 }]);

    expect(parseStoredCart(raw)).toEqual([{ productId: 4, quantity: 2 }]);
  });

  it("treats nothing saved as an empty bag", () => {
    expect(parseStoredCart(null)).toEqual([]);
  });

  it("treats corrupted storage as an empty bag", () => {
    expect(parseStoredCart("{not json")).toEqual([]);
    expect(parseStoredCart(JSON.stringify({ productId: 4 }))).toEqual([]);
  });

  it("drops entries that are not valid lines and keeps the rest", () => {
    const raw = JSON.stringify([
      { productId: 4, quantity: 2 },
      { productId: "x", quantity: 1 },
      { productId: 9, quantity: 0 },
      null,
    ]);

    expect(parseStoredCart(raw)).toEqual([{ productId: 4, quantity: 2 }]);
  });

  it("caps an edited quantity at the per-line maximum", () => {
    const raw = JSON.stringify([{ productId: 4, quantity: 999 }]);

    expect(parseStoredCart(raw)[0].quantity).toBe(MAX_QUANTITY_PER_LINE);
  });

  it("merges entries that name the same product twice", () => {
    const raw = JSON.stringify([
      { productId: 4, quantity: 1 },
      { productId: 4, quantity: 2 },
    ]);

    expect(parseStoredCart(raw)).toEqual([{ productId: 4, quantity: 3 }]);
  });

  it("drops ids that could never be a product", () => {
    const raw = JSON.stringify([
      { productId: -1, quantity: 1 },
      { productId: 0, quantity: 1 },
      { productId: 2 ** 60, quantity: 1 },
      { productId: 9, quantity: 1 },
    ]);

    expect(parseStoredCart(raw)).toEqual([{ productId: 9, quantity: 1 }]);
  });

  it("keeps no more lines than one order may contain", () => {
    const raw = JSON.stringify(
      Array.from({ length: 80 }, (_, i) => ({ productId: i + 1, quantity: 1 })),
    );

    expect(parseStoredCart(raw)).toHaveLength(MAX_LINES_PER_ORDER);
  });

  it("ignores extra fields such as a price planted in storage", () => {
    const raw = JSON.stringify([{ productId: 4, quantity: 1, priceCents: 1 }]);

    expect(parseStoredCart(raw)).toEqual([{ productId: 4, quantity: 1 }]);
  });
});
