create or replace function public.can_update_fire_hose_record(
  p_id uuid,
  p_department_id uuid,
  p_inventory_number text,
  p_hose_size numeric,
  p_hose_length integer,
  p_booster_reel boolean,
  p_in_service_date date,
  p_status text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_existing public.fire_hose%rowtype;
begin
  if not exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = p_department_id
  ) then
    return false;
  end if;

  if public.member_has_app_permission(p_department_id, 'inventory_management') then
    return true;
  end if;

  select *
  into v_existing
  from public.fire_hose
  where id = p_id
    and department_id = p_department_id
  limit 1;

  if v_existing.id is null then
    return false;
  end if;

  return v_existing.inventory_number is not distinct from p_inventory_number
    and v_existing.hose_size is not distinct from p_hose_size
    and v_existing.hose_length is not distinct from p_hose_length
    and v_existing.booster_reel is not distinct from p_booster_reel
    and v_existing.in_service_date is not distinct from p_in_service_date
    and coalesce(p_status, '') <> 'Retired';
end;
$$;

revoke all on function public.can_update_fire_hose_record(uuid, uuid, text, numeric, integer, boolean, date, text) from public;
revoke all on function public.can_update_fire_hose_record(uuid, uuid, text, numeric, integer, boolean, date, text) from anon;
grant execute on function public.can_update_fire_hose_record(uuid, uuid, text, numeric, integer, boolean, date, text) to authenticated;

drop policy if exists fire_hose_insert_by_department on public.fire_hose;
create policy fire_hose_insert_by_department
on public.fire_hose
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists fire_hose_update_by_department on public.fire_hose;
create policy fire_hose_update_by_department
on public.fire_hose
for update
to authenticated
using (
  public.can_update_fire_hose_record(
    id,
    department_id,
    inventory_number,
    hose_size,
    hose_length,
    booster_reel,
    in_service_date,
    status
  )
)
with check (
  public.can_update_fire_hose_record(
    id,
    department_id,
    inventory_number,
    hose_size,
    hose_length,
    booster_reel,
    in_service_date,
    status
  )
);