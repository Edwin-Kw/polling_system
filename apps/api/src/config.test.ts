import { describe, expect, it } from "vitest";
import { readConfig } from "./config.ts";

describe("server configuration", () => {
  it("loads PostgreSQL configuration with safe development defaults", () => {
    expect(readConfig({ DATABASE_URL: "postgresql://localhost/polling" })).toEqual({
      DATABASE_URL: "postgresql://localhost/polling",
      HOST: "127.0.0.1",
      PORT: 3000,
      NODE_ENV: "development",
      VOTE_FAILURE_RATE: 0.15,
    });
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
