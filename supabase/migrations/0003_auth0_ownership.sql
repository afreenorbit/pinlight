-- The migration runner replaces issuer placeholders with validated HTTPS issuers.
-- Existing UUID accounts and their rows are preserved; Auth0 ownership is separate.
create or replace function public.current_owner_key() returns text
language sql stable set search_path = pg_catalog as $$
 select case
  when auth.jwt()->>'iss' = '__AUTH0_ISSUER__' and length(auth.jwt()->>'sub') between 1 and 255
   then 'auth0-' || encode(convert_to((auth.jwt()->>'iss') || '|' || (auth.jwt()->>'sub'),'UTF8'),'hex')
  when auth.jwt()->>'iss' = '__SUPABASE_ISSUER__' and (auth.jwt()->>'sub') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   then lower(auth.jwt()->>'sub')
  else null
 end
$$;
create or replace function public.native_owner_uuid() returns uuid
language sql stable set search_path = pg_catalog as $$
 select case when public.current_owner_key() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then public.current_owner_key()::uuid else null end
$$;

do $$
declare target text;
begin
 foreach target in array array['learning_items','chats','messages','learning_artifacts'] loop
  execute format('alter table public.%I add column if not exists owner_key text',target);
  execute format('update public.%I set owner_key=user_id::text where owner_key is null and user_id is not null',target);
  execute format('alter table public.%I alter column owner_key set default public.current_owner_key(), alter column owner_key set not null, alter column user_id drop not null, alter column user_id set default public.native_owner_uuid()',target);
  if not exists(select 1 from pg_constraint where conname=target || '_identity_consistent' and conrelid=('public.'||target)::regclass) then
   execute format('alter table public.%I add constraint %I check ((user_id is null and owner_key like ''auth0-%%'') or (user_id is not null and owner_key=user_id::text))',target,target||'_identity_consistent');
  end if;
 end loop;
end $$;
create unique index if not exists learning_items_owner_slug on public.learning_items(owner_key,slug);
create unique index if not exists learning_artifacts_owner_version on public.learning_artifacts(owner_key,item_id,pipeline_version);
create index if not exists learning_items_owner_recent on public.learning_items(owner_key,updated_at desc);

drop policy if exists "own items" on public.learning_items;
create policy "own items" on public.learning_items for all to authenticated
using(owner_key=(select public.current_owner_key())) with check(owner_key=(select public.current_owner_key()));
drop policy if exists "own chats" on public.chats;
create policy "own chats" on public.chats for all to authenticated
using(owner_key=(select public.current_owner_key()))
with check(owner_key=(select public.current_owner_key()) and exists(select 1 from public.learning_items i where i.id=item_id and i.owner_key=(select public.current_owner_key())));
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for all to authenticated
using(owner_key=(select public.current_owner_key()))
with check(owner_key=(select public.current_owner_key()) and exists(select 1 from public.chats c where c.id=chat_id and c.owner_key=(select public.current_owner_key())));
drop policy if exists "own learning artifacts" on public.learning_artifacts;
create policy "own learning artifacts" on public.learning_artifacts for all to authenticated
using(owner_key=(select public.current_owner_key()))
with check(owner_key=(select public.current_owner_key()) and exists(select 1 from public.learning_items i where i.id=item_id and i.owner_key=(select public.current_owner_key())));

drop policy if exists "own documents read" on storage.objects;
create policy "own documents read" on storage.objects for select to authenticated
using(bucket_id='documents' and (storage.foldername(name))[1]=(select public.current_owner_key()));
drop policy if exists "own documents write" on storage.objects;
create policy "own documents write" on storage.objects for insert to authenticated
with check(bucket_id='documents' and (storage.foldername(name))[1]=(select public.current_owner_key()));
drop policy if exists "own documents update" on storage.objects;
create policy "own documents update" on storage.objects for update to authenticated
using(bucket_id='documents' and (storage.foldername(name))[1]=(select public.current_owner_key()))
with check(bucket_id='documents' and (storage.foldername(name))[1]=(select public.current_owner_key()));
drop policy if exists "own documents delete" on storage.objects;
create policy "own documents delete" on storage.objects for delete to authenticated
using(bucket_id='documents' and (storage.foldername(name))[1]=(select public.current_owner_key()));
