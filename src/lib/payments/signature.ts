import { createHmac, timingSafeEqual } from "node:crypto";

// Webhook signing in the same shape Stripe uses: the header carries a
// timestamp and an HMAC-SHA256 of "<timestamp>.<raw body>". Signing the
// timestamp lets the receiver reject old, replayed deliveries.

const DEFAULT_TOLERANCE_SECONDS = 300;

function digest(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export function signPayload(
  rawBody: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): string {
  return `t=${timestamp},v1=${digest(rawBody, secret, timestamp)}`;
}

export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
  options: { now?: number; toleranceSeconds?: number } = {},
): boolean {
  if (!header) return false;

  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!match) return false;

  const timestamp = Number(match[1]);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - timestamp) > tolerance) return false;

  const expected = Buffer.from(digest(rawBody, secret, timestamp), "hex");
  const received = Buffer.from(match[2], "hex");
  // Constant-time comparison so response timing does not leak the signature.
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
