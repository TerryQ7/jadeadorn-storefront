import type { Db } from "@/lib/db/client";
import { createMockProvider } from "@/lib/payments/mock-gateway";
import type { PaymentProvider } from "@/lib/payments/types";

// One setting decides who takes the money: PAYMENT_PROVIDER.
// Unset (or "mock") means the built-in mock gateway, so the demo runs with no
// configuration. Any other value switches the mock gateway's page and
// endpoint off entirely, so a deployment configured for a real provider
// cannot be paid with a test card.

function configuredProvider(): string {
  return process.env.PAYMENT_PROVIDER || "mock";
}

export function isMockGatewayEnabled(): boolean {
  return configuredProvider() === "mock";
}

/**
 * The payment provider the store talks to. Going live means adding a
 * Stripe-backed implementation of PaymentProvider here; nothing that calls
 * this function needs to change.
 */
export function getPaymentProvider(db?: Db): PaymentProvider {
  if (isMockGatewayEnabled()) return createMockProvider(db);
  throw new Error(
    `PAYMENT_PROVIDER is set to "${configuredProvider()}", which has no implementation yet. See DESIGN.md, "Handing over to IT".`,
  );
}
