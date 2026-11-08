import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

describe("API scaffold", () => {
  it("reports ready only after the database check succeeds", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ checkDatabase, logError: vi.fn() });
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "polling-api",
      database: "connected",
    });
    expect(checkDatabase).toHaveBeenCalledOnce();
  });

  it("logs database failures and returns an explicit 503", async () => {
    const error = new Error("Connection refused");
    const logError = vi.fn();
    const app = createApp({
      checkDatabase: vi.fn().mockRejectedValue(error),
      logError,
    });
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(logError).toHaveBeenCalledWith("Database health check failed", error);
  });

  it("returns JSON for an unknown API route", async () => {
    const app = createApp({ checkDatabase: vi.fn(), logError: vi.fn() });
    const response = await request(app).get("/api/missing");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("logs malformed JSON and returns 400 instead of 500", async () => {
    const logError = vi.fn();
    const app = createApp({ checkDatabase: vi.fn(), logError });
    const response = await request(app)
      .post("/api/missing")
      .set("Content-Type", "application/json")
      .send("{invalid");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(logError).toHaveBeenCalledOnce();
  });
});
