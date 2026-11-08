import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { migrate } from "../src/db/migrate.ts";
import { createTestDatabase } from "./database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let pollId: string;
let optionId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  app = createApp({
    repository: createPollRepository(database.pool),
    shouldFailVote: () => false,
    checkDatabase: async () => { await database.pool.query("SELECT 1 FROM polls LIMIT 1"); },
    logError: (message, error) => console.error(message, error),
  });
  const poll = await createPollRepository(database.pool).getActivePoll();
  if (!poll || !poll.options[0]) throw new Error("Seeded active poll is missing");
  pollId = poll.id;
  optionId = poll.options[0].id;
});

afterAll(async () => { if (database) await database.close(); });

const vote = (user: string, option = optionId) =>
  request(app).post(`/api/polls/${pollId}/votes`).set("X-Mock-User-Id", user).send({ optionId: option });
const results = (user = "observer") =>
  request(app).get(`/api/polls/${pollId}/results`).set("X-Mock-User-Id", user);

describe("real PostgreSQL voting integrity", () => {
  it("persists exactly 100 concurrent votes for the same option", async () => {
    const before = await results();
    const responses = await Promise.all(Array.from({ length: 100 }, (_, i) => vote(`distinct-${i}`)));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(100);
    const after = await results();
    expect(after.body.totalVotes - before.body.totalVotes).toBe(100);
    expect(after.body.options[0].count - before.body.options[0].count).toBe(100);
    const persisted = await database.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM votes WHERE user_id LIKE 'distinct-%'",
    );
    expect(persisted.rows[0]?.count).toBe(100);
  });

  it("allows exactly one of 100 concurrent duplicate submissions", async () => {
    const responses = await Promise.all(Array.from({ length: 100 }, () => vote("same-user")));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409
      && response.body.error.code === "ALREADY_VOTED")).toHaveLength(99);
    const persisted = await database.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM votes WHERE user_id = $1", ["same-user"],
    );
    expect(persisted.rows[0]?.count).toBe(1);
    expect((await results("same-user")).body.myVote).toBe(optionId);
  });

  it("rejects an unknown option and an option belonging to another poll", async () => {
    const otherPoll = "00000000-0000-4000-8000-000000000099";
    const otherOption = "00000000-0000-4000-8000-000000000098";
    await database.pool.query("INSERT INTO polls (id, question, active) VALUES ($1, 'Other poll', false)", [otherPoll]);
    await database.pool.query(
      "INSERT INTO poll_options (id, poll_id, label, display_order) VALUES ($1, $2, 'Other', 0)",
      [otherOption, otherPoll],
    );
    const before = await results();
    expect((await vote("invalid-option", "00000000-0000-4000-8000-000000000097")).status).toBe(400);
    expect((await vote("foreign-option", otherOption)).status).toBe(400);
    expect((await results()).body.totalVotes).toBe(before.body.totalVotes);
    await expect(database.pool.query(
      "INSERT INTO votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)",
      [pollId, otherOption, "direct-invalid"],
    )).rejects.toMatchObject({ code: "23503" });
  });

  it("validates identity, poll IDs and exact body shape", async () => {
    expect((await request(app).post(`/api/polls/${pollId}/votes`).send({ optionId })).status).toBe(400);
    expect((await vote("bad user")).status).toBe(400);
    expect((await request(app).get("/api/polls/not-an-id/results")
      .set("X-Mock-User-Id", "observer")).status).toBe(400);
    expect((await request(app).post(`/api/polls/${pollId}/votes`).set("X-Mock-User-Id", "extra")
      .send({ optionId, extra: true })).status).toBe(400);
    expect((await request(app).get("/api/polls/00000000-0000-4000-8000-000000000096/results")
      .set("X-Mock-User-Id", "observer")).status).toBe(404);
  });

  it("simulated failure happens before any database write", async () => {
    const shouldFailVote = vi.fn(() => true);
    const failingApp = createApp({
      repository: createPollRepository(database.pool),
      shouldFailVote,
      checkDatabase: async () => { await database.pool.query("SELECT 1"); },
      logError: vi.fn(),
    });
    const before = await results();
    const response = await request(failingApp).post(`/api/polls/${pollId}/votes`)
      .set("X-Mock-User-Id", "failed-vote").send({ optionId });
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("SIMULATED_FAILURE");
    expect((await results("failed-vote")).body.myVote).toBeNull();
    expect((await results()).body.totalVotes).toBe(before.body.totalVotes);
    expect(shouldFailVote).toHaveBeenCalledOnce();
  });

  it("setup is repeatable and retains accepted votes", async () => {
    const before = await results("same-user");
    await migrate(database.pool);
    expect((await results("same-user")).body).toEqual(before.body);
    expect((await request(app).get("/api/polls/active").set("X-Mock-User-Id", "observer")).status).toBe(200);
  });

  it("closed polls reject writes", async () => {
    await database.pool.query("UPDATE polls SET active = false WHERE id = $1", [pollId]);
    try {
      expect((await vote("closed-poll")).body.error.code).toBe("POLL_CLOSED");
      expect((await results("closed-poll")).body.myVote).toBeNull();
      expect((await request(app).get("/api/polls/active").set("X-Mock-User-Id", "observer")).status).toBe(404);
    } finally {
      await database.pool.query("UPDATE polls SET active = true WHERE id = $1", [pollId]);
    }
  });
});
