import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider, isMockGatewayEnabled } from "@/lib/payments";
import { createTestDb } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("payment provider selection", () => {
  it("uses the mock gateway when no provider is configured", () => {
    vi.stubEnv("PAYMENT_PROVIDER", undefined);

    expect(isMockGatewayEnabled()).toBe(true);
    expect(getPaymentProvider(createTestDb()).name).toBe("mock");
  });

  it("switches the mock gateway off once another provider is configured", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");

    expect(isMockGatewayEnabled()).toBe(false);
  });

  it("refuses to take orders for a provider that has no implementation", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");

    expect(() => getPaymentProvider(createTestDb())).toThrow(/stripe/);
  });
});
