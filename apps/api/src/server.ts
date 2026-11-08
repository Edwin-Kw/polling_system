import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { httpOrigin } from "@polling/shared/development";
import { createApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { createPool } from "./db/pool.ts";
import { migrate } from "./db/migrate.ts";
import { createPollRepository } from "./db/pollRepository.ts";
import { createFailurePolicy } from "./testing/failurePolicy.ts";
import { createPollSocketServer } from "./realtime/socketServer.ts";

const config = readConfig();
const pool = createPool(config.DATABASE_URL);
pool.on("error", (error) => console.error("Idle PostgreSQL connection failed", error));

try {
  await migrate(pool);
} catch (error) {
  console.error("Database initialization failed; server will not start", error);
  await pool.end();
  process.exit(1);
}

const server = createServer();
const app = createApp({
  notifyPollChanged: (pollId) => sockets.notifyPollChanged(pollId),
  repository: createPollRepository(pool),
  shouldFailVote: createFailurePolicy(config.VOTE_FAILURE_RATE),
  checkDatabase: async () => {
    await pool.query("SELECT 1 FROM polls LIMIT 1");
  },
  logError: (message, error) => console.error(message, error),
  ...(config.NODE_ENV === "production"
    ? { staticDirectory: fileURLToPath(new URL("../../web/dist/", import.meta.url)) }
    : {}),
});

server.on("request", app);
const sockets = createPollSocketServer(server, (message, error) => console.error(message, error));
server.listen(config.PORT, config.HOST, () => {
  console.log(`Polling API listening on ${httpOrigin(config.HOST, config.PORT)}`);
});

server.on("error", async (error) => {
  console.error("HTTP server failed", error);
  process.exitCode = 1;
  sockets.close((closeError) => {
    if (closeError) console.error("Live update shutdown failed", closeError);
  });
  await pool.end();
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping the server`);

  const timeout = setTimeout(() => {
    console.error("Graceful shutdown exceeded 10 seconds");
    process.exit(1);
  }, 10000);
  timeout.unref();

  sockets.close((error) => {
    if (error) {
      console.error("HTTP shutdown failed", error);
      process.exitCode = 1;
    }

    void pool.end().then(() => {
      clearTimeout(timeout);
    }).catch((databaseError: unknown) => {
      console.error("PostgreSQL shutdown failed", databaseError);
      process.exitCode = 1;
    });
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
