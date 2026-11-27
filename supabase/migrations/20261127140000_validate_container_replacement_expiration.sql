-- Prevent an expired lot from being recorded as a replacement in an EMS bag or drug box.
create or replace function public.replace_ems_container_item_batch(
  p_assignment_id uuid,
  p_quantity numeric,
  p_new_expiration_date date,
  p_new_lot_number text default null,
  p_reason text default null
)
returns table(replacement_id uuid, new_batch_id uuid, new_assignment_id uuid)
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user uuid := auth.uid();
  v_member uuid;
  v_assignment public.ems_container_item_batches%rowtype;
  v_old public.ems_supply_batches%rowtype;
  v_new_id uuid;
  v_new_assignment_id uuid;
  v_replacement_id uuid;
begin
  if v_user is null then raise exception 'Unauthorized.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Replacement quantity must be greater than zero.'; end if;
  if p_new_expiration_date is null then raise exception 'Enter the replacement expiration date.'; end if;
  if p_new_expiration_date < current_date then raise exception 'The replacement expiration date must be today or later.'; end if;

  select * into v_assignment
  from public.ems_container_item_batches
  where id = p_assignment_id
  for update;
  if not found then raise exception 'Bag or box assignment not found.'; end if;
  if p_quantity <> v_assignment.quantity_on_hand then
    raise exception 'Replace the full quantity assigned to this bag or box item.';
  end if;

  select * into v_old
  from public.ems_supply_batches
  where id = v_assignment.batch_id
    and department_id = v_assignment.department_id
  for update;
  if not found then raise exception 'Original supply batch not found.'; end if;
  if p_quantity > v_old.quantity_remaining then
    raise exception 'Replacement quantity exceeds the remaining quantity in the original batch.';
  end if;

  select m.id into v_member
  from public.auth_user_department_memberships x
  join public.members m on m.id = x.member_id
  where x.auth_user_id = v_user
    and x.department_id = v_assignment.department_id
    and m.active = true
  order by m.id limit 1;
  if v_member is null then raise exception 'This bag or box does not belong to your department.'; end if;
  if not coalesce(public.member_has_app_permission(v_assignment.department_id, 'inventory_management'), false) then
    raise exception 'You do not have permission to manage EMS inventory.';
  end if;

  update public.ems_supply_batches
  set quantity_remaining = quantity_remaining - p_quantity, updated_at = now()
  where id = v_old.id;

  update public.ems_container_item_batches
  set quantity_on_hand = quantity_on_hand - p_quantity, updated_at = now()
  where id = v_assignment.id;

  insert into public.ems_supply_batches (
    department_id, supply_item_id, lot_number, quantity_received, quantity_remaining,
    expiration_date, storage_location, notes, created_by_member_id
  ) values (
    v_old.department_id, v_old.supply_item_id, nullif(btrim(p_new_lot_number), ''),
    p_quantity, p_quantity, p_new_expiration_date, v_old.storage_location,
    coalesce(nullif(btrim(p_reason), ''), 'Replacement for EMS container assignment ' || v_assignment.id::text),
    v_member
  ) returning id into v_new_id;

  insert into public.ems_container_item_batches (
    department_id, container_type, container_id, template_item_key, item_label,
    batch_id, quantity_on_hand
  ) values (
    v_assignment.department_id, v_assignment.container_type, v_assignment.container_id,
    v_assignment.template_item_key, v_assignment.item_label, v_new_id, p_quantity
  ) returning id into v_new_assignment_id;

  insert into public.ems_supply_batch_replacements (
    department_id, old_batch_id, new_batch_id, supply_item_id, quantity, reason, performed_by_member_id
  ) values (
    v_old.department_id, v_old.id, v_new_id, v_old.supply_item_id, p_quantity,
    nullif(btrim(p_reason), ''), v_member
  ) returning id into v_replacement_id;

  return query select v_replacement_id, v_new_id, v_new_assignment_id;
end;
$function$;

revoke all on function public.replace_ems_container_item_batch(uuid, numeric, date, text, text) from public;
grant execute on function public.replace_ems_container_item_batch(uuid, numeric, date, text, text) to authenticated;
