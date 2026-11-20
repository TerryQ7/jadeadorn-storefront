import { describe, expect, it } from "vitest";
import { formatCents } from "@/lib/money";

describe("formatCents", () => {
  it("formats whole dollars with two decimals", () => {
    expect(formatCents(4800)).toBe("$48.00");
  });

  it("keeps cents", () => {
    expect(formatCents(695)).toBe("$6.95");
  });

  it("adds thousands separators", () => {
    expect(formatCents(125000)).toBe("$1,250.00");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });
});
