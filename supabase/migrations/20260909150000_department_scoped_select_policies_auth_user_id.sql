-- Cedar Bluff Command Center audit found that ~55 department-scoped tables
-- use a SELECT policy that matches only by email:
--   department_id in (select m.department_id from members m
--                      where lower(m.email) = lower(auth.email()))
-- A member whose Supabase Auth email differs from their roster email (e.g.
-- the Cedar Bluff demo admin) is silently denied access to their own
-- department's rows, even though the row genuinely belongs to them. This
-- adds the same auth_user_id identity path already used successfully on
-- public.departments, to every policy listed in the audit, without
-- changing any other existing condition (self-only, admin-only,
-- permission-only, etc.) on those policies.

drop policy if exists apparatus_check_requirements_select_by_department on public.apparatus_check_requirements;
create policy apparatus_check_requirements_select_by_department
on public.apparatus_check_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists apparatus_inspection_checklist_items_select_by_department on public.apparatus_inspection_checklist_items;
create policy apparatus_inspection_checklist_items_select_by_department
on public.apparatus_inspection_checklist_items
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = apparatus_inspection_checklist_items.department_id
  )
);

drop policy if exists apparatus_maintenance_requirements_select_by_department on public.apparatus_maintenance_requirements;
create policy apparatus_maintenance_requirements_select_by_department
on public.apparatus_maintenance_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists apparatus_pump_tests_select_by_department on public.apparatus_pump_tests;
create policy apparatus_pump_tests_select_by_department
on public.apparatus_pump_tests
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists certifications_select_by_department on public.certifications;
create policy certifications_select_by_department
on public.certifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists department_roles_select_by_department on public.department_roles;
create policy department_roles_select_by_department
on public.department_roles
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists ems_course_definitions_select_by_department on public.ems_course_definitions;
create policy ems_course_definitions_select_by_department
on public.ems_course_definitions
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists ems_member_track_profiles_select_self_or_role on public.ems_member_track_profiles;
create policy ems_member_track_profiles_select_self_or_role
on public.ems_member_track_profiles
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = ems_member_track_profiles.department_id
      and (
        m.id = ems_member_track_profiles.member_id
        or lower(coalesce(m.role, '')) = any (array['administrator', 'officer'])
      )
  )
);

drop policy if exists ems_requirement_sets_select_by_department on public.ems_requirement_sets;
create policy ems_requirement_sets_select_by_department
on public.ems_requirement_sets
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists member_certifications_select_self_or_admin on public.member_certifications;
create policy member_certifications_select_self_or_admin
on public.member_certifications
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = member_certifications.department_id
      and (m.id = member_certifications.member_id or lower(coalesce(m.role, '')) = 'administrator')
  )
);

drop policy if exists member_qualifications_select_self_or_admin on public.member_qualifications;
create policy member_qualifications_select_self_or_admin
on public.member_qualifications
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = member_qualifications.department_id
      and (m.id = member_qualifications.member_id or lower(coalesce(m.role, '')) = 'administrator')
  )
);

drop policy if exists role_required_certifications_select_by_department on public.role_required_certifications;
create policy role_required_certifications_select_by_department
on public.role_required_certifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists role_required_qualifications_select_by_department on public.role_required_qualifications;
create policy role_required_qualifications_select_by_department
on public.role_required_qualifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists training_assignment_members_select_self_or_permission on public.training_assignment_members;
create policy training_assignment_members_select_self_or_permission
on public.training_assignment_members
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = training_assignment_members.department_id
      and (
        m.id = training_assignment_members.member_id
        or member_has_app_permission(training_assignment_members.department_id, 'training_management')
        or member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
        or member_has_app_permission(training_assignment_members.department_id, 'training_review')
      )
  )
);

drop policy if exists training_assignments_select_by_department on public.training_assignments;
create policy training_assignments_select_by_department
on public.training_assignments
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists training_event_attendance_select_by_department_member on public.training_event_attendance;
create policy training_event_attendance_select_by_department_member
on public.training_event_attendance
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = training_event_attendance.department_id
  )
);

drop policy if exists training_events_select_by_department on public.training_events;
create policy training_events_select_by_department
on public.training_events
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);

drop policy if exists training_requirements_select_by_department on public.training_requirements;
create policy training_requirements_select_by_department
on public.training_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);
