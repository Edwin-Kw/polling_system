import { randomUUID } from "node:crypto";
import pg from "pg";
import { readConfig } from "../src/config.ts";
import { migrate } from "../src/db/migrate.ts";

export async function createTestDatabase() {
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: readConfig().DATABASE_URL });
  const pool = new pg.Pool({
    connectionString: readConfig().DATABASE_URL,
    options: `-c search_path=${schema}`,
    max: 20,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (error) => console.error("Test database connection failed", error));
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await migrate(pool);
  } catch (error) {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    throw error;
  }
  return {
    pool,
    async close() {
      await pool.end();
      // Only this generated test-owned schema is removed.
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    },
  };
}
