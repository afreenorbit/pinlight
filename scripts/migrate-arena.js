import { readFile } from "node:fs/promises";
import { databaseClient } from "./lib/database.js";
const client = await databaseClient();
try {
  await client.connect();
  await client.query("begin");
  await client.query(await readFile(new URL("../supabase/migrations/0005_arena_progress.sql", import.meta.url), "utf8"));
  await client.query("commit");
  console.log("Arena progress storage is ready.");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error(`Arena migration failed (${e.code || e.name}). No credentials logged.`);
  process.exitCode = 1;
} finally {
  await client.end();
}
