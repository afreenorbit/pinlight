create table if not exists public.build_records (
 id uuid primary key default gen_random_uuid(), owner_key text not null,
 title text not null check(length(title) between 1 and 180), kind text not null check(kind in ('build','viva','practice')),
 payload jsonb not null, updated_at timestamptz not null default now()
);
create index if not exists build_records_owner on public.build_records(owner_key,updated_at desc);
alter table public.build_records enable row level security;
drop policy if exists "own build records" on public.build_records;
create policy "own build records" on public.build_records for all to authenticated using(owner_key=public.current_owner_key()) with check(owner_key=public.current_owner_key());

create table if not exists public.review_evidence (
 id text primary key,title text not null,text text not null,url text not null,
 search tsvector generated always as (to_tsvector('english',title || ' ' || text)) stored
);
create index if not exists review_evidence_search on public.review_evidence using gin(search);
alter table public.review_evidence enable row level security;
drop policy if exists "read public evidence" on public.review_evidence;
create policy "read public evidence" on public.review_evidence for select using(true);

create table if not exists public.review_posts (
 id uuid primary key default gen_random_uuid(),owner_key text not null,
 title text not null check(length(title) between 5 and 160),question text not null check(length(question) between 10 and 2400),
 display_name text not null check(length(display_name) between 1 and 60), project jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.review_replies (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references public.review_posts(id) on delete cascade,
 owner_key text not null,display_name text not null check(length(display_name) between 1 and 60),
 body text not null check(length(body) between 10 and 2400),created_at timestamptz not null default now()
);
alter table public.review_posts enable row level security;
alter table public.review_replies enable row level security;
drop policy if exists "read community posts" on public.review_posts;
create policy "read community posts" on public.review_posts for select using(true);
drop policy if exists "write own posts" on public.review_posts;
create policy "write own posts" on public.review_posts for insert to authenticated with check(owner_key=public.current_owner_key());
drop policy if exists "read community replies" on public.review_replies;
create policy "read community replies" on public.review_replies for select using(true);
drop policy if exists "write own replies" on public.review_replies;
create policy "write own replies" on public.review_replies for insert to authenticated with check(owner_key=public.current_owner_key());
grant select,insert,update,delete on public.build_records to authenticated;
grant select on public.review_evidence,public.review_posts,public.review_replies to anon,authenticated;
grant insert on public.review_posts,public.review_replies to authenticated;
