-- Atlas Agency · 0001 · Identity, schools, classes, groups, rostering
--
-- Privacy rules baked into the shape of these tables:
--   * Students never have an email, real name, birthday, or photo in `profiles`.
--     They get an app-generated username (e.g. "BraveOtter42").
--   * A teacher-entered roster label (e.g. "Maya R.") lives in a separate table,
--     `student_roster_labels`, readable only by that student's teachers and school admins.
--   * Roles are never taken from client-supplied auth metadata. Profiles are
--     created by trusted server code (edge functions running as service_role).

create extension if not exists pgcrypto;

create schema if not exists app;
comment on schema app is 'Private helpers for RLS and server-side game logic. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role       as enum ('student', 'teacher', 'school_admin');
create type public.grade_band      as enum ('K-2', '3-5', '6-8');
create type public.app_locale      as enum ('en', 'es');
create type public.roster_provider as enum ('manual', 'clever', 'classlink', 'google_classroom', 'microsoft_teams');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------
create table public.schools (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(name) between 1 and 200),
  district_name       text check (length(district_name) <= 200),
  roster_provider     public.roster_provider not null default 'manual',
  roster_external_id  text,
  -- Inactive student records are purged after this many days (FERPA/COPPA retention).
  retention_days      integer not null default 365 check (retention_days between 30 and 1095),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (roster_provider, roster_external_id)
);
create trigger schools_touch before update on public.schools
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null,
  school_id     uuid not null references public.schools (id) on delete cascade,
  username      text not null unique check (username ~ '^[A-Za-z]{3,20}[0-9]{2,4}$'),
  -- Adults only. Students must never have a display name stored here.
  display_name  text check (length(display_name) <= 80),
  grade_band    public.grade_band,
  locale        public.app_locale not null default 'en',
  -- Accessibility + UX settings: font, read-aloud, timer multiplier, palette, etc.
  preferences   jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  avatar        jsonb not null default '{}'::jsonb check (jsonb_typeof(avatar) = 'object'),
  last_active_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint students_have_band   check (role <> 'student' or grade_band is not null),
  constraint students_no_names    check (role <> 'student' or display_name is null)
);
create index profiles_school_idx on public.profiles (school_id, role);
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- Teacher-visible label so a teacher can recognise "BraveOtter42" as "Maya R.".
create table public.student_roster_labels (
  student_id  uuid primary key references public.profiles (id) on delete cascade,
  school_id   uuid not null references public.schools (id) on delete cascade,
  label       text not null check (length(label) between 1 and 60),
  updated_at  timestamptz not null default now()
);
create trigger roster_labels_touch before update on public.student_roster_labels
  for each row execute function app.touch_updated_at();

-- External SIS / LMS identities (Clever, ClassLink, Google Classroom, Microsoft Teams).
-- Written only by the rostering sync job (service_role). No client policies.
create table public.roster_identities (
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  provider      public.roster_provider not null check (provider <> 'manual'),
  external_id   text not null,
  last_synced_at timestamptz not null default now(),
  primary key (provider, external_id),
  unique (profile_id, provider)
);

-- ---------------------------------------------------------------------------
-- Classes
-- ---------------------------------------------------------------------------
create table public.classes (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  name                text not null check (length(name) between 1 and 80),
  grade_band          public.grade_band not null,
  -- Short code typed on a shared device to reach the class sign-in screen.
  sign_in_code        text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6))
                        check (sign_in_code ~ '^[A-Z0-9]{6}$'),
  roster_provider     public.roster_provider not null default 'manual',
  roster_external_id  text,
  created_by          uuid references public.profiles (id) on delete set null,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (roster_provider, roster_external_id)
);
create index classes_school_idx on public.classes (school_id);
create trigger classes_touch before update on public.classes
  for each row execute function app.touch_updated_at();

create table public.class_teachers (
  class_id    uuid not null references public.classes (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (class_id, teacher_id)
);
create index class_teachers_teacher_idx on public.class_teachers (teacher_id);

create table public.class_students (
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_students_student_idx on public.class_students (student_id);

-- ---------------------------------------------------------------------------
-- Teacher-approved play groups (for cross-class multiplayer within one school)
-- ---------------------------------------------------------------------------
create table public.play_groups (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  name         text not null check (length(name) between 1 and 60),
  created_by   uuid not null references public.profiles (id) on delete cascade,
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  check ((approved_by is null) = (approved_at is null))
);

create table public.play_group_members (
  group_id    uuid not null references public.play_groups (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (group_id, student_id)
);
create index play_group_members_student_idx on public.play_group_members (student_id);

-- ---------------------------------------------------------------------------
-- Integrity triggers: membership must stay inside one school and the right roles
-- ---------------------------------------------------------------------------
create function app.assert_profile(p_id uuid, p_role public.user_role, p_school uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare r public.user_role; s uuid;
begin
  select role, school_id into r, s from public.profiles where id = p_id;
  if r is null then
    raise exception 'profile % does not exist', p_id using errcode = 'foreign_key_violation';
  end if;
  if p_role = 'teacher' and r not in ('teacher', 'school_admin') then
    raise exception 'profile % is not staff', p_id using errcode = 'check_violation';
  elsif p_role = 'student' and r <> 'student' then
    raise exception 'profile % is not a student', p_id using errcode = 'check_violation';
  end if;
  if s <> p_school then
    raise exception 'profile % belongs to another school', p_id using errcode = 'check_violation';
  end if;
end $$;

create function app.check_class_teacher() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_profile(new.teacher_id, 'teacher',
    (select school_id from public.classes where id = new.class_id));
  return new;
end $$;
create trigger class_teachers_check before insert or update on public.class_teachers
  for each row execute function app.check_class_teacher();

create function app.check_class_student() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_profile(new.student_id, 'student',
    (select school_id from public.classes where id = new.class_id));
  return new;
end $$;
create trigger class_students_check before insert or update on public.class_students
  for each row execute function app.check_class_student();

create function app.check_group_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_profile(new.student_id, 'student',
    (select school_id from public.play_groups where id = new.group_id));
  return new;
end $$;
create trigger play_group_members_check before insert or update on public.play_group_members
  for each row execute function app.check_group_member();

create function app.check_roster_label() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_profile(new.student_id, 'student', new.school_id);
  return new;
end $$;
create trigger roster_labels_check before insert or update on public.student_roster_labels
  for each row execute function app.check_roster_label();

-- The creator of a class becomes its first teacher.
create function app.add_creator_as_teacher() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.class_teachers (class_id, teacher_id)
    values (new.id, new.created_by) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger classes_add_creator after insert on public.classes
  for each row execute function app.add_creator_as_teacher();

-- ---------------------------------------------------------------------------
-- Kid-safe username generator (used by the create-students edge function).
-- Words are bilingual-neutral and reviewed to avoid unsafe combinations.
-- ---------------------------------------------------------------------------
create function app.generate_username() returns text
language plpgsql volatile set search_path = '' as $$
declare
  adjectives text[] := array['Brave','Swift','Clever','Sunny','Bright','Lucky','Mighty','Quiet',
                             'Jolly','Keen','Bold','Calm','Daring','Eager','Gentle','Happy',
                             'Nimble','Noble','Plucky','Rapid','Sharp','Steady','Witty','Zippy'];
  animals    text[] := array['Otter','Falcon','Panda','Koala','Lynx','Heron','Gecko','Tapir',
                             'Llama','Puffin','Bison','Okapi','Ibis','Marmot','Quokka','Toucan',
                             'Narwhal','Lemur','Jaguar','Condor','Walrus','Badger','Dingo','Yak'];
  candidate  text;
begin
  for i in 1..50 loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
              || animals[1 + floor(random() * array_length(animals, 1))::int]
              || lpad((floor(random() * 100))::int::text, 2, '0');
    if not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
  end loop;
  -- Fall back to a 4-digit suffix when the 2-digit space is crowded.
  return candidate || lpad((floor(random() * 100))::int::text, 2, '0');
end $$;
