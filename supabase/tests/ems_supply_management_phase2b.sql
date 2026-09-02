begin;

do $$
declare
  v_dept_id uuid;
  v_admin_member_id uuid;
  v_admin_auth_user_id uuid;
  v_non_admin_member_id uuid;
  v_non_admin_auth_user_id uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_before_qty numeric(12,2);
  v_after_qty numeric(12,2);
  v_tx_count_before integer;
  v_tx_count_after integer;
  v_msg text;
begin
  select m.department_id, m.id, m.auth_user_id
  into v_dept_id, v_admin_member_id, v_admin_auth_user_id
  from public.members m
  where coalesce(m.active, false) = true
    and m.auth_user_id is not null
    and lower(coalesce(m.role, '')) = 'administrator'
  order by m.created_at
  limit 1;

  if v_dept_id is null or v_admin_member_id is null or v_admin_auth_user_id is null then
    raise exception 'Phase 2B tests require an active administrator with auth_user_id.';
  end if;

  select m.id, m.auth_user_id
  into v_non_admin_member_id, v_non_admin_auth_user_id
  from public.members m
  where m.department_id = v_dept_id
    and coalesce(m.active, false) = true
    and m.auth_user_id is not null
    and lower(coalesce(m.role, '')) <> 'administrator'
  order by m.created_at
  limit 1;

  if v_non_admin_member_id is null or v_non_admin_auth_user_id is null then
    raise exception 'Phase 2B tests require an active non-admin member with auth_user_id in the same department.';
  end if;

  insert into public.ems_supply_items (
    department_id,
    item_name,
    item_category,
    unit_of_measure,
    quantity_on_hand,
    reorder_threshold,
    critical_threshold,
    target_quantity,
    location,
    notes,
    status,
    qr_identifier,
    created_by_member_id,
    updated_by_member_id
  ) values
    (
      v_dept_id,
      'PH2B Item A',
      'IV Supplies',
      'each',
      0,
      10,
      2,
      20,
      'Cabinet 1',
      'PH2B setup',
      'Active',
      'PH2B-A-' || replace(gen_random_uuid()::text, '-', ''),
      v_admin_member_id,
      v_admin_member_id
    ),
    (
      v_dept_id,
      'PH2B Item B',
      'Bandaging',
      'box',
      5,
      2,
      1,
      8,
      'Cabinet 2',
      'PH2B setup',
      'Active',
      'PH2B-B-' || replace(gen_random_uuid()::text, '-', ''),
      v_admin_member_id,
      v_admin_member_id
    );

  select id into v_item_a from public.ems_supply_items where item_name = 'PH2B Item A' order by created_at desc limit 1;
  select id into v_item_b from public.ems_supply_items where item_name = 'PH2B Item B' order by created_at desc limit 1;

  if v_item_a is null or v_item_b is null then
    raise exception 'Phase 2B test setup failed: unable to create supply fixtures.';
  end if;

  -- TEST 1: QR identifiers are unique within this setup
  if exists (
    select 1
    from public.ems_supply_items
    where id in (v_item_a, v_item_b)
    group by qr_identifier
    having count(*) > 1
  ) then
    raise exception 'TEST 1 failed: duplicate QR identifier generated in setup.';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_auth_user_id::text, true);

  -- TEST 2: Restock through transaction engine updates quantity and writes history
  select quantity_on_hand into v_before_qty from public.ems_supply_items where id = v_item_a;
  select count(*) into v_tx_count_before from public.ems_supply_transactions;

  perform public.apply_ems_supply_transaction(
    'Restock',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_a, 'quantity', 12)),
    'SupplyRoom',
    null,
    'Supply Room',
    'PH2B restock test'
  );

  select quantity_on_hand into v_after_qty from public.ems_supply_items where id = v_item_a;
  if v_after_qty <> v_before_qty + 12 then
    raise exception 'TEST 2 failed: expected quantity %, got %', v_before_qty + 12, v_after_qty;
  end if;

  select count(*) into v_tx_count_after from public.ems_supply_transactions;
  if v_tx_count_after <> v_tx_count_before + 1 then
    raise exception 'TEST 2 failed: transaction history row missing after restock.';
  end if;

  -- TEST 3: Return through transaction engine increments quantity and writes history
  select quantity_on_hand into v_before_qty from public.ems_supply_items where id = v_item_a;
  perform public.apply_ems_supply_transaction(
    'Return',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_a, 'quantity', 3)),
    'SupplyRoom',
    null,
    'Supply Room',
    'PH2B return test'
  );

  select quantity_on_hand into v_after_qty from public.ems_supply_items where id = v_item_a;
  if v_after_qty <> v_before_qty + 3 then
    raise exception 'TEST 3 failed: expected quantity %, got %', v_before_qty + 3, v_after_qty;
  end if;

  -- TEST 4: Correction requires reason
  begin
    perform public.apply_ems_supply_correction(v_item_a, 7, '', 'PH2B correction missing reason');
    raise exception 'TEST 4 failed: expected missing reason rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Adjustment reason is required.' in v_msg) = 0 then
      raise exception 'TEST 4 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 5: Correction as admin writes adjustment + updates quantity
  select quantity_on_hand into v_before_qty from public.ems_supply_items where id = v_item_a;
  perform public.apply_ems_supply_correction(v_item_a, v_before_qty - 2, 'Physical count correction', 'PH2B correction');
  select quantity_on_hand into v_after_qty from public.ems_supply_items where id = v_item_a;
  if v_after_qty <> v_before_qty - 2 then
    raise exception 'TEST 5 failed: expected quantity %, got %', v_before_qty - 2, v_after_qty;
  end if;

  if not exists (
    select 1
    from public.ems_supply_adjustments a
    where a.supply_item_id = v_item_a
      and a.reason = 'Physical count correction'
  ) then
    raise exception 'TEST 5 failed: adjustment row missing.';
  end if;

  -- TEST 6: non-admin cannot perform correction
  perform set_config('request.jwt.claim.sub', v_non_admin_auth_user_id::text, true);
  begin
    perform public.apply_ems_supply_correction(v_item_a, 4, 'No access test', 'PH2B non-admin correction');
    raise exception 'TEST 6 failed: expected administrator-only rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Administrator privileges required.' in v_msg) = 0 then
      raise exception 'TEST 6 failed: unexpected error: %', v_msg;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_admin_auth_user_id::text, true);

  -- TEST 7: metadata edit does not alter transaction item history row count
  select count(*) into v_tx_count_before from public.ems_supply_transaction_items where supply_item_id = v_item_a;

  update public.ems_supply_items
  set item_name = 'PH2B Item A Updated',
      item_category = 'Updated Category',
      location = 'Cabinet 3',
      notes = 'Metadata update test',
      status = 'Inactive',
      updated_by_member_id = v_admin_member_id
  where id = v_item_a;

  select count(*) into v_tx_count_after from public.ems_supply_transaction_items where supply_item_id = v_item_a;
  if v_tx_count_after <> v_tx_count_before then
    raise exception 'TEST 7 failed: transaction history changed during metadata update.';
  end if;

  if not exists (
    select 1 from public.ems_supply_items where id = v_item_a and status = 'Inactive'
  ) then
    raise exception 'TEST 7 failed: inactive status update did not persist.';
  end if;
end;
$$;

rollback;
