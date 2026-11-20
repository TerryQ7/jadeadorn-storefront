import { MAX_LINES_PER_ORDER, MAX_QUANTITY_PER_LINE } from "@/lib/pricing";

// Pure bag arithmetic, kept apart from browser storage so it can be tested
// without a browser. Every function returns a new list.

export type CartLine = { productId: number; quantity: number };

const clamp = (quantity: number) =>
  Math.max(1, Math.min(MAX_QUANTITY_PER_LINE, Math.trunc(quantity)));

export function addLine(
  lines: CartLine[],
  productId: number,
  quantity: number,
): CartLine[] {
  if (!lines.some((line) => line.productId === productId)) {
    return [...lines, { productId, quantity: clamp(quantity) }];
  }
  return lines.map((line) =>
    line.productId === productId
      ? { ...line, quantity: clamp(line.quantity + quantity) }
      : line,
  );
}

export function setLineQuantity(
  lines: CartLine[],
  productId: number,
  quantity: number,
): CartLine[] {
  return lines.map((line) =>
    line.productId === productId
      ? { ...line, quantity: clamp(quantity) }
      : line,
  );
}

export function quantityOf(lines: CartLine[], productId: number): number {
  return lines.find((line) => line.productId === productId)?.quantity ?? 0;
}

export function removeLine(lines: CartLine[], productId: number): CartLine[] {
  return lines.filter((line) => line.productId !== productId);
}

/**
 * Reads a bag back from storage. Storage is on the customer's device and can
 * contain anything, so the result is rebuilt to satisfy the same rules the
 * server enforces: real-looking ids, one line per product, bounded sizes.
 * Otherwise one bad entry would make the server reject the whole bag.
 */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  let lines: CartLine[] = [];
  for (const entry of data) {
    const valid =
      Number.isSafeInteger(entry?.productId) &&
      entry.productId > 0 &&
      Number.isInteger(entry?.quantity) &&
      entry.quantity >= 1;
    if (!valid) continue;
    // addLine merges a repeated product into its existing line.
    lines = addLine(lines, entry.productId, entry.quantity);
    if (lines.length === MAX_LINES_PER_ORDER) break;
  }
  return lines;
}
