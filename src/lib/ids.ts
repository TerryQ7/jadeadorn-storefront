import { randomBytes, randomInt } from "node:crypto";

/**
 * A 128-bit random id, e.g. "ord_q3J0c2s1X0hBZ2xvYmFsIQ". Order ids appear in
 * the confirmation URL, so they must not be guessable: a sequential id would
 * let anyone read other customers' names and addresses by counting.
 */
export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("base64url")}`;
}

// No 0/O or 1/I, so a number read over the phone cannot be mistyped.
const READABLE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** The short number customers and support staff quote, e.g. "JA-7K3M9Q". */
export function orderNumber(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += READABLE[randomInt(READABLE.length)];
  }
  return `JA-${code}`;
}
