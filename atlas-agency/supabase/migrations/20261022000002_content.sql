-- Atlas Agency · 0002 · Versioned content
--
-- All learning content (countries, clues, questions, missions, spelling lists,
-- badges, avatar items) is stored as versioned JSON documents. A published
-- version is immutable; edits create a new version. Progress rows reference
-- (content_id, version) so historical results stay interpretable.

create type public.content_kind as enum (
  'country', 'question', 'mission', 'spelling_list', 'badge', 'avatar_item', 'villain'
);
create type public.content_status as enum ('draft', 'published', 'retired');
create type public.standard_framework as enum ('NGS', 'TEKS');

-- ---------------------------------------------------------------------------
-- Standards catalogue (National Geography Standards, Texas TEKS)
-- ---------------------------------------------------------------------------
create table public.standards (
  id              text primary key check (id ~ '^(NGS|TEKS)\.[A-Za-z0-9.()-]+$'),
  framework       public.standard_framework not null,
  code            text not null,
  grade_bands     public.grade_band[] not null check (cardinality(grade_bands) > 0),
  description_en  text not null,
  description_es  text not null,
  unique (framework, code)
);

-- ---------------------------------------------------------------------------
-- Content items
-- ---------------------------------------------------------------------------
create table public.content_items (
  id              text not null check (id ~ '^[a-z_]+:[A-Za-z0-9._-]+$'),
  version         integer not null check (version > 0),
  kind            public.content_kind not null,
  status          public.content_status not null default 'draft',
  schema_version  integer not null default 1,
  grade_bands     public.grade_band[] not null default '{}',
  standard_ids    text[] not null default '{}',
  -- ISO 3166-1 alpha-2 codes this item is about; drives region packs and mastery.
  country_codes   text[] not null default '{}',
  -- Localised payload: { "en": {...}, "es": {...}, ...shared fields }
  data            jsonb not null check (jsonb_typeof(data) = 'object'),
  checksum        text generated always as (md5(data::text)) stored,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  primary key (id, version),
  constraint id_matches_kind check (split_part(id, ':', 1) = kind::text),
  -- Every question, mission and spelling list must carry a grade band and a standard.
  constraint tagged_for_curriculum check (
    kind not in ('question', 'mission', 'spelling_list')
    or (cardinality(grade_bands) > 0 and cardinality(standard_ids) > 0)
  ),
  constraint published_has_date check ((status = 'draft') or published_at is not null)
);
create index content_items_kind_idx on public.content_items (kind, status);
create index content_items_countries_idx on public.content_items using gin (country_codes);
create index content_items_standards_idx on public.content_items using gin (standard_ids);

create function app.validate_content_item() returns trigger
language plpgsql set search_path = '' as $$
declare missing text;
begin
  select s into missing
    from unnest(new.standard_ids) s
   where not exists (select 1 from public.standards st where st.id = s)
   limit 1;
  if missing is not null then
    raise exception 'unknown standard id: %', missing using errcode = 'foreign_key_violation';
  end if;

  if exists (select 1 from unnest(new.country_codes) c where c !~ '^[A-Z]{2}$') then
    raise exception 'country_codes must be ISO 3166-1 alpha-2' using errcode = 'check_violation';
  end if;

  -- Published content is frozen. Only the transition published -> retired is allowed.
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.data is distinct from old.data
       or new.grade_bands is distinct from old.grade_bands
       or new.standard_ids is distinct from old.standard_ids
       or new.country_codes is distinct from old.country_codes
       or new.kind is distinct from old.kind
       or not (new.status = old.status or (old.status = 'published' and new.status = 'retired')) then
      raise exception 'content %@% is % and immutable; create a new version', old.id, old.version, old.status
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger content_items_validate before insert or update on public.content_items
  for each row execute function app.validate_content_item();

-- Latest published version of each item.
create view public.content_current
with (security_invoker = true) as
select distinct on (id) *
  from public.content_items
 where status = 'published'
 order by id, version desc;

-- ---------------------------------------------------------------------------
-- Offline region packs: a manifest of content versions + map tile archive
-- ---------------------------------------------------------------------------
create table public.region_packs (
  id             text not null check (id ~ '^[a-z-]+$'),   -- e.g. 'south-america'
  version        integer not null check (version > 0),
  status         public.content_status not null default 'draft',
  name_en        text not null,
  name_es        text not null,
  bbox           numeric[] not null check (cardinality(bbox) = 4),  -- [west, south, east, north]
  min_zoom       smallint not null default 0,
  max_zoom       smallint not null default 7,
  -- [{ "id": "country:BR", "version": 3 }, ...]
  manifest       jsonb not null check (jsonb_typeof(manifest) = 'array'),
  tiles_path     text not null,              -- Supabase Storage path to the .pmtiles / .mbtiles file
  tiles_bytes    bigint not null check (tiles_bytes >= 0),
  tiles_sha256   text not null check (tiles_sha256 ~ '^[0-9a-f]{64}$'),
  published_at   timestamptz,
  primary key (id, version)
);

-- ---------------------------------------------------------------------------
-- Preset messages: the ONLY thing students can send each other.
-- ---------------------------------------------------------------------------
create table public.preset_messages (
  id         smallint primary key,
  key        text not null unique check (key ~ '^[a-z_]+$'),
  emoji      text,
  text_en    text not null check (length(text_en) <= 40),
  text_es    text not null check (length(text_es) <= 40),
  category   text not null check (category in ('cheer', 'team', 'game', 'thanks')),
  active     boolean not null default true
);

insert into public.preset_messages (id, key, emoji, text_en, text_es, category) values
  (1,  'good_luck',     '🍀', 'Good luck, agents!',   '¡Buena suerte, agentes!', 'cheer'),
  (2,  'nice_job',      '⭐', 'Nice job!',            '¡Buen trabajo!',          'cheer'),
  (3,  'great_clue',    '🔍', 'Great clue!',          '¡Gran pista!',            'team'),
  (4,  'follow_me',     '🧭', 'Follow my lead!',      '¡Sigue mi pista!',        'team'),
  (5,  'need_help',     '🙋', 'I could use a hint.',  'Necesito una pista.',     'team'),
  (6,  'almost',        '⏳', 'Almost there!',        '¡Casi llegamos!',         'game'),
  (7,  'ready',         '✅', 'I''m ready!',          '¡Ya estoy!',         'game'),
  (8,  'rematch',       '🔁', 'Rematch?',             '¿Revancha?',              'game'),
  (9,  'thanks',        '🙌', 'Thanks, team!',        '¡Gracias, equipo!',    'thanks'),
  (10, 'good_game',     '🤝', 'Good game!',           '¡Buen juego!',            'thanks');
