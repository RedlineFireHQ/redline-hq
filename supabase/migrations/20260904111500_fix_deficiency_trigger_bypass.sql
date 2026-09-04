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
  if session_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role' then
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
