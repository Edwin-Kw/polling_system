import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activePollsSchema, apiPaths, MOCK_USER_HEADER, pollResultsSchema, pollSchema } from "@polling/shared";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { migrate } from "../src/db/migrate.ts";
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
const list = () => request(app).get(apiPaths.polls).set(MOCK_USER_HEADER, "reader");

describe("multiple active polls backed by PostgreSQL", () => {
  it("lists ordered real polls, excludes closed polls, and retains the default endpoint", async () => {
    expect((await request(app).get(apiPaths.polls)).status).toBe(400);
    const response = await list();
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const polls = activePollsSchema.parse(response.body);
    expect(polls).toHaveLength(3);
    expect(polls.map((poll) => poll.id)).toEqual([...polls.map((poll) => poll.id)].sort());
    const active = await request(app).get(apiPaths.activePoll).set(MOCK_USER_HEADER, "reader");
    expect(pollSchema.parse(active.body)).toEqual(polls[0]);
    const second = polls[1]!;
    await database.pool.query("UPDATE polls SET active = false WHERE id = $1", [second.id]);
    try {
      expect(activePollsSchema.parse((await list()).body).map((poll) => poll.id)).not.toContain(second.id);
      await database.pool.query("UPDATE polls SET active = false");
      expect((await list()).body).toEqual([]);
      expect((await request(app).get(apiPaths.activePoll).set(MOCK_USER_HEADER, "reader")).status).toBe(404);
    } finally {
      await database.pool.query("UPDATE polls SET active = true");
    }
  });

  it("allows one vote per user in each poll without mixing results or option membership", async () => {
    const polls = activePollsSchema.parse((await list()).body);
    const first = polls[0]!;
    const second = polls[1]!;
    for (const poll of [first, second]) {
      const optionId = poll.options[0]!.id;
      const vote = () => request(app).post(apiPaths.votes(poll.id))
        .set(MOCK_USER_HEADER, "multi-voter").send({ optionId });
      expect((await vote()).status).toBe(201);
      expect((await vote()).status).toBe(409);
      const response = await request(app).get(apiPaths.results(poll.id)).set(MOCK_USER_HEADER, "multi-voter");
      expect(pollResultsSchema.parse(response.body)).toMatchObject({ pollId: poll.id, totalVotes: 1, myVote: optionId });
    }
    const crossPoll = await request(app).post(apiPaths.votes(second.id))
      .set(MOCK_USER_HEADER, "foreign-option").send({ optionId: first.options[0]!.id });
    expect(crossPoll.status).toBe(400);
    expect((await createPollRepository(database.pool).getResults(second.id, "foreign-option"))?.totalVotes).toBe(1);
    expect((await createPollRepository(database.pool).getResults(polls[2]!.id, "multi-voter"))?.totalVotes).toBe(0);
  });

  it("upgrades the legacy single-active index repeatably without altering votes or closed polls", async () => {
    const repo = createPollRepository(database.pool);
    const first = (await repo.getActivePoll())!;
    const before = await repo.getResults(first.id, "multi-voter");
    await database.pool.query("UPDATE polls SET active = false WHERE id <> $1", [first.id]);
    await database.pool.query("CREATE UNIQUE INDEX one_active_poll ON polls (active) WHERE active");
    await migrate(database.pool);
    await migrate(database.pool);
    expect(await repo.getResults(first.id, "multi-voter")).toEqual(before);
    expect(await repo.getActivePolls()).toHaveLength(1);
    const other = await database.pool.query<{ id: string }>("SELECT id FROM polls WHERE id <> $1 ORDER BY id LIMIT 1", [first.id]);
    await database.pool.query("UPDATE polls SET active = true WHERE id = $1", [other.rows[0]!.id]);
    expect(await repo.getActivePolls()).toHaveLength(2);
    expect((await database.pool.query("SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'one_active_poll'")).rowCount).toBe(0);
  });
});
