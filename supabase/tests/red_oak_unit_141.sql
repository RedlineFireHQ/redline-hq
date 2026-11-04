-- ISOLATED ONLY. Requires separate approval for each execution.
-- Use an owned schema-only database restored from the inspected Production schema,
-- before either apparatus draft, with no external workers or outbound integrations.
\set ON_ERROR_STOP on
\if :{?REDOAK_ISOLATED_TEST}
  \if :REDOAK_ISOLATED_TEST
  \else
    \echo 'REDOAK_ISOLATED_TEST must be enabled explicitly.'
    \quit 1
  \endif
\else
  \echo 'Requires explicit -v REDOAK_ISOLATED_TEST=1 and isolated database approval.'
  \quit 1
\endif
begin;
set local statement_timeout = '30s';
do $$
begin
  if current_database() not like 'redline_redoak_141_dev_%'
    or exists (select 1 from auth.users)
    or exists (select 1 from public.departments)
    or exists (select 1 from public.members)
    or exists (select 1 from public.apparatus)
    or exists (select 1 from public.deficiencies)
    or exists (select 1 from public.daily_checks) then
    raise exception 'Requires an empty, owned Red Oak schema-only isolated database.';
  end if;
end;
$$;
create function pg_temp.check_141(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
  raise notice 'PASS: %', p_message;
end;
$$;
create function pg_temp.reject_141(p_sql text, p_message text)
returns void language plpgsql as $$
declare v_constraint text;
begin
  begin
    execute p_sql;
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'red_oak_unit_141_check_exclusion' then raise; end if;
    perform pg_temp.check_141(true, p_message);
    return;
  end;
  raise exception 'FAIL: write succeeded: %', p_message;
end;
$$;
create function pg_temp.reject_access(p_sql text, p_message text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when insufficient_privilege then
    perform pg_temp.check_141(true, p_message);
    return;
  end;
  raise exception 'FAIL: unauthorized write succeeded: %', p_message;
end;
$$;
create function pg_temp.reject_rpc(p_sql text, p_expected text, p_message text)
returns void language plpgsql as $$
declare v_message text;
begin
  begin
    execute p_sql;
  exception when raise_exception then
    get stacked diagnostics v_message = message_text;
    if position(p_expected in v_message) = 0 then raise; end if;
    perform pg_temp.check_141(true, p_message);
    return;
  end;
  raise exception 'FAIL: RPC succeeded: %', p_message;
end;
$$;

insert into public.departments(id, name) values
('82f50d14-216a-4dd1-80f4-58459dc97b97', 'Synthetic Red Oak'),
('10000000-0000-0000-0000-000000000002', 'Synthetic other department');
insert into auth.users(id, email) values
('20000000-0000-0000-0000-000000000001', 'owner@example.test'),
('20000000-0000-0000-0000-000000000002', 'helper@example.test'),
('20000000-0000-0000-0000-000000000003', 'foreign@example.test'),
('20000000-0000-0000-0000-000000000004', 'second-helper@example.test');
insert into public.members(id, department_id, auth_user_id, email, first_name, last_name, active, role) values
('30000000-0000-0000-0000-000000000001', '82f50d14-216a-4dd1-80f4-58459dc97b97', '20000000-0000-0000-0000-000000000001', 'owner@example.test', 'Owner', 'Synthetic', true, 'Administrator'),
('30000000-0000-0000-0000-000000000002', '82f50d14-216a-4dd1-80f4-58459dc97b97', '20000000-0000-0000-0000-000000000002', 'helper@example.test', 'Helper', 'Synthetic', true, 'Firefighter'),
('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'foreign@example.test', 'Foreign', 'Synthetic', true, 'Administrator'),
('30000000-0000-0000-0000-000000000004', '82f50d14-216a-4dd1-80f4-58459dc97b97', '20000000-0000-0000-0000-000000000004', 'second-helper@example.test', 'Second helper', 'Synthetic', true, 'Firefighter');
insert into public.apparatus(id, department_id, name, type) values
('44d16b08-9adb-402a-bfe5-80ee5f4143c5', '82f50d14-216a-4dd1-80f4-58459dc97b97', '141', 'Engine'),
('57c966d3-107e-4c56-92ce-996edabe7d3c', '82f50d14-216a-4dd1-80f4-58459dc97b97', 'Daily Apparatus Checks', 'Administrative'),
('40000000-0000-0000-0000-000000000114', '82f50d14-216a-4dd1-80f4-58459dc97b97', '114', 'Engine'),
('40000000-0000-0000-0000-000000000115', '82f50d14-216a-4dd1-80f4-58459dc97b97', '115', 'Engine'),
('40000000-0000-0000-0000-000000000116', '82f50d14-216a-4dd1-80f4-58459dc97b97', '116', 'Engine'),
('40000000-0000-0000-0000-000000000117', '82f50d14-216a-4dd1-80f4-58459dc97b97', '117', 'Engine'),
('40000000-0000-0000-0000-000000000141', '10000000-0000-0000-0000-000000000002', '141', 'Engine');
insert into public.apparatus_inspection_settings(department_id, require_checklist)
select id, true from public.departments;
insert into public.apparatus_inspection_checklist_items(
  id, department_id, apparatus_id, section_name, item_label, is_required, display_order
) values
('4267b954-ca67-4a93-ac89-14d6bda940f9', '82f50d14-216a-4dd1-80f4-58459dc97b97', '57c966d3-107e-4c56-92ce-996edabe7d3c', 'Apparatus', '141', true, 14);
insert into public.apparatus_inspection_checklist_items(
  department_id, apparatus_id, section_name, item_label, is_required, display_order
)
select '82f50d14-216a-4dd1-80f4-58459dc97b97', '57c966d3-107e-4c56-92ce-996edabe7d3c',
  'Apparatus', label, true, ordinality
from unnest(array['114','115','116','117','120','121','130','131','135','140','142','145','ROFD Ranger']) with ordinality as items(label, ordinality);
insert into public.apparatus_inspection_checklist_items(
  department_id, apparatus_id, section_name, item_label, is_required, display_order
) values
('82f50d14-216a-4dd1-80f4-58459dc97b97', '57c966d3-107e-4c56-92ce-996edabe7d3c', 'Saturday Only', 'Radio Checks', false, 15),
('82f50d14-216a-4dd1-80f4-58459dc97b97', '57c966d3-107e-4c56-92ce-996edabe7d3c', 'Saturday Only', 'Fuel Checks', false, 16);
insert into public.apparatus_inspection_checklist_items(department_id, apparatus_id, section_name, item_label, is_required)
select department_id, id, 'Test', 'Required synthetic item', true from public.apparatus
where id <> '57c966d3-107e-4c56-92ce-996edabe7d3c';

-- Seed history before applying guards, using the schema owner's fixture access.
insert into public.apparatus_check_sessions(id, apparatus_id, department_id, member_id) values
('50000000-0000-0000-0000-000000000141', '44d16b08-9adb-402a-bfe5-80ee5f4143c5', '82f50d14-216a-4dd1-80f4-58459dc97b97', '30000000-0000-0000-0000-000000000001');
insert into public.apparatus_inspections(id, apparatus_id, department_id, member_id, status) values
('60000000-0000-0000-0000-000000000141', '44d16b08-9adb-402a-bfe5-80ee5f4143c5', '82f50d14-216a-4dd1-80f4-58459dc97b97', '30000000-0000-0000-0000-000000000001', 'ready');
insert into public.apparatus_inspection_checklist_results(
  inspection_id,department_id,apparatus_id,section_name_snapshot,item_label_snapshot,is_required_snapshot,result_status,item_order
) values (
  '60000000-0000-0000-0000-000000000141','82f50d14-216a-4dd1-80f4-58459dc97b97',
  '44d16b08-9adb-402a-bfe5-80ee5f4143c5','Historical','Synthetic historical item',true,'checked',1
);
insert into public.daily_checks(id,apparatus_id) values(1,'44d16b08-9adb-402a-bfe5-80ee5f4143c5');
insert into public.apparatus_inspection_checklist_progress(
  department_id, apparatus_id, member_id, checklist_item_id, status
) values
('82f50d14-216a-4dd1-80f4-58459dc97b97', '57c966d3-107e-4c56-92ce-996edabe7d3c', '30000000-0000-0000-0000-000000000001', '4267b954-ca67-4a93-ac89-14d6bda940f9', 'checked');
insert into public.apparatus_check_session_members(session_id, department_id, member_id, added_by_member_id) values
('50000000-0000-0000-0000-000000000141', '82f50d14-216a-4dd1-80f4-58459dc97b97', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001');
insert into public.deficiencies(id, apparatus_id, department_id, reported_by, description) values
('70000000-0000-0000-0000-000000000141', '44d16b08-9adb-402a-bfe5-80ee5f4143c5', '82f50d14-216a-4dd1-80f4-58459dc97b97', '30000000-0000-0000-0000-000000000001', 'Synthetic historical deficiency');
create temp table history_before as
select jsonb_build_object(
  'apparatus', (select jsonb_agg(to_jsonb(a) order by a.id) from public.apparatus a),
  'sessions', (select jsonb_agg(to_jsonb(s) order by s.id) from public.apparatus_check_sessions s),
  'inspections', (select jsonb_agg(to_jsonb(i) order by i.id) from public.apparatus_inspections i),
  'progress', (select jsonb_agg(to_jsonb(p) order by p.id) from public.apparatus_inspection_checklist_progress p),
  'participants', (select jsonb_agg(to_jsonb(p) order by p.id) from public.apparatus_check_session_members p),
  'results', (select jsonb_agg(to_jsonb(r) order by r.id) from public.apparatus_inspection_checklist_results r),
  'template', (select jsonb_agg(to_jsonb(i) order by i.id) from public.apparatus_inspection_checklist_items i),
  'legacy', (select jsonb_agg(to_jsonb(d) order by d.id) from public.daily_checks d),
  'deficiencies', (select jsonb_agg(to_jsonb(d) order by d.id) from public.deficiencies d)
) snapshot;
create temp table security_before as
select p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig
from pg_proc p where p.pronamespace = 'public'::regnamespace;
create temp table policies_before as select * from pg_policies where schemaname = 'public';
create temp table table_security_before as
select oid,relacl,relrowsecurity from pg_class where relnamespace='public'::regnamespace;

\ir ../migrations/20261104091000_scope_red_oak_apparatus_check_exclusions.sql
\ir ../migrations/20261104092000_guard_red_oak_unit_141_check_writes.sql

select pg_temp.check_141((select snapshot from history_before) = jsonb_build_object(
  'apparatus', (select jsonb_agg(to_jsonb(a) order by a.id) from public.apparatus a),
  'sessions', (select jsonb_agg(to_jsonb(s) order by s.id) from public.apparatus_check_sessions s),
  'inspections', (select jsonb_agg(to_jsonb(i) order by i.id) from public.apparatus_inspections i),
  'progress', (select jsonb_agg(to_jsonb(p) order by p.id) from public.apparatus_inspection_checklist_progress p),
  'participants', (select jsonb_agg(to_jsonb(p) order by p.id) from public.apparatus_check_session_members p),
  'results', (select jsonb_agg(to_jsonb(r) order by r.id) from public.apparatus_inspection_checklist_results r),
  'template', (select jsonb_agg(to_jsonb(i) order by i.id) from public.apparatus_inspection_checklist_items i),
  'legacy', (select jsonb_agg(to_jsonb(d) order by d.id) from public.daily_checks d),
  'deficiencies', (select jsonb_agg(to_jsonb(d) order by d.id) from public.deficiencies d)
), 'migration preserves history byte-for-byte as JSON');
select pg_temp.check_141(not exists (
  select 1 from security_before b left join pg_proc p on p.oid = b.oid
  where p.oid is null or row(p.proowner,p.proacl,p.prosecdef,p.proconfig) is distinct from row(b.proowner,b.proacl,b.prosecdef,b.proconfig)
), 'existing function owners, ACLs and security settings unchanged');
select pg_temp.check_141(not exists (
  select 1 from table_security_before b left join pg_class c on c.oid=b.oid
  where c.oid is null or row(c.relacl,c.relrowsecurity) is distinct from row(b.relacl,b.relrowsecurity)
), 'existing table grants and RLS activation unchanged');
select pg_temp.check_141(not exists (
  (select * from policies_before except select * from pg_policies where schemaname='public')
  union all
  (select * from pg_policies where schemaname='public' except select * from policies_before)
), 'all existing RLS policies unchanged');

-- Ownership restrictions are additive and applied after the existing-policy
-- preservation assertions above. No inspection UPDATE permission is added.
\ir ../migrations/20261104093000_enforce_apparatus_inspection_write_ownership.sql

select pg_temp.check_141(not exists (
  select 1 from security_before b left join pg_proc p on p.oid=b.oid
  where p.oid is null or row(p.proowner,p.proacl,p.prosecdef,p.proconfig)
    is distinct from row(b.proowner,b.proacl,b.prosecdef,b.proconfig)
), 'ownership migration preserves all existing RPC security settings and grants');
select pg_temp.check_141(not exists (
  select 1 from table_security_before b left join pg_class c on c.oid=b.oid
  where c.oid is null or row(c.relacl,c.relrowsecurity) is distinct from row(b.relacl,b.relrowsecurity)
), 'ownership migration leaves table grants and RLS enabled unchanged');
select pg_temp.check_141(not exists (
  select 1 from policies_before b left join pg_policies p
    on p.schemaname=b.schemaname and p.tablename=b.tablename and p.policyname=b.policyname
  where p.policyname is null or to_jsonb(p) is distinct from to_jsonb(b)
), 'ownership migration preserves every pre-existing policy');

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'owner@example.test';
set local request.jwt.claim.role = 'authenticated';
select pg_temp.check_141(
  exists(select 1 from public.apparatus_inspections where id='60000000-0000-0000-0000-000000000141')
  and exists(select 1 from public.apparatus_check_sessions where id='50000000-0000-0000-0000-000000000141')
  and exists(select 1 from public.apparatus_inspection_checklist_progress where checklist_item_id='4267b954-ca67-4a93-ac89-14d6bda940f9')
  and exists(select 1 from public.apparatus_check_session_members where session_id='50000000-0000-0000-0000-000000000141')
  and exists(select 1 from public.apparatus_inspection_checklist_results where inspection_id='60000000-0000-0000-0000-000000000141')
  and exists(select 1 from public.daily_checks where id=1)
  and exists(select 1 from public.deficiencies where id='70000000-0000-0000-0000-000000000141'),
  'existing Unit 141 history remains readable');
select pg_temp.reject_141($q$
  insert into public.apparatus_check_sessions(apparatus_id,department_id,member_id)
  values('44d16b08-9adb-402a-bfe5-80ee5f4143c5','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001')
$q$, 'direct session insert rejected');
select pg_temp.reject_141($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('44d16b08-9adb-402a-bfe5-80ee5f4143c5','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001','ready')
$q$, 'direct inspection insert rejected');
select pg_temp.reject_141($q$
  update public.apparatus_inspection_checklist_progress set status='not_applicable'
  where checklist_item_id='4267b954-ca67-4a93-ac89-14d6bda940f9'
$q$, 'Daily 141 progress update rejected');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
set local request.jwt.claim.email = 'helper@example.test';
select pg_temp.reject_141($q$
  insert into public.apparatus_inspection_checklist_progress(department_id,apparatus_id,member_id,checklist_item_id,status)
  values('82f50d14-216a-4dd1-80f4-58459dc97b97','57c966d3-107e-4c56-92ce-996edabe7d3c','30000000-0000-0000-0000-000000000002','4267b954-ca67-4a93-ac89-14d6bda940f9','checked')
$q$, 'Daily 141 progress insert rejected');
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'owner@example.test';
select pg_temp.reject_141($q$
  insert into public.apparatus_check_session_members(session_id,department_id,member_id,added_by_member_id)
  values('50000000-0000-0000-0000-000000000141','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001')
$q$, 'existing-session participant insert rejected');
select pg_temp.check_141(not public.can_insert_apparatus_check_session_member(
  '50000000-0000-0000-0000-000000000141','82f50d14-216a-4dd1-80f4-58459dc97b97',
  '30000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001'
), 'participant policy helper returns false');
select pg_temp.reject_141($q$
  insert into public.deficiencies(apparatus_id,department_id,reported_by,description)
  values('44d16b08-9adb-402a-bfe5-80ee5f4143c5','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001','Blocked synthetic deficiency')
$q$, 'direct Unit 141 deficiency rejected');
select pg_temp.reject_141($q$
  insert into public.deficiencies(inspection_id,department_id,reported_by,description)
  values('60000000-0000-0000-0000-000000000141','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001','Blocked indirect deficiency')
$q$, 'inspection-linked deficiency rejected without apparatus_id');
select pg_temp.reject_141($q$
  insert into public.deficiencies(check_session_id,department_id,reported_by,description)
  values('50000000-0000-0000-0000-000000000141','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001','Blocked indirect session deficiency')
$q$, 'session-linked deficiency rejected without apparatus_id');
select pg_temp.reject_rpc($q$select public.get_or_create_apparatus_check_session('44d16b08-9adb-402a-bfe5-80ee5f4143c5')$q$,
  'Unit 141 is excluded', 'session RPC rejected');
select pg_temp.reject_rpc($q$select public.complete_apparatus_check('50000000-0000-0000-0000-000000000141','ready')$q$,
  'Unit 141 is excluded', 'completion RPC rejected');
select pg_temp.reject_rpc($q$select public.save_apparatus_inspection('44d16b08-9adb-402a-bfe5-80ee5f4143c5','ready')$q$,
  'Unit 141 is excluded', 'legacy inspection RPC rejected');

do $$
declare a record; v_session uuid; v_result jsonb;
begin
  for a in select * from public.apparatus where name in ('114','115','116','117') loop
    v_session := public.get_or_create_apparatus_check_session(a.id);
    insert into public.apparatus_inspection_checklist_progress(department_id,apparatus_id,member_id,checklist_item_id,status)
    select a.department_id,a.id,'30000000-0000-0000-0000-000000000001',i.id,'checked'
    from public.apparatus_inspection_checklist_items i where i.apparatus_id=a.id;
    insert into public.apparatus_check_session_members(session_id,department_id,member_id,added_by_member_id)
    values(v_session,a.department_id,'30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001');
    v_result := public.complete_apparatus_check(v_session,'ready');
    perform pg_temp.check_141(v_result->>'inspection_id' is not null, 'normal check completes: ' || a.name);
  end loop;
end;
$$;
create temp table daily_session as select public.get_or_create_apparatus_check_session('57c966d3-107e-4c56-92ce-996edabe7d3c') id;
insert into public.apparatus_inspection_checklist_progress(department_id,apparatus_id,member_id,checklist_item_id,status)
select department_id,apparatus_id,'30000000-0000-0000-0000-000000000001',id,'checked'
from public.apparatus_inspection_checklist_items
where apparatus_id='57c966d3-107e-4c56-92ce-996edabe7d3c' and item_label<>'141' and is_required;
do $$
declare v_result jsonb;
begin
  if extract(dow from current_timestamp at time zone 'America/Chicago')=6 then
    perform pg_temp.reject_rpc(
      'select public.complete_apparatus_check((select id from daily_session),''ready'')',
      'complete all required', 'Saturday completion rejects missing Radio/Fuel');
    insert into public.apparatus_inspection_checklist_progress(department_id,apparatus_id,member_id,checklist_item_id,status)
    select department_id,apparatus_id,'30000000-0000-0000-0000-000000000001',id,'checked'
    from public.apparatus_inspection_checklist_items
    where apparatus_id='57c966d3-107e-4c56-92ce-996edabe7d3c' and section_name='Saturday Only';
  end if;
  v_result := public.complete_apparatus_check((select id from daily_session),'ready');
  perform pg_temp.check_141(v_result->>'inspection_id' is not null, 'Daily completion works on actual Central calendar day');
  perform pg_temp.check_141(
    (select count(*) from public.apparatus_inspection_checklist_results
      where inspection_id=(v_result->>'inspection_id')::uuid)
      = case when extract(dow from current_timestamp at time zone 'America/Chicago')=6 then 15 else 13 end,
    'Daily results contain 13 ordinary items plus two on Saturday, never historical 141 progress');
end;
$$;
-- Evaluate the installed RPC's exact required predicate at both dates without
-- changing its function body or the shared machine/database clock.
do $$
declare v_source text; v_predicate text; v_count integer; v_clock timestamptz;
begin
  v_source := pg_get_functiondef('public.complete_apparatus_check(uuid,text,text,integer,numeric)'::regprocedure);
  v_predicate := substring(v_source from '(and \(\s*i.is_required = true or \([^;]*\))');
  if v_predicate is null then raise exception 'Installed required predicate could not be extracted'; end if;
  v_predicate := replace(v_predicate,'v_department_id','i.department_id');
  v_predicate := replace(v_predicate,'v_apparatus_id','i.apparatus_id');
  foreach v_clock in array array['2026-11-06 18:00:00+00'::timestamptz,'2026-11-07 18:00:00+00'::timestamptz] loop
    execute 'select count(*) from public.apparatus_inspection_checklist_items i where i.apparatus_id=''57c966d3-107e-4c56-92ce-996edabe7d3c'' and i.is_active and i.item_label<>''141'' '
      || replace(v_predicate,'current_timestamp',quote_literal(v_clock)||'::timestamptz') into v_count;
    perform pg_temp.check_141(v_count=case when extract(dow from v_clock at time zone 'America/Chicago')=6 then 15 else 13 end,
      'installed Saturday required predicate preserves 13/15 counts');
  end loop;
end;
$$;
create temp table deficiency_session as select public.get_or_create_apparatus_check_session('40000000-0000-0000-0000-000000000114') id;
insert into public.deficiencies(id,apparatus_id,department_id,check_session_id,reported_by,description)
select '70000000-0000-0000-0000-000000000114','40000000-0000-0000-0000-000000000114',
  '82f50d14-216a-4dd1-80f4-58459dc97b97',id,'30000000-0000-0000-0000-000000000001','Allowed synthetic deficiency'
from deficiency_session;
update public.deficiencies set repair_notes='Allowed synthetic history edit'
where id='70000000-0000-0000-0000-000000000141';
select pg_temp.reject_141($q$
  update public.deficiencies set inspection_id='60000000-0000-0000-0000-000000000141'
  where id='70000000-0000-0000-0000-000000000114'
$q$, 'new Unit 141 association on existing deficiency rejected');
do $$
declare v_result jsonb;
begin
  v_result := public.complete_apparatus_check((select id from deficiency_session),'needs_attention');
  perform pg_temp.check_141(
    exists(select 1 from public.deficiencies
      where id='70000000-0000-0000-0000-000000000114'
        and inspection_id=(v_result->>'inspection_id')::uuid),
    'allowed apparatus deficiency workflow completes and links the inspection');
  perform pg_temp.check_141(
    exists(select 1 from public.deficiencies
      where id='70000000-0000-0000-0000-000000000141' and repair_notes='Allowed synthetic history edit'),
    'historical Unit 141 deficiency repairs retain existing authorization');
end;
$$;

set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'foreign@example.test';
select pg_temp.reject_141($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('44d16b08-9adb-402a-bfe5-80ee5f4143c5','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','ready')
$q$, 'cross-department Unit 141 inspection rejected even with forged department');
select pg_temp.reject_access($q$
  insert into public.apparatus_check_sessions(apparatus_id,department_id,member_id)
  values('40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001')
$q$, 'cross-department direct session denied');
select pg_temp.reject_rpc($q$select public.get_or_create_apparatus_check_session('40000000-0000-0000-0000-000000000114')$q$,
  'Unable to resolve', 'cross-department RPC denied');
do $$
declare v_session uuid; v_result jsonb;
begin
  v_session := public.get_or_create_apparatus_check_session('40000000-0000-0000-0000-000000000141');
  insert into public.apparatus_inspection_checklist_progress(department_id,apparatus_id,member_id,checklist_item_id,status)
  select department_id,apparatus_id,'30000000-0000-0000-0000-000000000003',id,'checked'
  from public.apparatus_inspection_checklist_items where apparatus_id='40000000-0000-0000-0000-000000000141';
  v_result := public.complete_apparatus_check(v_session,'ready');
  perform pg_temp.check_141(v_result->>'inspection_id' is not null, 'other department apparatus named 141 works normally');
end;
$$;
set local request.jwt.claim.sub = '';
set local request.jwt.claim.email = '';
select pg_temp.reject_access($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001','ready')
$q$, 'unauthorized direct inspection denied');
select pg_temp.reject_rpc($q$select public.get_or_create_apparatus_check_session('40000000-0000-0000-0000-000000000114')$q$,
  'Unable to resolve', 'unauthorized RPC denied');
set local role anon;
set local request.jwt.claim.role = 'anon';
select pg_temp.reject_access($q$select public.get_or_create_apparatus_check_session('40000000-0000-0000-0000-000000000114')$q$,
  'anonymous role still cannot execute session RPC');

-- Owner-only probes cover writes that RLS already denies to application users.
reset role;
select pg_temp.reject_141($q$
  insert into public.daily_checks(id,apparatus_id) values(2,'44d16b08-9adb-402a-bfe5-80ee5f4143c5')
$q$, 'legacy daily_checks write rejected');
select pg_temp.reject_141($q$
  insert into public.apparatus_inspection_checklist_results(
    inspection_id,department_id,apparatus_id,section_name_snapshot,item_label_snapshot,is_required_snapshot,result_status,item_order
  ) select completed_inspection_id,'82f50d14-216a-4dd1-80f4-58459dc97b97','57c966d3-107e-4c56-92ce-996edabe7d3c','Apparatus','141',true,'checked',1
  from public.apparatus_check_sessions where id=(select id from daily_session)
$q$, 'detached Daily 141 snapshot rejected without excluded inspection');
select pg_temp.reject_141($q$
  insert into public.apparatus_inspection_checklist_results(
    inspection_id,department_id,apparatus_id,section_name_snapshot,item_label_snapshot,is_required_snapshot,result_status,item_order
  ) values('60000000-0000-0000-0000-000000000141','82f50d14-216a-4dd1-80f4-58459dc97b97','40000000-0000-0000-0000-000000000114','Test','Ordinary synthetic item',true,'checked',1)
$q$, 'indirect inspection result cannot disguise Unit 141 with an allowed apparatus_id');
select pg_temp.reject_141($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('44d16b08-9adb-402a-bfe5-80ee5f4143c5','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','ready')
$q$, 'spoofed department cannot bypass exact apparatus identity guard');
select pg_temp.reject_141($q$
  update public.apparatus_check_sessions set apparatus_id='44d16b08-9adb-402a-bfe5-80ee5f4143c5'
  where id=(select id from deficiency_session)
$q$, 'existing allowed session cannot be retargeted to Unit 141');
select pg_temp.check_141(not has_function_privilege('authenticated','public.guard_red_oak_unit_141_check_write()','EXECUTE')
  and not has_function_privilege('anon','public.guard_red_oak_unit_141_check_write()','EXECUTE'),
  'new definer guard is not exposed as an application RPC');

-- Regression for the reproduced forged-department inspection INSERT.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'foreign@example.test';
select pg_temp.reject_access($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('40000000-0000-0000-0000-000000000114','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','ready')
$q$, 'cross-department normal inspection cannot forge its department');
select pg_temp.reject_access($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000003','ready')
$q$, 'foreign user cannot insert by supplying the actual Red Oak department');
select pg_temp.check_141(not public.can_write_apparatus_inspection(
  '40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97'
), 'actual-parent ownership helper rejects foreign department');
do $$
declare v_changed integer;
begin
  update public.apparatus_inspections set notes='Foreign overwrite'
  where apparatus_id='40000000-0000-0000-0000-000000000114';
  get diagnostics v_changed=row_count;
  perform pg_temp.check_141(v_changed=0,'foreign user cannot modify another department inspection');
  update public.apparatus_inspections set apparatus_id='40000000-0000-0000-0000-000000000114'
  where apparatus_id='40000000-0000-0000-0000-000000000141';
  get diagnostics v_changed=row_count;
  perform pg_temp.check_141(v_changed=0,'direct UPDATE remains denied and cannot retarget own inspection');
end;
$$;
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email='owner@example.test';
select pg_temp.check_141(public.can_write_apparatus_inspection(
  '40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97'
), 'actual-parent ownership helper authorizes active owning member');
do $$
declare a record;
begin
  for a in select id,department_id,name from public.apparatus where name in ('114','115','116','117') loop
    insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status,notes)
    values(a.id,a.department_id,'30000000-0000-0000-0000-000000000001','ready','Valid direct synthetic inspection');
    perform pg_temp.check_141(exists(
      select 1 from public.apparatus_inspections where apparatus_id=a.id and notes='Valid direct synthetic inspection'
    ),'own department direct inspection succeeds: '||a.name);
  end loop;
end;
$$;
select pg_temp.reject_access($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('40000000-0000-0000-0000-000000000114','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','ready')
$q$, 'own department user cannot submit mismatched inspection department');
reset role;
select pg_temp.check_141(not exists(
  select 1 from public.apparatus_inspections where notes='Foreign overwrite'
),'foreign update changed no stored inspection');
update public.members set active=false where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.reject_access($q$
  insert into public.apparatus_inspections(apparatus_id,department_id,member_id,status)
  values('40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97','30000000-0000-0000-0000-000000000001','ready')
$q$, 'inactive owning member cannot create inspections');
reset role;
update public.members set active=true,auth_user_id=null where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.check_141(public.can_write_apparatus_inspection(
  '40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97'
), 'unlinked roster member retains verified Auth-email fallback');
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email='owner@example.test';
select pg_temp.check_141(not public.can_write_apparatus_inspection(
  '40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97'
), 'forged claim email cannot authorize a foreign Auth identity');
set local request.jwt.claim.sub='';
select pg_temp.check_141(not public.can_write_apparatus_inspection(
  '40000000-0000-0000-0000-000000000114','82f50d14-216a-4dd1-80f4-58459dc97b97'
), 'email alone without authenticated UID cannot authorize an inspection');
reset role;
select pg_temp.reject_access($q$
  update public.apparatus_inspections set department_id='10000000-0000-0000-0000-000000000002'
  where apparatus_id='40000000-0000-0000-0000-000000000114'
$q$, 'ownership trigger rejects mismatched UPDATE even under schema-owner/RPC visibility');
rollback;
