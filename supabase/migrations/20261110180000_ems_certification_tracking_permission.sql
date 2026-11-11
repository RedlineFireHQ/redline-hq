-- Dedicated permission for managing EMS certification tracking.
--
-- "Manage EMS Certification Tracking" controls who can set up a member's Iowa
-- EMS / National Registry trackers, enter or edit certification information,
-- and renew or restart certification cycles. Members without it can still view
-- their own EMS Continuing Education progress (select policies unchanged) but
-- cannot edit tracking information. Existing broad EMS managers
-- (ems_management) and administrators (built into member_has_app_permission)
-- retain access so no department loses its current workflow.

insert into public.app_permissions (key, label, description, sort_order)
values (
  'ems_certification_tracking_management',
  'Manage EMS Certification Tracking',
  'Set up Iowa EMS and National Registry trackers, enter certification numbers and dates, and renew certification cycles for members.',
  221
)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;

drop policy if exists ems_member_track_profiles_manage_by_role on public.ems_member_track_profiles;
create policy ems_member_track_profiles_manage_by_role
on public.ems_member_track_profiles
for all
to authenticated
using (
  public.member_has_app_permission(department_id, 'ems_certification_tracking_management')
  or public.member_has_app_permission(department_id, 'ems_management')
)
with check (
  public.member_has_app_permission(department_id, 'ems_certification_tracking_management')
  or public.member_has_app_permission(department_id, 'ems_management')
);
