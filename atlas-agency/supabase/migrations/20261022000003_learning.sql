-- Atlas Agency · 0003 · Assignments, play, progress, rewards, spaced review, spelling
--
-- Trust model:
--   * Students write only raw learning evidence: mission attempts and answer events.
--     Both use client-generated UUIDs so offline play can sync idempotently.
--   * Points, rewards, review schedules and mastery are derived server-side
--     (security-definer functions added in later steps). Clients cannot write them.
--   * Points have no monetary path: the ledger's reasons are all learning events.

create type public.assignment_kind as enum ('mission', 'spelling_list', 'review');
create type public.attempt_status  as enum ('in_progress', 'solved', 'abandoned');
create type public.play_context    as enum ('explore', 'mission', 'review', 'spelling', 'race', 'team_mission');
create type public.skill           as enum (
  'location', 'capital', 'flag', 'landmark', 'language', 'currency', 'food', 'animal', 'spelling'
);
create type public.points_reason   as enum (
  'clue_solved', 'mission_solved', 'hint_used', 'review_correct', 'item_mastered',
  'spelling_correct', 'bee_round_won', 'race_finished', 'team_mission_solved', 'streak_bonus'
);
create type public.reward_type     as enum ('badge', 'stamp', 'avatar_item');
create type public.mastery_dimension as enum ('country', 'capital', 'skill');

-- ---------------------------------------------------------------------------
-- Assignments (teacher -> class)
-- ---------------------------------------------------------------------------
create table public.assignments (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references public.classes (id) on delete cascade,
  kind             public.assignment_kind not null,
  content_id       text,
  content_version  integer,
  -- { "timer_multiplier": 1.5, "hints_allowed": true, "max_hints": 3, "read_aloud": true }
  settings         jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  opens_at         timestamptz not null default now(),
  due_at           timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (content_id, content_version) references public.content_items (id, version),
  check ((kind = 'review') = (content_id is null)),
  check (due_at is null or due_at > opens_at)
);
create index assignments_class_idx on public.assignments (class_id, opens_at desc);

-- ---------------------------------------------------------------------------
-- Mission attempts
-- ---------------------------------------------------------------------------
create table public.mission_attempts (
  id                uuid primary key,                         -- generated on device
  student_id        uuid not null references public.profiles (id) on delete cascade,
  mission_id        text not null,
  mission_version   integer not null,
  assignment_id     uuid references public.assignments (id) on delete set null,
  status            public.attempt_status not null default 'in_progress',
  current_stop      smallint not null default 0 check (current_stop between 0 and 10),
  hints_used        smallint not null default 0 check (hints_used >= 0),
  points_earned     integer not null default 0,                -- server-maintained
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  client_updated_at timestamptz not null default now(),
  foreign key (mission_id, mission_version) references public.content_items (id, version),
  check ((status = 'in_progress') = (completed_at is null))
);
create index mission_attempts_student_idx on public.mission_attempts (student_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Answer events: the single source of learning evidence
-- ---------------------------------------------------------------------------
create table public.answer_events (
  id            uuid primary key,                             -- generated on device
  student_id    uuid not null references public.profiles (id) on delete cascade,
  context       public.play_context not null,
  context_id    uuid,                                         -- attempt, room, or bracket match
  item_id       text not null,                                -- content item, e.g. 'question:flag-FR-1'
  item_version  integer not null,
  skill         public.skill not null,
  country_code  text check (country_code ~ '^[A-Z]{2}$'),
  correct       boolean not null,
  hint_used     boolean not null default false,
  -- Small structured response only (chosen option id, or typed spelling). Max ~1 KB.
  response      jsonb not null default '{}'::jsonb check (pg_column_size(response) <= 1024),
  duration_ms   integer check (duration_ms between 0 and 3600000),
  occurred_at   timestamptz not null,                         -- device clock
  received_at   timestamptz not null default now(),
  foreign key (item_id, item_version) references public.content_items (id, version),
  check (occurred_at <= received_at + interval '5 minutes')
);
create index answer_events_student_idx on public.answer_events (student_id, occurred_at desc);
create index answer_events_context_idx on public.answer_events (context, context_id);

-- ---------------------------------------------------------------------------
-- Points ledger (append-only, server-written)
-- ---------------------------------------------------------------------------
create table public.points_ledger (
  id            bigint generated always as identity primary key,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  delta         integer not null check (delta between -50 and 500 and delta <> 0),
  reason        public.points_reason not null,
  source_event  uuid,                                         -- answer_events.id or attempt id
  created_at    timestamptz not null default now(),
  check ((reason = 'hint_used') = (delta < 0)),
  unique (student_id, reason, source_event)                   -- one award per event
);
create index points_ledger_student_idx on public.points_ledger (student_id, created_at desc);

create view public.student_points
with (security_invoker = true) as
select student_id, sum(delta)::integer as total_points, max(created_at) as last_earned_at
  from public.points_ledger
 group by student_id;

-- ---------------------------------------------------------------------------
-- Rewards: badges, passport stamps, avatar items (all earned, never bought)
-- ---------------------------------------------------------------------------
create table public.student_rewards (
  student_id      uuid not null references public.profiles (id) on delete cascade,
  reward_type     public.reward_type not null,
  reward_key      text not null,                -- 'badge:first-case', 'stamp:JP', 'avatar_item:teal-trenchcoat'
  earned_at       timestamptz not null default now(),
  source_event    uuid,
  equipped        boolean not null default false,
  primary key (student_id, reward_key),
  check (reward_key ~ ('^' || reward_type::text || ':[A-Za-z0-9._-]+$'))
);

-- ---------------------------------------------------------------------------
-- Spaced repetition cards (Leitner boxes 1-5; box 5 + 2 correct in a row = mastered)
-- ---------------------------------------------------------------------------
create table public.review_cards (
  student_id        uuid not null references public.profiles (id) on delete cascade,
  item_key          text not null,              -- stable across versions, e.g. 'capital:FR'
  skill             public.skill not null,
  country_code      text check (country_code ~ '^[A-Z]{2}$'),
  box               smallint not null default 1 check (box between 1 and 5),
  due_at            timestamptz not null default now(),
  reps              integer not null default 0,
  lapses            integer not null default 0,
  correct_streak    smallint not null default 0,
  last_reviewed_at  timestamptz,
  mastered_at       timestamptz,
  primary key (student_id, item_key)
);
create index review_cards_due_idx on public.review_cards (student_id, due_at) where mastered_at is null;

-- ---------------------------------------------------------------------------
-- Mastery rollups per country, capital and skill
-- ---------------------------------------------------------------------------
create table public.mastery (
  student_id   uuid not null references public.profiles (id) on delete cascade,
  dimension    public.mastery_dimension not null,
  key          text not null,                  -- 'FR' for country/capital, 'flag' for skill
  attempts     integer not null default 0,
  correct      integer not null default 0,
  score        numeric(4,3) not null default 0 check (score between 0 and 1),
  mastered_at  timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (student_id, dimension, key),
  check (correct <= attempts)
);

-- ---------------------------------------------------------------------------
-- Spelling bee brackets
-- ---------------------------------------------------------------------------
create type public.bracket_status as enum ('setup', 'active', 'finished');

create table public.spelling_brackets (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes (id) on delete cascade,
  list_id        text not null,
  list_version   integer not null,
  name           text not null check (length(name) between 1 and 60),
  status         public.bracket_status not null default 'setup',
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (list_id, list_version) references public.content_items (id, version)
);

create table public.bracket_matches (
  id           uuid primary key default gen_random_uuid(),
  bracket_id   uuid not null references public.spelling_brackets (id) on delete cascade,
  round        smallint not null check (round between 1 and 8),
  slot         smallint not null check (slot >= 0),
  student_a    uuid references public.profiles (id) on delete set null,
  student_b    uuid references public.profiles (id) on delete set null,   -- null = bye
  winner_id    uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  unique (bracket_id, round, slot),
  check (winner_id is null or winner_id in (student_a, student_b))
);
