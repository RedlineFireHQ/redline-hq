-- Run only in a NEW disposable PostgreSQL database, never Supabase/Production.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid
$$;
create function auth.email() returns text language sql stable as $$
  select current_setting('test.email', true)
$$;
create table public.departments(id uuid primary key);
create table public.members(id uuid primary key, department_id uuid, email text);
create table public.auth_user_department_memberships(auth_user_id uuid, department_id uuid);
create table public.deficiency_statuses(id uuid primary key, active boolean);
create table public.deficiencies(id uuid primary key, department_id uuid, fire_hose_id uuid, status uuid);
\ir ../migrations/20260807_create_fire_hose.sql
\ir ../migrations/20260809020000_add_fire_hose_test_dates.sql
\ir ../migrations/20260809050000_create_fire_hose_testing_history.sql
-- The supplied Production schema uses numeric, unlike the original base migration.
alter table public.fire_hose alter column hose_size type numeric using hose_size::numeric;
alter table public.fire_hose drop constraint fire_hose_status_check;
alter table public.fire_hose add check(status in ('Ready', 'Testing Due', 'Out of Service', 'Retired'));

-- Minimal fixture identities and permission switch, not customer accounts.
create function public.member_has_inventory_permission(department_id uuid, permission_key text)
returns boolean language sql stable as $$
  select department_id = '10000000-0000-0000-0000-000000000001'::uuid
    and coalesce(current_setting('test.allow_writes', true), 'yes') <> 'no'
$$;
drop policy fire_hose_update_by_department on public.fire_hose;
create policy fixture_hose_update on public.fire_hose for update to authenticated
using(public.member_has_inventory_permission(department_id, 'fire_hose_management'))
with check(public.member_has_inventory_permission(department_id, 'fire_hose_management'));
drop policy fire_hose_testing_sessions_insert_by_department on public.fire_hose_testing_sessions;
drop policy fire_hose_testing_results_insert_by_department on public.fire_hose_testing_results;
create policy fixture_session_insert on public.fire_hose_testing_sessions for insert to authenticated
with check(public.member_has_inventory_permission(department_id, 'fire_hose_inspection_testing'));
create policy fixture_result_insert on public.fire_hose_testing_results for insert to authenticated
with check(public.member_has_inventory_permission(department_id, 'fire_hose_inspection_testing'));
grant usage on schema public, auth to authenticated, anon;
grant select, insert, update on all tables in schema public to authenticated;

create function public.assert_test(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
insert into public.departments values
('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into public.members values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'fixture@example.invalid');
insert into public.auth_user_department_memberships values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.fire_hose(id, department_id, inventory_number, hose_size, hose_length, in_service_date, next_test_date, status)
select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       case when n = 5 then '10000000-0000-0000-0000-000000000002'::uuid else '10000000-0000-0000-0000-000000000001'::uuid end,
       'LOCAL-' || n, '5', 50, '2020-01-01', '2027-06-01', case when n = 4 then 'Retired' else 'Ready' end
from generate_series(1, 5) n;
insert into public.fire_hose_testing_sessions(id, department_id, test_date, tester)
values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2024-02-29', 'Historical fixture');
insert into public.fire_hose_testing_results(testing_session_id, department_id, hose_id, inventory_number, test_date, tester, result)
values
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'LOCAL-1', '2024-02-29', 'Historical fixture', 'pass'),
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'LOCAL-2', '2024-02-29', 'Historical fixture', 'fail'),
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'LOCAL-3', '2025-02-28', 'Mismatched legacy fixture', 'pass');
insert into public.fire_hose_testing_sessions(id, department_id, test_date, tester)
values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2099-01-01', 'Abandoned future legacy fixture');
insert into public.fire_hose_testing_results(testing_session_id, department_id, hose_id, inventory_number, test_date, tester, result)
values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'LOCAL-3', '2099-01-01', 'Abandoned future legacy fixture', 'pass');
create table fixture_history_snapshot as
select (select jsonb_agg(to_jsonb(r) order by id) from public.fire_hose_testing_results r) as results,
       (select jsonb_agg(to_jsonb(s) order by id) from public.fire_hose_testing_sessions s) as sessions;
create table fixture_inventory_snapshot as select jsonb_agg(to_jsonb(h) order by id) as inventory from public.fire_hose h;
create table fixture_policy_snapshot as
select jsonb_agg(to_jsonb(p) order by oid) as policies from pg_policy p;

\ir ../migrations/20261105193000_complete_fire_hose_tests_atomically.sql

select public.assert_test(last_test_date is null and next_test_date = '2027-06-01', 'migration does not infer dates from a matching legacy pass')
from public.fire_hose where inventory_number = 'LOCAL-1';
select public.assert_test(count(*) = 4, 'failed-only, unmatched, untested and other-department rows keep existing dates')
from public.fire_hose where inventory_number <> 'LOCAL-1' and last_test_date is null and next_test_date = '2027-06-01';
select public.assert_test(
  results = (select jsonb_agg(to_jsonb(r) order by id) from public.fire_hose_testing_results r)
  and sessions = (select jsonb_agg(to_jsonb(s) - 'completed_at' order by id) from public.fire_hose_testing_sessions s),
  'migration preserves every historical result and session byte-for-byte')
from fixture_history_snapshot;
select public.assert_test(inventory = (select jsonb_agg(to_jsonb(h) order by id) from public.fire_hose h),
  'migration preserves every existing inventory row byte-for-byte')
from fixture_inventory_snapshot;
select public.assert_test(bool_and(completed_at is null), 'legacy sessions are not retroactively marked completed')
from public.fire_hose_testing_sessions;
select public.assert_test(policies = (select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p),
  'migration preserves all existing RLS policies unchanged')
from fixture_policy_snapshot;

set role authenticated;
set test.user_id = '20000000-0000-0000-0000-000000000001';
set test.email = 'fixture@example.invalid';
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2026-11-05', 'Local Tester',
  '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
select public.assert_test(last_test_date = '2026-11-05' and next_test_date = '2027-11-05', 'completion saves actual test date and one-year anniversary')
from public.fire_hose where inventory_number = 'LOCAL-1';
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2027-01-10', 'Local Tester',
  '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
select public.assert_test(last_test_date = '2027-01-10' and next_test_date = '2028-01-10', 'subsequent completed test replaces dates')
from public.fire_hose where inventory_number = 'LOCAL-1';
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2025-03-01', 'Backdated fixture',
  '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
select public.assert_test(last_test_date = '2027-01-10' and next_test_date = '2028-01-10', 'older completed test cannot regress dates')
from public.fire_hose where inventory_number = 'LOCAL-1';
select public.assert_test(count(*) = 4, 'all historical and subsequent pass results remain')
from public.fire_hose_testing_results where hose_id = '30000000-0000-0000-0000-000000000001';

insert into public.deficiency_statuses values ('50000000-0000-0000-0000-000000000001', true);
insert into public.deficiencies values ('60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001');
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2028-02-29', 'Failed fixture',
  '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"fail"}]');
select public.assert_test(last_test_date = '2027-01-10' and next_test_date = '2028-01-10' and status = 'Out of Service', 'failed test preserves both dates and remains out of service')
from public.fire_hose where inventory_number = 'LOCAL-1';
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2028-02-29', 'Passed with deficiency',
  '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
select public.assert_test(last_test_date = '2028-02-29' and next_test_date = '2029-02-28' and status = 'Out of Service', 'leap date is clamped and existing deficiency stays blocking')
from public.fire_hose where inventory_number = 'LOCAL-1';

do $$
declare
  before_sessions integer := (select count(*) from public.fire_hose_testing_sessions);
  before_results integer := (select count(*) from public.fire_hose_testing_results);
  payload jsonb;
begin
  for payload in select value from jsonb_array_elements('[
    [],
    [{"hose_id":"30000000-0000-0000-0000-000000000001","result":"untested"}],
    [{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"},{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}],
    [{"hose_id":"30000000-0000-0000-0000-000000000005","result":"pass"}],
    [{"hose_id":"30000000-0000-0000-0000-000000000004","result":"pass"}],
    [{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"},{"hose_id":"30000000-0000-0000-0000-000000000002","result":"fail"}]
  ]'::jsonb) loop
    begin
      perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2030-01-01', 'Rejected fixture', payload);
      raise exception 'INVALID TEST INPUT ACCEPTED';
    exception when others then
      if sqlerrm = 'INVALID TEST INPUT ACCEPTED' then raise; end if;
    end;
    perform public.assert_test((select count(*) from public.fire_hose_testing_sessions) = before_sessions
      and (select count(*) from public.fire_hose_testing_results) = before_results,
      'invalid/duplicate/retired/foreign-department/missing-deficiency session rolls back all history');
  end loop;
  perform public.assert_test((select last_test_date = '2028-02-29' and next_test_date = '2029-02-28'
    from public.fire_hose where inventory_number = 'LOCAL-1'), 'multi-hose failure rolls back previously updated hose dates');
end;
$$;

set test.allow_writes = 'no';
do $$
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2030-01-01', 'Denied fixture',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'DENIED WRITE ACCEPTED';
  exception when insufficient_privilege then
    raise notice 'PASS: caller RLS denies completion without write permissions';
  end;
end;
$$;
set test.allow_writes = 'yes';

reset role;
create function public.reject_fixture_history() returns trigger language plpgsql as $$
begin
  if new.tester = 'Forced history failure' then raise exception 'Synthetic result insert failure'; end if;
  return new;
end;
$$;
create trigger reject_fixture_history before insert on public.fire_hose_testing_results
for each row execute function public.reject_fixture_history();
set role authenticated;
do $$
declare before_sessions integer := (select count(*) from public.fire_hose_testing_sessions);
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2030-01-01', 'Forced history failure',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'FAILED INSERT ACCEPTED';
  exception when others then
    if sqlerrm <> 'Synthetic result insert failure' then raise; end if;
  end;
  perform public.assert_test((select count(*) from public.fire_hose_testing_sessions) = before_sessions,
    'result insert failure also rolls back the parent session');
  perform public.assert_test((select last_test_date = '2028-02-29' from public.fire_hose where inventory_number = 'LOCAL-1'),
    'failed database save never advances dates');
end;
$$;
select public.assert_test(count(*) = 4, 'existing visible inventory still loads under caller RLS')
from public.fire_hose;
select public.assert_test(last_test_date is null and next_test_date = '2027-06-01', 'untested/abandoned hose still retains original next date')
from public.fire_hose where inventory_number = 'LOCAL-2';
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2026-11-05', 'New verified completion',
  '[{"hose_id":"30000000-0000-0000-0000-000000000003","result":"pass"}]');
select public.assert_test(last_test_date = '2026-11-05' and next_test_date = '2027-11-05',
  'new completion ignores both future-dated and mismatched unmarked legacy passes')
from public.fire_hose where inventory_number = 'LOCAL-3';
select public.assert_test(completed_at is not null, 'atomic Finish records explicit completion provenance')
from public.fire_hose_testing_sessions where tester = 'New verified completion';
update public.fire_hose set last_test_date = '2032-03-01', next_test_date = '2034-04-02'
where inventory_number = 'LOCAL-3';
select public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2027-01-01', 'Older than stored verified baseline',
  '[{"hose_id":"30000000-0000-0000-0000-000000000003","result":"pass"}]');
select public.assert_test(last_test_date = '2032-03-01' and next_test_date = '2034-04-02',
  'backdated Finish preserves both dates when existing last-test date is newer')
from public.fire_hose where inventory_number = 'LOCAL-3';

set test.user_id = '20000000-0000-0000-0000-000000000002';
do $$
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2030-01-01', 'Nonmember',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'NONMEMBER ACCEPTED';
  exception when insufficient_privilege then
    raise notice 'PASS: trusted membership is required even if a legacy policy allows email access';
  end;
end;
$$;
set test.user_id = '20000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000002', '2030-01-01', 'Wrong department',
      '[{"hose_id":"30000000-0000-0000-0000-000000000005","result":"pass"}]');
    raise exception 'CROSS-DEPARTMENT ACCEPTED';
  exception when insufficient_privilege then
    raise notice 'PASS: caller cannot complete another departments hose';
  end;
end;
$$;
set test.user_id = '';
do $$
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2030-01-01', 'Missing identity', '[]');
    raise exception 'MISSING IDENTITY ACCEPTED';
  exception when insufficient_privilege then
    raise notice 'PASS: authenticated role without an Auth identity is rejected';
  end;
end;
$$;
reset role;
create function public.reject_fixture_hose_update() returns trigger language plpgsql as $$
begin
  if new.last_test_date = '2035-01-01' then raise exception 'Synthetic inventory update failure'; end if;
  return new;
end;
$$;
create trigger reject_fixture_hose_update before update on public.fire_hose
for each row execute function public.reject_fixture_hose_update();
set role authenticated;
set test.user_id = '20000000-0000-0000-0000-000000000001';
do $$
declare
  before_sessions integer := (select count(*) from public.fire_hose_testing_sessions);
  before_results integer := (select count(*) from public.fire_hose_testing_results);
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2035-01-01', 'Inventory error',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'INVENTORY FAILURE ACCEPTED';
  exception when others then
    if sqlerrm <> 'Synthetic inventory update failure' then raise; end if;
  end;
  perform public.assert_test(
    (select count(*) from public.fire_hose_testing_sessions) = before_sessions
    and (select count(*) from public.fire_hose_testing_results) = before_results
    and (select last_test_date = '2028-02-29' from public.fire_hose where inventory_number = 'LOCAL-1'),
    'inventory write failure rolls back completed marker, session, results and dates');
end;
$$;
reset role;
set role anon;
do $$
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2030-01-01', 'Anonymous fixture', '[]');
    raise exception 'ANONYMOUS EXECUTION ACCEPTED';
  exception when insufficient_privilege then
    raise notice 'PASS: anonymous role cannot execute completion RPC';
  end;
end;
$$;
reset role;
select public.assert_test(count(*) = 1 and min(next_test_date) = '2027-06-01' and bool_and(last_test_date is null),
  'unrelated department inventory remains untouched')
from public.fire_hose where department_id = '10000000-0000-0000-0000-000000000002';

select public.assert_test(
  (select format_type(atttypid, atttypmod) = 'numeric' from pg_attribute
    where attrelid = 'public.fire_hose'::regclass and attname = 'hose_size')
  and (select format_type(atttypid, atttypmod) = 'uuid' from pg_attribute
    where attrelid = 'public.fire_hose_testing_sessions'::regclass and attname = 'id')
  and (select format_type(atttypid, atttypmod) = 'uuid' from pg_attribute
    where attrelid = 'public.fire_hose_testing_results'::regclass and attname = 'testing_session_id'),
  'fixture matches supplied Production numeric hose size and UUID history relationships');

create policy hide_fixture_results on public.fire_hose_testing_results as restrictive
for select to authenticated using (false);
set role authenticated;
do $$
declare
  before_dates jsonb := (select to_jsonb(h) from public.fire_hose h where inventory_number = 'LOCAL-1');
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2033-01-01', 'Hidden completion',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'HIDDEN RESULTS ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm <> 'Completed test results could not be verified; no test results were saved.' then raise; end if;
  end;
  perform public.assert_test(
    before_dates = (select to_jsonb(h) from public.fire_hose h where inventory_number = 'LOCAL-1'),
    'RLS-hidden results reject completion without changing inventory');
end;
$$;
reset role;
drop policy hide_fixture_results on public.fire_hose_testing_results;
select public.assert_test(
  not exists (select 1 from public.fire_hose_testing_sessions where tester = 'Hidden completion')
  and not exists (select 1 from public.fire_hose_testing_results where tester = 'Hidden completion'),
  'RLS-hidden completion rolls back both history tables');

create function public.skip_fixture_result() returns trigger language plpgsql as $$
begin
  if new.tester = 'Skipped completion' then return null; end if;
  return new;
end;
$$;
create trigger skip_fixture_result before insert on public.fire_hose_testing_results
for each row execute function public.skip_fixture_result();
set role authenticated;
do $$
declare
  before_dates jsonb := (select to_jsonb(h) from public.fire_hose h where inventory_number = 'LOCAL-1');
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2033-01-01', 'Skipped completion',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'SKIPPED RESULT ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm <> 'Completed test results could not be verified; no test results were saved.' then raise; end if;
  end;
  perform public.assert_test(
    before_dates = (select to_jsonb(h) from public.fire_hose h where inventory_number = 'LOCAL-1')
    and not exists (select 1 from public.fire_hose_testing_sessions where tester = 'Skipped completion')
    and not exists (select 1 from public.fire_hose_testing_results where tester = 'Skipped completion'),
    'trigger-skipped results roll back history and preserve inventory');
end;
$$;
reset role;
create or replace function public.member_has_inventory_permission(department_id uuid, permission_key text)
returns boolean language sql stable as $$ select null::boolean $$;
set role authenticated;
do $$
begin
  begin
    perform public.complete_fire_hose_test('10000000-0000-0000-0000-000000000001', '2033-01-01', 'Null permission',
      '[{"hose_id":"30000000-0000-0000-0000-000000000001","result":"pass"}]');
    raise exception 'NULL PERMISSION ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm <> 'Hose testing permission is required in this department.' then raise; end if;
    raise notice 'PASS: a NULL permission result fails at the explicit permission check';
  end;
end;
$$;
reset role;
