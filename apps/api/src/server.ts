import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { createPool } from "./db/pool.ts";

const config = readConfig();
const pool = createPool(config.DATABASE_URL);
pool.on("error", (error) => console.error("Idle PostgreSQL connection failed", error));

const app = createApp({
  checkDatabase: async () => {
    await pool.query("SELECT 1");
  },
  logError: (message, error) => console.error(message, error),
  ...(config.NODE_ENV === "production"
    ? { staticDirectory: fileURLToPath(new URL("../../web/dist/", import.meta.url)) }
    : {}),
});

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Polling API listening on http://${config.HOST}:${config.PORT}`);
});

server.on("error", async (error) => {
  console.error("HTTP server failed", error);
  process.exitCode = 1;
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

  server.close((error) => {
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
