import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";
import { io, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  apiPaths, MOCK_USER_HEADER, POLL_CHANGED_EVENT, SOCKET_PATH,
  pollResultsSchema, pollSchema,
} from "@polling/shared";
import type { ClientToServerEvents, ServerToClientEvents } from "@polling/shared";
import { developmentDefaults, httpOrigin } from "@polling/shared/development";
import { createApp } from "../src/app.ts";
import { createPollRepository } from "../src/db/pollRepository.ts";
import { createPollSocketServer } from "../src/realtime/socketServer.ts";
import { createTestDatabase } from "./database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
const apiServer = createHttpServer();
let sockets: ReturnType<typeof createPollSocketServer>;
let web: ViteDevServer;
let origin: string;
let client: Socket<ServerToClientEvents, ClientToServerEvents>;
const headers = { [MOCK_USER_HEADER]: "proxy-voter" };

beforeAll(async () => {
  database = await createTestDatabase();
  apiServer.on("request", createApp({
    repository: createPollRepository(database.pool),
    shouldFailVote: () => false,
    notifyPollChanged: (pollId) => sockets.notifyPollChanged(pollId),
    checkDatabase: async () => { await database.pool.query("SELECT 1 FROM polls"); },
    logError: (message, error) => console.error(message, error),
  }));
  sockets = createPollSocketServer(apiServer, (message, error) => console.error(message, error));
  await new Promise<void>((resolve, reject) => {
    apiServer.once("error", reject);
    apiServer.listen(0, developmentDefaults.host, resolve);
  });
  const address = apiServer.address();
  if (!address || typeof address === "string") throw new Error("Missing API TCP address");
  vi.stubEnv("HOST", developmentDefaults.host);
  vi.stubEnv("PORT", String(address.port));
  web = await createViteServer({
    root: fileURLToPath(new URL("../../web/", import.meta.url)),
    configFile: fileURLToPath(new URL("../../web/vite.config.ts", import.meta.url)),
    mode: "test",
    server: { port: 0, strictPort: false, watch: null, hmr: false },
  });
  await web.listen();
  const webAddress = web.httpServer?.address();
  if (!webAddress || typeof webAddress === "string") throw new Error("Missing web TCP address");
  origin = httpOrigin(developmentDefaults.host, webAddress.port);
});
afterAll(async () => {
  client?.disconnect();
  if (web) await web.close();
  if (sockets) await new Promise<void>((resolve, reject) => sockets.close((error) => error ? reject(error) : resolve()));
  if (database) await database.close();
  vi.unstubAllEnvs();
});

describe("shared address settings with a real Vite proxy", () => {
  it("proxies health, voting and results to a non-default API port", async () => {
    expect((await fetch(`${origin}${apiPaths.health}`)).status).toBe(200);
    expect((await fetch(`${origin}${apiPaths.activePoll}`)).status).toBe(400);
    const active = await fetch(`${origin}${apiPaths.activePoll}`, { headers });
    expect(active.status).toBe(200);
    const poll = pollSchema.parse(await active.json());
    const vote = await fetch(`${origin}${apiPaths.votes(poll.id)}`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: poll.options[0]!.id }),
    });
    expect(vote.status).toBe(201);
    const response = await fetch(`${origin}${apiPaths.results(poll.id)}`, { headers });
    expect(response.status).toBe(200);
    expect(pollResultsSchema.parse(await response.json())).toMatchObject({
      totalVotes: 1, myVote: poll.options[0]!.id,
    });
  });

  it("proxies Socket.IO HTTP polling and upgrades to WebSocket using the shared path", async () => {
    client = io(origin, {
      path: SOCKET_PATH, autoConnect: false, reconnection: false,
      transports: ["polling", "websocket"],
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
      client.connect();
    });
    await vi.waitFor(() => expect(client.io.engine.transport.name).toBe("websocket"));
    const poll = pollSchema.parse(await (await fetch(`${origin}${apiPaths.activePoll}`, { headers })).json());
    const changed = new Promise<{ pollId: string }>((resolve) => client.once(POLL_CHANGED_EVENT, resolve));
    const vote = await fetch(`${origin}${apiPaths.votes(poll.id)}`, {
      method: "POST", headers: { [MOCK_USER_HEADER]: "proxy-socket-voter", "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: poll.options[0]!.id }),
    });
    expect(vote.status).toBe(201);
    expect(await changed).toEqual({ pollId: poll.id });
    expect((await createPollRepository(database.pool).getResults(poll.id, "proxy-socket-voter"))?.totalVotes).toBe(2);
  });
});
