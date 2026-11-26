-- Restrict batch receipt to members with inventory-management permission.
create or replace function public.receive_ems_supply_batch(
  p_supply_item_id uuid,
  p_quantity numeric,
  p_expiration_date date default null,
  p_lot_number text default null,
  p_storage_location text default null,
  p_notes text default null
)
returns table(batch_id uuid, transaction_id uuid, quantity_after numeric)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_department_id uuid;
  v_member_id uuid;
  v_quantity_before numeric(12,2);
  v_quantity_after numeric(12,2);
  v_unit text;
  v_transaction_id uuid;
  v_batch_id uuid;
begin
  if v_auth_user_id is null then raise exception 'Unauthorized.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;

  select s.department_id, s.quantity_on_hand, s.unit_of_measure
    into v_department_id, v_quantity_before, v_unit
  from public.ems_supply_items s
  where s.id = p_supply_item_id
  for update;

  if v_department_id is null then raise exception 'Supply item not found.'; end if;

  select audm.member_id into v_member_id
  from public.auth_user_department_memberships audm
  join public.members m on m.id = audm.member_id
  where audm.auth_user_id = v_auth_user_id
    and audm.department_id = v_department_id
    and coalesce(m.active, false) = true
  order by m.id limit 1;

  if v_member_id is null then raise exception 'Supply item does not belong to your department.'; end if;
  if not public.member_has_app_permission(v_department_id, 'inventory_management') then
    raise exception 'You do not have permission to manage EMS inventory.';
  end if;

  v_quantity_after := v_quantity_before + p_quantity;

  insert into public.ems_supply_transactions (
    department_id, transaction_type, performed_by_member_id, notes, occurred_at
  ) values (
    v_department_id, 'Restock', v_member_id,
    coalesce(nullif(btrim(p_notes), ''), 'Received tracked supply batch'),
    now()
  ) returning id into v_transaction_id;

  update public.ems_supply_items
  set quantity_on_hand = v_quantity_after,
      updated_by_member_id = v_member_id
  where id = p_supply_item_id;

  insert into public.ems_supply_transaction_items (
    transaction_id, department_id, supply_item_id, unit_of_measure,
    quantity_delta, quantity_before, quantity_after
  ) values (
    v_transaction_id, v_department_id, p_supply_item_id, v_unit,
    p_quantity, v_quantity_before, v_quantity_after
  );

  insert into public.ems_supply_batches (
    department_id, supply_item_id, lot_number, quantity_received,
    quantity_remaining, expiration_date, storage_location, notes,
    created_by_member_id
  ) values (
    v_department_id, p_supply_item_id, nullif(btrim(p_lot_number), ''),
    p_quantity, p_quantity, p_expiration_date,
    nullif(btrim(p_storage_location), ''), nullif(btrim(p_notes), ''),
    v_member_id
  ) returning id into v_batch_id;

  return query select v_batch_id, v_transaction_id, v_quantity_after;
end;
$function$;

revoke all on function public.receive_ems_supply_batch(uuid,numeric,date,text,text,text) from public;
grant execute on function public.receive_ems_supply_batch(uuid,numeric,date,text,text,text) to authenticated;
