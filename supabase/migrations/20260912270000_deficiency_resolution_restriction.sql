alter table public.departments
  add column if not exists restrict_deficiency_resolution boolean not null default false;

comment on column public.departments.restrict_deficiency_resolution is
  'When true, resolving deficiencies requires deficiency_resolve or legacy deficiency_management; when false, any active same-department member may resolve.';

create or replace function public.can_resolve_deficiency_row(
  p_apparatus_id uuid,
  p_fire_hose_id uuid,
  p_scba_cylinder_id uuid,
  p_scba_pack_id uuid,
  p_pie_equipment_id uuid,
  p_ems_equipment_id uuid,
  p_ppe_item_id uuid,
  p_rope_item_id uuid,
  p_fire_extinguisher_id uuid,
  p_misc_fire_equipment_id uuid,
  p_gas_monitor_id uuid,
  p_battery_id uuid,
  p_thermal_imaging_camera_id uuid,
  p_ground_ladder_id uuid,
  p_reported_by uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_member_id uuid;
  v_restrict_resolution boolean;
begin
  v_department_id := public.resolve_deficiency_department_id_from_links(
    p_apparatus_id, p_fire_hose_id, p_scba_cylinder_id, p_scba_pack_id,
    p_pie_equipment_id, p_ems_equipment_id, p_ppe_item_id, p_rope_item_id,
    p_fire_extinguisher_id, p_misc_fire_equipment_id, p_gas_monitor_id,
    p_battery_id, p_thermal_imaging_camera_id, p_ground_ladder_id, p_reported_by
  );

  if v_department_id is null then
    return false;
  end if;

  select ctx.member_id
  into v_member_id
  from public.resolve_requesting_member_access_context() ctx
  join public.members m on m.id = ctx.member_id
  where ctx.department_id = v_department_id
    and coalesce(m.active, false) = true
  limit 1;

  if v_member_id is null then
    return false;
  end if;

  select coalesce(d.restrict_deficiency_resolution, false)
  into v_restrict_resolution
  from public.departments d
  where d.id = v_department_id;

  if not coalesce(v_restrict_resolution, false) then
    return true;
  end if;

  return public.member_has_app_permission(v_department_id, 'deficiency_resolve')
    or public.member_has_app_permission(v_department_id, 'deficiency_management');
end;
$$;

revoke all on function public.can_resolve_deficiency_row(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public;
grant execute on function public.can_resolve_deficiency_row(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.set_restrict_deficiency_resolution(
  p_department_id uuid,
  p_restricted boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.member_has_app_permission(p_department_id, 'settings_management') then
    raise exception 'Forbidden: settings management permission is required.';
  end if;

  update public.departments
  set restrict_deficiency_resolution = coalesce(p_restricted, false)
  where id = p_department_id;

  if not found then
    raise exception 'Department not found.';
  end if;

  return coalesce(p_restricted, false);
end;
$$;

comment on function public.set_restrict_deficiency_resolution(uuid, boolean) is
  'Updates only the department-level deficiency-resolution restriction and requires settings_management or administrator bypass.';

revoke all on function public.set_restrict_deficiency_resolution(uuid, boolean) from public;
revoke all on function public.set_restrict_deficiency_resolution(uuid, boolean) from anon;
grant execute on function public.set_restrict_deficiency_resolution(uuid, boolean) to authenticated;

drop policy if exists deficiency_history_insert_by_edit_or_resolve_permission on public.deficiency_history;
create policy deficiency_history_insert_by_edit_or_resolve_permission
on public.deficiency_history
for insert
to authenticated
with check (
  public.can_edit_deficiency(deficiency_id)
  or public.can_resolve_deficiency(deficiency_id)
);