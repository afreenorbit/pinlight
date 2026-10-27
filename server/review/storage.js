import { createClient } from "@supabase/supabase-js";
import { databaseClient } from "../../scripts/lib/database.js";
export function reviewStorage(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    key =
      env.SUPABASE_SECRET_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = !!(
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  );
  const db =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  const required = () => {
    if (!db)
      throw Object.assign(
        Error(
          "Cloud saving is not configured. You can still try the workspace.",
        ),
        { status: 503 },
      );
    return db;
  };
  const unwrap = ({ data, error }) => {
    if (error)
      throw Object.assign(
        Error(
          "Cloud storage is unavailable. Please try again after the storage migration is applied.",
        ),
        { status: 503 },
      );
    return data;
  };
  const sql = async (query, values = []) => {
    const client = await databaseClient(env);
    try {
      await client.connect();
      const result = await client.query(query, values);
      return result.rows;
    } catch {
      throw Object.assign(
        Error("Cloud saving is unavailable. Please try again shortly."),
        { status: 503 },
      );
    } finally {
      await client.end();
    }
  };
  return {
    configured: !!db && (serviceKey || !!env.DATABASE_URL),
    async retrieve(query) {
      if (!db) return [];
      const { data, error } = await db
        .from("review_evidence")
        .select("id,title,text,url")
        .textSearch("search", query, { type: "websearch", config: "english" })
        .limit(8);
      return error ? [] : data;
    },
    async list(owner) {
      if (!serviceKey && env.DATABASE_URL)
        return sql(
          "select id,title,kind,payload,updated_at from public.build_records where owner_key=$1 order by updated_at desc limit 40",
          [owner],
        );
      return unwrap(
        await required()
          .from("build_records")
          .select("id,title,kind,payload,updated_at")
          .eq("owner_key", owner)
          .order("updated_at", { ascending: false })
          .limit(40),
      );
    },
    async save(owner, input) {
      const {id,...record}=input;
      if (!serviceKey && env.DATABASE_URL) {
        const rows=await sql(
          `insert into public.build_records(id,owner_key,title,kind,payload) values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5)
           on conflict(id) do update set title=excluded.title,kind=excluded.kind,payload=excluded.payload,updated_at=now()
           where build_records.owner_key=excluded.owner_key returning id`,
          [id||null,owner,record.title,record.kind,record.payload]);
        if(!rows.length)throw Object.assign(Error('Saved work was not found for this account.'),{status:404});
        return rows[0];
      }
      const client=required();
      if(id){
        const existing=unwrap(await client.from('build_records').select('owner_key').eq('id',id).maybeSingle());
        if(existing&&existing.owner_key!==owner)throw Object.assign(Error('Saved work was not found for this account.'),{status:404});
        if(existing)return unwrap(await client.from('build_records').update({...record,updated_at:new Date().toISOString()}).eq('id',id).eq('owner_key',owner).select('id').single());
      }
      return unwrap(await client.from('build_records').insert({...record,...(id?{id}:{}),owner_key:owner,updated_at:new Date().toISOString()}).select('id').single());
    },
    async posts() {
      return unwrap(
        await required()
          .from("review_posts")
          .select("id,title,question,display_name,created_at,project")
          .order("created_at", { ascending: false })
          .limit(40),
      );
    },
    async publish(owner, input) {
      if (!serviceKey && env.DATABASE_URL)
        return (
          await sql(
            "insert into public.review_posts(owner_key,title,question,display_name,project) values($1,$2,$3,$4,$5) returning id",
            [
              owner,
              input.title,
              input.question,
              input.display_name,
              input.project,
            ],
          )
        )[0];
      return unwrap(
        await required()
          .from("review_posts")
          .insert({ ...input, owner_key: owner })
          .select("id")
          .single(),
      );
    },
    async replies(id) {
      return unwrap(
        await required()
          .from("review_replies")
          .select("id,body,display_name,created_at")
          .eq("post_id", id)
          .order("created_at")
          .limit(100),
      );
    },
    async reply(owner, input) {
      if (!serviceKey && env.DATABASE_URL)
        return (
          await sql(
            "insert into public.review_replies(owner_key,post_id,display_name,body) values($1,$2,$3,$4) returning id",
            [owner, input.post_id, input.display_name, input.body],
          )
        )[0];
      return unwrap(
        await required()
          .from("review_replies")
          .insert({ ...input, owner_key: owner })
          .select("id")
          .single(),
      );
    },
  };
}
