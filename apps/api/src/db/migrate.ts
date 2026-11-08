import { readFile } from "node:fs/promises";
import type pg from "pg";

export async function migrate(pool: pg.Pool) {
  const [schema, seed] = await Promise.all([
    readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    readFile(new URL("./seed.sql", import.meta.url), "utf8"),
  ]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(731004)");
    await client.query(schema);
    await client.query(seed);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
