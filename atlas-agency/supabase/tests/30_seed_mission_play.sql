-- A student plays a seeded case: the engine's AttemptRow / AnswerEventRow shapes
-- must be accepted under RLS, re-sync must be idempotent, and the teacher feed fires.
set client_min_messages = notice;

insert into public.schools (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Play School');
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000a002'), ('00000000-0000-0000-0000-00000000a011');
insert into public.profiles (id, role, school_id, username, display_name, grade_band) values
  ('00000000-0000-0000-0000-00000000a002', 'teacher', 'aaaaaaaa-0000-0000-0000-000000000000', 'StaffTeach01', 'Ms. Rivera', null),
  ('00000000-0000-0000-0000-00000000a011', 'student', 'aaaaaaaa-0000-0000-0000-000000000000', 'BraveOtter42', null, 'K-2');
insert into public.classes (id, school_id, name, grade_band, created_by)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Room 4', 'K-2', '00000000-0000-0000-0000-00000000a002');
insert into public.class_students values ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a011');

select test.login('00000000-0000-0000-0000-00000000a011');
set role authenticated;

-- What supabaseEvidenceApi sends: AttemptRow + student_id, insert-if-missing.
select test.ok('student starts a seeded K-2 case',
  $$insert into public.mission_attempts (id, student_id, mission_id, mission_version, assignment_id, status, current_stop, hints_used, started_at, completed_at, client_updated_at)
    values ('11111111-0000-4000-8000-000000000001', auth.uid(), 'mission:gk2-eiffel-tower', 1, null, 'in_progress', 0, 0, now(), null, now())
    on conflict (id) do nothing$$);
select test.ok('the engine answer row is accepted',
  $$insert into public.answer_events (id, student_id, context, context_id, item_id, item_version, skill, country_code, correct, hint_used, response, duration_ms, occurred_at)
    select '22222222-0000-4000-8000-000000000001', auth.uid(), 'mission', '11111111-0000-4000-8000-000000000001',
           'country:' || (data->'stops'->1->>'country'), 1, 'flag', data->'stops'->1->>'country', true, false,
           jsonb_build_object('choice', data->'stops'->1->>'country', 'stop', 0), 8200, now()
      from public.content_current where id = 'mission:gk2-eiffel-tower'
    on conflict (id) do nothing$$);
select test.ok('re-syncing the same rows is a no-op',
  $$insert into public.mission_attempts (id, student_id, mission_id, mission_version, status, started_at, client_updated_at)
    values ('11111111-0000-4000-8000-000000000001', auth.uid(), 'mission:gk2-eiffel-tower', 1, 'in_progress', now(), now())
    on conflict (id) do nothing$$);
select test.ok('student marks the case solved (client-writable columns only)',
  $$update public.mission_attempts set status = 'solved', current_stop = 2, hints_used = 0, completed_at = now(), client_updated_at = now()
    where id = '11111111-0000-4000-8000-000000000001'$$);
select test.throws('students cannot award themselves attempt points',
  $$update public.mission_attempts set points_earned = 999 where id = '11111111-0000-4000-8000-000000000001'$$, '42501');
reset role;

select test.eq('one attempt, solved', (select count(*) from public.mission_attempts where status = 'solved'), 1);
select test.eq('one answer event stored', (select count(*) from public.answer_events), 1);
select test.eq('the teacher live feed got the answer',
  (select count(*) from realtime.messages where topic = 'class:cccccccc-0000-0000-0000-000000000001' and event = 'answer'), 1);
