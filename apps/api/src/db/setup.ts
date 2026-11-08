import { readConfig } from "../config.ts";
import { createPool } from "./pool.ts";
import { migrate } from "./migrate.ts";

const pool = createPool(readConfig().DATABASE_URL);
try {
  await migrate(pool);
  console.log("Poll schema and seed are ready");
} catch (error) {
  console.error("Database setup failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
