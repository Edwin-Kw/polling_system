import { createServer } from "node:http";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ClientToServerEvents, ServerToClientEvents } from "@polling/shared";
import { apiPaths, MOCK_USER_HEADER, POLL_CHANGED_EVENT, SOCKET_PATH } from "@polling/shared";
import { developmentDefaults, httpOrigin } from "@polling/shared/development";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { createPollSocketServer } from "../src/realtime/socketServer.ts";
import { createTestDatabase } from "./database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
const server = createServer();
let sockets: ReturnType<typeof createPollSocketServer>;
let origin: string;
let pollId: string;
let optionId: string;
let failVotes = false;
const clients: Socket<ServerToClientEvents, ClientToServerEvents>[] = [];

async function newClient(transports: ("polling" | "websocket")[] = ["websocket"]) {
  const client: Socket<ServerToClientEvents, ClientToServerEvents> =
    connect(origin, { autoConnect: false, transports, reconnection: false, path: SOCKET_PATH });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
    client.connect();
  });
  return client;
}
beforeAll(async () => {
  database = await createTestDatabase();
  const repository = createPollRepository(database.pool);
  const poll = await repository.getActivePoll();
  if (!poll || !poll.options[0]) throw new Error("Seed missing");
  pollId = poll.id;
  optionId = poll.options[0].id;
  server.on("request", createApp({
    repository, shouldFailVote: () => failVotes,
    notifyPollChanged: (id) => sockets.notifyPollChanged(id),
    checkDatabase: async () => { await database.pool.query("SELECT 1"); },
    logError: (message, error) => console.error(message, error),
  }));
  sockets = createPollSocketServer(server, (message, error) => console.error(message, error));
  await new Promise<void>((resolve) => server.listen(0, developmentDefaults.host, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing HTTP address");
  origin = httpOrigin(developmentDefaults.host, address.port);
});
afterAll(async () => {
  for (const client of clients) client.disconnect();
  if (sockets) await new Promise<void>((resolve, reject) =>
    sockets.close((error) => error ? reject(error) : resolve()));
  if (database) await database.close();
});
const vote = (userId: string) => fetch(`${origin}${apiPaths.votes(pollId)}`, {
  method: "POST",
  headers: { [MOCK_USER_HEADER]: userId, "Content-Type": "application/json" },
  body: JSON.stringify({ optionId }),
});

describe("Socket.IO with real PostgreSQL", () => {
  it("broadcasts to two WebSocket clients only after commit without leaking personalized results", async () => {
    const [first, second] = await Promise.all([newClient(), newClient()]);
    const notifications = [first, second].map((client) =>
      new Promise<{ pollId: string }>((resolve) => client.once(POLL_CHANGED_EVENT, resolve)));
    const accepted = await vote("socket-voter");
    expect(accepted.status).toBe(201);
    for (const payload of await Promise.all(notifications)) expect(payload).toEqual({ pollId });
    const repository = createPollRepository(database.pool);
    expect((await repository.getResults(pollId, "socket-voter"))?.myVote).toBe(optionId);
    expect((await repository.getResults(pollId, "socket-observer"))?.myVote).toBeNull();
  });

  it("never broadcasts rejected, duplicate, or simulated-failure submissions", async () => {
    const client = await newClient();
    const changed = vi.fn();
    client.on(POLL_CHANGED_EVENT, changed);
    expect((await vote("socket-voter")).status).toBe(409);
    expect((await fetch(`${origin}${apiPaths.votes(pollId)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }),
    })).status).toBe(400);
    failVotes = true;
    try {
      expect((await vote("socket-failure")).status).toBe(500);
    } finally { failVotes = false; }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    expect(changed).not.toHaveBeenCalled();
    expect((await createPollRepository(database.pool).getResults(pollId, "socket-failure"))?.myVote).toBeNull();
  });

  it("broadcasts all 100 concurrent committed votes and retains exact counts", async () => {
    const client = await newClient();
    const notifications: { pollId: string }[] = [];
    client.on(POLL_CHANGED_EVENT, (payload) => notifications.push(payload));
    const responses = await Promise.all(Array.from({ length: 100 }, (_, i) => vote(`socket-concurrent-${i}`)));
    expect(responses.every((response) => response.status === 201)).toBe(true);
    await vi.waitFor(() => expect(notifications).toHaveLength(100));
    expect(notifications.every((event) => event.pollId === pollId)).toBe(true);
    const result = await database.pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM votes WHERE user_id LIKE 'socket-concurrent-%'",
    );
    expect(result.rows[0]?.count).toBe(100);
  });

  it("reconnected clients can fetch the authoritative results missed while disconnected", async () => {
    const client = await newClient();
    client.disconnect();
    expect((await vote("while-disconnected")).status).toBe(201);
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
      client.connect();
    });
    const result = await createPollRepository(database.pool).getResults(pollId, "while-disconnected");
    expect(result?.myVote).toBe(optionId);
    expect(result?.totalVotes).toBe(102);
  });

  it("supports the HTTP polling transport without Express handling the handshake twice", async () => {
    const client = await newClient(["polling"]);
    expect(client.io.engine.transport.name).toBe("polling");
    const changed = new Promise<{ pollId: string }>((resolve) => client.once(POLL_CHANGED_EVENT, resolve));
    expect((await vote("socket-polling-voter")).status).toBe(201);
    expect(await changed).toEqual({ pollId });
    expect((await fetch(`${origin}${apiPaths.health}`)).status).toBe(200);
  });
});
