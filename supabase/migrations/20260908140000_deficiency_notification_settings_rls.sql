-- Deficiency notification settings RLS.
--
-- deficiency_notification_settings has RLS enabled but no policies, which
-- blocked all writes. Add a department-scoped read policy and gate all writes
-- behind the existing settings_management permission.
-- member_has_app_permission preserves the administrator bypass; job titles do
-- not grant access.

alter table public.deficiency_notification_settings enable row level security;

-- Any department member can read their department's assignment configuration.
drop policy if exists deficiency_notification_settings_select_by_department on public.deficiency_notification_settings;
create policy deficiency_notification_settings_select_by_department
on public.deficiency_notification_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = deficiency_notification_settings.department_id
  )
);

-- Only settings managers can create assignment rules.
drop policy if exists deficiency_notification_settings_insert_by_settings_manager on public.deficiency_notification_settings;
create policy deficiency_notification_settings_insert_by_settings_manager
on public.deficiency_notification_settings
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Only settings managers can update assignment rules.
drop policy if exists deficiency_notification_settings_update_by_settings_manager on public.deficiency_notification_settings;
create policy deficiency_notification_settings_update_by_settings_manager
on public.deficiency_notification_settings
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Only settings managers can delete assignment rules.
drop policy if exists deficiency_notification_settings_delete_by_settings_manager on public.deficiency_notification_settings;
create policy deficiency_notification_settings_delete_by_settings_manager
on public.deficiency_notification_settings
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);
