import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pollResultsSchema, pollSchema } from "@polling/shared";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { createTestDatabase } from "./database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  database = await createTestDatabase();
  app = createApp({
    repository: createPollRepository(database.pool),
    shouldFailVote: () => false,
    checkDatabase: async () => { await database.pool.query("SELECT 1 FROM polls"); },
    logError: (message, error) => console.error(message, error),
  });
});
afterAll(async () => { if (database) await database.close(); });

describe("poll display and result contracts", () => {
  it("loads the seeded poll with ordered zero-vote options", async () => {
    const active = await request(app).get("/api/polls/active").set("X-Mock-User-Id", "reader");
    expect(active.status).toBe(200);
    const poll = pollSchema.parse(active.body);
    expect(poll.options.map((option) => option.label)).toEqual([
      "Dark mode", "Mobile app", "Data exports", "More integrations",
    ]);
    const response = await request(app).get(`/api/polls/${poll.id}/results`).set("X-Mock-User-Id", "reader");
    const results = pollResultsSchema.parse(response.body);
    expect(results.totalVotes).toBe(0);
    expect(results.myVote).toBeNull();
    expect(results.options.every((option) => option.count === 0)).toBe(true);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("missing or malformed identities cannot vote or read personalized results", async () => {
    const poll = await createPollRepository(database.pool).getActivePoll();
    if (!poll) throw new Error("No seeded poll");
    expect((await request(app).get("/api/polls/active")).status).toBe(400);
    expect((await request(app).get(`/api/polls/${poll.id}/results`).set("X-Mock-User-Id", "bad user")).status).toBe(400);
    const response = await request(app).post(`/api/polls/${poll.id}/votes`)
      .set("X-Mock-User-Id", "x".repeat(81)).send({ optionId: poll.options[0]?.id });
    expect(response.status).toBe(400);
    expect((await createPollRepository(database.pool).getResults(poll.id, "reader"))?.totalVotes).toBe(0);
  });
  it("persists a vote and keeps another user's personalized result separate", async () => {
    const repo = createPollRepository(database.pool);
    const poll = await repo.getActivePoll();
    if (!poll || !poll.options[1]) throw new Error("No seeded option");
    const response = await request(app).post(`/api/polls/${poll.id}/votes`)
      .set("X-Mock-User-Id", "voter").send({ optionId: poll.options[1].id });
    expect(response.status).toBe(201);
    expect((await repo.getResults(poll.id, "voter"))?.myVote).toBe(poll.options[1].id);
    const other = await repo.getResults(poll.id, "reader");
    expect(other?.myVote).toBeNull();
    expect(other?.totalVotes).toBe(1);
    expect(other?.options[1]?.count).toBe(1);
  });
});
