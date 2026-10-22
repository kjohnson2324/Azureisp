-- RLS / privacy suite. Each assertion prints PASS or FAIL via NOTICE.
-- Runs as superuser to build fixtures, then impersonates each role.
set client_min_messages = notice;

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create schema test;
grant usage on schema test to authenticated, anon;

create function test.eq(label text, actual bigint, expected bigint) returns void
language plpgsql as $$ begin
  if actual is not distinct from expected then raise notice 'PASS %', label;
  else raise notice 'FAIL % (expected %, got %)', label, expected, actual; end if;
end $$;

create function test.throws(label text, stmt text, sqlstate_prefix text default '') returns void
language plpgsql as $$ begin
  begin
    execute stmt;
  exception when others then
    if sqlstate like sqlstate_prefix || '%' then raise notice 'PASS %', label;
    else raise notice 'FAIL % (wrong error % %)', label, sqlstate, sqlerrm; end if;
    return;
  end;
  raise notice 'FAIL % (no error raised)', label;
end $$;

create function test.ok(label text, stmt text) returns void
language plpgsql as $$ begin
  execute stmt;
  raise notice 'PASS %', label;
exception when others then
  raise notice 'FAIL % (% %)', label, sqlstate, sqlerrm;
end $$;

create function test.affected(label text, stmt text, expected bigint) returns void
language plpgsql as $$ declare n bigint; begin
  execute stmt;
  get diagnostics n = row_count;
  perform test.eq(label, n, expected);
exception when others then
  raise notice 'FAIL % (% %)', label, sqlstate, sqlerrm;
end $$;

create function test.login(p_uid uuid) returns void
language sql as $$ select set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false) $$;

grant execute on all functions in schema test to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Fixtures:  School A {admin, T1 -> C1 [S1, S2], T2 -> C2 [S3]}   School B {TB -> CB [SB]}
-- ---------------------------------------------------------------------------
\set school_a '''aaaaaaaa-0000-0000-0000-000000000000'''
\set school_b '''bbbbbbbb-0000-0000-0000-000000000000'''
\set admin_a  '''00000000-0000-0000-0000-00000000a001'''
\set t1       '''00000000-0000-0000-0000-00000000a002'''
\set t2       '''00000000-0000-0000-0000-00000000a003'''
\set s1       '''00000000-0000-0000-0000-00000000a011'''
\set s2       '''00000000-0000-0000-0000-00000000a012'''
\set s3       '''00000000-0000-0000-0000-00000000a013'''
\set tb       '''00000000-0000-0000-0000-00000000b002'''
\set sb       '''00000000-0000-0000-0000-00000000b011'''
\set c1       '''cccccccc-0000-0000-0000-000000000001'''
\set c2       '''cccccccc-0000-0000-0000-000000000002'''
\set cb       '''cccccccc-0000-0000-0000-00000000000b'''
\set room1    '''dddddddd-0000-0000-0000-000000000001'''
\set att1     '''eeeeeeee-0000-0000-0000-000000000001'''

insert into public.schools (id, name) values (:school_a, 'Riverbend Elementary'), (:school_b, 'Hillcrest Middle');
insert into auth.users (id) values (:admin_a), (:t1), (:t2), (:s1), (:s2), (:s3), (:tb), (:sb);
insert into public.profiles (id, role, school_id, username, display_name, grade_band) values
  (:admin_a, 'school_admin', :school_a, 'StaffAdmin01',  'Dr. Ames',   null),
  (:t1,      'teacher',      :school_a, 'StaffTeach01',  'Ms. Rivera', null),
  (:t2,      'teacher',      :school_a, 'StaffTeach02',  'Mr. Chen',   null),
  (:s1,      'student',      :school_a, 'BraveOtter42',  null, '3-5'),
  (:s2,      'student',      :school_a, 'SwiftHeron07',  null, '3-5'),
  (:s3,      'student',      :school_a, 'CalmTapir19',   null, '6-8'),
  (:tb,      'teacher',      :school_b, 'StaffTeach03',  'Mx. Okoro',  null),
  (:sb,      'student',      :school_b, 'JollyYak88',    null, '6-8');
insert into public.classes (id, school_id, name, grade_band, created_by) values
  (:c1, :school_a, 'Room 12 Geography', '3-5', :t1),
  (:c2, :school_a, 'Period 3 World Studies', '6-8', :t2),
  (:cb, :school_b, 'Explorers Club', '6-8', :tb);
insert into public.class_students values (:c1, :s1), (:c1, :s2), (:c2, :s3), (:cb, :sb);
insert into public.student_roster_labels (student_id, school_id, label) values
  (:s1, :school_a, 'Maya R.'), (:s2, :school_a, 'Leo T.'), (:s3, :school_a, 'Ana P.');

insert into public.standards (id, framework, code, grade_bands, description_en, description_es) values
  ('NGS.1', 'NGS', '1', '{K-2,3-5,6-8}', 'How to use maps and other geographic representations',
   'Cómo usar mapas y otras representaciones geográficas'),
  ('TEKS.113.15.b.6', 'TEKS', '113.15(b)(6)', '{3-5}', 'Geography: uses geographic tools',
   'Geografía: usa herramientas geográficas');
insert into public.content_items (id, version, kind, status, grade_bands, standard_ids, country_codes, data) values
  ('country:FR', 1, 'country', 'published', '{}', '{}', '{FR}', '{"en":{"name":"France"},"es":{"name":"Francia"}}'),
  ('question:capital-FR-1', 1, 'question', 'published', '{3-5}', '{NGS.1}', '{FR}', '{"en":{"prompt":"Capital?"}}'),
  ('mission:paris-1', 1, 'mission', 'published', '{3-5}', '{NGS.1,TEKS.113.15.b.6}', '{FR}', '{"en":{"title":"Case"}}'),
  ('mission:secret-draft', 1, 'mission', 'draft', '{3-5}', '{NGS.1}', '{FR}', '{"en":{"title":"WIP"}}');

-- ===========================================================================
-- Content rules (as content pipeline / superuser)
-- ===========================================================================
select test.throws('question without a standard is rejected',
  $$insert into public.content_items (id, version, kind, grade_bands, data)
    values ('question:untagged', 1, 'question', '{3-5}', '{}')$$, '23514');
select test.throws('unknown standard id is rejected',
  $$insert into public.content_items (id, version, kind, grade_bands, standard_ids, data)
    values ('question:badstd', 1, 'question', '{3-5}', '{NGS.999}', '{}')$$, '23503');
select test.throws('published content is immutable',
  $$update public.content_items set data = '{"en":{"name":"Changed"}}' where id = 'country:FR'$$, '23514');
select test.ok('published content can be retired',
  $$update public.content_items set status = 'retired' where id = 'question:capital-FR-1';
    update public.content_items set status = 'published' where false$$);
update public.content_items set status = 'published' where false;
-- restore a published question for later tests
insert into public.content_items (id, version, kind, status, grade_bands, standard_ids, country_codes, data)
values ('question:capital-FR-1', 2, 'question', 'published', '{3-5}', '{NGS.1}', '{FR}', '{"en":{"prompt":"Capital?"}}');
select test.throws('student profile cannot carry a real name',
  $$insert into auth.users (id) values ('00000000-0000-0000-0000-00000000ffff');
    insert into public.profiles (id, role, school_id, username, display_name, grade_band)
    values ('00000000-0000-0000-0000-00000000ffff', 'student', 'aaaaaaaa-0000-0000-0000-000000000000',
            'NobleLynx11', 'Real Name', '3-5')$$, '23514');

-- ===========================================================================
-- anon
-- ===========================================================================
set role anon;
select test.throws('anon cannot read profiles', 'select 1 from public.profiles', '42501');
select test.throws('anon cannot read content', 'select 1 from public.content_items', '42501');
select test.throws('anon cannot call delete_student_data',
  $$select public.delete_student_data('00000000-0000-0000-0000-00000000a011', 'parent_request')$$, '42501');
reset role;

-- ===========================================================================
-- Student S1 (class C1, school A)
-- ===========================================================================
select test.login(:s1);
set role authenticated;

select test.eq('S1 sees self + 3 school staff in profiles', (select count(*) from public.profiles), 4);
select test.eq('S1 cannot read classmate S2 profile row', (select count(*) from public.profiles where id = :s2), 0);
select test.eq('peer_profiles = S1 + classmate S2 only', (select count(*) from public.peer_profiles()), 2);
select test.eq('peer_profiles excludes other class + other school',
  (select count(*) from public.peer_profiles() where id in (:s3, :sb)), 0);
select test.eq('S1 cannot see any roster labels (even own)', (select count(*) from public.student_roster_labels), 0);
select test.eq('S1 sees only own school', (select count(*) from public.schools), 1);
select test.eq('S1 sees only class C1', (select count(*) from public.classes), 1);
select test.eq('S1 cannot see draft content', (select count(*) from public.content_items where status = 'draft'), 0);

select test.throws('S1 cannot change own role',
  $$update public.profiles set role = 'teacher' where id = auth.uid()$$, '42501');
select test.throws('S1 cannot move to another school',
  $$update public.profiles set school_id = 'bbbbbbbb-0000-0000-0000-000000000000' where id = auth.uid()$$, '42501');
select test.ok('S1 can change own locale + accessibility prefs',
  $$update public.profiles set locale = 'es', preferences = '{"font":"dyslexic","timerMultiplier":2}' where id = auth.uid()$$);
select test.affected('S1 update of classmate S2 profile affects 0 rows',
  $$update public.profiles set locale = 'es' where id = '00000000-0000-0000-0000-00000000a012'$$, 0);

select test.throws('S1 cannot create a class',
  $$insert into public.classes (school_id, name, grade_band, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Fake', '3-5', auth.uid())$$, '42501');

select test.ok('S1 can start own mission attempt',
  $$insert into public.mission_attempts (id, student_id, mission_id, mission_version)
    values ('eeeeeeee-0000-0000-0000-000000000001', auth.uid(), 'mission:paris-1', 1)$$);
select test.throws('S1 cannot self-award attempt points',
  $$insert into public.mission_attempts (id, student_id, mission_id, mission_version, points_earned)
    values (gen_random_uuid(), auth.uid(), 'mission:paris-1', 1, 500)$$, '42501');
select test.throws('S1 cannot update points_earned column',
  $$update public.mission_attempts set points_earned = 999$$, '42501');
select test.ok('S1 can log an answer for own attempt',
  $$insert into public.answer_events (id, student_id, context, context_id, item_id, item_version, skill, country_code, correct, occurred_at)
    values (gen_random_uuid(), auth.uid(), 'mission', 'eeeeeeee-0000-0000-0000-000000000001',
            'question:capital-FR-1', 2, 'capital', 'FR', true, now())$$);
select test.ok('offline re-sync of same answer id is idempotent',
  $$insert into public.answer_events (id, student_id, context, item_id, item_version, skill, correct, occurred_at)
    values ('ffffffff-0000-0000-0000-000000000001', auth.uid(), 'explore', 'country:FR', 1, 'location', true, now());
    insert into public.answer_events (id, student_id, context, item_id, item_version, skill, correct, occurred_at)
    values ('ffffffff-0000-0000-0000-000000000001', auth.uid(), 'explore', 'country:FR', 1, 'location', true, now())
    on conflict (id) do nothing$$);
select test.throws('S1 cannot log answers as S2',
  $$insert into public.answer_events (id, student_id, context, item_id, item_version, skill, correct, occurred_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000a012', 'explore', 'country:FR', 1, 'location', true, now())$$,
  '42501');
select test.throws('S1 cannot write the points ledger',
  $$insert into public.points_ledger (student_id, delta, reason) values (auth.uid(), 500, 'mission_solved')$$, '42501');
select test.throws('S1 cannot grant self a badge',
  $$insert into public.student_rewards (student_id, reward_type, reward_key) values (auth.uid(), 'badge', 'badge:x')$$, '42501');
select test.throws('S1 cannot write review cards',
  $$insert into public.review_cards (student_id, item_key, skill) values (auth.uid(), 'capital:FR', 'capital')$$, '42501');

-- Multiplayer
select test.ok('S1 can open a race room for own class',
  $$insert into public.match_rooms (id, kind, class_id, host_id, content_id, content_version)
    values ('dddddddd-0000-0000-0000-000000000001', 'quiz_race', 'cccccccc-0000-0000-0000-000000000001',
            auth.uid(), 'mission:paris-1', 1)$$);
select test.throws('S1 cannot open a room for another class',
  $$insert into public.match_rooms (kind, class_id, host_id, content_id, content_version)
    values ('quiz_race', 'cccccccc-0000-0000-0000-000000000002', auth.uid(), 'mission:paris-1', 1)$$, '42501');
select test.ok('S1 joins own room',
  $$insert into public.match_players (room_id, student_id) values ('dddddddd-0000-0000-0000-000000000001', auth.uid())$$);
select test.ok('S1 sends a preset message',
  $$insert into public.match_messages (room_id, sender_id, preset_message_id)
    values ('dddddddd-0000-0000-0000-000000000001', auth.uid(), 1)$$);
select test.throws('preset messages are rate limited',
  $$insert into public.match_messages (room_id, sender_id, preset_message_id)
    values ('dddddddd-0000-0000-0000-000000000001', auth.uid(), 2)$$, 'P0001');
select test.throws('there is no free-text column to send',
  $$insert into public.match_messages (room_id, sender_id, preset_message_id, body)
    values ('dddddddd-0000-0000-0000-000000000001', auth.uid(), 2, 'hi')$$, '42703');

-- Realtime: receive-only
select set_config('realtime.topic', 'room:' || :room1, false);
select test.eq('S1 receives broadcasts for own room (join + 1 message)', (select count(*) from realtime.messages where topic = realtime.topic()), 2);
select test.throws('S1 cannot broadcast arbitrary payloads',
  $$insert into realtime.messages (topic, extension, payload) values (realtime.topic(), 'broadcast', '{"text":"hi"}')$$,
  '42501');
reset role;

-- ===========================================================================
-- Student S2 (classmate, not in room) and S3 (other class)
-- ===========================================================================
select test.login(:s2);
set role authenticated;
select test.throws('S2 cannot post into a room they have not joined',
  $$insert into public.match_messages (room_id, sender_id, preset_message_id)
    values ('dddddddd-0000-0000-0000-000000000001', auth.uid(), 3)$$, '42501');
select test.eq('S2 cannot read S1 answer events', (select count(*) from public.answer_events), 0);
reset role;

select test.login(:s3);
set role authenticated;
select test.eq('S3 cannot see the C1 room', (select count(*) from public.match_rooms), 0);
select test.throws('S3 cannot join the C1 room',
  $$insert into public.match_players (room_id, student_id) values ('dddddddd-0000-0000-0000-000000000001', auth.uid())$$,
  '42501');
select test.eq('S3 receives no broadcasts for the C1 room', (select count(*) from realtime.messages where topic = realtime.topic()), 0);
reset role;
select set_config('realtime.topic', '', false);

-- ===========================================================================
-- Teacher T1 (teaches C1)
-- ===========================================================================
select test.login(:t1);
set role authenticated;
select test.eq('T1 sees students S1+S2 only', (select count(*) from public.profiles where role = 'student'), 2);
select test.eq('T1 sees roster labels for own students', (select count(*) from public.student_roster_labels), 2);
select test.eq('T1 sees S1 answer events', (select count(*) from public.answer_events where student_id = :s1), 2);
select test.throws('T1 cannot label a student outside their classes',
  $$insert into public.student_roster_labels (student_id, school_id, label)
    values ('00000000-0000-0000-0000-00000000a013', 'aaaaaaaa-0000-0000-0000-000000000000', 'X')
    on conflict (student_id) do update set label = 'X'$$, '42501');
select test.throws('T1 cannot enrol a student from another school',
  $$insert into public.class_students values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b011')$$,
  '23514');
select test.throws('T1 cannot add students to a class they do not teach',
  $$insert into public.class_students values ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000a011')$$,
  '42501');
select test.ok('T1 can create a class (and becomes its teacher)',
  $$insert into public.classes (school_id, name, grade_band, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Geo Club', '3-5', auth.uid())$$);
select test.eq('T1 now teaches 2 classes', (select count(*) from public.class_teachers where teacher_id = auth.uid()), 2);
select test.ok('T1 can assign a mission to C1',
  $$insert into public.assignments (class_id, kind, content_id, content_version, settings, created_by)
    values ('cccccccc-0000-0000-0000-000000000001', 'mission', 'mission:paris-1', 1,
            '{"timer_multiplier":1.5,"max_hints":3}', auth.uid())$$);
select test.throws('T1 cannot change own role',
  $$update public.profiles set role = 'school_admin' where id = auth.uid()$$, '42501');
reset role;

-- ===========================================================================
-- Teacher T2 and School B teacher: isolation
-- ===========================================================================
select test.login(:t2);
set role authenticated;
select test.eq('T2 cannot see S1 answers', (select count(*) from public.answer_events), 0);
select test.throws('T2 cannot delete a student they do not teach',
  $$select public.delete_student_data('00000000-0000-0000-0000-00000000a011', 'parent_request')$$, '42501');
reset role;

select test.login(:tb);
set role authenticated;
select test.eq('School B teacher sees no School A profiles',
  (select count(*) from public.profiles where school_id = :school_a), 0);
select test.eq('School B teacher sees no School A classes',
  (select count(*) from public.classes where school_id = :school_a), 0);
reset role;

-- ===========================================================================
-- School admin A
-- ===========================================================================
select test.login(:admin_a);
set role authenticated;
select test.eq('Admin A sees all 3 School A students', (select count(*) from public.profiles where role = 'student'), 3);
select test.eq('Admin A sees nothing from School B', (select count(*) from public.profiles where school_id = :school_b), 0);
select test.ok('Admin A can set retention window',
  $$update public.schools set retention_days = 180 where id = 'aaaaaaaa-0000-0000-0000-000000000000'$$);
reset role;

-- ===========================================================================
-- Decision: device-graded answers stream live to the class's teachers
-- ===========================================================================
select set_config('realtime.topic', 'class:' || :c1, false);
select test.login(:t1);
set role authenticated;
select test.eq('T1 receives live answer feed for C1',
  (select count(*) from realtime.messages where event = 'answer'), 2);
reset role;
select test.login(:t2);
set role authenticated;
select test.eq('T2 cannot receive C1 live feed', (select count(*) from realtime.messages), 0);
reset role;
select test.login(:s2);
set role authenticated;
select test.eq('students cannot receive the class feed', (select count(*) from realtime.messages), 0);
reset role;
select set_config('realtime.topic', '', false);
select test.eq('live feed payload has no roster label or free text',
  (select count(*) from realtime.messages where event = 'answer' and (payload ? 'label' or payload ? 'response')), 0);

-- ===========================================================================
-- Decision: cross-class groups need the second teacher's approval
-- ===========================================================================
\set g1 '''99999999-0000-0000-0000-000000000001'''
select test.login(:t1);
set role authenticated;
select test.ok('T1 creates an approved play group',
  $$insert into public.play_groups (id, school_id, name, created_by, approved_by, approved_at)
    values ('99999999-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000',
            'Map Masters', auth.uid(), auth.uid(), now())$$);
select test.ok('T1 adds own student S1',
  $$insert into public.play_group_members (group_id, student_id)
    values ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a011')$$);
select test.throws('T1 cannot add T2''s student S3 without T2',
  $$insert into public.play_group_members (group_id, student_id)
    values ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a013')$$, '42501');
reset role;
select test.login(:t2);
set role authenticated;
select test.ok('T2 approves by adding own student S3',
  $$insert into public.play_group_members (group_id, student_id)
    values ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a013')$$);
select test.eq('T2 sees the group roster it contributes to',
  (select count(*) from public.play_group_members where group_id = :g1), 2);
reset role;
select test.login(:tb);
set role authenticated;
select test.throws('other-school teacher cannot add to the group',
  $$insert into public.play_group_members (group_id, student_id)
    values ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000b011')$$);
reset role;
select test.login(:s1);
set role authenticated;
select test.eq('S1 now sees group-mate S3 in peer_profiles',
  (select count(*) from public.peer_profiles() where id = :s3), 1);
reset role;

-- ===========================================================================
-- Data deletion by S1's teacher
-- ===========================================================================
select test.login(:t1);
set role authenticated;
select test.ok('T1 deletes S1 data',
  $$select public.delete_student_data('00000000-0000-0000-0000-00000000a011', 'parent_request')$$);
reset role;
select test.eq('S1 profile gone', (select count(*) from public.profiles where id = :s1), 0);
select test.eq('S1 answers gone', (select count(*) from public.answer_events where student_id = :s1), 0);
select test.eq('S1 roster label gone', (select count(*) from public.student_roster_labels where student_id = :s1), 0);
select test.eq('S1 room seat gone', (select count(*) from public.match_players where student_id = :s1), 0);
select test.eq('PII-free deletion receipt kept', (select count(*) from public.deletion_requests where student_id = :s1), 1);
select test.eq('deletion audited', (select count(*) from public.audit_events where action = 'delete_student'), 1);
