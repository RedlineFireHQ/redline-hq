-- Track replacements as an auditable movement from an old lot to a new lot.
-- Total on-hand quantity is unchanged: old batch is reduced, new batch is received.
create table if not exists public.ems_supply_batch_replacements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  old_batch_id uuid not null references public.ems_supply_batches(id),
  new_batch_id uuid not null references public.ems_supply_batches(id),
  supply_item_id uuid not null references public.ems_supply_items(id),
  quantity numeric(12,2) not null check (quantity > 0),
  reason text,
  performed_by_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ems_supply_batch_replacements enable row level security;
drop policy if exists ems_supply_batch_replacements_select on public.ems_supply_batch_replacements;
create policy ems_supply_batch_replacements_select on public.ems_supply_batch_replacements
for select to authenticated using (exists (
  select 1 from public.auth_user_department_memberships m
  where m.auth_user_id = auth.uid() and m.department_id = ems_supply_batch_replacements.department_id
));
grant select on public.ems_supply_batch_replacements to authenticated;

create or replace function public.replace_ems_supply_batch(
  p_old_batch_id uuid,
  p_quantity numeric,
  p_new_expiration_date date,
  p_new_lot_number text default null,
  p_reason text default null
) returns table (replacement_id uuid, new_batch_id uuid)
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_member uuid;
  v_old public.ems_supply_batches%rowtype;
  v_new_id uuid;
  v_replacement_id uuid;
begin
  if v_user is null then raise exception 'Unauthorized.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Replacement quantity must be greater than zero.'; end if;
  if p_new_expiration_date is null then raise exception 'Enter the replacement expiration date.'; end if;

  select * into v_old from public.ems_supply_batches where id = p_old_batch_id for update;
  if not found then raise exception 'Original batch not found.'; end if;
  if p_quantity > v_old.quantity_remaining then raise exception 'Replacement quantity exceeds the remaining quantity in the original batch.'; end if;

  select m.id into v_member
  from public.auth_user_department_memberships x
  join public.members m on m.id = x.member_id
  where x.auth_user_id = v_user and x.department_id = v_old.department_id and m.active = true
  order by m.id limit 1;
  if v_member is null then raise exception 'This batch does not belong to your department.'; end if;
  if not public.member_has_app_permission(v_old.department_id, 'inventory_management') then
    raise exception 'You do not have permission to manage EMS inventory.';
  end if;

  update public.ems_supply_batches
  set quantity_remaining = quantity_remaining - p_quantity, updated_at = now()
  where id = v_old.id;

  insert into public.ems_supply_batches (
    department_id, supply_item_id, lot_number, quantity_received, quantity_remaining,
    expiration_date, storage_location, notes, created_by_member_id
  ) values (
    v_old.department_id, v_old.supply_item_id, nullif(btrim(p_new_lot_number), ''),
    p_quantity, p_quantity, p_new_expiration_date, v_old.storage_location,
    coalesce(nullif(btrim(p_reason), ''), 'Replacement for batch ' || coalesce(v_old.lot_number, v_old.id::text)),
    v_member
  ) returning id into v_new_id;

  insert into public.ems_supply_batch_replacements (
    department_id, old_batch_id, new_batch_id, supply_item_id, quantity, reason, performed_by_member_id
  ) values (
    v_old.department_id, v_old.id, v_new_id, v_old.supply_item_id, p_quantity,
    nullif(btrim(p_reason), ''), v_member
  ) returning id into v_replacement_id;

  return query select v_replacement_id, v_new_id;
end;
$$;

revoke all on function public.replace_ems_supply_batch(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.replace_ems_supply_batch(uuid, numeric, date, text, text) to authenticated;
