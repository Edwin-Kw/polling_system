import { describe, expect, it, vi } from "vitest";
import { getMockUserId } from "./mockUser.ts";

describe("stable mock identity", () => {
  it("persists an injected ID and reuses it on reload", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const random = vi.fn(() => "deterministic");
    expect(getMockUserId(storage, random)).toBe("user_deterministic");
    expect(getMockUserId(storage, random)).toBe("user_deterministic");
    expect(random).toHaveBeenCalledOnce();
  });
  it("surfaces inaccessible storage rather than silently creating a new voter", () => {
    const storage = { getItem: () => { throw new Error("Storage blocked"); }, setItem: vi.fn() };
    expect(() => getMockUserId(storage)).toThrow("Storage blocked");
  });
  it("rejects an invalid stored identity instead of silently changing users", () => {
    expect(() => getMockUserId({ getItem: () => "bad user", setItem: vi.fn() })).toThrow();
  });
});
