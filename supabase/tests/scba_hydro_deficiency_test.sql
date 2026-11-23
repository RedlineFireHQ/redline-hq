\set ON_ERROR_STOP on
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
set role authenticated;
select public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2026-11-22', 'Tester', 'Company', null,
 '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Fail"},{"cylinder_id":"20000000-0000-0000-0000-000000000002","result":"Pass"}]') as session_id \gset
select id as fail_result from public.scba_hydro_results where session_id = :'session_id' and result = 'Fail' \gset
select id as pass_result from public.scba_hydro_results where session_id = :'session_id' and result = 'Pass' \gset
select set_config('test.fail_result', :'fail_result', false);
select set_config('test.pass_result', :'pass_result', false);
insert into public.deficiencies (id, department_id, scba_cylinder_id, scba_hydro_result_id, description)
values ('50000000-0000-0000-0000-000000000001', null,
 '20000000-0000-0000-0000-000000000001', :'fail_result', 'Failure');
do $$ begin
 if (select department_id from public.deficiencies where id='50000000-0000-0000-0000-000000000001')
   is distinct from '10000000-0000-0000-0000-000000000001'::uuid then
   raise exception 'Deficiency department was not assigned';
 end if;
 if (select status from public.scba_cylinders where id='20000000-0000-0000-0000-000000000001') <> 'Ready' then
   raise exception 'Deficiency creation changed cylinder status';
 end if;
 begin
   insert into public.deficiencies(id, department_id, scba_cylinder_id, scba_hydro_result_id)
   select gen_random_uuid(), department_id, cylinder_id, id from public.scba_hydro_results
   where id = current_setting('test.pass_result')::uuid;
   raise exception 'Pass result accepted';
 exception when raise_exception then if sqlerrm = 'Pass result accepted' then raise; end if; end;
 begin
   insert into public.deficiencies(id, department_id, scba_cylinder_id, scba_hydro_result_id)
   select gen_random_uuid(), department_id, '20000000-0000-0000-0000-000000000002', id
   from public.scba_hydro_results where id = current_setting('test.fail_result')::uuid;
   raise exception 'Wrong cylinder accepted';
 exception when raise_exception then if sqlerrm = 'Wrong cylinder accepted' then raise; end if; end;
end $$;
select public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', :'session_id', '2026-11-22', 'Tester', 'Company', null,
 '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"},{"cylinder_id":"20000000-0000-0000-0000-000000000002","result":"Pass"}]');
update public.deficiencies set description='Corrected test, retained deficiency' where id='50000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists (select 1 from public.deficiencies d join public.scba_hydro_results r on r.id=d.scba_hydro_result_id
   where d.id='50000000-0000-0000-0000-000000000001' and r.result='Pass') then
   raise exception 'Correction lost the original deficiency association';
 end if;
end $$;
reset role;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
set role authenticated;
do $$ begin
 begin
   insert into public.deficiencies(id, department_id, scba_cylinder_id, scba_hydro_result_id)
   values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001', current_setting('test.fail_result')::uuid);
   raise exception 'Cross-department link accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'SCBA hydro deficiency assertions passed' as result;
