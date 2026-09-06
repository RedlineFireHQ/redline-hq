drop policy if exists gas_monitor_calibration_settings_select_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_select_by_department
on public.gas_monitor_calibration_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
  )
);

drop policy if exists gas_monitor_calibration_settings_insert_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_insert_by_department
on public.gas_monitor_calibration_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_calibration_settings_update_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_update_by_department
on public.gas_monitor_calibration_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_calibration_settings_delete_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_delete_by_department
on public.gas_monitor_calibration_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);
