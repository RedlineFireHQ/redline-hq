insert into public.app_permissions (key, label, description, sort_order)
values
  ('deficiency_edit_any', 'Deficiency Edit (Any)', 'Edit any deficiency in the department.', 69),
  ('deficiency_resolve', 'Deficiency Resolve', 'Resolve deficiencies in the department.', 71),
  ('deficiency_management', 'Deficiency Management (Legacy)', 'Legacy combined deficiency permission. Grants edit and resolve access for compatibility.', 72)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;

alter table public.deficiencies enable row level security;
alter table public.deficiency_history enable row level security;

create or replace function public.resolve_deficiency_department_id_from_links(
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
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select a.department_id from public.apparatus a where a.id = p_apparatus_id limit 1),
    (select h.department_id from public.fire_hose h where h.id = p_fire_hose_id limit 1),
    (select c.department_id from public.scba_cylinders c where c.id = p_scba_cylinder_id limit 1),
    (select p.department_id from public.scba_packs p where p.id = p_scba_pack_id limit 1),
    (select pie.department_id from public.pie_equipment pie where pie.id = p_pie_equipment_id limit 1),
    (select ems.department_id from public.ems_equipment ems where ems.id = p_ems_equipment_id limit 1),
    (select ppe.department_id from public.ppe_items ppe where ppe.id = p_ppe_item_id limit 1),
    (select rope.department_id from public.rope_items rope where rope.id = p_rope_item_id limit 1),
    (select fe.department_id from public.fire_extinguishers fe where fe.id = p_fire_extinguisher_id limit 1),
    (select mfe.department_id from public.misc_fire_equipment mfe where mfe.id = p_misc_fire_equipment_id limit 1),
    (select gm.department_id from public.gas_monitors gm where gm.id = p_gas_monitor_id limit 1),
    (select b.department_id from public.batteries b where b.id = p_battery_id limit 1),
    (select tic.department_id from public.thermal_imaging_cameras tic where tic.id = p_thermal_imaging_camera_id limit 1),
    (select gl.department_id from public.ground_ladders gl where gl.id = p_ground_ladder_id limit 1),
    (select m.department_id from public.members m where m.id = p_reported_by limit 1)
  );
$$;

revoke all on function public.resolve_deficiency_department_id_from_links(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public;
grant execute on function public.resolve_deficiency_department_id_from_links(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

create or replace function public.can_view_deficiency_row(
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
begin
  v_department_id := public.resolve_deficiency_department_id_from_links(
    p_apparatus_id,
    p_fire_hose_id,
    p_scba_cylinder_id,
    p_scba_pack_id,
    p_pie_equipment_id,
    p_ems_equipment_id,
    p_ppe_item_id,
    p_rope_item_id,
    p_fire_extinguisher_id,
    p_misc_fire_equipment_id,
    p_gas_monitor_id,
    p_battery_id,
    p_thermal_imaging_camera_id,
    p_ground_ladder_id,
    p_reported_by
  );

  if v_department_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.resolve_requesting_member_access_context() ctx
    where ctx.department_id = v_department_id
  );
end;
$$;

revoke all on function public.can_view_deficiency_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public;
grant execute on function public.can_view_deficiency_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

create or replace function public.can_edit_deficiency_row(
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
begin
  v_department_id := public.resolve_deficiency_department_id_from_links(
    p_apparatus_id,
    p_fire_hose_id,
    p_scba_cylinder_id,
    p_scba_pack_id,
    p_pie_equipment_id,
    p_ems_equipment_id,
    p_ppe_item_id,
    p_rope_item_id,
    p_fire_extinguisher_id,
    p_misc_fire_equipment_id,
    p_gas_monitor_id,
    p_battery_id,
    p_thermal_imaging_camera_id,
    p_ground_ladder_id,
    p_reported_by
  );

  if v_department_id is null then
    return false;
  end if;

  select ctx.member_id
  into v_member_id
  from public.resolve_requesting_member_access_context() ctx
  where ctx.department_id = v_department_id
  limit 1;

  if v_member_id is null then
    return false;
  end if;

  if p_reported_by = v_member_id then
    return true;
  end if;

  return public.member_has_app_permission(v_department_id, 'deficiency_edit_any')
    or public.member_has_app_permission(v_department_id, 'deficiency_management');
end;
$$;

revoke all on function public.can_edit_deficiency_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public;
grant execute on function public.can_edit_deficiency_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

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
begin
  v_department_id := public.resolve_deficiency_department_id_from_links(
    p_apparatus_id,
    p_fire_hose_id,
    p_scba_cylinder_id,
    p_scba_pack_id,
    p_pie_equipment_id,
    p_ems_equipment_id,
    p_ppe_item_id,
    p_rope_item_id,
    p_fire_extinguisher_id,
    p_misc_fire_equipment_id,
    p_gas_monitor_id,
    p_battery_id,
    p_thermal_imaging_camera_id,
    p_ground_ladder_id,
    p_reported_by
  );

  if v_department_id is null then
    return false;
  end if;

  return public.member_has_app_permission(v_department_id, 'deficiency_resolve')
    or public.member_has_app_permission(v_department_id, 'deficiency_management');
end;
$$;

revoke all on function public.can_resolve_deficiency_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public;
grant execute on function public.can_resolve_deficiency_row(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

create or replace function public.can_view_deficiency(
  p_deficiency_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_view_deficiency_row(
    d.apparatus_id,
    d.fire_hose_id,
    d.scba_cylinder_id,
    d.scba_pack_id,
    d.pie_equipment_id,
    d.ems_equipment_id,
    d.ppe_item_id,
    d.rope_item_id,
    d.fire_extinguisher_id,
    d.misc_fire_equipment_id,
    d.gas_monitor_id,
    d.battery_id,
    d.thermal_imaging_camera_id,
    d.ground_ladder_id,
    d.reported_by
  )
  from public.deficiencies d
  where d.id = p_deficiency_id
  limit 1;
$$;

revoke all on function public.can_view_deficiency(uuid) from public;
grant execute on function public.can_view_deficiency(uuid) to authenticated;

create or replace function public.can_edit_deficiency(
  p_deficiency_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_edit_deficiency_row(
    d.apparatus_id,
    d.fire_hose_id,
    d.scba_cylinder_id,
    d.scba_pack_id,
    d.pie_equipment_id,
    d.ems_equipment_id,
    d.ppe_item_id,
    d.rope_item_id,
    d.fire_extinguisher_id,
    d.misc_fire_equipment_id,
    d.gas_monitor_id,
    d.battery_id,
    d.thermal_imaging_camera_id,
    d.ground_ladder_id,
    d.reported_by
  )
  from public.deficiencies d
  where d.id = p_deficiency_id
  limit 1;
$$;

revoke all on function public.can_edit_deficiency(uuid) from public;
grant execute on function public.can_edit_deficiency(uuid) to authenticated;

create or replace function public.can_resolve_deficiency(
  p_deficiency_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_resolve_deficiency_row(
    d.apparatus_id,
    d.fire_hose_id,
    d.scba_cylinder_id,
    d.scba_pack_id,
    d.pie_equipment_id,
    d.ems_equipment_id,
    d.ppe_item_id,
    d.rope_item_id,
    d.fire_extinguisher_id,
    d.misc_fire_equipment_id,
    d.gas_monitor_id,
    d.battery_id,
    d.thermal_imaging_camera_id,
    d.ground_ladder_id,
    d.reported_by
  )
  from public.deficiencies d
  where d.id = p_deficiency_id
  limit 1;
$$;

revoke all on function public.can_resolve_deficiency(uuid) from public;
grant execute on function public.can_resolve_deficiency(uuid) to authenticated;

create or replace function public.enforce_deficiency_update_authorization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_edit boolean;
  v_can_resolve boolean;
  v_resolved_status_id uuid;
begin
  if current_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  v_can_edit := public.can_edit_deficiency_row(
    old.apparatus_id,
    old.fire_hose_id,
    old.scba_cylinder_id,
    old.scba_pack_id,
    old.pie_equipment_id,
    old.ems_equipment_id,
    old.ppe_item_id,
    old.rope_item_id,
    old.fire_extinguisher_id,
    old.misc_fire_equipment_id,
    old.gas_monitor_id,
    old.battery_id,
    old.thermal_imaging_camera_id,
    old.ground_ladder_id,
    old.reported_by
  );

  v_can_resolve := public.can_resolve_deficiency_row(
    old.apparatus_id,
    old.fire_hose_id,
    old.scba_cylinder_id,
    old.scba_pack_id,
    old.pie_equipment_id,
    old.ems_equipment_id,
    old.ppe_item_id,
    old.rope_item_id,
    old.fire_extinguisher_id,
    old.misc_fire_equipment_id,
    old.gas_monitor_id,
    old.battery_id,
    old.thermal_imaging_camera_id,
    old.ground_ladder_id,
    old.reported_by
  );

  if not v_can_edit and not v_can_resolve then
    raise exception 'Forbidden: deficiency update permission is required.';
  end if;

  if not v_can_edit then
    if (to_jsonb(new) - array['status', 'resolved_by', 'resolved_at', 'repair_notes', 'updated_at'])
      is distinct from
      (to_jsonb(old) - array['status', 'resolved_by', 'resolved_at', 'repair_notes', 'updated_at']) then
      raise exception 'Forbidden: only users with deficiency edit permission may change deficiency details.';
    end if;
  end if;

  if not v_can_resolve then
    if new.resolved_by is distinct from old.resolved_by
      or new.resolved_at is distinct from old.resolved_at
      or new.repair_notes is distinct from old.repair_notes then
      raise exception 'Forbidden: deficiency resolve permission is required.';
    end if;

    select ds.id
    into v_resolved_status_id
    from public.deficiency_statuses ds
    where lower(coalesce(ds.name, '')) = 'resolved'
    order by ds.display_order asc nulls last
    limit 1;

    if v_resolved_status_id is not null
      and (
        (new.status = v_resolved_status_id and old.status is distinct from v_resolved_status_id)
        or (old.status = v_resolved_status_id and new.status is distinct from v_resolved_status_id)
      ) then
      raise exception 'Forbidden: deficiency resolve permission is required to set or clear resolved status.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_deficiency_update_authorization on public.deficiencies;
create trigger trg_enforce_deficiency_update_authorization
before update on public.deficiencies
for each row
execute function public.enforce_deficiency_update_authorization();

do $$
declare
  policy_row record;
begin
  for policy_row in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'deficiencies'
  loop
    execute format('drop policy if exists %I on public.deficiencies', policy_row.policyname);
  end loop;

  for policy_row in
    select p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'deficiency_history'
  loop
    execute format('drop policy if exists %I on public.deficiency_history', policy_row.policyname);
  end loop;
end
$$;

create policy deficiencies_select_by_department_member
on public.deficiencies
for select
to authenticated
using (
  public.can_view_deficiency_row(
    apparatus_id,
    fire_hose_id,
    scba_cylinder_id,
    scba_pack_id,
    pie_equipment_id,
    ems_equipment_id,
    ppe_item_id,
    rope_item_id,
    fire_extinguisher_id,
    misc_fire_equipment_id,
    gas_monitor_id,
    battery_id,
    thermal_imaging_camera_id,
    ground_ladder_id,
    reported_by
  )
);

create policy deficiencies_insert_by_department_member
on public.deficiencies
for insert
to authenticated
with check (
  reported_by in (
    select ctx.member_id
    from public.resolve_requesting_member_access_context() ctx
  )
  and public.can_view_deficiency_row(
    apparatus_id,
    fire_hose_id,
    scba_cylinder_id,
    scba_pack_id,
    pie_equipment_id,
    ems_equipment_id,
    ppe_item_id,
    rope_item_id,
    fire_extinguisher_id,
    misc_fire_equipment_id,
    gas_monitor_id,
    battery_id,
    thermal_imaging_camera_id,
    ground_ladder_id,
    reported_by
  )
);

create policy deficiencies_update_by_edit_or_resolve_permission
on public.deficiencies
for update
to authenticated
using (
  public.can_edit_deficiency_row(
    apparatus_id,
    fire_hose_id,
    scba_cylinder_id,
    scba_pack_id,
    pie_equipment_id,
    ems_equipment_id,
    ppe_item_id,
    rope_item_id,
    fire_extinguisher_id,
    misc_fire_equipment_id,
    gas_monitor_id,
    battery_id,
    thermal_imaging_camera_id,
    ground_ladder_id,
    reported_by
  )
  or public.can_resolve_deficiency_row(
    apparatus_id,
    fire_hose_id,
    scba_cylinder_id,
    scba_pack_id,
    pie_equipment_id,
    ems_equipment_id,
    ppe_item_id,
    rope_item_id,
    fire_extinguisher_id,
    misc_fire_equipment_id,
    gas_monitor_id,
    battery_id,
    thermal_imaging_camera_id,
    ground_ladder_id,
    reported_by
  )
)
with check (
  public.can_view_deficiency_row(
    apparatus_id,
    fire_hose_id,
    scba_cylinder_id,
    scba_pack_id,
    pie_equipment_id,
    ems_equipment_id,
    ppe_item_id,
    rope_item_id,
    fire_extinguisher_id,
    misc_fire_equipment_id,
    gas_monitor_id,
    battery_id,
    thermal_imaging_camera_id,
    ground_ladder_id,
    reported_by
  )
);

create policy deficiency_history_select_by_department_member
on public.deficiency_history
for select
to authenticated
using (
  public.can_view_deficiency(deficiency_id)
);

create policy deficiency_history_insert_by_edit_or_resolve_permission
on public.deficiency_history
for insert
to authenticated
with check (
  public.can_edit_deficiency(deficiency_id)
  or public.can_resolve_deficiency(deficiency_id)
);
