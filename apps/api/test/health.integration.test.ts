import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { apiPaths } from "@polling/shared";
import { createApp } from "../src/app.ts";
import { readConfig } from "../src/config.ts";
import { createPool } from "../src/db/pool.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";

const config = readConfig();
const pool = createPool(config.DATABASE_URL);
pool.on("error", (error) => console.error("Integration database connection failed", error));

afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL connectivity", () => {
  it("checks a real PostgreSQL connection through the health endpoint", async () => {
    const app = createApp({
      repository: createPollRepository(pool),
      shouldFailVote: () => false,
      checkDatabase: async () => {
        await pool.query("SELECT 1");
      },
      logError: (message, error) => console.error(message, error),
    });

    const response = await request(app).get(apiPaths.health);
    expect(response.status).toBe(200);
    expect(response.body.database).toBe("connected");
  });
});
