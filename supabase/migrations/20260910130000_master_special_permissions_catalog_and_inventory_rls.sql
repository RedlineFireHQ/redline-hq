with catalog as (
  select
    permission_key,
    row_number() over () + 200 as sort_order
  from unnest(array[
    'calendar_management', 'ems_management',
    'training_program_management', 'training_assignment_management', 'training_review_management',
    'apparatus_checks_management', 'pump_testing_management',
    'fire_hose_management', 'fire_hose_inspection_testing', 'fire_hose_assignment', 'fire_hose_retire_delete',
    'scba_pack_management', 'scba_pack_inspection_testing', 'scba_pack_assignment', 'scba_pack_retire_delete',
    'scba_cylinder_management', 'scba_cylinder_inspection_testing', 'scba_cylinder_assignment', 'scba_cylinder_retire_delete',
    'ppe_management', 'ppe_inspection_testing', 'ppe_assignment', 'ppe_retire_delete',
    'portable_radio_management', 'portable_radio_inspection_testing', 'portable_radio_assignment', 'portable_radio_retire_delete',
    'portable_radio_mic_management', 'portable_radio_mic_inspection_testing', 'portable_radio_mic_assignment', 'portable_radio_mic_retire_delete',
    'gas_monitor_management', 'gas_monitor_calibration', 'gas_monitor_assignment', 'gas_monitor_retire_delete',
    'ground_ladder_management', 'ground_ladder_inspection', 'ground_ladder_service_testing', 'ground_ladder_assignment', 'ground_ladder_retire_delete',
    'ems_equipment_management', 'ems_equipment_inspection_testing', 'ems_equipment_assignment', 'ems_equipment_retire_delete',
    'ems_supply_management', 'ems_supply_inspection', 'ems_supply_assignment', 'ems_supply_retire_delete',
    'fire_extinguisher_management', 'fire_extinguisher_inspection_testing', 'fire_extinguisher_assignment', 'fire_extinguisher_retire_delete',
    'rope_management', 'rope_inspection_testing', 'rope_assignment', 'rope_retire_delete',
    'tic_management', 'tic_inspection_testing', 'tic_assignment', 'tic_retire_delete',
    'battery_management', 'battery_testing', 'battery_assignment', 'battery_retire_delete',
    'pie_equipment_management', 'pie_equipment_inspection_testing', 'pie_equipment_assignment', 'pie_equipment_retire_delete',
    'misc_fire_equipment_management', 'misc_fire_equipment_inspection_testing', 'misc_fire_equipment_assignment', 'misc_fire_equipment_retire_delete'
  ]) as permission_key
)
insert into public.app_permissions (key, label, description, sort_order)
select
  permission_key,
  case permission_key
    when 'tic_management' then 'TIC Management'
    when 'tic_inspection_testing' then 'TIC Inspection & Testing'
    when 'tic_assignment' then 'TIC Assignment'
    when 'tic_retire_delete' then 'TIC Retire / Delete'
    else replace(initcap(replace(permission_key, '_', ' ')), 'Scba', 'SCBA')
  end,
  'Special permission for ' || replace(permission_key, '_', ' ') || '.',
  sort_order
from catalog
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;

create or replace function public.member_has_inventory_permission(
  p_department_id uuid,
  p_permission_key text
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.member_has_app_permission(p_department_id, p_permission_key)
    or public.member_has_app_permission(p_department_id, 'inventory_management');
$$;

revoke all on function public.member_has_inventory_permission(uuid, text) from public;
revoke all on function public.member_has_inventory_permission(uuid, text) from anon;
grant execute on function public.member_has_inventory_permission(uuid, text) to authenticated;

create or replace function public.replace_inventory_write_policy(
  p_table_name text,
  p_command text,
  p_permission_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_policy record;
  v_policy_name text := format('%s_%s_special_permission', p_table_name, lower(p_command));
  v_condition text := format('public.member_has_inventory_permission(department_id, %L)', p_permission_key);
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    return;
  end if;

  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = p_table_name
      and cmd = lower(p_command)
  loop
    execute format('drop policy if exists %I on public.%I', v_policy.policyname, p_table_name);
  end loop;

  if upper(p_command) = 'INSERT' then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', v_policy_name, p_table_name, v_condition);
  elsif upper(p_command) = 'UPDATE' then
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', v_policy_name, p_table_name, v_condition, v_condition);
  elsif upper(p_command) = 'DELETE' then
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', v_policy_name, p_table_name, v_condition);
  else
    raise exception 'Unsupported inventory policy command: %', p_command;
  end if;
end;
$$;

revoke all on function public.replace_inventory_write_policy(text, text, text) from public;
revoke all on function public.replace_inventory_write_policy(text, text, text) from anon;

do $$
declare
  permission_row record;
begin
  for permission_row in
    select * from (values
      ('fire_hose', 'fire_hose_management', 'fire_hose_retire_delete'),
      ('scba_packs', 'scba_pack_management', 'scba_pack_retire_delete'),
      ('scba_cylinders', 'scba_cylinder_management', 'scba_cylinder_retire_delete'),
      ('ppe_items', 'ppe_management', 'ppe_retire_delete'),
      ('portable_radios', 'portable_radio_management', 'portable_radio_retire_delete'),
      ('portable_radio_mics', 'portable_radio_mic_management', 'portable_radio_mic_retire_delete'),
      ('gas_monitors', 'gas_monitor_management', 'gas_monitor_retire_delete'),
      ('ground_ladders', 'ground_ladder_management', 'ground_ladder_retire_delete'),
      ('ems_equipment', 'ems_equipment_management', 'ems_equipment_retire_delete'),
      ('ems_supply_items', 'ems_supply_management', 'ems_supply_retire_delete'),
      ('fire_extinguishers', 'fire_extinguisher_management', 'fire_extinguisher_retire_delete'),
      ('rope_items', 'rope_management', 'rope_retire_delete'),
      ('thermal_imaging_cameras', 'tic_management', 'tic_retire_delete'),
      ('batteries', 'battery_management', 'battery_retire_delete'),
      ('pie_equipment', 'pie_equipment_management', 'pie_equipment_retire_delete'),
      ('misc_fire_equipment', 'misc_fire_equipment_management', 'misc_fire_equipment_retire_delete')
    ) as permissions(table_name, management_key, retire_key)
  loop
    perform public.replace_inventory_write_policy(permission_row.table_name, 'INSERT', permission_row.management_key);
    perform public.replace_inventory_write_policy(permission_row.table_name, 'UPDATE', permission_row.management_key);
    perform public.replace_inventory_write_policy(permission_row.table_name, 'DELETE', permission_row.retire_key);
  end loop;

  for permission_row in
    select * from (values
      ('fire_hose_testing_sessions', 'fire_hose_inspection_testing'),
      ('fire_hose_testing_results', 'fire_hose_inspection_testing'),
      ('scba_pack_flow_tests', 'scba_pack_inspection_testing'),
      ('scba_pack_testing_sessions', 'scba_pack_inspection_testing'),
      ('gas_monitor_calibration_sessions', 'gas_monitor_calibration'),
      ('gas_monitor_calibration_session_results', 'gas_monitor_calibration'),
      ('gas_monitor_calibrations', 'gas_monitor_calibration'),
      ('ground_ladder_inspections', 'ground_ladder_inspection'),
      ('ground_ladder_service_tests', 'ground_ladder_service_testing'),
      ('rope_inspections', 'rope_inspection_testing')
    ) as permissions(table_name, permission_key)
  loop
    perform public.replace_inventory_write_policy(permission_row.table_name, 'INSERT', permission_row.permission_key);
    perform public.replace_inventory_write_policy(permission_row.table_name, 'UPDATE', permission_row.permission_key);
    perform public.replace_inventory_write_policy(permission_row.table_name, 'DELETE', permission_row.permission_key);
  end loop;

  for permission_row in
    select * from (values
      ('scba_pack_assignments', 'scba_pack_assignment'),
      ('scba_cylinder_assignments', 'scba_cylinder_assignment'),
      ('ppe_assignments', 'ppe_assignment'),
      ('portable_radio_assignments', 'portable_radio_assignment'),
      ('portable_radio_mic_assignments', 'portable_radio_mic_assignment'),
      ('gas_monitor_assignments', 'gas_monitor_assignment'),
      ('ground_ladder_assignments', 'ground_ladder_assignment'),
      ('ems_equipment_assignments', 'ems_equipment_assignment'),
      ('fire_extinguisher_assignments', 'fire_extinguisher_assignment'),
      ('rope_assignments', 'rope_assignment'),
      ('thermal_imaging_camera_assignments', 'tic_assignment'),
      ('battery_assignments', 'battery_assignment'),
      ('pie_equipment_assignments', 'pie_equipment_assignment'),
      ('misc_fire_equipment_assignments', 'misc_fire_equipment_assignment')
    ) as permissions(table_name, permission_key)
  loop
    perform public.replace_inventory_write_policy(permission_row.table_name, 'INSERT', permission_row.permission_key);
    perform public.replace_inventory_write_policy(permission_row.table_name, 'UPDATE', permission_row.permission_key);
    perform public.replace_inventory_write_policy(permission_row.table_name, 'DELETE', permission_row.permission_key);
  end loop;
end;
$$;

drop function public.replace_inventory_write_policy(text, text, text);