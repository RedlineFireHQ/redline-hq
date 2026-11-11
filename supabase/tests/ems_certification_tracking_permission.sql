-- EMS Certification Tracking permission + renewal cycle E2E tests.
-- Run against the local test stack only:
--   docker exec -i supabase_db_redline-notification-local-test \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/ems_certification_tracking_permission.sql
--
-- Scenarios:
--   S1 regular member cannot create or edit their own EMS tracker
--   S2 member holding ems_certification_tracking_management can manage trackers
--   S3 member holding broad ems_management retains access
--   S4 authorized member of another department cannot touch this department
--   S5 regular member can still read their own tracker rows
--   S6 renewal closes the open cycle and starts a fresh one, preserving history

begin;

-- The local test stack strips authenticated's table grants (prod has them:
-- the tracker UI performs direct table writes). Grant inside this transaction
-- so the tests exercise the RLS policies; rolled back at the end.
grant select, insert, update on public.ems_member_track_profiles to authenticated;
grant select on public.members to authenticated;

-- Fixtures (as postgres).
do $$
declare
  v_dept_a uuid := gen_random_uuid();
  v_dept_b uuid := gen_random_uuid();
begin
  insert into public.departments (id, name) values
    (v_dept_a, 'EMS Perm Test Dept A'),
    (v_dept_b, 'EMS Perm Test Dept B');

  insert into auth.users (id, email) values
    ('11111111-aaaa-4aaa-8aaa-111111111111', 'ems-ff@test.local'),
    ('22222222-aaaa-4aaa-8aaa-222222222222', 'ems-tracker-mgr@test.local'),
    ('33333333-aaaa-4aaa-8aaa-333333333333', 'ems-broad-mgr@test.local'),
    ('44444444-aaaa-4aaa-8aaa-444444444444', 'ems-other-dept@test.local');

  insert into public.members (id, department_id, auth_user_id, first_name, last_name, email, role, active, special_permissions_enabled) values
    ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', v_dept_a, '11111111-aaaa-4aaa-8aaa-111111111111', 'Fiona', 'Firefighter', 'ems-ff@test.local', 'Firefighter', true, false),
    ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', v_dept_a, '22222222-aaaa-4aaa-8aaa-222222222222', 'Tracy', 'TrackerMgr', 'ems-tracker-mgr@test.local', 'Officer', true, true),
    ('cccccccc-1111-4111-8111-cccccccccccc', v_dept_a, '33333333-aaaa-4aaa-8aaa-333333333333', 'Bram', 'BroadMgr', 'ems-broad-mgr@test.local', 'Officer', true, true),
    ('dddddddd-1111-4111-8111-dddddddddddd', v_dept_b, '44444444-aaaa-4aaa-8aaa-444444444444', 'Olive', 'OtherDept', 'ems-other-dept@test.local', 'Officer', true, true);

  insert into public.member_app_permissions (department_id, member_id, permission_key) values
    (v_dept_a, 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'ems_certification_tracking_management'),
    (v_dept_a, 'cccccccc-1111-4111-8111-cccccccccccc', 'ems_management'),
    (v_dept_b, 'dddddddd-1111-4111-8111-dddddddddddd', 'ems_certification_tracking_management');

  perform set_config('test.dept_a', v_dept_a::text, false);
  perform set_config('test.dept_b', v_dept_b::text, false);
end $$;

-- S1: the regular member cannot create their own tracker.
do $$
declare
  v_dept uuid := current_setting('test.dept_a')::uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', '11111111-aaaa-4aaa-8aaa-111111111111', true);
  set local role authenticated;

  begin
    insert into public.ems_member_track_profiles
      (department_id, member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date)
    values
      (v_dept, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'iowa', 'emt', 'active', true, 'SELF-EDIT', '2028-01-01', '2026-01-01');
    raise exception 'S1 FAILED: regular member inserted their own tracker';
  exception
    when insufficient_privilege or sqlstate '42501' then null;
    when others then
      if sqlstate = '42501' or position('row-level security' in lower(sqlerrm)) > 0 then
        null;
      else
        raise;
      end if;
  end;

  reset role;
  select count(*) into v_count from public.ems_member_track_profiles where certification_number = 'SELF-EDIT';
  if v_count <> 0 then
    raise exception 'S1 FAILED: self-service tracker row was persisted';
  end if;
  raise notice 'S1 PASS: regular member blocked from creating their own tracker';
end $$;

-- S2: the dedicated-permission holder can create and edit trackers.
do $$
declare
  v_dept uuid := current_setting('test.dept_a')::uuid;
  v_id uuid;
  v_level text;
begin
  perform set_config('request.jwt.claim.sub', '22222222-aaaa-4aaa-8aaa-222222222222', true);
  set local role authenticated;

  insert into public.ems_member_track_profiles
    (department_id, member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, created_by, updated_by)
  values
    (v_dept, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'iowa', 'emt', 'active', true, 'IA-100', '2028-01-01', '2026-01-01',
     'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb')
  returning id into v_id;

  update public.ems_member_track_profiles
  set certification_level = 'aemt'
  where id = v_id;

  select certification_level into v_level from public.ems_member_track_profiles where id = v_id;
  if v_level <> 'aemt' then
    raise exception 'S2 FAILED: dedicated permission holder could not edit the tracker';
  end if;

  reset role;
  raise notice 'S2 PASS: ems_certification_tracking_management can create and edit trackers';
end $$;

-- S3: broad ems_management retains access.
do $$
declare
  v_dept uuid := current_setting('test.dept_a')::uuid;
begin
  perform set_config('request.jwt.claim.sub', '33333333-aaaa-4aaa-8aaa-333333333333', true);
  set local role authenticated;

  insert into public.ems_member_track_profiles
    (department_id, member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date)
  values
    (v_dept, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'nremt', 'emt', 'active', true, 'NR-100', '2028-06-30', '2026-06-30');

  reset role;
  raise notice 'S3 PASS: ems_management retains tracker management access';
end $$;

-- S4: an authorized member of another department cannot modify this department.
do $$
declare
  v_dept uuid := current_setting('test.dept_a')::uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', '44444444-aaaa-4aaa-8aaa-444444444444', true);
  set local role authenticated;

  begin
    update public.ems_member_track_profiles
    set certification_number = 'CROSS-DEPT'
    where department_id = v_dept;
  exception
    when others then null;
  end;

  reset role;
  select count(*) into v_count from public.ems_member_track_profiles where certification_number = 'CROSS-DEPT';
  if v_count <> 0 then
    raise exception 'S4 FAILED: cross-department edit succeeded';
  end if;
  raise notice 'S4 PASS: department isolation holds for tracker management';
end $$;

-- S5: the regular member can still read their own tracker rows.
do $$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', '11111111-aaaa-4aaa-8aaa-111111111111', true);
  set local role authenticated;

  select count(*) into v_count
  from public.ems_member_track_profiles
  where member_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

  reset role;
  if v_count < 2 then
    raise exception 'S5 FAILED: member cannot read their own tracker rows (saw %)', v_count;
  end if;
  raise notice 'S5 PASS: member can read their own tracker rows';
end $$;

-- Scenarios S6-S7 follow.
-- S6: renewal closes the open cycle and starts a fresh one; history is preserved.
do $$
declare
  v_dept uuid := current_setting('test.dept_a')::uuid;
  v_open_count integer;
  v_history_count integer;
  v_new_start date;
begin
  perform set_config('request.jwt.claim.sub', '22222222-aaaa-4aaa-8aaa-222222222222', true);
  set local role authenticated;

  -- Close the current Iowa cycle at the renewal date (what the UI's Renew flow does).
  update public.ems_member_track_profiles
  set effective_end_date = '2027-12-31', track_status = 'expired'
  where department_id = v_dept
    and member_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
    and track = 'iowa'
    and effective_end_date is null;

  insert into public.ems_member_track_profiles
    (department_id, member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date)
  values
    (v_dept, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'iowa', 'aemt', 'active', true, 'IA-200-RENEWED', '2029-12-31', '2027-12-31');

  reset role;

  select count(*) into v_open_count
  from public.ems_member_track_profiles
  where member_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' and track = 'iowa' and effective_end_date is null;
  if v_open_count <> 1 then
    raise exception 'S6 FAILED: expected exactly one open Iowa cycle, saw %', v_open_count;
  end if;

  select count(*) into v_history_count
  from public.ems_member_track_profiles
  where member_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' and track = 'iowa' and effective_end_date is not null;
  if v_history_count <> 1 then
    raise exception 'S6 FAILED: previous cycle history missing (saw %)', v_history_count;
  end if;

  select effective_start_date into v_new_start
  from public.ems_member_track_profiles
  where member_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' and track = 'iowa' and effective_end_date is null;
  if v_new_start <> '2027-12-31' then
    raise exception 'S6 FAILED: new cycle start date wrong (%)', v_new_start;
  end if;

  raise notice 'S6 PASS: renewal closes the old cycle, starts a fresh one, and preserves history';
end $$;

-- S7: an authorized manager can also manage THEIR OWN tracker (self-management).
do $$
declare
  v_dept uuid := current_setting('test.dept_a')::uuid;
  v_id uuid;
  v_number text;
begin
  perform set_config('request.jwt.claim.sub', '22222222-aaaa-4aaa-8aaa-222222222222', true);
  set local role authenticated;

  insert into public.ems_member_track_profiles
    (department_id, member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date)
  values
    (v_dept, 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'iowa', 'paramedic', 'active', true, 'IA-SELF-1', '2028-05-01', '2026-05-01')
  returning id into v_id;

  update public.ems_member_track_profiles
  set certification_number = 'IA-SELF-2'
  where id = v_id;

  select certification_number into v_number from public.ems_member_track_profiles where id = v_id;
  reset role;

  if v_number <> 'IA-SELF-2' then
    raise exception 'S7 FAILED: authorized manager could not edit their own tracker';
  end if;
  raise notice 'S7 PASS: authorized manager can create and edit their own tracker';
end $$;

rollback;
