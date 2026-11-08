import { describe, expect, it, vi } from "vitest";
import { createFailurePolicy } from "./failurePolicy.ts";

describe("pre-write failure policy", () => {
  it("rejects below 15% and accepts exactly at the threshold", () => {
    expect(createFailurePolicy(0.15, () => 0.149)()).toBe(true);
    expect(createFailurePolicy(0.15, () => 0.15)()).toBe(false);
  });

  it("can disable failure simulation for concurrency tests", () => {
    const random = vi.fn(() => 0);
    expect(createFailurePolicy(0, random)()).toBe(false);
  });

  it.each([-1, 1.1, NaN])("rejects invalid rate %s", (rate) => {
    expect(() => createFailurePolicy(rate)).toThrow();
  });
});
