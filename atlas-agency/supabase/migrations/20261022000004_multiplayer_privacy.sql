-- Atlas Agency · 0004 · Multiplayer rooms, preset messaging, privacy operations
--
-- Multiplayer safety model:
--   * A room belongs to exactly one class OR one teacher-approved play group.
--   * Messages reference preset_messages by id. There is no free-text column anywhere.
--   * Clients may RECEIVE Realtime broadcasts for rooms they can access, but may
--     not SEND broadcasts or presence (those payloads would be free-form JSON).
--     All fan-out is done server-side with realtime.send() from triggers.

create type public.room_kind   as enum ('quiz_race', 'team_mission');
create type public.room_status as enum ('lobby', 'active', 'finished', 'cancelled');

create table public.match_rooms (
  id               uuid primary key default gen_random_uuid(),
  kind             public.room_kind not null,
  class_id         uuid references public.classes (id) on delete cascade,
  group_id         uuid references public.play_groups (id) on delete cascade,
  host_id          uuid not null references public.profiles (id) on delete cascade,
  content_id       text not null,
  content_version  integer not null,
  status           public.room_status not null default 'lobby',
  max_players      smallint not null default 8 check (max_players between 2 and 30),
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  ended_at         timestamptz,
  foreign key (content_id, content_version) references public.content_items (id, version),
  check (num_nonnulls(class_id, group_id) = 1)
);
create index match_rooms_class_idx on public.match_rooms (class_id, status);
create index match_rooms_group_idx on public.match_rooms (group_id, status);

create table public.match_players (
  room_id      uuid not null references public.match_rooms (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  team         smallint check (team between 1 and 4),
  score        integer not null default 0,                    -- server-maintained
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  finished_at  timestamptz,
  primary key (room_id, student_id)
);
create index match_players_student_idx on public.match_players (student_id);

create table public.match_messages (
  id                 bigint generated always as identity primary key,
  room_id            uuid not null references public.match_rooms (id) on delete cascade,
  sender_id          uuid not null references public.profiles (id) on delete cascade,
  preset_message_id  smallint not null references public.preset_messages (id),
  sent_at            timestamptz not null default now()
);
create index match_messages_room_idx on public.match_messages (room_id, sent_at);

-- Rate limit: one preset message per sender per room every 2 seconds.
create function app.rate_limit_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.match_messages
     where room_id = new.room_id and sender_id = new.sender_id
       and sent_at > now() - interval '2 seconds'
  ) then
    raise exception 'slow down, agent' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if not exists (select 1 from public.preset_messages where id = new.preset_message_id and active) then
    raise exception 'unknown preset message' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger match_messages_rate before insert on public.match_messages
  for each row execute function app.rate_limit_messages();

-- Server-side fan-out to the private Realtime topic "room:<uuid>".
-- realtime.send() exists on Supabase; guard so plain Postgres (CI) still works.
create function app.broadcast_room_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_room uuid; v_payload jsonb;
begin
  v_room := coalesce(new.room_id, old.room_id);
  v_payload := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'row', to_jsonb(new));
  if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is not null then
    perform realtime.send(v_payload, tg_table_name, 'room:' || v_room::text, true);
  end if;
  return coalesce(new, old);
end $$;
create trigger match_messages_broadcast after insert on public.match_messages
  for each row execute function app.broadcast_room_event();
create trigger match_players_broadcast after insert or update or delete on public.match_players
  for each row execute function app.broadcast_room_event();

-- ---------------------------------------------------------------------------
-- Privacy: deletion requests and a minimal audit trail of staff disclosures
-- ---------------------------------------------------------------------------
create type public.deletion_reason as enum ('parent_request', 'school_request', 'account_closure', 'retention_expiry');
create type public.deletion_status as enum ('pending', 'completed', 'rejected');

-- Kept after deletion as proof of compliance; contains no student PII
-- (student_id is a dangling UUID once the profile is gone).
create table public.deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null,
  school_id      uuid not null references public.schools (id) on delete cascade,
  requested_by   uuid references public.profiles (id) on delete set null,
  reason         public.deletion_reason not null,
  status         public.deletion_status not null default 'pending',
  requested_at   timestamptz not null default now(),
  completed_at   timestamptz
);

create type public.audit_action as enum (
  'export_csv', 'delete_student', 'roster_sync', 'view_roster_labels', 'role_change'
);

create table public.audit_events (
  id          bigint generated always as identity primary key,
  school_id   uuid not null references public.schools (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      public.audit_action not null,
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_events_school_idx on public.audit_events (school_id, created_at desc);
