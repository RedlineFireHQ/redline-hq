drop policy if exists training_events_insert_by_department_role on public.training_events;
create policy training_events_insert_by_training_permission
on public.training_events
for insert
with check (public.member_has_app_permission(training_events.department_id, 'training_management'));

drop policy if exists training_events_update_by_department_role on public.training_events;
create policy training_events_update_by_training_permission
on public.training_events
for update
using (public.member_has_app_permission(training_events.department_id, 'training_management'))
with check (public.member_has_app_permission(training_events.department_id, 'training_management'));

drop policy if exists training_events_delete_by_department_role on public.training_events;
create policy training_events_delete_by_training_permission
on public.training_events
for delete
using (public.member_has_app_permission(training_events.department_id, 'training_management'));

drop policy if exists training_event_attendance_select_self_or_role on public.training_event_attendance;
create policy training_event_attendance_select_by_department_member
on public.training_event_attendance
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
  )
);

drop policy if exists training_event_attendance_insert_by_department_role on public.training_event_attendance;
create policy training_event_attendance_insert_by_training_permission
on public.training_event_attendance
for insert
with check (public.member_has_app_permission(training_event_attendance.department_id, 'training_management'));

drop policy if exists training_event_attendance_update_by_department_role on public.training_event_attendance;
create policy training_event_attendance_update_by_training_permission
on public.training_event_attendance
for update
using (public.member_has_app_permission(training_event_attendance.department_id, 'training_management'))
with check (public.member_has_app_permission(training_event_attendance.department_id, 'training_management'));

drop policy if exists training_event_attendance_delete_by_department_role on public.training_event_attendance;
create policy training_event_attendance_delete_by_training_permission
on public.training_event_attendance
for delete
using (public.member_has_app_permission(training_event_attendance.department_id, 'training_management'));

drop policy if exists training_assignments_insert_by_department_role on public.training_assignments;
create policy training_assignments_insert_by_training_permission
on public.training_assignments
for insert
with check (
  public.member_has_app_permission(training_assignments.department_id, 'training_management')
  or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
);

drop policy if exists training_assignments_update_by_department_role on public.training_assignments;
create policy training_assignments_update_by_training_permission
on public.training_assignments
for update
using (
  public.member_has_app_permission(training_assignments.department_id, 'training_management')
  or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
)
with check (
  public.member_has_app_permission(training_assignments.department_id, 'training_management')
  or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
);

drop policy if exists training_assignments_delete_by_department_role on public.training_assignments;
create policy training_assignments_delete_by_training_permission
on public.training_assignments
for delete
using (
  public.member_has_app_permission(training_assignments.department_id, 'training_management')
  or public.member_has_app_permission(training_assignments.department_id, 'homework_assignment')
);

drop policy if exists training_assignment_members_select_self_or_role on public.training_assignment_members;
create policy training_assignment_members_select_self_or_permission
on public.training_assignment_members
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and (
        m.id = training_assignment_members.member_id
        or public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
        or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
        or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
      )
  )
);

drop policy if exists training_assignment_members_insert_by_department_role on public.training_assignment_members;
create policy training_assignment_members_insert_by_training_permission
on public.training_assignment_members
for insert
with check (
  public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
  or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
);

drop policy if exists training_assignment_members_update_by_department_role on public.training_assignment_members;
create policy training_assignment_members_update_by_training_permission
on public.training_assignment_members
for update
using (
  public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
  or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
  or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
)
with check (
  public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
  or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
  or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
);

drop policy if exists training_assignment_members_delete_by_department_role on public.training_assignment_members;
create policy training_assignment_members_delete_by_training_permission
on public.training_assignment_members
for delete
using (
  public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
  or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
);

drop policy if exists training_outside_submissions_select_self_or_role on public.training_outside_submissions;
create policy training_outside_submissions_select_self_or_permission
on public.training_outside_submissions
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and (
        m.id = training_outside_submissions.member_id
        or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
        or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
      )
  )
);

drop policy if exists training_outside_submissions_insert_by_self_or_role on public.training_outside_submissions;
create policy training_outside_submissions_insert_by_self_or_permission
on public.training_outside_submissions
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and (
        m.id = training_outside_submissions.member_id
        or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
        or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
      )
  )
);

drop policy if exists training_outside_submissions_update_by_department_role on public.training_outside_submissions;
create policy training_outside_submissions_update_by_training_permission
on public.training_outside_submissions
for update
using (
  public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
  or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
)
with check (
  public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
  or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
);

drop policy if exists training_outside_submissions_delete_by_department_role on public.training_outside_submissions;
create policy training_outside_submissions_delete_by_training_permission
on public.training_outside_submissions
for delete
using (
  public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
  or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
);
