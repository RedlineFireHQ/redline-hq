\set ON_ERROR_STOP on
begin;
-- Test-only grants reproduce relevant privileges on the local source, whose ACLs were not dumped.
grant usage on schema public to authenticated;
grant select on public.auth_user_department_memberships to authenticated;
revoke select on public.members from authenticated;
insert into public.departments(id, name) values
 ('10000000-0000-0000-0000-000000000001','Synthetic A'),
 ('10000000-0000-0000-0000-000000000002','Synthetic B');
insert into auth.users(id, email) values
 ('30000000-0000-0000-0000-000000000001','hydro-admin@example.invalid'),
 ('30000000-0000-0000-0000-000000000002','hydro-reader@example.invalid'),
 ('30000000-0000-0000-0000-000000000003','hydro-other@example.invalid');
insert into public.members(id,department_id,first_name,last_name,role,active,auth_user_id) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Synthetic','Admin','Administrator',true,'30000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Synthetic','Reader','Firefighter',true,'30000000-0000-0000-0000-000000000002'),
 ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Synthetic','Other','Administrator',true,'30000000-0000-0000-0000-000000000003');
insert into public.auth_user_department_memberships(auth_user_id,department_id,member_id) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003')
 on conflict (auth_user_id,department_id) do update set member_id = excluded.member_id;
insert into public.scba_cylinders(id,department_id,cylinder_number,cylinder_type,in_service_date,status) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A1','Steel','2020-01-01','Ready'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B1','Steel','2020-01-01','Ready');
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
set local role authenticated;
select public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001',null,'2024-02-29','Tester','Company',null,
 '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Fail"}]') as session_id \gset
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 1 then raise exception 'Administrator cannot read'; end if;
end $$;
reset role;
do $$ begin
 if (select status from public.scba_cylinders where id='20000000-0000-0000-0000-000000000001') <> 'Ready' then raise exception 'Failed test changed status'; end if;
 if (select next_hydrostatic_test_due_date from public.scba_cylinders where id='20000000-0000-0000-0000-000000000001') <> '2029-02-28' then raise exception 'Bad due date'; end if;
end $$;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 0 then raise exception 'Unpermitted reader can read'; end if;
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001',null,'2025-01-01','Tester','Company',null,
    '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
  raise exception 'Reader unexpectedly allowed to write';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 0 then raise exception 'Cross-department read allowed'; end if;
end $$;
reset role;
rollback;
select 'SCBA hydro cloned-schema assertions passed' as result;
