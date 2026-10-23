-- Seed content suite: runs after supabase/seed.sql has been loaded.
set client_min_messages = notice;

select test.eq('18 National Geography Standards seeded', (select count(*) from public.standards where framework = 'NGS'), 18);
select test.eq('195 country documents seeded', (select count(*) from public.content_items where kind = 'country'), 195);
select test.eq('all 195 are published', (select count(*) from public.content_current where kind = 'country'), 195);
select test.eq('every country has exactly 5 clues',
  (select count(*) from public.content_items where kind = 'country' and jsonb_array_length(data->'clues') = 5), 195);
select test.eq('975 clues in total',
  (select sum(jsonb_array_length(data->'clues')) from public.content_items where kind = 'country'), 975);
select test.eq('every clue is bilingual',
  (select count(*) from public.content_items, jsonb_array_elements(data->'clues') c
    where kind = 'country' and length(c->'text'->>'en') > 0 and length(c->'text'->>'es') > 0), 975);
select test.eq('every clue is tagged with a known standard',
  (select count(*) from public.content_items, jsonb_array_elements(data->'clues') c
    where kind = 'country'
      and jsonb_array_length(c->'standardIds') > 0
      and not exists (select 1 from jsonb_array_elements_text(c->'standardIds') s
                       where s not in (select id from public.standards))), 975);
select test.eq('every country has a capital, flag, greeting and 2+ facts',
  (select count(*) from public.content_items
    where kind = 'country'
      and data->'capital'->'name'->>'en' is not null
      and jsonb_array_length(data->'capital'->'coord') = 2
      and data->'flag'->>'path' like 'flags/%.svg'
      and data->'greeting'->>'ttsLang' is not null
      and jsonb_array_length(data->'facts') >= 2), 195);
select test.eq('country_codes match the document',
  (select count(*) from public.content_items where kind = 'country' and country_codes = array[data->>'iso2']), 195);
select test.eq('five continents represented', (select count(distinct data->>'region') from public.content_items where kind = 'country'), 5);

select test.eq('six continent region packs seeded', (select count(*) from public.region_packs where status = 'published'), 6);
select test.eq('region packs cover all 195 countries exactly once',
  (select count(distinct e->>'id') from public.region_packs, jsonb_array_elements(manifest) e), 195);
select test.throws('a pack cannot reference unknown content',
  $$insert into public.region_packs (id, version, status, name_en, name_es, bbox, manifest)
    values ('atlantis', 1, 'published', 'Atlantis', 'Atlántida', '{0,0,1,1}', '[{"id":"country:ZZ","version":1}]')$$, '23503');
select test.throws('tile fields are all-or-nothing',
  $$insert into public.region_packs (id, version, status, name_en, name_es, bbox, manifest, tiles_path)
    values ('half', 1, 'draft', 'Half', 'Mitad', '{0,0,1,1}', '[]', 'tiles/half.pmtiles')$$, '23514');

-- Students can read published country content.
insert into public.schools (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Seed School');
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000a011');
insert into public.profiles (id, role, school_id, username, grade_band)
values ('00000000-0000-0000-0000-00000000a011', 'student', 'aaaaaaaa-0000-0000-0000-000000000000', 'BraveOtter42', 'K-2');
select test.login('00000000-0000-0000-0000-00000000a011');
set role authenticated;
select test.eq('a student can read all 195 countries', (select count(*) from public.content_current where kind = 'country'), 195);
select test.eq('a student can list the published region packs', (select count(*) from public.region_packs), 6);
select test.eq('a student can look up a clue by id',
  (select count(*) from public.content_current, jsonb_array_elements(data->'clues') c
    where id = 'country:JP' and c->>'id' = 'JP-food-1'), 1);
reset role;

select test.throws('seeded content is immutable',
  $$update public.content_items set data = jsonb_set(data, '{capital,name,en}', '"Osaka"') where id = 'country:JP'$$, '23514');
