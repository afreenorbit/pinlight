-- Arena progress: one row per finished battle, practice or skill check for a signed-in player.
-- Attempts hold grades and key points per concept (not transcripts); stats are derived from them.
create table if not exists public.arena_matches (
 id text not null check(length(id) between 1 and 80),
 owner_key text not null,
 kind text not null check(kind in ('battle','practice','skillcheck')),
 mode text not null check(mode in ('solo','duo','practice')),
 opponent text check(opponent is null or length(opponent) <= 60),
 my_score integer not null default 0,
 their_score integer,
 outcome text check(outcome is null or outcome in ('win','loss','draw')),
 played_at timestamptz not null default now(),
 attempts jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 primary key(owner_key,id)
);
create index if not exists arena_matches_owner on public.arena_matches(owner_key,played_at desc);
alter table public.arena_matches enable row level security;
drop policy if exists "own arena matches" on public.arena_matches;
create policy "own arena matches" on public.arena_matches for all to authenticated using(owner_key=public.current_owner_key()) with check(owner_key=public.current_owner_key());
grant select,insert,update,delete on public.arena_matches to authenticated;
