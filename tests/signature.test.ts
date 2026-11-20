import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "@/lib/payments/signature";

const SECRET = "whsec_test";
const BODY = JSON.stringify({ id: "evt_1", type: "payment.succeeded" });
const NOW = 1_800_000_000;

describe("webhook signatures", () => {
  it("accepts a payload signed with the shared secret", () => {
    const header = signPayload(BODY, SECRET, NOW);

    expect(verifySignature(BODY, header, SECRET, { now: NOW })).toBe(true);
  });

  it("rejects a payload that was altered after signing", () => {
    const header = signPayload(BODY, SECRET, NOW);
    const tampered = BODY.replace("evt_1", "evt_2");

    expect(verifySignature(tampered, header, SECRET, { now: NOW })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const header = signPayload(BODY, "someone-elses-secret", NOW);

    expect(verifySignature(BODY, header, SECRET, { now: NOW })).toBe(false);
  });

  it("rejects a signature older than the tolerance window", () => {
    const header = signPayload(BODY, SECRET, NOW - 301);

    expect(
      verifySignature(BODY, header, SECRET, { now: NOW, toleranceSeconds: 300 }),
    ).toBe(false);
  });

  it("rejects a timestamp that was changed without re-signing", () => {
    const header = signPayload(BODY, SECRET, NOW - 10_000);
    const refreshed = header.replace(/t=\d+/, `t=${NOW}`);

    expect(verifySignature(BODY, refreshed, SECRET, { now: NOW })).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifySignature(BODY, null, SECRET, { now: NOW })).toBe(false);
    expect(verifySignature(BODY, "nonsense", SECRET, { now: NOW })).toBe(false);
    expect(verifySignature(BODY, "t=abc,v1=zz", SECRET, { now: NOW })).toBe(
      false,
    );
  });
});
