import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiErrorResponseSchema, apiPaths, MOCK_USER_HEADER, voteResponseSchema } from "@polling/shared";
import { developmentDefaults, httpOrigin } from "@polling/shared/development";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { createTestDatabase } from "./database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let server: Server;
let port: number;
let pollId: string;
let optionId: string;
let arrivals: number[] = [];
beforeAll(async () => {
  database = await createTestDatabase();
  const repository = createPollRepository(database.pool);
  const poll = await repository.getActivePoll();
  if (!poll?.options[0]) throw new Error("Seeded poll option is missing");
  pollId = poll.id;
  optionId = poll.options[0].id;
  const app = createApp({
    repository,
    shouldFailVote: () => false,
    checkDatabase: async () => { await database.pool.query("SELECT 1 FROM polls"); },
    logError: (message, error) => console.error(message, error),
  });
  server = createServer((incoming, response) => {
    if (incoming.method === "POST") incoming.once("end", () => arrivals.push(performance.now()));
    app(incoming, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, developmentDefaults.host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing TCP listener");
  port = address.port;
  expect((await fetch(`${httpOrigin(developmentDefaults.host, port)}${apiPaths.health}`)).status).toBe(200);
});
afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (database) await database.close();
});

async function burst(users: string[]) {
  const body = JSON.stringify({ optionId });
  arrivals = [];
  const clients = users.map((userId) => {
    let readyResolve!: () => void;
    let readyReject!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    let outgoing!: ReturnType<typeof request>;
    const completed = new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      outgoing = request({
        hostname: developmentDefaults.host, port, path: apiPaths.votes(pollId), method: "POST",
        agent: false,
        headers: {
          [MOCK_USER_HEADER]: userId, "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body), Connection: "close",
        },
      }, (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => { text += chunk; });
        response.once("error", reject);
        response.once("end", () => {
          try { resolve({ status: response.statusCode ?? 0, body: JSON.parse(text) }); }
          catch (error) { reject(error); }
        });
      });
      outgoing.once("error", (error) => { readyReject(error); reject(error); });
      outgoing.once("socket", (socket) => {
        socket.setNoDelay(true);
        if (socket.connecting) socket.once("connect", readyResolve);
        else readyResolve();
      });
      outgoing.setTimeout(8000, () => outgoing.destroy(new Error("Synchronized vote request timed out")));
      outgoing.flushHeaders();
    });
    return { outgoing, ready, completed };
  });
  const settled = Promise.allSettled(clients.map((client) => client.completed));
  const releases: number[] = [];
  try {
    // Open every TCP connection first, then release all vote bodies without an intervening await.
    await Promise.all(clients.map((client) => client.ready));
    for (const client of clients) {
      releases.push(performance.now());
      client.outgoing.end(body);
    }
    const outcomes = await settled;
    const responses = outcomes.map((outcome) => {
      if (outcome.status === "rejected") throw outcome.reason;
      return outcome.value;
    });
    expect(arrivals).toHaveLength(users.length);
    const span = (times: number[]) => Number((Math.max(...times) - Math.min(...times)).toFixed(3));
    const buckets = new Map<number, number>();
    for (const time of arrivals) {
      const millisecond = Math.floor(time);
      buckets.set(millisecond, (buckets.get(millisecond) ?? 0) + 1);
    }
    console.info("Synchronized TCP vote timing", {
      requests: users.length, clientReleaseSpanMs: span(releases),
      serverBodyArrivalSpanMs: span(arrivals),
      largestSameMillisecondArrivalGroup: Math.max(...buckets.values()),
      allArrivedInOneMillisecond: buckets.size === 1,
    });
    return responses;
  } finally {
    for (const client of clients) client.outgoing.destroy();
    await settled;
  }
}

describe("synchronized votes over 100 preconnected TCP clients", () => {
  it("persists all 100 distinct users' votes for the exact same option", async () => {
    const responses = await burst(Array.from({ length: 100 }, (_, index) => `burst-user-${index}`));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(100);
    for (const response of responses) expect(voteResponseSchema.parse(response.body)).toEqual({ pollId, optionId });
    const persisted = await database.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM votes WHERE poll_id = $1 AND option_id = $2 AND user_id LIKE 'burst-user-%'",
      [pollId, optionId],
    );
    expect(persisted.rows[0]?.count).toBe(100);
    const results = await createPollRepository(database.pool).getResults(pollId, "observer");
    expect(results?.totalVotes).toBe(100);
    expect(results?.options.find((option) => option.id === optionId)?.count).toBe(100);
  });

  it("accepts exactly one of 100 synchronized requests from the same user", async () => {
    const responses = await burst(Array.from({ length: 100 }, () => "burst-duplicate"));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    const rejected = responses.filter((response) => response.status === 409);
    expect(rejected).toHaveLength(99);
    for (const response of rejected) expect(apiErrorResponseSchema.parse(response.body).error.code).toBe("ALREADY_VOTED");
    const results = await createPollRepository(database.pool).getResults(pollId, "burst-duplicate");
    expect(results?.totalVotes).toBe(101);
    expect(results?.myVote).toBe(optionId);
    const persisted = await database.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM votes WHERE poll_id = $1 AND user_id = $2", [pollId, "burst-duplicate"],
    );
    expect(persisted.rows[0]?.count).toBe(1);
  });

  it("rejects a missing mock identity over TCP without changing the persisted count", async () => {
    const response = await fetch(`${httpOrigin(developmentDefaults.host, port)}${apiPaths.votes(pollId)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }),
    });
    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).error.code).toBe("INVALID_REQUEST");
    expect((await createPollRepository(database.pool).getResults(pollId, "observer"))?.totalVotes).toBe(101);
  });
});
