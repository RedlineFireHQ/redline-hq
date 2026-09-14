-- Group 8: department Calendar mutations require calendar_management.
-- The Calendar is department-wide; no personal activity model is introduced.

drop policy if exists department_calendar_activities_insert_by_role on public.department_calendar_activities;
create policy department_calendar_activities_insert_by_permission
on public.department_calendar_activities
for insert
to authenticated
with check (
  public.member_has_app_permission(
    department_calendar_activities.department_id,
    'calendar_management'
  )
);

drop policy if exists department_calendar_activities_update_by_role on public.department_calendar_activities;
create policy department_calendar_activities_update_by_permission
on public.department_calendar_activities
for update
to authenticated
using (
  public.member_has_app_permission(
    department_calendar_activities.department_id,
    'calendar_management'
  )
)
with check (
  public.member_has_app_permission(
    department_calendar_activities.department_id,
    'calendar_management'
  )
);

drop policy if exists department_calendar_activities_delete_by_role on public.department_calendar_activities;
create policy department_calendar_activities_delete_by_permission
on public.department_calendar_activities
for delete
to authenticated
using (
  public.member_has_app_permission(
    department_calendar_activities.department_id,
    'calendar_management'
  )
);