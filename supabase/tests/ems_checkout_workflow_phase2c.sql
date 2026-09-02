begin;

do $$
declare
  v_dept_id uuid;
  v_admin_member_id uuid;
  v_admin_auth_user_id uuid;
  v_non_admin_member_id uuid;
  v_non_admin_auth_user_id uuid;
  v_other_dept_id uuid;
  v_other_admin_member_id uuid;
  v_other_admin_auth_user_id uuid;
  v_apparatus_id uuid;

  v_item_1 uuid;
  v_item_2 uuid;
  v_item_low uuid;
  v_item_critical uuid;
  v_item_zero uuid;
  v_item_other_dept uuid;

  v_before numeric(12,2);
  v_after numeric(12,2);
  v_msg text;
  v_tx_count_before integer;
  v_tx_count_after integer;
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
    raise exception 'Phase 2C tests require an active administrator with auth_user_id.';
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
    raise exception 'Phase 2C tests require an active non-admin member with auth_user_id in the same department.';
  end if;

  select m.department_id, m.id, m.auth_user_id
  into v_other_dept_id, v_other_admin_member_id, v_other_admin_auth_user_id
  from public.members m
  where coalesce(m.active, false) = true
    and m.auth_user_id is not null
    and lower(coalesce(m.role, '')) = 'administrator'
    and m.department_id <> v_dept_id
  order by m.created_at
  limit 1;

  if v_other_dept_id is null or v_other_admin_member_id is null or v_other_admin_auth_user_id is null then
    insert into public.departments (name)
    values ('PH2C Other Department ' || substr(gen_random_uuid()::text, 1, 8))
    returning id into v_other_dept_id;

    insert into public.members (department_id, first_name, last_name, email, role, active, auth_user_id)
    values (
      v_other_dept_id,
      'PH2C',
      'OtherAdmin',
      'ph2c-other-' || substr(gen_random_uuid()::text, 1, 8) || '@example.com',
      'Administrator',
      true,
      gen_random_uuid()
    )
    returning id, auth_user_id into v_other_admin_member_id, v_other_admin_auth_user_id;
  end if;

  select a.id
  into v_apparatus_id
  from public.apparatus a
  where a.department_id = v_dept_id
  order by a.created_at
  limit 1;

  if v_apparatus_id is null then
    insert into public.apparatus (department_id, name, status)
    values (v_dept_id, 'PH2C TEMP APPARATUS', 'ready')
    returning id into v_apparatus_id;
  end if;

  insert into public.ems_supply_items (
    department_id,
    item_name,
    item_category,
    unit_of_measure,
    quantity_on_hand,
    reorder_threshold,
    critical_threshold,
    status,
    qr_identifier,
    created_by_member_id,
    updated_by_member_id
  ) values
    (v_dept_id, 'PH2C Item 1', 'Checkout', 'each', 30, 10, 4, 'Active', 'PH2C-I1-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2C Item 2', 'Checkout', 'box', 12, 5, 2, 'Active', 'PH2C-I2-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2C Low', 'Checkout', 'bag', 3, 5, 1, 'Active', 'PH2C-LOW-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2C Critical', 'Checkout', 'vial', 1, 5, 2, 'Active', 'PH2C-CRIT-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_dept_id, 'PH2C Zero', 'Checkout', 'roll', 0, 1, 0, 'Active', 'PH2C-ZERO-' || replace(gen_random_uuid()::text, '-', ''), v_admin_member_id, v_admin_member_id),
    (v_other_dept_id, 'PH2C Other Dept', 'Checkout', 'each', 20, 5, 2, 'Active', 'PH2C-OTHER-' || replace(gen_random_uuid()::text, '-', ''), v_other_admin_member_id, v_other_admin_member_id);

  select id into v_item_1 from public.ems_supply_items where item_name = 'PH2C Item 1' order by created_at desc limit 1;
  select id into v_item_2 from public.ems_supply_items where item_name = 'PH2C Item 2' order by created_at desc limit 1;
  select id into v_item_low from public.ems_supply_items where item_name = 'PH2C Low' order by created_at desc limit 1;
  select id into v_item_critical from public.ems_supply_items where item_name = 'PH2C Critical' order by created_at desc limit 1;
  select id into v_item_zero from public.ems_supply_items where item_name = 'PH2C Zero' order by created_at desc limit 1;
  select id into v_item_other_dept from public.ems_supply_items where item_name = 'PH2C Other Dept' order by created_at desc limit 1;

  perform set_config('request.jwt.claim.sub', v_non_admin_auth_user_id::text, true);

  -- TEST 1: multi-item checkout succeeds atomically for normal member
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(
      jsonb_build_object('supply_item_id', v_item_1, 'quantity', 7),
      jsonb_build_object('supply_item_id', v_item_2, 'quantity', 4)
    ),
    'Apparatus',
    v_apparatus_id,
    null,
    'PH2C multi-item checkout'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_1;
  if v_after <> 23 then
    raise exception 'TEST 1 failed: item 1 expected 23, got %', v_after;
  end if;

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_2;
  if v_after <> 8 then
    raise exception 'TEST 1 failed: item 2 expected 8, got %', v_after;
  end if;

  -- TEST 2: checkout exact remaining quantity to zero is allowed
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_2, 'quantity', 8)),
    'SupplyRoom',
    null,
    'Supply Room',
    'PH2C exact to zero'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_2;
  if v_after <> 0 then
    raise exception 'TEST 2 failed: item 2 expected 0, got %', v_after;
  end if;

  -- TEST 3: insufficient quantity fails and rolls back history row creation
  select count(*) into v_tx_count_before from public.ems_supply_transactions;
  select quantity_on_hand into v_before from public.ems_supply_items where id = v_item_1;

  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_1, 'quantity', v_before + 1)),
      'None',
      null,
      null,
      'PH2C stale quantity simulation'
    );
    raise exception 'TEST 3 failed: expected insufficient quantity rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Insufficient quantity available.' in v_msg) = 0 then
      raise exception 'TEST 3 failed: unexpected error: %', v_msg;
    end if;
  end;

  select count(*) into v_tx_count_after from public.ems_supply_transactions;
  if v_tx_count_after <> v_tx_count_before then
    raise exception 'TEST 3 failed: transaction history changed on failed checkout.';
  end if;

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_1;
  if v_after <> v_before then
    raise exception 'TEST 3 failed: quantity changed from % to %', v_before, v_after;
  end if;

  -- TEST 4: low and critical stock items can still be checked out
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(
      jsonb_build_object('supply_item_id', v_item_low, 'quantity', 1),
      jsonb_build_object('supply_item_id', v_item_critical, 'quantity', 1)
    ),
    'Station',
    null,
    'Station',
    'PH2C low critical allowed'
  );

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_low;
  if v_after <> 2 then
    raise exception 'TEST 4 failed: low item expected 2, got %', v_after;
  end if;

  select quantity_on_hand into v_after from public.ems_supply_items where id = v_item_critical;
  if v_after <> 0 then
    raise exception 'TEST 4 failed: critical item expected 0, got %', v_after;
  end if;

  -- TEST 5: checkout zero quantity item is rejected when requesting >0
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_zero, 'quantity', 1)),
      'None',
      null,
      null,
      'PH2C zero stock rejection'
    );
    raise exception 'TEST 5 failed: expected insufficient quantity rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Insufficient quantity available.' in v_msg) = 0 then
      raise exception 'TEST 5 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 6: other-department supply item cannot be checked out
  begin
    perform public.apply_ems_supply_transaction(
      'Checkout',
      jsonb_build_array(jsonb_build_object('supply_item_id', v_item_other_dept, 'quantity', 1)),
      'None',
      null,
      null,
      'PH2C cross department rejection'
    );
    raise exception 'TEST 6 failed: expected department ownership rejection.';
  exception when others then
    v_msg := sqlerrm;
    if position('Supply item does not belong to your department.' in v_msg) = 0 then
      raise exception 'TEST 6 failed: unexpected error: %', v_msg;
    end if;
  end;

  -- TEST 7: destination variants accepted
  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_1, 'quantity', 1)),
    'Other',
    null,
    'Training Event Cache',
    'PH2C destination other'
  );

  perform public.apply_ems_supply_transaction(
    'Checkout',
    jsonb_build_array(jsonb_build_object('supply_item_id', v_item_1, 'quantity', 1)),
    'None',
    null,
    null,
    'PH2C destination none'
  );
end;
$$;

rollback;
