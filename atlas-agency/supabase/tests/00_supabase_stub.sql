-- Minimal stand-in for the parts of Supabase the migrations depend on, so the
-- schema and RLS suite can run on plain Postgres in CI. NOT applied on Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's default privileges on public
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Realtime authorization surface
create schema realtime;
create table realtime.messages (
  id bigint generated always as identity primary key,
  topic text not null, extension text not null, event text, payload jsonb,
  private boolean default true, inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated, service_role;
grant select, insert on realtime.messages to authenticated;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;
grant execute on function realtime.topic() to authenticated;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql security definer as $$
  insert into realtime.messages (topic, extension, event, payload, private)
  values (topic, 'broadcast', event, payload, private)
$$;
