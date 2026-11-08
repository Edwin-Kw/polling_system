import { describe, expect, it } from "vitest";
import { readConfig } from "./config.ts";
import { developmentDefaults } from "@polling/shared/development";

describe("server configuration", () => {
  it("loads PostgreSQL configuration with safe development defaults", () => {
    expect(readConfig({ DATABASE_URL: "postgresql://localhost/polling" })).toEqual({
      DATABASE_URL: "postgresql://localhost/polling",
      HOST: developmentDefaults.host,
      PORT: developmentDefaults.apiPort,
      NODE_ENV: "development",
      VOTE_FAILURE_RATE: 0.15,
    });
  });

  it("honors the same host and port overrides used by the development proxy", () => {
    const config = readConfig({ DATABASE_URL: "postgresql://localhost/polling", HOST: "::", PORT: "3100" });
    expect(config.HOST).toBe("::");
    expect(config.PORT).toBe(3100);
  });

  it.each([
    {},
    { DATABASE_URL: "https://localhost/polling" },
    { DATABASE_URL: "postgresql://localhost/polling", PORT: "not-a-port" },
    { DATABASE_URL: "postgresql://localhost/polling", VOTE_FAILURE_RATE: "1.1" },
  ])("rejects invalid configuration without printing credentials", (environment) => {
    expect(() => readConfig(environment)).toThrow("Invalid server configuration");
  });
});
