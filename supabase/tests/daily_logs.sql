\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_database() not like 'redline_daily_log_dev_%' or exists(select 1 from public.members) then
    raise exception 'Requires an empty, owned schema-only Daily Log test database';
  end if;
end;
$$;
create function pg_temp.check_log(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
  raise notice 'PASS: %', p_message;
end;
$$;
insert into public.departments(id,name) values
('10000000-0000-0000-0000-000000000001','Daily Log local A'),
('10000000-0000-0000-0000-000000000002','Daily Log local B');
insert into auth.users(id,email) values
('20000000-0000-0000-0000-000000000001','creator@example.test'),
('20000000-0000-0000-0000-000000000002','peer@example.test'),
('20000000-0000-0000-0000-000000000003','admin@example.test'),
('20000000-0000-0000-0000-000000000004','foreign@example.test');
insert into public.members(id,department_id,auth_user_id,first_name,last_name,email,active,role) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Creator','Local','creator@example.test',true,'Firefighter'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Peer','Local','peer@example.test',true,'Firefighter'),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Admin','Local','admin@example.test',true,'Administrator'),
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','Foreign','Local','foreign@example.test',true,'Administrator');
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
create temp table full_log as select public.save_daily_log(
  '10000000-0000-0000-0000-000000000001',null,'2026-11-03','09:30',
  'Station Alpha','Checked medical equipment','Engine 7',null) id;
create temp table blank_log as select public.save_daily_log(
  '10000000-0000-0000-0000-000000000001',null,null,null,null,null,null,null) id;
select pg_temp.check_log(
  (select count(*)=2 from public.daily_logs)
  and (select entry_date is null and entry_time is null and location is null and activity is null and unit is null
    from public.daily_logs where id=(select id from blank_log)), 'all five fields can be blank');
select pg_temp.check_log(
  (select created_by='30000000-0000-0000-0000-000000000001' and created_at is not null and edited_at is null
    from public.daily_logs where id=(select id from full_log)), 'server captures original creator and timestamp');
select pg_temp.check_log(
  (select count(*)=1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','MEDICAL'))
  and (select count(*)=1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','station alpha'))
  and (select count(*)=1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','engine 7'))
  and (select count(*)=1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','2026-11-03'))
  and (select count(*)=1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','11/03/2026'))
  and (select count(*)=1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','Nov 3, 2026')),
  'activity, location, unit and date search work case insensitively');
select pg_temp.check_log(
  not exists(select 1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','%_,()')),
  'search treats SQL/PostgREST special characters literally');
create temp table version_before as select * from public.daily_logs where id=(select id from full_log);
select public.save_daily_log(department_id,id,entry_date,entry_time,location,repeat('Large activity ',10000),unit,created_at)
from version_before;
select pg_temp.check_log(
  (select l.created_at=b.created_at and l.created_by=b.created_by
    and l.edited_by=l.created_by and l.edited_at is not null and length(l.activity)=150000
    from public.daily_logs l join version_before b on l.id=b.id),
  'creator edit preserves origin, tracks editor, and accepts substantial activity text');
do $$
begin
  begin
    perform public.save_daily_log(department_id,id,entry_date,entry_time,location,'Stale overwrite',unit,created_at)
    from version_before;
    raise exception 'Stale update succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'stale updates are rejected'); end;
  begin
    update public.daily_logs set created_by='30000000-0000-0000-0000-000000000003';
    raise exception 'Direct audit tampering succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'direct writes cannot forge audit metadata'); end;
  begin
    delete from public.daily_logs;
    raise exception 'Direct delete succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'hard deletion is not granted'); end;
end;
$$;
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000002';
select pg_temp.check_log((select count(*)=2 from public.daily_logs),'same-department peers can read entries');
do $$
declare v_log public.daily_logs%rowtype;
begin
  select * into v_log from public.daily_logs where id=(select id from full_log);
  begin
    perform public.save_daily_log(v_log.department_id,v_log.id,null,null,null,'Peer edit',null,coalesce(v_log.edited_at,v_log.created_at));
    raise exception 'Peer edit succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'noncreator cannot edit'); end;
  begin
    perform public.archive_daily_log(v_log.department_id,v_log.id,coalesce(v_log.edited_at,v_log.created_at));
    raise exception 'Peer archive succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'ordinary members cannot archive'); end;
end;
$$;
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000004';
set local request.jwt.claim.email='creator@example.test';
select pg_temp.check_log(not exists(select 1 from public.daily_logs)
  and not exists(select 1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','')),
  'foreign department Administrator cannot read or search another department');
do $$
begin
  begin
    perform public.save_daily_log('10000000-0000-0000-0000-000000000001',null,null,null,null,null,null,null);
    raise exception 'Foreign create succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'foreign department create rejected'); end;
  begin
    perform public.save_daily_log('10000000-0000-0000-0000-000000000002',(select id from full_log),null,null,null,null,null,now());
    raise exception 'Foreign edit succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'foreign record cannot be edited using own department'); end;
  begin
    perform public.archive_daily_log('10000000-0000-0000-0000-000000000002',(select id from full_log),now());
    raise exception 'Foreign archive succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'foreign record cannot be archived using own department'); end;
end;
$$;
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000003';
select public.save_daily_log(department_id,id,entry_date,entry_time,location,'Administrator edit',unit,coalesce(edited_at,created_at))
from public.daily_logs where id=(select id from full_log);
select pg_temp.check_log(
  (select created_by='30000000-0000-0000-0000-000000000001'
    and edited_by='30000000-0000-0000-0000-000000000003'
    from public.daily_logs where id=(select id from full_log)), 'Administrator can edit while preserving creator');
select public.save_daily_log('10000000-0000-0000-0000-000000000001',null,'2026-11-04','01:00',null,'Newest day',null,null);
select public.save_daily_log('10000000-0000-0000-0000-000000000001',null,'2026-11-03','23:59',null,'Later time',null,null);
select pg_temp.check_log(
  (select array_agg(activity)=array['Newest day','Later time','Administrator edit',null]::text[]
    from public.search_daily_logs('10000000-0000-0000-0000-000000000001')),
  'history sorts by date then time, newest first; undated entries last');
select public.archive_daily_log(department_id,id,coalesce(edited_at,created_at))
from public.daily_logs where id=(select id from full_log);
select pg_temp.check_log(
  not exists(select 1 from public.daily_logs where id=(select id from full_log))
  and not exists(select 1 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','Administrator edit')),
  'archived record disappears from normal history and search');
reset role;
select pg_temp.check_log(
  (select archived_by='30000000-0000-0000-0000-000000000003' and archived_at is not null
    and created_by='30000000-0000-0000-0000-000000000001' and activity='Administrator edit'
    from public.daily_logs where id=(select id from full_log)), 'archival retains content and all accountability metadata');
update public.members set active=false where id='30000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
select pg_temp.check_log(not exists(select 1 from public.daily_logs),'inactive membership cannot read entries');
do $$
begin
  begin
    perform public.save_daily_log('10000000-0000-0000-0000-000000000001',null,null,null,null,null,null,null);
    raise exception 'Inactive create succeeded';
  exception when insufficient_privilege then perform pg_temp.check_log(true,'inactive membership cannot create'); end;
end;
$$;
reset role;
select pg_temp.check_log(
  not has_function_privilege('anon','public.save_daily_log(uuid,uuid,date,time,text,text,text,timestamptz)','EXECUTE')
  and not has_table_privilege('anon','public.daily_logs','SELECT')
  and not has_table_privilege('authenticated','public.daily_logs','DELETE')
  and not has_table_privilege('service_role','public.daily_logs','UPDATE'),
  'anonymous access, hard deletes and direct service mutations are not granted');
set local role authenticated;
set local request.jwt.claim.sub='20000000-0000-0000-0000-000000000003';
select public.save_daily_log('10000000-0000-0000-0000-000000000001',null,'2026-11-05','12:00',null,
  'Pagination ' || i::text,null,null) from generate_series(1,55) i;
select pg_temp.check_log(
  (select count(*)=51 from public.search_daily_logs('10000000-0000-0000-0000-000000000001'))
  and (select count(*)=8 from public.search_daily_logs('10000000-0000-0000-0000-000000000001','',50))
  and not exists(
    select id from public.search_daily_logs('10000000-0000-0000-0000-000000000001') with ordinality
    where ordinality<=50
    intersect select id from public.search_daily_logs('10000000-0000-0000-0000-000000000001','',50)
  ), 'paginated history includes older records without overlaps or silent truncation');
reset role;
rollback;
