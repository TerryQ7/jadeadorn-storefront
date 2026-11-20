import { z } from "zod";
import { MAX_LINES_PER_ORDER, MAX_QUANTITY_PER_LINE } from "@/lib/pricing";
import { US_STATE_CODES } from "@/lib/us-states";

// Everything the browser sends is validated here before it reaches the
// database. Note what is absent: no prices and no totals. The server looks
// those up itself.

const cartItemsSchema = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z
        .number()
        .int()
        .min(1, "Quantity must be at least 1")
        .max(
          MAX_QUANTITY_PER_LINE,
          `You can order up to ${MAX_QUANTITY_PER_LINE} of each item`,
        ),
    }),
  )
  .min(1, "Your bag is empty")
  .max(MAX_LINES_PER_ORDER, "Too many different items in one order")
  .refine(
    (items) => new Set(items.map((i) => i.productId)).size === items.length,
    "Each product can only appear once",
  );

const requiredText = (label: string, max: number) =>
  z
    .string(`Enter ${label}`)
    .trim()
    .min(1, `Enter ${label}`)
    .max(max, `Keep ${label} under ${max} characters`);

const checkoutSchema = z.object({
  items: cartItemsSchema,
  email: z
    .string("Enter your email address")
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address").max(254)),
  shipping: z.object({
    name: requiredText("your full name", 100),
    line1: requiredText("a street address", 120),
    line2: z
      .string()
      .trim()
      .max(120, "Keep this line under 120 characters")
      .nullish()
      .transform((value) => value || null),
    city: requiredText("a city", 80),
    state: z.enum(US_STATE_CODES, "Choose a state"),
    zip: z
      .string("Enter a ZIP code")
      .trim()
      .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code"),
  }),
  // Generated once per checkout attempt by the browser, so a double-click or
  // a retried request cannot create two orders.
  idempotencyKey: z.string().min(16).max(64),
});

export type CartItemInput = z.infer<typeof cartItemsSchema>[number];
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields: Record<string, string> };

function toResult<T>(result: z.ZodSafeParseResult<T>): Parsed<T> {
  if (result.success) return { ok: true, data: result.data };

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    // Keep the first message per field; it is the most specific one.
    if (!(key in fields)) fields[key] = issue.message;
  }
  return {
    ok: false,
    message: result.error.issues[0]?.message ?? "Invalid request",
    fields,
  };
}

export function parseCartItems(input: unknown): Parsed<CartItemInput[]> {
  return toResult(cartItemsSchema.safeParse(input));
}

export function parseCheckout(input: unknown): Parsed<CheckoutInput> {
  return toResult(checkoutSchema.safeParse(input));
}
