-- Atlas Agency · 0005 · Row-level security, grants, and privacy RPCs
--
-- Roles:  student | teacher | school_admin   (public.profiles.role)
--   student       – own rows; classmates' usernames/avatars only (via peer_profiles()).
--   teacher       – rows for students in classes they teach; their school's staff.
--   school_admin  – everything inside their own school; nothing outside it.
--   service_role  – bypasses RLS; used only by edge functions (rostering, sign-in, sync).
--   anon          – nothing.

-- ===========================================================================
-- Helper functions (security definer so they can read membership tables
-- without recursing through those tables' own policies)
-- ===========================================================================
create function app.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function app.my_school() returns uuid
language sql stable security definer set search_path = '' as $$
  select school_id from public.profiles where id = (select auth.uid())
$$;

create function app.is_student() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_role() = 'student', false)
$$;

create function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.my_role() in ('teacher', 'school_admin'), false)
$$;

create function app.is_school_admin(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and role = 'school_admin' and school_id = p_school
  )
$$;

create function app.can_manage_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.class_teachers
            where class_id = p_class and teacher_id = (select auth.uid()))
      or exists (
           select 1 from public.classes c
            where c.id = p_class and app.is_school_admin(c.school_id))
$$;

create function app.in_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_students cs
      join public.classes c on c.id = cs.class_id
     where cs.class_id = p_class and cs.student_id = (select auth.uid()) and c.archived_at is null
  )
$$;

create function app.in_group(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.play_group_members m
      join public.play_groups g on g.id = m.group_id
     where m.group_id = p_group and m.student_id = (select auth.uid())
       and g.approved_at is not null
       and (g.expires_at is null or g.expires_at > now())
  )
$$;

create function app.can_manage_group(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.play_groups g
     where g.id = p_group
       and (g.created_by = (select auth.uid()) or app.is_school_admin(g.school_id))
  )
$$;

-- Staff who may see a given student's records: their teachers and their school admin.
create function app.is_staff_for_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.class_students cs
             join public.class_teachers ct on ct.class_id = cs.class_id
            where cs.student_id = p_student and ct.teacher_id = (select auth.uid()))
      or exists (
           select 1 from public.profiles p
            where p.id = p_student and p.role = 'student' and app.is_school_admin(p.school_id))
$$;

create function app.can_view_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_student = (select auth.uid()) or app.is_staff_for_student(p_student)
$$;

-- Students who share an active class or approved group with the caller.
create function app.is_peer(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
           select 1 from public.class_students a
             join public.class_students b on b.class_id = a.class_id
            where a.student_id = (select auth.uid()) and b.student_id = p_student)
      or exists (
           select 1 from public.play_group_members a
             join public.play_group_members b on b.group_id = a.group_id
             join public.play_groups g on g.id = a.group_id
            where a.student_id = (select auth.uid()) and b.student_id = p_student
              and g.approved_at is not null and (g.expires_at is null or g.expires_at > now()))
$$;

create function app.can_access_room(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.match_rooms r
     where r.id = p_room
       and (   (r.class_id is not null and (app.in_class(r.class_id) or app.can_manage_class(r.class_id)))
            or (r.group_id is not null and (app.in_group(r.group_id) or app.can_manage_group(r.group_id))))
  )
$$;

create function app.can_join_room(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_student()
     and app.can_access_room(p_room)
     and exists (
       select 1 from public.match_rooms r
        where r.id = p_room and r.status = 'lobby'
          and (select count(*) from public.match_players p where p.room_id = r.id) < r.max_players)
$$;

create function app.is_room_player(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.match_players where room_id = p_room and student_id = (select auth.uid())
  )
$$;

create function app.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- ===========================================================================
-- Privileges: deny by default, then grant narrowly
-- ===========================================================================
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
revoke all on all functions in schema app    from public, anon, authenticated;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated, service_role;

grant execute on function
  app.my_role(), app.my_school(), app.is_student(), app.is_staff(), app.is_school_admin(uuid),
  app.can_manage_class(uuid), app.in_class(uuid), app.in_group(uuid), app.can_manage_group(uuid),
  app.is_staff_for_student(uuid), app.can_view_student(uuid), app.is_peer(uuid),
  app.can_access_room(uuid), app.can_join_room(uuid), app.is_room_player(uuid), app.try_uuid(text)
to authenticated;

-- Read access (rows still filtered by policies below)
grant select on
  public.schools, public.profiles, public.student_roster_labels,
  public.classes, public.class_teachers, public.class_students,
  public.play_groups, public.play_group_members,
  public.standards, public.content_items, public.content_current, public.region_packs, public.preset_messages,
  public.assignments, public.mission_attempts, public.answer_events, public.points_ledger, public.student_points,
  public.student_rewards, public.review_cards, public.mastery,
  public.spelling_brackets, public.bracket_matches,
  public.match_rooms, public.match_players, public.match_messages,
  public.deletion_requests, public.audit_events
to authenticated;

-- Writes, column-scoped where a row is only partly user-editable
grant update (name, district_name, retention_days)                     on public.schools          to authenticated;
grant update (locale, preferences, avatar)                             on public.profiles         to authenticated;
grant insert, update (label), delete                                   on public.student_roster_labels to authenticated;
grant insert, update (name, grade_band, archived_at), delete           on public.classes          to authenticated;
grant insert, delete                                                   on public.class_teachers   to authenticated;
grant insert, delete                                                   on public.class_students   to authenticated;
grant insert, update (name, approved_by, approved_at, expires_at), delete on public.play_groups   to authenticated;
grant insert, delete                                                   on public.play_group_members to authenticated;
grant insert, update (settings, opens_at, due_at), delete              on public.assignments      to authenticated;
grant insert, update (status, current_stop, hints_used, completed_at, client_updated_at)
                                                                       on public.mission_attempts to authenticated;
grant insert                                                           on public.answer_events    to authenticated;
grant update (equipped)                                                on public.student_rewards  to authenticated;
grant insert, update (name, status), delete                            on public.spelling_brackets to authenticated;
grant insert, delete                                                   on public.bracket_matches  to authenticated;
grant insert, update (status, started_at, ended_at)                    on public.match_rooms      to authenticated;
grant insert, delete                                                   on public.match_players    to authenticated;
grant insert                                                           on public.match_messages   to authenticated;
-- points_ledger, review_cards, mastery, roster_identities, deletion_requests, audit_events:
-- server-written only. No client write grants at all.

-- ===========================================================================
-- Enable RLS everywhere
-- ===========================================================================
alter table public.schools               enable row level security;
alter table public.profiles              enable row level security;
alter table public.student_roster_labels enable row level security;
alter table public.roster_identities     enable row level security;
alter table public.classes               enable row level security;
alter table public.class_teachers        enable row level security;
alter table public.class_students        enable row level security;
alter table public.play_groups           enable row level security;
alter table public.play_group_members    enable row level security;
alter table public.standards             enable row level security;
alter table public.content_items         enable row level security;
alter table public.region_packs          enable row level security;
alter table public.preset_messages       enable row level security;
alter table public.assignments           enable row level security;
alter table public.mission_attempts      enable row level security;
alter table public.answer_events         enable row level security;
alter table public.points_ledger         enable row level security;
alter table public.student_rewards       enable row level security;
alter table public.review_cards          enable row level security;
alter table public.mastery               enable row level security;
alter table public.spelling_brackets     enable row level security;
alter table public.bracket_matches       enable row level security;
alter table public.match_rooms           enable row level security;
alter table public.match_players         enable row level security;
alter table public.match_messages        enable row level security;
alter table public.deletion_requests     enable row level security;
alter table public.audit_events          enable row level security;

-- ===========================================================================
-- Policies
-- ===========================================================================

-- Schools --------------------------------------------------------------------
create policy schools_select on public.schools for select to authenticated
  using (id = app.my_school());
create policy schools_update on public.schools for update to authenticated
  using (app.is_school_admin(id)) with check (app.is_school_admin(id));

-- Profiles -------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (role = 'student' and app.is_staff_for_student(id))
    or (role <> 'student' and school_id = app.my_school())        -- anyone sees their school's staff
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Roster labels: staff only -----------------------------------------------------
create policy roster_labels_staff on public.student_roster_labels for all to authenticated
  using (app.is_staff_for_student(student_id))
  with check (app.is_staff_for_student(student_id) and school_id = app.my_school());

-- roster_identities: no policies => service_role only.

-- Classes ----------------------------------------------------------------------
create policy classes_select on public.classes for select to authenticated
  using (app.can_manage_class(id) or app.in_class(id) or created_by = (select auth.uid()));
create policy classes_insert on public.classes for insert to authenticated
  with check (app.is_staff() and school_id = app.my_school() and created_by = (select auth.uid()));
create policy classes_update on public.classes for update to authenticated
  using (app.can_manage_class(id)) with check (app.can_manage_class(id));
create policy classes_delete on public.classes for delete to authenticated
  using (app.can_manage_class(id));

create policy class_teachers_select on public.class_teachers for select to authenticated
  using (app.can_manage_class(class_id) or app.in_class(class_id));
create policy class_teachers_write on public.class_teachers for insert to authenticated
  with check (app.can_manage_class(class_id));
create policy class_teachers_delete on public.class_teachers for delete to authenticated
  using (app.can_manage_class(class_id));

create policy class_students_select on public.class_students for select to authenticated
  using (app.can_manage_class(class_id) or app.in_class(class_id));
create policy class_students_insert on public.class_students for insert to authenticated
  with check (app.can_manage_class(class_id));
create policy class_students_delete on public.class_students for delete to authenticated
  using (app.can_manage_class(class_id));

-- Play groups ------------------------------------------------------------------
create policy play_groups_select on public.play_groups for select to authenticated
  using (app.can_manage_group(id) or app.in_group(id)
         or (app.is_staff() and school_id = app.my_school()));
create policy play_groups_insert on public.play_groups for insert to authenticated
  with check (app.is_staff() and school_id = app.my_school() and created_by = (select auth.uid())
              and (approved_by is null or approved_by = (select auth.uid())));
create policy play_groups_update on public.play_groups for update to authenticated
  using (app.can_manage_group(id))
  with check (app.can_manage_group(id) and (approved_by is null or approved_by = (select auth.uid())));
create policy play_groups_delete on public.play_groups for delete to authenticated
  using (app.can_manage_group(id));

create policy group_members_select on public.play_group_members for select to authenticated
  using (app.can_manage_group(group_id) or app.in_group(group_id));
create policy group_members_insert on public.play_group_members for insert to authenticated
  with check (app.can_manage_group(group_id) and app.is_staff_for_student(student_id));
create policy group_members_delete on public.play_group_members for delete to authenticated
  using (app.can_manage_group(group_id));

-- Content (read-only to clients; authored through the content pipeline) ---------
create policy standards_read on public.standards for select to authenticated using (true);
create policy content_read on public.content_items for select to authenticated
  using (status = 'published' or (status = 'retired' and app.is_staff()));
create policy region_packs_read on public.region_packs for select to authenticated
  using (status = 'published');
create policy preset_messages_read on public.preset_messages for select to authenticated
  using (active);

-- Assignments ------------------------------------------------------------------
create policy assignments_select on public.assignments for select to authenticated
  using (app.can_manage_class(class_id) or (app.in_class(class_id) and opens_at <= now()));
create policy assignments_insert on public.assignments for insert to authenticated
  with check (app.can_manage_class(class_id) and created_by = (select auth.uid()));
create policy assignments_update on public.assignments for update to authenticated
  using (app.can_manage_class(class_id)) with check (app.can_manage_class(class_id));
create policy assignments_delete on public.assignments for delete to authenticated
  using (app.can_manage_class(class_id));

-- Mission attempts -------------------------------------------------------------
create policy attempts_select on public.mission_attempts for select to authenticated
  using (app.can_view_student(student_id));
create policy attempts_insert on public.mission_attempts for insert to authenticated
  with check (
    student_id = (select auth.uid()) and app.is_student() and points_earned = 0
    and (assignment_id is null
         or exists (select 1 from public.assignments a where a.id = assignment_id and app.in_class(a.class_id)))
  );
create policy attempts_update on public.mission_attempts for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

-- Answer events ----------------------------------------------------------------
create policy answers_select on public.answer_events for select to authenticated
  using (app.can_view_student(student_id));
create policy answers_insert on public.answer_events for insert to authenticated
  with check (
    student_id = (select auth.uid()) and app.is_student()
    and case context
          when 'mission'      then exists (select 1 from public.mission_attempts m
                                            where m.id = context_id and m.student_id = (select auth.uid()))
          when 'race'         then app.is_room_player(context_id)
          when 'team_mission' then app.is_room_player(context_id)
          else true
        end
  );

-- Derived progress: read-only to the student and their staff ---------------------
create policy points_select on public.points_ledger for select to authenticated
  using (app.can_view_student(student_id));
create policy rewards_select on public.student_rewards for select to authenticated
  using (app.can_view_student(student_id));
create policy rewards_equip on public.student_rewards for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and (reward_type = 'avatar_item' or not equipped));
create policy review_select on public.review_cards for select to authenticated
  using (app.can_view_student(student_id));
create policy mastery_select on public.mastery for select to authenticated
  using (app.can_view_student(student_id));

-- Spelling bee -----------------------------------------------------------------
create policy brackets_select on public.spelling_brackets for select to authenticated
  using (app.can_manage_class(class_id) or app.in_class(class_id));
create policy brackets_write on public.spelling_brackets for insert to authenticated
  with check (app.can_manage_class(class_id) and created_by = (select auth.uid()));
create policy brackets_update on public.spelling_brackets for update to authenticated
  using (app.can_manage_class(class_id)) with check (app.can_manage_class(class_id));
create policy brackets_delete on public.spelling_brackets for delete to authenticated
  using (app.can_manage_class(class_id));

create policy matches_select on public.bracket_matches for select to authenticated
  using (exists (select 1 from public.spelling_brackets b where b.id = bracket_id
                  and (app.can_manage_class(b.class_id) or app.in_class(b.class_id))));
create policy matches_insert on public.bracket_matches for insert to authenticated
  with check (exists (select 1 from public.spelling_brackets b where b.id = bracket_id
                       and app.can_manage_class(b.class_id)));
create policy matches_delete on public.bracket_matches for delete to authenticated
  using (exists (select 1 from public.spelling_brackets b where b.id = bracket_id
                  and app.can_manage_class(b.class_id)));

-- Multiplayer ------------------------------------------------------------------
create policy rooms_select on public.match_rooms for select to authenticated
  using (   (class_id is not null and (app.in_class(class_id) or app.can_manage_class(class_id)))
         or (group_id is not null and (app.in_group(group_id) or app.can_manage_group(group_id))));
create policy rooms_insert on public.match_rooms for insert to authenticated
  with check (
    host_id = (select auth.uid()) and status = 'lobby'
    and (   (class_id is not null and (app.in_class(class_id) or app.can_manage_class(class_id)))
         or (group_id is not null and (app.in_group(group_id) or app.can_manage_group(group_id))))
  );
create policy rooms_update on public.match_rooms for update to authenticated
  using (host_id = (select auth.uid()) or (class_id is not null and app.can_manage_class(class_id))
         or (group_id is not null and app.can_manage_group(group_id)))
  with check (host_id = (select auth.uid()) or (class_id is not null and app.can_manage_class(class_id))
         or (group_id is not null and app.can_manage_group(group_id)));

create policy players_select on public.match_players for select to authenticated
  using (app.can_access_room(room_id));
create policy players_join on public.match_players for insert to authenticated
  with check (student_id = (select auth.uid()) and score = 0 and app.can_join_room(room_id));
create policy players_leave on public.match_players for delete to authenticated
  using (student_id = (select auth.uid()));

create policy messages_select on public.match_messages for select to authenticated
  using (app.can_access_room(room_id));
create policy messages_insert on public.match_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and app.is_room_player(room_id));

-- Privacy records ----------------------------------------------------------------
create policy deletion_select on public.deletion_requests for select to authenticated
  using (requested_by = (select auth.uid()) or app.is_school_admin(school_id));
create policy audit_select on public.audit_events for select to authenticated
  using (app.is_school_admin(school_id));

-- ===========================================================================
-- Realtime authorization (private channels). Receive-only for clients.
--   topic "room:<uuid>"  -> players and supervising teachers
--   topic "class:<uuid>" -> the class's teachers (live dashboard)
-- No INSERT policy on realtime.messages => clients cannot broadcast or track presence.
-- ===========================================================================
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy atlas_receive_broadcasts on realtime.messages for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and case split_part(realtime.topic(), ':', 1)
              when 'room'  then app.can_access_room(app.try_uuid(split_part(realtime.topic(), ':', 2)))
              when 'class' then app.can_manage_class(app.try_uuid(split_part(realtime.topic(), ':', 2)))
              else false
            end
      )
    $p$;
  end if;
end $$;

-- ===========================================================================
-- RPCs
-- ===========================================================================

-- Classmates and group-mates: username + avatar only. Never roster labels.
create function public.peer_profiles()
returns table (id uuid, username text, avatar jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.avatar
    from public.profiles p
   where p.role = 'student'
     and (p.id = (select auth.uid()) or app.is_peer(p.id) or app.is_staff_for_student(p.id))
$$;
revoke all on function public.peer_profiles() from public, anon;
grant execute on function public.peer_profiles() to authenticated;

-- Hard-delete a student and every row that references them (cascades from auth.users).
-- Callable by that student's teachers or school admin. Leaves a PII-free receipt.
create function public.delete_student_data(p_student uuid, p_reason public.deletion_reason)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_school uuid; v_request uuid;
begin
  if not app.is_staff_for_student(p_student) then
    raise exception 'not authorised to delete this student' using errcode = '42501';
  end if;
  select school_id into v_school from public.profiles where id = p_student and role = 'student';

  insert into public.deletion_requests (student_id, school_id, requested_by, reason, status, completed_at)
  values (p_student, v_school, (select auth.uid()), p_reason, 'completed', now())
  returning id into v_request;

  insert into public.audit_events (school_id, actor_id, action, target_id, detail)
  values (v_school, (select auth.uid()), 'delete_student', p_student, jsonb_build_object('reason', p_reason));

  delete from auth.users where id = p_student;     -- cascades through profiles and all progress
  return v_request;
end $$;
revoke all on function public.delete_student_data(uuid, public.deletion_reason) from public, anon;
grant execute on function public.delete_student_data(uuid, public.deletion_reason) to authenticated;

-- Retention sweep for a scheduled job (pg_cron / edge function, service_role only).
create function app.purge_inactive_students() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0; r record;
begin
  for r in
    select p.id, p.school_id
      from public.profiles p join public.schools s on s.id = p.school_id
     where p.role = 'student' and p.last_active_at < now() - make_interval(days => s.retention_days)
  loop
    insert into public.deletion_requests (student_id, school_id, reason, status, completed_at)
    values (r.id, r.school_id, 'retention_expiry', 'completed', now());
    delete from auth.users where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function app.purge_inactive_students() to service_role;
