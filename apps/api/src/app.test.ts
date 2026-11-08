import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import { API_BASE_PATH, apiPaths, MOCK_USER_HEADER } from "@polling/shared";

const votingDependencies = {
  repository: {
    getActivePoll: vi.fn(),
    getActivePolls: vi.fn(),
    getPoll: vi.fn(),
    getResults: vi.fn(),
    insertVote: vi.fn(),
  },
  shouldFailVote: () => false,
};

describe("API", () => {
  it("reports ready only after the database check succeeds", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ ...votingDependencies, checkDatabase, logError: vi.fn() });
    const response = await request(app).get(apiPaths.health);

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
      ...votingDependencies,
      checkDatabase: vi.fn().mockRejectedValue(error),
      logError,
    });
    const response = await request(app).get(apiPaths.health);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(logError).toHaveBeenCalledWith("Database health check failed", error);
  });

  it("returns JSON for an unknown API route", async () => {
    const app = createApp({ ...votingDependencies, checkDatabase: vi.fn(), logError: vi.fn() });
    const response = await request(app).get(`${API_BASE_PATH}/missing`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("logs malformed JSON and returns 400 instead of 500", async () => {
    const logError = vi.fn();
    const app = createApp({ ...votingDependencies, checkDatabase: vi.fn(), logError });
    const response = await request(app)
      .post(`${API_BASE_PATH}/missing`)
      .set("Content-Type", "application/json")
      .send("{invalid");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(logError).toHaveBeenCalledOnce();
  });

  it("logs unexpected polling failures and surfaces a JSON 500", async () => {
    const error = new Error("Connection reset");
    const logError = vi.fn();
    const app = createApp({
      ...votingDependencies,
      repository: { ...votingDependencies.repository, getActivePoll: vi.fn().mockRejectedValue(error) },
      checkDatabase: vi.fn(),
      logError,
    });
    const response = await request(app).get(apiPaths.activePoll).set(MOCK_USER_HEADER, "user");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(logError).toHaveBeenCalledWith("HTTP request failed", error);
  });

  it("logs a notification failure without misreporting a committed vote as rejected", async () => {
    const pollId = "00000000-0000-4000-8000-000000000001";
    const optionId = "00000000-0000-4000-8000-000000000011";
    const error = new Error("Notification failed");
    const logError = vi.fn();
    const app = createApp({
      ...votingDependencies,
      repository: {
        ...votingDependencies.repository,
        getPoll: vi.fn().mockResolvedValue({ id: pollId, active: true, options: [{ id: optionId }] }),
        insertVote: vi.fn().mockResolvedValue(true),
      },
      checkDatabase: vi.fn(),
      logError,
      notifyPollChanged: () => { throw error; },
    });
    const response = await request(app).post(apiPaths.votes(pollId))
      .set(MOCK_USER_HEADER, "user").send({ optionId });
    expect(response.status).toBe(201);
    expect(logError).toHaveBeenCalledWith("Vote saved but live notification failed", error);
  });
});
