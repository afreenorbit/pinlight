import { readFile } from "node:fs/promises";
import { databaseClient } from "./lib/database.js";
import { reviewParts } from "../shared/review/catalog.js";
const client = await databaseClient();
try {
  await client.connect();
  await client.query("begin");
  await client.query(
    await readFile(
      new URL("../supabase/migrations/0004_build_review.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const p of reviewParts)
    await client.query(
      "insert into public.review_evidence(id,title,text,url) values($1,$2,$3,$4) on conflict(id) do update set title=excluded.title,text=excluded.text,url=excluded.url",
      [p.id, p.name, p.fact, p.source],
    );
  await client.query("commit");
  console.log(
    "Build review storage, community tables and source retrieval are ready.",
  );
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error(
    `Build review migration failed (${e.code || e.name}). No credentials logged.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
