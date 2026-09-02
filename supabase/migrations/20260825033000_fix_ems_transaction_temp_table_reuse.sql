create or replace function public.apply_ems_supply_transaction(
  p_transaction_type text,
  p_items jsonb,
  p_destination_type text default null,
  p_destination_apparatus_id uuid default null,
  p_destination_label text default null,
  p_notes text default null
)
returns table (
  transaction_id uuid,
  department_id uuid,
  transaction_type text,
  item_count integer,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_department_ids uuid[];
  v_department_id uuid;
  v_member_id uuid;
  v_destination_label text;
  v_transaction_id uuid;
  v_occurred_at timestamptz := now();
  v_item jsonb;
  v_item_id_text text;
  v_item_id uuid;
  v_quantity_text text;
  v_quantity_requested numeric(12,2);
  v_item_count integer := 0;
  v_found_count integer := 0;
  v_apparatus_valid boolean := false;
  v_delta numeric(12,2);
  v_quantity_after numeric(12,2);
  v_locked record;
begin
  if v_auth_user_id is null then
    raise exception 'Unauthorized.';
  end if;

  if p_transaction_type not in ('Checkout', 'Restock', 'Return') then
    raise exception 'Invalid transaction type.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one supply item is required.';
  end if;

  drop table if exists _ems_requested_items;

  create temporary table _ems_requested_items (
    supply_item_id uuid primary key,
    quantity_requested numeric(12,2) not null
  ) on commit drop;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid item payload.';
    end if;

    v_item_id_text := btrim(coalesce(v_item ->> 'supply_item_id', ''));
    if v_item_id_text = '' then
      raise exception 'Supply item id is required.';
    end if;

    begin
      v_item_id := v_item_id_text::uuid;
    exception when others then
      raise exception 'Invalid supply item id.';
    end;

    v_quantity_text := btrim(coalesce(v_item ->> 'quantity', ''));
    if v_quantity_text = '' then
      raise exception 'Quantity is required.';
    end if;

    begin
      v_quantity_requested := v_quantity_text::numeric(12,2);
    exception when others then
      raise exception 'Invalid quantity value.';
    end;

    if v_quantity_requested <= 0 then
      raise exception 'Quantity must be greater than zero.';
    end if;

    if exists (
      select 1
      from _ems_requested_items r
      where r.supply_item_id = v_item_id
    ) then
      raise exception 'Duplicate supply item in transaction.';
    end if;

    insert into _ems_requested_items (supply_item_id, quantity_requested)
    values (v_item_id, v_quantity_requested);
  end loop;

  select count(*)
  into v_item_count
  from _ems_requested_items;

  select array_agg(distinct s.department_id)
  into v_department_ids
  from public.ems_supply_items s
  join _ems_requested_items r
    on r.supply_item_id = s.id;

  if v_department_ids is null or coalesce(array_length(v_department_ids, 1), 0) = 0 then
    raise exception 'Supply item not found.';
  end if;

  if array_length(v_department_ids, 1) > 1 then
    raise exception 'All supply items must belong to the same department.';
  end if;

  v_department_id := v_department_ids[1];

  select count(*)
  into v_found_count
  from public.ems_supply_items s
  join _ems_requested_items r
    on r.supply_item_id = s.id
  where s.department_id = v_department_id;

  if v_found_count <> v_item_count then
    raise exception 'Supply item not found.';
  end if;

  select audm.member_id
  into v_member_id
  from public.auth_user_department_memberships audm
  join public.members m
    on m.id = audm.member_id
  where audm.auth_user_id = v_auth_user_id
    and audm.department_id = v_department_id
    and coalesce(m.active, false) = true
  order by m.id
  limit 1;

  if v_member_id is null then
    raise exception 'Supply item does not belong to your department.';
  end if;

  v_destination_label := nullif(btrim(coalesce(p_destination_label, '')), '');

  if p_destination_type is null then
    if p_destination_apparatus_id is not null or v_destination_label is not null then
      raise exception 'Destination type is required when destination details are provided.';
    end if;
  elsif p_destination_type not in ('Apparatus', 'Station', 'SupplyRoom', 'Other', 'None') then
    raise exception 'Invalid destination type.';
  elsif p_destination_type = 'None' then
    if p_destination_apparatus_id is not null or v_destination_label is not null then
      raise exception 'Destination None cannot include apparatus or label.';
    end if;
  elsif p_destination_type = 'Apparatus' then
    if p_destination_apparatus_id is null then
      raise exception 'Destination apparatus id is required for Apparatus destination type.';
    end if;

    select exists (
      select 1
      from public.apparatus a
      where a.id = p_destination_apparatus_id
        and a.department_id = v_department_id
    ) into v_apparatus_valid;

    if not v_apparatus_valid then
      raise exception 'Apparatus destination does not belong to this department.';
    end if;

    if v_destination_label is not null then
      raise exception 'Destination label is not allowed for Apparatus destination type.';
    end if;
  else
    if p_destination_apparatus_id is not null then
      raise exception 'Destination apparatus id is only allowed for Apparatus destination type.';
    end if;

    if v_destination_label is null then
      raise exception 'Destination label is required for this destination type.';
    end if;
  end if;

  for v_locked in
    select s.id, s.quantity_on_hand, s.unit_of_measure, r.quantity_requested
    from public.ems_supply_items s
    join _ems_requested_items r
      on r.supply_item_id = s.id
    where s.department_id = v_department_id
    order by s.id
    for update
  loop
    if p_transaction_type = 'Checkout' and v_locked.quantity_requested > v_locked.quantity_on_hand then
      raise exception 'Insufficient quantity available.';
    end if;
  end loop;

  insert into public.ems_supply_transactions (
    department_id,
    transaction_type,
    performed_by_member_id,
    destination_type,
    destination_apparatus_id,
    destination_label,
    notes,
    occurred_at
  )
  values (
    v_department_id,
    p_transaction_type,
    v_member_id,
    p_destination_type,
    p_destination_apparatus_id,
    v_destination_label,
    p_notes,
    v_occurred_at
  )
  returning id into v_transaction_id;

  for v_locked in
    select s.id, s.quantity_on_hand, s.unit_of_measure, r.quantity_requested
    from public.ems_supply_items s
    join _ems_requested_items r
      on r.supply_item_id = s.id
    where s.department_id = v_department_id
    order by s.id
    for update
  loop
    if p_transaction_type = 'Checkout' then
      v_delta := v_locked.quantity_requested * -1;
    else
      v_delta := v_locked.quantity_requested;
    end if;

    v_quantity_after := v_locked.quantity_on_hand + v_delta;

    if v_quantity_after < 0 then
      raise exception 'Insufficient quantity available.';
    end if;

    update public.ems_supply_items
    set quantity_on_hand = v_quantity_after,
        updated_by_member_id = v_member_id
    where id = v_locked.id
      and public.ems_supply_items.department_id = v_department_id;

    insert into public.ems_supply_transaction_items (
      transaction_id,
      department_id,
      supply_item_id,
      unit_of_measure,
      quantity_delta,
      quantity_before,
      quantity_after
    )
    values (
      v_transaction_id,
      v_department_id,
      v_locked.id,
      v_locked.unit_of_measure,
      v_delta,
      v_locked.quantity_on_hand,
      v_quantity_after
    );
  end loop;

  return query
  select
    v_transaction_id,
    v_department_id,
    p_transaction_type,
    v_item_count,
    v_occurred_at;
end;
$$;

revoke all on function public.apply_ems_supply_transaction(text, jsonb, text, uuid, text, text) from public;
revoke all on function public.apply_ems_supply_transaction(text, jsonb, text, uuid, text, text) from anon;
grant execute on function public.apply_ems_supply_transaction(text, jsonb, text, uuid, text, text) to authenticated;
