-- Pinlight signed-in desk: uploaded learning items, segregated chats and messages.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null,
  kind text not null check (kind in ('board', 'chip', 'module', 'other')),
  title text not null check (char_length(title) <= 300),
  board_id text,
  local_document_id text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.learning_items (id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_items_user_idx on public.learning_items (user_id, updated_at desc);
create index if not exists chats_item_idx on public.chats (item_id, updated_at desc);
create index if not exists messages_chat_idx on public.messages (chat_id, created_at);

alter table public.learning_items enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- Each person sees and changes only their own rows. Children must point at a parent the person owns,
-- because foreign-key checks alone bypass RLS.
drop policy if exists "own items" on public.learning_items;
create policy "own items" on public.learning_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own chats" on public.chats;
create policy "own chats" on public.chats for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.learning_items i where i.id = item_id and i.user_id = auth.uid()));

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid()));

-- Keep "recently used" ordering current when a message is added.
create or replace function public.touch_chat() returns trigger language plpgsql set search_path = public as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  update public.learning_items set updated_at = now() where id = (select item_id from public.chats where id = new.chat_id);
  return new;
end $$;
drop trigger if exists messages_touch_chat on public.messages;
create trigger messages_touch_chat after insert on public.messages for each row execute function public.touch_chat();

-- Private PDF storage, one folder per user: documents/<user id>/<item id>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "own documents read" on storage.objects;
create policy "own documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own documents write" on storage.objects;
create policy "own documents write" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own documents update" on storage.objects;
create policy "own documents update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own documents delete" on storage.objects;
create policy "own documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
