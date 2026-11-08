import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHealth } from "./health.ts";
import { apiPaths } from "@polling/shared";

afterEach(() => vi.unstubAllGlobals());

describe("health API client", () => {
  it("validates the returned health response", async () => {
    const body = { status: "ok", service: "polling-api", database: "connected" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    ));
    const signal = new AbortController().signal;

    await expect(fetchHealth(signal)).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(apiPaths.health, { signal });
  });

  it("surfaces non-success responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(fetchHealth(new AbortController().signal)).rejects.toThrow("HTTP 503");
  });

  it("rejects an invalid success-shaped payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    ));
    await expect(fetchHealth(new AbortController().signal)).rejects.toThrow();
  });
});
