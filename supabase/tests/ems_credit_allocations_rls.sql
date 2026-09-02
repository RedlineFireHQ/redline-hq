begin;

do $$
declare
  v_dept_a uuid;
  v_dept_b uuid;
  v_admin_a uuid;
  v_admin_b uuid;
  v_auth_a uuid;
  v_auth_b uuid;
  v_requirement_set_a uuid;
  v_source_id uuid;
  v_seen_by_a integer;
  v_seen_by_b integer;
begin
  select m.department_id, m.id, m.auth_user_id
  into v_dept_a, v_admin_a, v_auth_a
  from public.members m
  where coalesce(m.active, false) = true
    and lower(coalesce(m.role, '')) = 'administrator'
    and m.auth_user_id is not null
  order by m.created_at
  limit 1;

  if v_dept_a is null then
    raise exception 'RLS test requires an active admin in at least one department.';
  end if;

  select m.department_id, m.id, m.auth_user_id
  into v_dept_b, v_admin_b, v_auth_b
  from public.members m
  where coalesce(m.active, false) = true
    and lower(coalesce(m.role, '')) = 'administrator'
    and m.auth_user_id is not null
    and m.department_id <> v_dept_a
  order by m.created_at
  limit 1;

  if v_dept_b is null then
    raise exception 'RLS test requires an admin in a different department.';
  end if;

  select rs.id
  into v_requirement_set_a
  from public.ems_requirement_sets rs
  where rs.department_id = v_dept_a
    and rs.authority = 'iowa'
  order by rs.created_at
  limit 1;

  if v_requirement_set_a is null then
    raise exception 'RLS test requires seeded EMS requirement sets.';
  end if;

  perform set_config('request.jwt.claim.sub', v_auth_a::text, true);

  insert into public.ems_credit_sources (
    department_id,
    member_id,
    source_type,
    source_record_id,
    source_occurred_at,
    source_title,
    source_hours,
    ems_core_topic,
    approval_state,
    metadata_json,
    created_by
  )
  values (
    v_dept_a,
    v_admin_a,
    'manual',
    gen_random_uuid(),
    current_date,
    'RLS Fixture',
    1,
    'cardiology',
    'approved',
    '{}'::jsonb,
    v_admin_a
  )
  returning id into v_source_id;

  insert into public.ems_credit_allocations (
    department_id,
    member_id,
    credit_source_id,
    requirement_set_id,
    allocated_hours,
    allocation_status,
    allocation_reason,
    allocator_version,
    rule_trace_json,
    is_manual_override
  )
  values (
    v_dept_a,
    v_admin_a,
    v_source_id,
    v_requirement_set_a,
    1,
    'allocated',
    'rls_fixture',
    'rls-test',
    '{}'::jsonb,
    false
  );

  select count(*) into v_seen_by_a
  from public.ems_credit_allocations a
  where a.credit_source_id = v_source_id;

  if v_seen_by_a <> 1 then
    raise exception 'RLS test failed: department admin could not read own allocation fixture.';
  end if;

  perform set_config('request.jwt.claim.sub', v_auth_b::text, true);

  select count(*) into v_seen_by_b
  from public.ems_credit_allocations a
  where a.credit_source_id = v_source_id;

  if v_seen_by_b <> 0 then
    raise exception 'RLS test failed: cross-department allocation visibility detected.';
  end if;

  perform set_config('request.jwt.claim.sub', v_auth_a::text, true);

  delete from public.ems_credit_allocations where credit_source_id = v_source_id;
  delete from public.ems_credit_sources where id = v_source_id;
end;
$$;

rollback;
