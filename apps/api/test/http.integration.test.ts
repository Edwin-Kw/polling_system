import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPaths, MOCK_USER_HEADER, pollResultsSchema, pollSchema, voteResponseSchema } from "@polling/shared";
import { developmentDefaults, httpOrigin } from "@polling/shared/development";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { createTestDatabase } from "./database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let server: Server;
let origin: string;
async function startServer() {
  const app = createApp({
    repository: createPollRepository(database.pool),
    shouldFailVote: () => false,
    checkDatabase: async () => { await database.pool.query("SELECT 1 FROM polls"); },
    logError: (message, error) => console.error(message, error),
  });
  server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, developmentDefaults.host, () => resolve(instance));
    instance.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("HTTP listener has no TCP address");
  origin = httpOrigin(developmentDefaults.host, address.port);
}
const closeServer = () => new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});
beforeAll(async () => { database = await createTestDatabase(); await startServer(); });
afterAll(async () => {
  if (server?.listening) await closeServer();
  if (database) await database.close();
});
const headers = { [MOCK_USER_HEADER]: "http-voter" };

describe("running HTTP application", () => {
  it("serves health, rejects missing identity, and completes write/read/duplicate flows over TCP", async () => {
    expect((await fetch(`${origin}${apiPaths.health}`)).status).toBe(200);
    expect((await fetch(`${origin}${apiPaths.activePoll}`)).status).toBe(400);
    const active = await fetch(`${origin}${apiPaths.activePoll}`, { headers });
    expect(active.status).toBe(200);
    const poll = pollSchema.parse(await active.json());
    const optionId = poll.options[0]?.id;
    const url = `${origin}${apiPaths.votes(poll.id)}`;
    const submission = { method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }) };
    const accepted = await fetch(url, submission);
    expect(accepted.status).toBe(201);
    expect(voteResponseSchema.parse(await accepted.json()).optionId).toBe(optionId);
    const duplicate = await fetch(url, submission);
    expect(duplicate.status).toBe(409);
    const results = pollResultsSchema.parse(await (await fetch(`${origin}${apiPaths.results(poll.id)}`, { headers })).json());
    expect(results.totalVotes).toBe(1);
    expect(results.myVote).toBe(optionId);
  });
  it("retains the accepted vote after the HTTP server is restarted", async () => {
    await closeServer();
    await startServer();
    const poll = pollSchema.parse(await (await fetch(`${origin}${apiPaths.activePoll}`, { headers })).json());
    const response = await fetch(`${origin}${apiPaths.results(poll.id)}`, { headers });
    expect(response.status).toBe(200);
    const results = pollResultsSchema.parse(await response.json());
    expect(results.totalVotes).toBe(1);
    expect(results.myVote).toBe(poll.options[0]?.id);
    expect((await fetch(`${origin}${apiPaths.results(poll.id)}`)).status).toBe(400);
  });
});
