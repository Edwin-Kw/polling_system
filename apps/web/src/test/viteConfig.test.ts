// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../../vite.config.ts";
import { API_BASE_PATH, SOCKET_PATH } from "@polling/shared";
import { developmentDefaults } from "@polling/shared/development";

afterEach(() => vi.unstubAllEnvs());

describe("Vite address configuration", () => {
  it("shares the overridden API target for HTTP and sockets without changing build mode", async () => {
    vi.stubEnv("HOST", "localhost");
    vi.stubEnv("PORT", "3100");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITE_USER_NODE_ENV", undefined);
    if (typeof config !== "function") throw new Error("Expected a Vite configuration factory");
    const resolved = await config({ command: "build", mode: "production" });
    expect(resolved.server?.host).toBe(developmentDefaults.host);
    expect(resolved.server?.port).toBe(developmentDefaults.webPort);
    expect(resolved.server?.proxy).toEqual({
      [API_BASE_PATH]: "http://localhost:3100",
      [SOCKET_PATH]: { target: "http://localhost:3100", ws: true },
    });
    expect(process.env.NODE_ENV).toBe("production");
    expect(process.env.VITE_USER_NODE_ENV).toBeUndefined();
    expect(resolved.envDir).toBeUndefined();
    expect(resolved.define).toBeUndefined();
  });
});
