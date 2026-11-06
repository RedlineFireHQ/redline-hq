-- DRAFT: requires approval before applying to Production.
begin;

-- Legacy result rows are not proof that Finish was reached. Only the new
-- transactional completion path marks a session; existing rows remain NULL.
alter table public.fire_hose_testing_sessions
  add column completed_at timestamptz;

create function public.complete_fire_hose_test(
  p_department_id uuid,
  p_test_date date,
  p_tester text,
  p_results jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_hose public.fire_hose%rowtype;
  v_result record;
  v_count integer := 0;
  v_last_test_date date;
  v_has_deficiency boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in before completing a hose test.' using errcode = '42501';
  end if;
  if p_department_id is null or p_test_date is null or nullif(btrim(p_tester), '') is null then
    raise exception 'Department, testing date and tester are required.';
  end if;
  if not exists (
    select 1 from public.auth_user_department_memberships m
    where m.auth_user_id = auth.uid() and m.department_id = p_department_id
  ) or public.member_has_inventory_permission(p_department_id, 'fire_hose_inspection_testing') is not true then
    raise exception 'Hose testing permission is required in this department.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' then
    raise exception 'Hose results must be an array.';
  end if;
  if jsonb_array_length(p_results) = 0 or exists (
    select 1 from jsonb_to_recordset(p_results) as r(hose_id uuid, result text)
    where r.hose_id is null or r.result is null or r.result not in ('pass', 'fail')
  ) or (
    select count(*) <> count(distinct r.hose_id)
    from jsonb_to_recordset(p_results) as r(hose_id uuid, result text)
  ) then
    raise exception 'Provide unique hoses with pass or fail results.';
  end if;

  -- Stable lock order serializes overlapping sessions without allowing older dates
  -- to overwrite a newer saved pass. All reads and writes retain caller RLS.
  for v_hose in
    select h.* from public.fire_hose h
    join jsonb_to_recordset(p_results) as r(hose_id uuid, result text) on r.hose_id = h.id
    where h.department_id = p_department_id and h.status <> 'Retired'
    order by h.id for update of h
  loop
    v_count := v_count + 1;
  end loop;
  if v_count <> jsonb_array_length(p_results) then
    raise exception 'One or more hoses are unavailable in this department.' using errcode = '42501';
  end if;

  insert into public.fire_hose_testing_sessions(department_id, test_date, tester, completed_at)
  values (p_department_id, p_test_date, btrim(p_tester), clock_timestamp())
  returning id into v_session_id;

  insert into public.fire_hose_testing_results(
    testing_session_id, department_id, hose_id, inventory_number, test_date, tester, result
  )
  select v_session_id, p_department_id, h.id, h.inventory_number, p_test_date, btrim(p_tester), r.result
  from jsonb_to_recordset(p_results) as r(hose_id uuid, result text)
  join public.fire_hose h on h.id = r.hose_id and h.department_id = p_department_id;

  -- Fail closed if caller RLS hides saved results or a trigger skips/changes them.
  select count(*) into v_count
  from public.fire_hose_testing_results r
  join public.fire_hose_testing_sessions s
    on s.id = r.testing_session_id and s.department_id = r.department_id
      and s.test_date = r.test_date and s.completed_at is not null
  join jsonb_to_recordset(p_results) as expected(hose_id uuid, result text)
    on expected.hose_id = r.hose_id and expected.result = r.result
  where s.id = v_session_id and r.department_id = p_department_id and r.test_date = p_test_date;
  if v_count <> jsonb_array_length(p_results) then
    raise exception 'Completed test results could not be verified; no test results were saved.'
      using errcode = '42501';
  end if;

  for v_result in
    select * from jsonb_to_recordset(p_results) as r(hose_id uuid, result text)
    order by r.hose_id
  loop
    select exists (
      select 1 from public.deficiencies d
      join public.deficiency_statuses s on s.id = d.status
      where d.fire_hose_id = v_result.hose_id and d.department_id = p_department_id and s.active
    ) into v_has_deficiency;
    if v_result.result = 'fail' and not v_has_deficiency then
      raise exception 'Failed hoses require an active deficiency before finishing.';
    end if;

    if v_result.result = 'pass' then
      select max(r.test_date) into v_last_test_date
      from public.fire_hose_testing_results r
      join public.fire_hose_testing_sessions s
        on s.id = r.testing_session_id and s.department_id = r.department_id
        and s.test_date = r.test_date and s.completed_at is not null
      where r.hose_id = v_result.hose_id and r.department_id = p_department_id and r.result = 'pass';
      update public.fire_hose
      set last_test_date = case
            when last_test_date is null or v_last_test_date >= last_test_date then v_last_test_date
            else last_test_date end,
          next_test_date = case
            when last_test_date is null or v_last_test_date >= last_test_date
              then (v_last_test_date + interval '1 year')::date
            else next_test_date end,
          status = case when v_has_deficiency then 'Out of Service' else 'Ready' end
      where id = v_result.hose_id and department_id = p_department_id;
    else
      update public.fire_hose set status = 'Out of Service'
      where id = v_result.hose_id and department_id = p_department_id;
    end if;
    if not found then
      raise exception 'Hose update was denied; no test results were saved.' using errcode = '42501';
    end if;
  end loop;
  return v_session_id;
end;
$$;

revoke all on function public.complete_fire_hose_test(uuid, date, text, jsonb) from public, anon;
grant execute on function public.complete_fire_hose_test(uuid, date, text, jsonb) to authenticated;

-- No historical backfill: preserve every existing inventory date and result.
-- Departments must verify legacy history before any separate reconciliation.

commit;
