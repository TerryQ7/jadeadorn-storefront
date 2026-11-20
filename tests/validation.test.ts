import { describe, expect, it } from "vitest";
import { parseCartItems, parseCheckout } from "@/lib/validation";

const validCheckout = {
  items: [{ productId: 1, quantity: 2 }],
  email: "  Mei.Lin@Example.com ",
  shipping: {
    name: " Mei Lin ",
    line1: "12 Orchard St",
    line2: "",
    city: "Brooklyn",
    state: "NY",
    zip: "11201",
  },
  idempotencyKey: "3f0c2a52-7b1e-4c1c-9a57-0d3f6f1f2a10",
};

describe("parseCheckout", () => {
  it("accepts a complete order and tidies the contact fields", () => {
    const result = parseCheckout(validCheckout);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email).toBe("mei.lin@example.com");
    expect(result.data.shipping.name).toBe("Mei Lin");
    expect(result.data.shipping.line2).toBeNull();
  });

  it("accepts a ZIP+4 code", () => {
    const result = parseCheckout({
      ...validCheckout,
      shipping: { ...validCheckout.shipping, zip: "11201-1234" },
    });

    expect(result.ok).toBe(true);
  });

  it("reports an invalid email against the email field", () => {
    const result = parseCheckout({ ...validCheckout, email: "not-an-email" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields.email).toBeDefined();
  });

  it("reports a malformed ZIP code against the zip field", () => {
    const result = parseCheckout({
      ...validCheckout,
      shipping: { ...validCheckout.shipping, zip: "1120" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields["shipping.zip"]).toBeDefined();
  });

  it("rejects a state that is not a U.S. state code", () => {
    const result = parseCheckout({
      ...validCheckout,
      shipping: { ...validCheckout.shipping, state: "ZZ" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields["shipping.state"]).toBeDefined();
  });

  it("reports every missing required address field", () => {
    const result = parseCheckout({
      ...validCheckout,
      shipping: { name: "", line1: "", city: "", state: "", zip: "" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fields).sort()).toEqual([
      "shipping.city",
      "shipping.line1",
      "shipping.name",
      "shipping.state",
      "shipping.zip",
    ]);
  });

  it("rejects a missing idempotency key", () => {
    const result = parseCheckout({ ...validCheckout, idempotencyKey: undefined });

    expect(result.ok).toBe(false);
  });
});

describe("parseCartItems", () => {
  it("accepts product ids with whole-number quantities", () => {
    const result = parseCartItems([
      { productId: 4, quantity: 1 },
      { productId: 9, quantity: 3 },
    ]);

    expect(result.ok).toBe(true);
  });

  it("rejects an empty cart", () => {
    expect(parseCartItems([]).ok).toBe(false);
  });

  it("rejects a zero quantity", () => {
    expect(parseCartItems([{ productId: 4, quantity: 0 }]).ok).toBe(false);
  });

  it("rejects a quantity above the per-line maximum", () => {
    expect(parseCartItems([{ productId: 4, quantity: 11 }]).ok).toBe(false);
  });

  it("rejects the same product listed twice", () => {
    const result = parseCartItems([
      { productId: 4, quantity: 1 },
      { productId: 4, quantity: 2 },
    ]);

    expect(result.ok).toBe(false);
  });

  it("rejects input that is not a list", () => {
    expect(parseCartItems({ productId: 4 }).ok).toBe(false);
  });
});
