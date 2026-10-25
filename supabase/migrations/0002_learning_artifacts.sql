-- Source-grounded journeys and progress belong to the owner of their learning item.
create table if not exists public.learning_artifacts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 item_id uuid not null references public.learning_items(id) on delete cascade,
 pipeline_version text not null,
 document_revision text not null,
 journey jsonb not null,
 progress jsonb not null default '{"done":[],"notes":{}}'::jsonb,
 updated_at timestamptz not null default now(),
 unique(user_id,item_id,pipeline_version)
);
alter table public.learning_artifacts enable row level security;
drop policy if exists "own learning artifacts" on public.learning_artifacts;
create policy "own learning artifacts" on public.learning_artifacts for all to authenticated
using(user_id=auth.uid())
with check(user_id=auth.uid() and exists(select 1 from public.learning_items i where i.id=item_id and i.user_id=auth.uid()));
create index if not exists learning_artifacts_item_idx on public.learning_artifacts(user_id,item_id);
