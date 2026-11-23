-- Run against an isolated synthetic PostgreSQL database only.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid
$$;
create table public.departments (id uuid primary key);
create table public.members (
  id uuid primary key, department_id uuid not null references public.departments,
  auth_user_id uuid, active boolean, role text, first_name text, last_name text,
  unique (id, department_id)
);
create table public.test_permissions (member_id uuid, permission text);
create table public.test_training_hours (member_id uuid, hours numeric);
create function public.can_manage_personnel(p_department_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.members m left join public.test_permissions p on p.member_id = m.id
    where m.department_id = p_department_id and m.auth_user_id = auth.uid()
      and m.active and (m.role = 'administrator' or p.permission = 'personnel_management')
  )
$$;
create function public.test_has_department(p_department_id uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.members where department_id = p_department_id and auth_user_id = auth.uid() and active)
$$;
alter table public.members enable row level security;
create policy test_members_read on public.members for select to authenticated using (public.test_has_department(department_id));
grant usage on schema auth, public to authenticated;
grant execute on function auth.uid() to authenticated;
grant select on public.members to authenticated;
insert into public.departments values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
insert into public.members(id,department_id,auth_user_id,active,role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true,'administrator'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',true,'firefighter'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',true,'firefighter'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004',true,'administrator');
update public.members set first_name = 'Alex', last_name = 'Smith' where id = '10000000-0000-0000-0000-000000000002';
update public.members set first_name = 'Sam', last_name = 'Jones' where id = '10000000-0000-0000-0000-000000000003';
insert into public.test_training_hours values ('10000000-0000-0000-0000-000000000002', 12);
insert into public.test_permissions values ('10000000-0000-0000-0000-000000000003', 'personnel_management');
grant select on public.test_training_hours to authenticated;
\ir ../../supabase/migrations/20261122230000_scba_mask_fit_testing.sql
set role authenticated;
select set_config('test.user_id', '20000000-0000-0000-0000-000000000001', false);
select public.save_scba_mask_fit_session(
 '00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 'Annual', '2025-01-01', 'Tester',
 '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Fail","mask_size":"S"},{"member_id":"10000000-0000-0000-0000-000000000003","result":"Pass","mask_size":"L"}]'::jsonb);
select public.save_scba_mask_fit_session(
 '00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 'Annual', '2025-01-01', 'Tester',
 '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Fail","mask_size":"S"},{"member_id":"10000000-0000-0000-0000-000000000003","result":"Pass","mask_size":"L"}]'::jsonb);
select public.save_scba_mask_fit_session(
 '00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',
 'Retest', '2025-01-02', 'Tester',
 '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Pass","mask_size":"M"}]'::jsonb);
do $$
begin
  if (select count(*) from public.scba_mask_fit_results) <> 3 then raise exception 'History or idempotency failed'; end if;
  if (select hours from public.test_training_hours) <> 12 then raise exception 'Fit tests changed training hours'; end if;
  if (select count(*) from public.search_scba_mask_fit_history('00000000-0000-0000-0000-000000000001', p_personnel => 'Alex Smith')) <> 2 then
    raise exception 'Personnel search failed';
  end if;
  if (select count(*) from public.search_scba_mask_fit_history('00000000-0000-0000-0000-000000000001', p_session_id => '30000000-0000-0000-0000-000000000001')) <> 2 then
    raise exception 'Session search failed';
  end if;
  begin
    perform public.save_scba_mask_fit_session('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','Invalid','2025-01-02','Tester',
      '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Pass","mask_size":"S"},{"member_id":"10000000-0000-0000-0000-000000000002","result":"Fail","mask_size":"M"}]'::jsonb);
    raise exception 'Duplicate accepted';
  exception when raise_exception then
    if sqlerrm = 'Duplicate accepted' then raise; end if;
  end;
  begin
    perform public.save_scba_mask_fit_session('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','Invalid','2025-01-02','Tester',
      '[{"member_id":"10000000-0000-0000-0000-000000000004","result":"Pass","mask_size":"S"}]'::jsonb);
    raise exception 'Cross-department member accepted';
  exception when raise_exception then
    if sqlerrm = 'Cross-department member accepted' then raise; end if;
  end;
  begin
    perform public.save_scba_mask_fit_session('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006','Invalid','2025-01-02','Tester',
      '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Pass"}]'::jsonb);
    raise exception 'Incomplete result accepted';
  exception when raise_exception then
    if sqlerrm = 'Incomplete result accepted' then raise; end if;
  end;
  begin
    perform public.save_scba_mask_fit_session('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Annual','2025-01-01','Tester',
      '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Pass","mask_size":"S"}]'::jsonb);
    raise exception 'Changed retry accepted';
  exception when raise_exception then
    if sqlerrm = 'Changed retry accepted' then raise; end if;
  end;
end $$;
select set_config('test.user_id', '20000000-0000-0000-0000-000000000002', false);
do $$
begin
  if (select count(*) from public.scba_mask_fit_results) <> 2 then raise exception 'Self history isolation failed'; end if;
  if (select count(*) from public.scba_mask_fit_sessions) <> 2 then raise exception 'Self session access failed'; end if;
  if (select count(*) from public.search_scba_mask_fit_history('00000000-0000-0000-0000-000000000001')) <> 2 then raise exception 'Self history search failed'; end if;
  if exists (select 1 from public.search_scba_mask_fit_history('00000000-0000-0000-0000-000000000001',
    p_member_id => '10000000-0000-0000-0000-000000000003')) then raise exception 'Self search exposed another member'; end if;
  begin
    perform public.save_scba_mask_fit_session('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','Invalid','2025-01-02','Tester',
      '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Pass","mask_size":"M"}]'::jsonb);
    raise exception 'Unauthorized save accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('test.user_id', '', false);
do $$
begin
  if exists (select 1 from public.search_scba_mask_fit_history('00000000-0000-0000-0000-000000000001')) then
    raise exception 'History search allowed an unauthenticated identity';
  end if;
end $$;
select set_config('test.user_id', '20000000-0000-0000-0000-000000000003', false);
do $$
begin
  if (select count(*) from public.scba_mask_fit_results) <> 3 then raise exception 'Personnel manager read failed'; end if;
  perform public.save_scba_mask_fit_session('00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006','Manager','2025-01-03','Tester',
    '[{"member_id":"10000000-0000-0000-0000-000000000002","result":"Pass","mask_size":"M"}]'::jsonb);
  begin
    update public.scba_mask_fit_results set result = 'Fail';
    raise exception 'Direct historical update accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('test.user_id', '20000000-0000-0000-0000-000000000004', false);
do $$
begin
  if exists (select 1 from public.scba_mask_fit_results) or exists (select 1 from public.scba_mask_fit_sessions) then
    raise exception 'Cross-department read allowed';
  end if;
  if exists (select 1 from public.search_scba_mask_fit_history('00000000-0000-0000-0000-000000000001')) then
    raise exception 'Cross-department history search allowed';
  end if;
end $$;
reset role;
insert into public.members(id,department_id,active,role,first_name,last_name)
select ('40000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000001', true, 'firefighter', 'Synthetic', 'Member' || lpad(n::text,3,'0')
from generate_series(1,225) n;
update public.members set auth_user_id = '20000000-0000-0000-0000-000000000002'
where id = '40000000-0000-0000-0000-000000000225';
insert into public.scba_mask_fit_sessions(id,department_id,name,test_date,tester_name,created_by)
select ('50000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000001', 'Scale session ' || n,
  make_date(2010+n,1,1), 'Tester', '10000000-0000-0000-0000-000000000001'
from generate_series(1,12) n;
insert into public.scba_mask_fit_results(department_id,session_id,member_id,result,mask_size)
select '00000000-0000-0000-0000-000000000001',
  ('50000000-0000-0000-0000-' || lpad(s::text,12,'0'))::uuid,
  ('40000000-0000-0000-0000-' || lpad(m::text,12,'0'))::uuid, 'Pass', 'M'
from generate_series(1,12) s cross join generate_series(1,225) m;
set role authenticated;
select set_config('test.user_id', '20000000-0000-0000-0000-000000000001', false);
do $$
declare v_count integer; v_distinct integer;
begin
  select count(*), count(distinct result_id) into v_count, v_distinct
  from (
    select h.result_id
    from generate_series(0,2500,500) offsets(n)
    cross join lateral public.search_scba_mask_fit_history(
      '00000000-0000-0000-0000-000000000001', p_session => 'Scale session',
      p_offset => offsets.n, p_limit => 500) h
  ) results;
  if v_count <> 2700 or v_distinct <> 2700 then raise exception 'Large history pagination lost or duplicated records'; end if;
  if (select count(*) from public.search_scba_mask_fit_history(
    '00000000-0000-0000-0000-000000000001', p_session => 'Scale session 12',
    p_limit => 500)) <> 225 then
    raise exception 'Large session filter failed';
  end if;
  if (select count(*) from public.search_scba_mask_fit_history(
    '00000000-0000-0000-0000-000000000001', p_personnel => 'Synthetic Member225',
    p_session => 'Scale session')) <> 12 then raise exception 'Large history personnel filter failed'; end if;
end $$;
select set_config('test.user_id', '20000000-0000-0000-0000-000000000002', false);
do $$
begin
  if (select count(*) from public.search_scba_mask_fit_history(
    '00000000-0000-0000-0000-000000000001', p_session => 'Scale session')) <> 12 then
    raise exception 'Large history self-only access failed';
  end if;
end $$;
