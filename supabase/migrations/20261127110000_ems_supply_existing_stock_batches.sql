-- Let departments assign existing on-hand stock to expiry lots without
-- accidentally increasing inventory during first-time setup.
create table if not exists public.ems_supply_batch_opening_balances (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  batch_id uuid not null references public.ems_supply_batches(id),
  supply_item_id uuid not null references public.ems_supply_items(id),
  quantity numeric(12,2) not null check (quantity > 0),
  performed_by_member_id uuid references public.members(id) on delete set null,
  recorded_at timestamptz not null default now()
);
alter table public.ems_supply_batch_opening_balances enable row level security;
drop policy if exists ems_supply_batch_opening_balances_select on public.ems_supply_batch_opening_balances;
create policy ems_supply_batch_opening_balances_select on public.ems_supply_batch_opening_balances
for select to authenticated using (exists (
  select 1 from public.auth_user_department_memberships m
  where m.auth_user_id = auth.uid()
    and m.department_id = ems_supply_batch_opening_balances.department_id
));
grant select on public.ems_supply_batch_opening_balances to authenticated;

create or replace function public.record_existing_ems_supply_batch(
  p_supply_item_id uuid,
  p_quantity numeric,
  p_expiration_date date default null,
  p_lot_number text default null,
  p_storage_location text default null,
  p_notes text default null
) returns table (batch_id uuid, quantity_untracked numeric)
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_department_id uuid;
  v_member_id uuid;
  v_on_hand numeric(12,2);
  v_tracked numeric(12,2);
  v_untracked numeric(12,2);
  v_batch_id uuid;
begin
  if v_user is null then raise exception 'Unauthorized.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;

  select s.department_id, s.quantity_on_hand
    into v_department_id, v_on_hand
  from public.ems_supply_items s
  where s.id = p_supply_item_id
  for update;
  if v_department_id is null then raise exception 'Supply item not found.'; end if;

  select audm.member_id into v_member_id
  from public.auth_user_department_memberships audm
  join public.members m on m.id = audm.member_id
  where audm.auth_user_id = v_user
    and audm.department_id = v_department_id
    and coalesce(m.active, false) = true
  order by m.id limit 1;
  if v_member_id is null then raise exception 'Supply item does not belong to your department.'; end if;
  if not coalesce(public.member_has_app_permission(v_department_id, 'inventory_management'), false) then
    raise exception 'You do not have permission to manage EMS inventory.';
  end if;

  select coalesce(sum(b.quantity_remaining), 0)
    into v_tracked
  from public.ems_supply_batches b
  where b.department_id = v_department_id
    and b.supply_item_id = p_supply_item_id;

  v_untracked := greatest(v_on_hand - v_tracked, 0);
  if p_quantity > v_untracked then
    raise exception 'Only % of existing stock is not yet assigned to an expiration batch.', v_untracked;
  end if;

  insert into public.ems_supply_batches (
    department_id, supply_item_id, lot_number, quantity_received,
    quantity_remaining, expiration_date, storage_location, notes,
    created_by_member_id
  ) values (
    v_department_id, p_supply_item_id, nullif(btrim(p_lot_number), ''),
    p_quantity, p_quantity, p_expiration_date,
    nullif(btrim(p_storage_location), ''),
    coalesce(nullif(btrim(p_notes), ''), 'Existing on-hand stock assigned to expiration tracking; quantity unchanged'),
    v_member_id
  ) returning id into v_batch_id;

  insert into public.ems_supply_batch_opening_balances (
    department_id, batch_id, supply_item_id, quantity, performed_by_member_id
  ) values (v_department_id, v_batch_id, p_supply_item_id, p_quantity, v_member_id);

  return query select v_batch_id, v_untracked - p_quantity;
end;
$$;

revoke all on function public.record_existing_ems_supply_batch(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.record_existing_ems_supply_batch(uuid, numeric, date, text, text, text) to authenticated;
