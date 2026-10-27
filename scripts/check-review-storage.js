import { databaseClient } from "./lib/database.js";
import { auth0OwnerKey } from "../shared/identity.js";
const client = await databaseClient(),
  issuer = `https://${process.env.AUTH0_DOMAIN}/`;
const owner = auth0OwnerKey(issuer, "pinlight-storage-test-a");
try {
  await client.connect();
  await client.query("begin");
  const {
    rows: [row],
  } = await client.query(
    "insert into public.build_records(owner_key,title,kind,payload) values($1,'Temporary storage test','build','{}') returning id",
    [owner],
  );
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({
      iss: issuer,
      sub: "pinlight-storage-test-b",
      role: "authenticated",
    }),
  ]);
  const other = await client.query(
    "select id from public.build_records where id=$1",
    [row.id],
  );
  if (other.rows.length) throw Error("Cross-owner read was allowed");
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({
      iss: issuer,
      sub: "pinlight-storage-test-a",
      role: "authenticated",
    }),
  ]);
  const mine = await client.query(
    "select id from public.build_records where id=$1",
    [row.id],
  );
  if (mine.rows.length !== 1) throw Error("Owner could not read saved record");
  console.log(
    "Supabase owner isolation verified: owner can read; another identity cannot. Test transaction rolled back.",
  );
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
