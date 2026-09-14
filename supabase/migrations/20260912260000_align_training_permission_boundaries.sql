-- Group 6: align Training mutations with canonical permissions.
-- Legacy training keys remain valid compatibility aliases.

-- Program and category configuration.
drop policy if exists training_categories_insert_by_settings_manager on public.training_categories;
create policy training_categories_insert_by_training_program_manager
on public.training_categories for insert to authenticated
with check (
  (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
  and (created_by is null or exists (select 1 from public.members m where m.id = training_categories.created_by and m.department_id = training_categories.department_id))
  and (updated_by is null or exists (select 1 from public.members m where m.id = training_categories.updated_by and m.department_id = training_categories.department_id))
);

drop policy if exists training_categories_update_by_settings_manager on public.training_categories;
create policy training_categories_update_by_training_program_manager
on public.training_categories for update to authenticated
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
with check (
  (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
  and (created_by is null or exists (select 1 from public.members m where m.id = training_categories.created_by and m.department_id = training_categories.department_id))
  and (updated_by is null or exists (select 1 from public.members m where m.id = training_categories.updated_by and m.department_id = training_categories.department_id))
);

drop policy if exists training_categories_delete_by_settings_manager on public.training_categories;
create policy training_categories_delete_by_training_program_manager
on public.training_categories for delete to authenticated
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));

drop policy if exists training_requirements_insert_by_settings_manager on public.training_requirements;
create policy training_requirements_insert_by_training_program_manager
on public.training_requirements for insert to authenticated
with check (
  (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
  and (category_id is null or exists (select 1 from public.training_categories c where c.id = training_requirements.category_id and c.department_id = training_requirements.department_id))
  and (created_by is null or exists (select 1 from public.members m where m.id = training_requirements.created_by and m.department_id = training_requirements.department_id))
  and (updated_by is null or exists (select 1 from public.members m where m.id = training_requirements.updated_by and m.department_id = training_requirements.department_id))
);

drop policy if exists training_requirements_update_by_settings_manager on public.training_requirements;
create policy training_requirements_update_by_training_program_manager
on public.training_requirements for update to authenticated
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
with check (
  (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
  and (category_id is null or exists (select 1 from public.training_categories c where c.id = training_requirements.category_id and c.department_id = training_requirements.department_id))
  and (created_by is null or exists (select 1 from public.members m where m.id = training_requirements.created_by and m.department_id = training_requirements.department_id))
  and (updated_by is null or exists (select 1 from public.members m where m.id = training_requirements.updated_by and m.department_id = training_requirements.department_id))
);

drop policy if exists training_requirements_delete_by_settings_manager on public.training_requirements;
create policy training_requirements_delete_by_training_program_manager
on public.training_requirements for delete to authenticated
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));

-- Department training events and attendance are program-management operations.
drop policy if exists training_events_insert_by_training_permission on public.training_events;
create policy training_events_insert_by_training_program_permission
on public.training_events for insert
with check (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_events_update_by_training_permission on public.training_events;
create policy training_events_update_by_training_program_permission
on public.training_events for update
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
with check (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_events_delete_by_training_permission on public.training_events;
create policy training_events_delete_by_training_program_permission
on public.training_events for delete
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));

drop policy if exists training_event_attendance_insert_by_training_permission on public.training_event_attendance;
create policy training_event_attendance_insert_by_training_program_permission
on public.training_event_attendance for insert
with check (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_event_attendance_update_by_training_permission on public.training_event_attendance;
create policy training_event_attendance_update_by_training_program_permission
on public.training_event_attendance for update
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'))
with check (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_event_attendance_delete_by_training_permission on public.training_event_attendance;
create policy training_event_attendance_delete_by_training_program_permission
on public.training_event_attendance for delete
using (public.member_has_app_permission(department_id, 'training_program_management') or public.member_has_app_permission(department_id, 'training_management'));

-- Assignments preserve legacy keys and gain the canonical assignment key.
drop policy if exists training_assignments_insert_by_training_permission on public.training_assignments;
create policy training_assignments_insert_by_assignment_permission
on public.training_assignments for insert
with check (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_assignments_update_by_training_permission on public.training_assignments;
create policy training_assignments_update_by_assignment_permission
on public.training_assignments for update
using (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management'))
with check (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_assignments_delete_by_training_permission on public.training_assignments;
create policy training_assignments_delete_by_assignment_permission
on public.training_assignments for delete
using (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management'));

drop policy if exists training_assignment_members_insert_by_training_permission on public.training_assignment_members;
create policy training_assignment_members_insert_by_assignment_permission
on public.training_assignment_members for insert
with check (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management'));
drop policy if exists training_assignment_members_update_by_training_permission on public.training_assignment_members;
create policy training_assignment_members_update_by_assignment_or_review_permission
on public.training_assignment_members for update
using (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management') or public.member_has_app_permission(department_id, 'training_review_management') or public.member_has_app_permission(department_id, 'training_review'))
with check (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management') or public.member_has_app_permission(department_id, 'training_review_management') or public.member_has_app_permission(department_id, 'training_review'));
drop policy if exists training_assignment_members_delete_by_training_permission on public.training_assignment_members;
create policy training_assignment_members_delete_by_assignment_permission
on public.training_assignment_members for delete
using (public.member_has_app_permission(department_id, 'training_assignment_management') or public.member_has_app_permission(department_id, 'homework_assignment') or public.member_has_app_permission(department_id, 'training_management'));

-- Self-submission remains available; review management gains its canonical key.
drop policy if exists training_outside_submissions_insert_by_self_or_permission on public.training_outside_submissions;
create policy training_outside_submissions_insert_by_self_or_permission
on public.training_outside_submissions for insert
with check (
  exists (
    select 1 from public.members m
    where (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), '')))
      and m.department_id = training_outside_submissions.department_id
      and (m.id = training_outside_submissions.member_id or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management') or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review'))
  )
);

drop policy if exists training_outside_submissions_update_by_training_permission on public.training_outside_submissions;
create policy training_outside_submissions_update_by_review_permission
on public.training_outside_submissions for update
using (public.member_has_app_permission(department_id, 'training_review_management') or public.member_has_app_permission(department_id, 'training_review') or public.member_has_app_permission(department_id, 'training_management'))
with check (public.member_has_app_permission(department_id, 'training_review_management') or public.member_has_app_permission(department_id, 'training_review') or public.member_has_app_permission(department_id, 'training_management'));

drop policy if exists training_outside_submissions_delete_by_training_permission on public.training_outside_submissions;
create policy training_outside_submissions_delete_by_review_permission
on public.training_outside_submissions for delete
using (public.member_has_app_permission(department_id, 'training_review_management') or public.member_has_app_permission(department_id, 'training_review') or public.member_has_app_permission(department_id, 'training_management'));

drop policy if exists training_outside_submissions_update_self_editable_only on public.training_outside_submissions;
create policy training_outside_submissions_update_self_editable_only
on public.training_outside_submissions for update
using (
  exists (
    select 1 from public.members m
    where (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), '')))
      and coalesce(m.active, false) = true
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('draft', 'rejected')
)
with check (
  exists (
    select 1 from public.members m
    where (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), '')))
      and coalesce(m.active, false) = true
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('draft', 'submitted', 'rejected')
  and (
    training_outside_submissions.category_id is null
    or exists (
      select 1 from public.training_categories c
      where c.id = training_outside_submissions.category_id
        and c.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.status = 'rejected'
    or (training_outside_submissions.reviewed_by is null and training_outside_submissions.reviewed_at is null)
  )
);