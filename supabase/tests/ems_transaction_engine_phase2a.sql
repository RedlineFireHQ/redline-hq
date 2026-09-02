begin;

do $$
declare
  v_dept_id uuid;
  v_other_dept_id uuid;
  v_admin_member_id uuid;
  v_admin_auth_user_id uuid;
  v_non_admin_member_id uuid;
  v_non_admin_auth_user_id uuid;
  v_apparatus_id uuid;
  v_other_apparatus_id uuid;

  v_item_1 uuid;
  v_item_2 uuid;
  v_item_3 uuid;
  v_item_4 uuid;
  v_item_5 uuid;
  v_item_6 uuid;
  v_item_7a uuid;
  v_item_7b uuid;
  v_item_8a uuid;
  v_item_8b uuid;
  v_item_9 uuid;
  v_item_10 uuid;
  v_item_11 uuid;
  v_item_12 uuid;
  v_item_13 uuid;
  v_item_14 uuid;
  v_item_other_dept uuid;

  v_before numeric(12,2);
  v_after numeric(12,2);
  v_tx_count_before integer;
  v_tx_count_after integer;
  v_item_count_before integer;
  v_item_count_after integer;
  v_qty_8a_before numeric(12,2);
  v_qty_8b_before numeric(12,2);
  v_qty_8a_after numeric(12,2);
  v_qty_8b_after numeric(12,2);
  v_tx_id uuid;
  v_adj_id uuid;
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
    raise exception 'Phase 2A tests require at least one active administrator with auth_user_id.';
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
    raise exception 'Phase 2A tests require at least one active non-admin member with auth_user_id in the same department.';
  end if;

  select a.id
  into v_apparatus_id
  from public.apparatus a
  where a.department_id = v_dept_id
  limit 1;

  if v_apparatus_id is null then
    insert into public.apparatus (department_id, name, status)
    values (v_dept_id, 'PH2A TEMP APPARATUS', 'ready')
    returning id into v_apparatus_id;
  end if;

  insert into public.departments (name)
  values ('PH2A Other Department ' || substr(gen_random_uuid()::text, 1, 8))
  returning id into v_other_dept_id;

  insert into public.apparatus (department_id, name, status)
  values (v_other_dept_id, 'PH2A OTHER APPARATUS', 'ready')
  returning id into v_other_apparatus_id;

  insert into public.ems_supply_items (
    department_id, item_name, unit_of_measure, quantity_on_hand, reorder_threshold, status, qr_identifier, created_by_member_id, updated_by_member_id
  ) values
    (v_dept_id, 'PH2A T1 Item', 'each', 30, 0, 'Active', 'PH2A-T1-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T2 Item', 'each', 30, 0, 'Active', 'PH2A-T2-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T3 Item', 'each', 30, 0, 'Active', 'PH2A-T3-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T4 Item', 'each', 30, 0, 'Active', 'PH2A-T4-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T5 Item', 'each', 30, 0, 'Active', 'PH2A-T5-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T6 Item', 'each', 30, 0, 'Active', 'PH2A-T6-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T7A Item', 'each', 40, 0, 'Active', 'PH2A-T7A-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T7B Item', 'each', 20, 0, 'Active', 'PH2A-T7B-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T8A Item', 'each', 40, 0, 'Active', 'PH2A-T8A-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T8B Item', 'each', 5, 0, 'Active', 'PH2A-T8B-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T9 Item', 'each', 0, 0, 'Active', 'PH2A-T9-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T10 Item', 'each', 0, 0, 'Active', 'PH2A-T10-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T11 Item', 'each', 30, 0, 'Active', 'PH2A-T11-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T12 Item', 'each', 30, 0, 'Active', 'PH2A-T12-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T13 Item', 'each', 30, 0, 'Active', 'PH2A-T13-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2A T14 Item', 'each', 30, 0, 'Active', 'PH2A-T14-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id);

  select id into v_item_1 from public.ems_supply_items where item_name = 'PH2A T1 Item' order by created_at desc limit 1;
  select id into v_item_2 from public.ems_supply_items where item_name = 'PH2A T2 Item' order by created_at desc limit 1;
  select id into v_item_3 from public.ems_supply_items where item_name = 'PH2A T3 Item' order by created_at desc limit 1;
  select id into v_item_4 from public.ems_supply_items where item_name = 'PH2A T4 Item' order by created_at desc limit 1;
  select id into v_item_5 from public.ems_supply_items where item_name = 'PH2A T5 Item' order by created_at desc limit 1;
  select id into v_item_6 from public.ems_supply_items where item_name = 'PH2A T6 Item' order by created_at desc limit 1;
  select id into v_item_7a from public.ems_supply_items where item_name = 'PH2A T7A Item' order by created_at desc limit 1;
  select id into v_item_7b from public.ems_supply_items where item_name = 'PH2A T7B Item' order by created_at desc limit 1;
  select id into v_item_8a from public.ems_supply_items where item_name = 'PH2A T8A Item' order by created_at desc limit 1;
  select id into v_item_8b from public.ems_supply_items where item_name = 'PH2A T8B Item' order by created_at desc limit 1;
  select id into v_item_9 from public.ems_supply_items where item_name = 'PH2A T9 Item' order by created_at desc limit 1;
  select id into v_item_10 from public.ems_supply_items where item_name = 'PH2A T10 Item' order by created_at desc limit 1;
  select id into v_item_11 from public.ems_supply_items where item_name = 'PH2A T11 Item' order by created_at desc limit 1;
  select id into v_item_12 from public.ems_supply_items where item_name = 'PH2A T12 Item' order by created_at desc limit 1;
  select id into v_item_13 from public.ems_supply_items where item_name = 'PH2A T13 Item' order by created_at desc limit 1;
  select id into v_item_14 from public.ems_supply_items where item_name = 'PH2A T14 Item' order by created_at desc limit 1;

  insert into public.ems_supply_items (
    department_id, item_name, unit_of_measure, quantity_on_hand, reorder_threshold, status, qr_identifier
  ) values (
    v_other_dept_id, 'PH2A Other Dept Item', 'each', 30, 0, 'Active', 'PH2A-OTHER-' || replace(gen_random_uuid()::text, '-', '')
  ) returning id into v_item_other_dept;

  perform set_config('request.jwt.claim.sub', v_admin_auth_user_id::text, true);

  -- TEST 1: Checkout 15 from 30 -> 15
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_1, 'quantity', 15)),
    'Apparatus',
    v_apparatus_id,
    null,
    'PH2A-T1'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_1;
  if v_after <> 15 then
    raise exception 'TEST 1 failed: expected quantity 15, got %', v_after;
  end if;

  -- TEST 2: Checkout exactly available 30 -> 0
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_2, 'quantity', 30)),
    'Station',
    null,
    'Station',
    'PH2A-T2'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_2;
  if v_after <> 0 then
    raise exception 'TEST 2 failed: expected quantity 0, got %', v_after;
  end if;

  -- TEST 3: Checkout more than available fails and quantity unchanged
  select quantity_on_hand into v_before from public.ems_supply_items where id = v_item_3;
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_3, 'quantity', v_before + 1)),
      'None',
      null,
      null,
      'PH2A-T3'
    );
    raise exception 'TEST 3 failed: expected insufficient quantity error.';
  exception when others then
    v_msg := sqlerrm;
    if position('Insufficient quantity available.' in v_msg) = 0 then
      raise exception 'TEST 3 failed: unexpected error: %', v_msg;
    end if;
  end;

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_3;
  if v_after <> v_before then
    raise exception 'TEST 3 failed: quantity changed from % to %', v_before, v_after;
  end if;

  -- TEST 4: Checkout zero rejected
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_4, 'quantity', 0)),
      'None',
      null,
      null,
      'PH2A-T4'
    );
    raise exception 'TEST 4 failed: expected zero quantity rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Quantity must be greater than zero.' in v_msg) = 0 then
      raise exception 'TEST 4 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 5: Checkout negative rejected
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_5, 'quantity', -2)),
      'None',
      null,
      null,
      'PH2A-T5'
    );
    raise exception 'TEST 5 failed: expected negative quantity rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Quantity must be greater than zero.' in v_msg) = 0 then
      raise exception 'TEST 5 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 6: Checkout from another department item rejected
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_other_dept, 'quantity', 1)),
      'None',
      null,
      null,
      'PH2A-T6'
    );
    raise exception 'TEST 6 failed: expected department ownership rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Supply item does not belong to your department.' in v_msg) = 0 then
      raise exception 'TEST 6 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 7: Multi-item checkout succeeds atomically
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(
      jsonb_build_object('supply_item_id', v_item_7a, 'quantity', 10),
      jsonb_build_object('supply_item_id', v_item_7b, 'quantity', 5)
    ),
    'SupplyRoom',
    null,
    'Main EMS Room',
    'PH2A-T7'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_7a;
  if v_after <> 30 then
    raise exception 'TEST 7 failed: item 7A expected 30, got %', v_after;
  end if;

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_7b;
  if v_after <> 15 then
    raise exception 'TEST 7 failed: item 7B expected 15, got %', v_after;
  end if;

  -- TEST 8: Multi-item with one insufficient rolls back all
  select quantity_on_hand into v_qty_8a_before from public.ems_supply_items where id = v_item_8a;
  select quantity_on_hand into v_qty_8b_before from public.ems_supply_items where id = v_item_8b;
  select count(*) into v_tx_count_before from public.ems_supply_transactions;
  select count(*) into v_item_count_before from public.ems_supply_transaction_items;

  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(
        jsonb_build_object('supply_item_id', v_item_8a, 'quantity', 5),
        jsonb_build_object('supply_item_id', v_item_8b, 'quantity', 10)
      ),
      'Other',
      null,
      'Overflow Staging',
      'PH2A-T8'
    );
    raise exception 'TEST 8 failed: expected insufficient quantity rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Insufficient quantity available.' in v_msg) = 0 then
      raise exception 'TEST 8 failed: unexpected error: %', v_msg;
    end if;
  end;

  select quantity_on_hand into v_qty_8a_after from public.ems_supply_items where id = v_item_8a;
  select quantity_on_hand into v_qty_8b_after from public.ems_supply_items where id = v_item_8b;
  if v_qty_8a_after <> v_qty_8a_before or v_qty_8b_after <> v_qty_8b_before then
    raise exception 'TEST 8 failed: quantities changed despite rollback.';
  end if;

  select count(*) into v_tx_count_after from public.ems_supply_transactions;
  select count(*) into v_item_count_after from public.ems_supply_transaction_items;
  if v_tx_count_after <> v_tx_count_before or v_item_count_after <> v_item_count_before then
    raise exception 'TEST 8 failed: history rows changed despite rollback.';
  end if;

  -- TEST 9: Administrator correction 0 -> 12 with adjustment linkage
  select quantity_on_hand into v_before from public.ems_supply_items where id = v_item_9;
  if v_before <> 0 then
    raise exception 'TEST 9 setup failed: expected starting quantity 0, got %', v_before;
  end if;

  select transaction_id, adjustment_id
  into v_tx_id, v_adj_id
  from public.apply_ems_supply_correction(v_item_9, 12, 'Physical count correction', 'PH2A-T9');

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_9;
  if v_after <> 12 then
    raise exception 'TEST 9 failed: expected quantity 12, got %', v_after;
  end if;

  if not exists (
    select 1
    from public.ems_supply_transactions t
    where t.id = v_tx_id
      and t.transaction_type = 'Correction'
  ) then
    raise exception 'TEST 9 failed: correction transaction missing.';
  end if;

  if not exists (
    select 1
    from public.ems_supply_adjustments a
    where a.id = v_adj_id
      and a.transaction_id = v_tx_id
      and a.old_quantity = 0
      and a.new_quantity = 12
  ) then
    raise exception 'TEST 9 failed: adjustment record missing or incorrect.';
  end if;

  -- TEST 10: Non-admin correction rejected
  perform set_config('request.jwt.claim.sub', v_non_admin_auth_user_id::text, true);
  begin
    perform public.apply_ems_supply_correction(v_item_10, 12, 'Unauthorized correction', 'PH2A-T10');
    raise exception 'TEST 10 failed: expected admin privilege rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Administrator privileges required.' in v_msg) = 0 then
      raise exception 'TEST 10 failed: unexpected error: %', v_msg;
    end if;
  end;

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_10;
  if v_after <> 0 then
    raise exception 'TEST 10 failed: quantity changed unexpectedly to %', v_after;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_auth_user_id::text, true);

  -- TEST 11: Restock 30 -> 530
  perform public.apply_ems_supply_transaction(
    'Restock',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_11, 'quantity', 500)),
    'SupplyRoom',
    null,
    'Main EMS Room',
    'PH2A-T11'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_11;
  if v_after <> 530 then
    raise exception 'TEST 11 failed: expected quantity 530, got %', v_after;
  end if;

  -- TEST 12: Return 30 -> 35
  perform public.apply_ems_supply_transaction(
    'Return',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_12, 'quantity', 5)),
    'Station',
    null,
    'Station Return Bin',
    'PH2A-T12'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_12;
  if v_after <> 35 then
    raise exception 'TEST 12 failed: expected quantity 35, got %', v_after;
  end if;

  -- TEST 13: Apparatus destination from another department rejected
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_13, 'quantity', 1)),
      'Apparatus',
      v_other_apparatus_id,
      null,
      'PH2A-T13'
    );
    raise exception 'TEST 13 failed: expected foreign apparatus rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Apparatus destination does not belong to this department.' in v_msg) = 0 then
      raise exception 'TEST 13 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 14: Duplicate supply item in one request rejected
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(
        jsonb_build_object('supply_item_id', v_item_14, 'quantity', 1),
        jsonb_build_object('supply_item_id', v_item_14, 'quantity', 2)
      ),
      'None',
      null,
      null,
      'PH2A-T14'
    );
    raise exception 'TEST 14 failed: expected duplicate item rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Duplicate supply item in transaction.' in v_msg) = 0 then
      raise exception 'TEST 14 failed: unexpected error: %', v_msg;
    end if;
  end;

  raise notice 'EMS Phase 2A transaction tests passed.';
end
$$;

rollback;
