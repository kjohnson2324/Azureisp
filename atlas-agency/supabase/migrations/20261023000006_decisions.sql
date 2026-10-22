-- Atlas Agency · 0006 · Step-1 product decisions
--
-- 1. Answers are graded on the device. Teachers watch results arrive live:
--    every answer event is broadcast to each of the student's class topics
--    ("class:<uuid>"). Only that class's teachers can receive them (policy in 0005).
-- 2. Cross-class play groups need the second teacher's approval. A teacher can
--    only place THEIR OWN students in a group, so a student from another class
--    joins only when that student's teacher adds them.

-- ---------------------------------------------------------------------------
-- 1. Live grade feed
-- ---------------------------------------------------------------------------
create function app.broadcast_answer_to_classes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_class uuid; v_payload jsonb;
begin
  if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is null then
    return new;
  end if;
  -- No free text and no roster label in the payload; the dashboard joins labels locally.
  v_payload := jsonb_build_object(
    'student_id',   new.student_id,
    'context',      new.context,
    'context_id',   new.context_id,
    'item_id',      new.item_id,
    'skill',        new.skill,
    'country_code', new.country_code,
    'correct',      new.correct,
    'hint_used',    new.hint_used,
    'occurred_at',  new.occurred_at
  );
  for v_class in
    select cs.class_id from public.class_students cs
      join public.classes c on c.id = cs.class_id
     where cs.student_id = new.student_id and c.archived_at is null
  loop
    perform realtime.send(v_payload, 'answer', 'class:' || v_class::text, true);
  end loop;
  return new;
end $$;

create trigger answer_events_live_feed after insert on public.answer_events
  for each row execute function app.broadcast_answer_to_classes();

-- ---------------------------------------------------------------------------
-- 2. Group membership is approved by the student's own teacher
-- ---------------------------------------------------------------------------
alter table public.play_group_members
  add column added_by uuid references public.profiles (id) on delete set null default auth.uid();

drop policy group_members_insert on public.play_group_members;
drop policy group_members_delete on public.play_group_members;

-- Any teacher in the group's school may add their own students (that act is the approval).
create policy group_members_insert on public.play_group_members for insert to authenticated
  with check (
    app.is_staff_for_student(student_id)
    and added_by = (select auth.uid())
    and exists (select 1 from public.play_groups g
                 where g.id = group_id and g.school_id = app.my_school() and g.approved_at is not null)
  );
-- The group owner can remove anyone; a student's teacher can withdraw their own students.
create policy group_members_delete on public.play_group_members for delete to authenticated
  using (app.can_manage_group(group_id) or app.is_staff_for_student(student_id));

-- Teachers who have students in a group can see the group and its roster.
create function app.has_students_in_group(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.play_group_members m
     where m.group_id = p_group and app.is_staff_for_student(m.student_id)
  )
$$;
revoke all on function app.has_students_in_group(uuid) from public, anon;
grant execute on function app.has_students_in_group(uuid) to authenticated;

drop policy group_members_select on public.play_group_members;
create policy group_members_select on public.play_group_members for select to authenticated
  using (app.can_manage_group(group_id) or app.in_group(group_id) or app.has_students_in_group(group_id));
