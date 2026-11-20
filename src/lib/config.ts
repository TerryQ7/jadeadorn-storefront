import { randomBytes } from "node:crypto";

const globalForConfig = globalThis as typeof globalThis & {
  __jadeadornWebhookSecret?: string;
};

/**
 * The secret shared between the payment provider and our webhook endpoint.
 *
 * With a real provider this comes from their dashboard via
 * PAYMENT_WEBHOOK_SECRET. With the built-in mock gateway both sides run in
 * this process, so when the variable is unset we generate a random secret at
 * startup: the app runs with zero configuration and there is still no
 * well-known default that would let a stranger forge a "paid" event.
 */
export function getWebhookSecret(): string {
  if (process.env.PAYMENT_WEBHOOK_SECRET) {
    return process.env.PAYMENT_WEBHOOK_SECRET;
  }
  globalForConfig.__jadeadornWebhookSecret ??= randomBytes(32).toString("hex");
  return globalForConfig.__jadeadornWebhookSecret;
}
