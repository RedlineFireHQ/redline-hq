\set ON_ERROR_STOP on
insert into public.departments values ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
insert into public.scba_cylinders values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2023-01-01','2028-01-01','Ready'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',null,null,'Ready'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',null,null,'Ready');
insert into public.members values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',true),
 ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',true),
 ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',true),
 ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',false);
insert into public.auth_user_department_memberships values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true,'40000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',false,'40000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',true,'40000000-0000-0000-0000-000000000003'),
 ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',true,'40000000-0000-0000-0000-000000000004'),
 ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',true,'40000000-0000-0000-0000-000000000005');
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
set role authenticated;
select public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2024-02-29', 'Tester', 'Company', 'notes',
 '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Fail"},{"cylinder_id":"20000000-0000-0000-0000-000000000002","result":"Pass"}]') as session_id \gset
reset role;
insert into public.scba_hydro_attachments(department_id,session_id,storage_path,original_filename,content_type,file_size_bytes)
 values ('10000000-0000-0000-0000-000000000001', :'session_id', 'test/path', 'test.pdf', 'application/pdf', 8);
do $$ begin
 if (select next_hydrostatic_test_due_date from public.scba_cylinders where id='20000000-0000-0000-0000-000000000001') <> '2029-02-28' then raise exception 'Leap date failure'; end if;
 if (select status from public.scba_cylinders where id='20000000-0000-0000-0000-000000000001') <> 'Ready' then raise exception 'Failure changed status'; end if;
 if (select count(*) from public.scba_hydro_results) <> 2 then raise exception 'Missing results'; end if;
end $$;
set role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 1 or
    (select count(*) from public.scba_hydro_results) <> 2 or
    (select count(*) from public.scba_hydro_attachments) <> 1 then
   raise exception 'Authorized member cannot read hydro data';
 end if;
end $$;
select public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2022-01-01', 'Tester', 'Company', null,
 '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
select public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', :'session_id', '2021-01-01', 'Corrected', 'Company', 'corrected',
 '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"},{"cylinder_id":"20000000-0000-0000-0000-000000000002","result":"Fail"}]');
reset role;
do $$ begin
 if (select last_hydrostatic_test_date from public.scba_cylinders where id='20000000-0000-0000-0000-000000000001') <> '2023-01-01' then raise exception 'Baseline overwritten'; end if;
 if (select count(*) from public.scba_hydro_corrections) <> 1 then raise exception 'Correction audit missing'; end if;
 if (select count(*) from public.scba_hydro_results) <> 3 then raise exception 'History lost'; end if;
end $$;
set role authenticated;
do $$ begin
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2025-01-01', 'Tester', ' ', null,
   '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
  raise exception 'Blank company accepted';
 exception when raise_exception then if sqlerrm = 'Blank company accepted' then raise; end if; end;
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2025-01-01', 'Tester', 'Company', null,
   '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"},{"cylinder_id":"20000000-0000-0000-0000-000000000003","result":"Pass"}]');
  raise exception 'Cross-department cylinder accepted';
 exception when raise_exception then if sqlerrm = 'Cross-department cylinder accepted' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 2 then raise exception 'Invalid session partially saved'; end if;
 if has_function_privilege('anon', 'public.save_scba_hydro_session(uuid,uuid,date,text,text,text,jsonb)', 'execute') then raise exception 'Anon may execute'; end if;
 if has_table_privilege('authenticated','public.scba_hydro_results','insert') then raise exception 'Direct result insert allowed'; end if;
end $$;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';
set role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 0 or
    (select count(*) from public.scba_hydro_results) <> 0 or
    (select count(*) from public.scba_hydro_corrections) <> 0 or
    (select count(*) from public.scba_hydro_attachments) <> 0 then
   raise exception 'Unpermitted member can read hydro data';
 end if;
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2025-01-01', 'Tester', 'Company', null,
   '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
  raise exception 'Unauthorized write accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000004';
set role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 0 then raise exception 'NULL permission allowed read'; end if;
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2025-01-01', 'Tester', 'Company', null,
   '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
  raise exception 'NULL permission allowed write';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000005';
set role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 0 then raise exception 'Inactive member allowed read'; end if;
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2025-01-01', 'Tester', 'Company', null,
   '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
  raise exception 'Inactive member allowed write';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
set role authenticated;
do $$ begin
 if (select count(*) from public.scba_hydro_sessions) <> 0 then raise exception 'Cross-department history visible'; end if;
 if (select count(*) from public.scba_hydro_attachments) <> 0 then raise exception 'Cross-department attachment visible'; end if;
 begin
  perform public.save_scba_hydro_session('10000000-0000-0000-0000-000000000001', null, '2025-01-01', 'Tester', 'Company', null,
   '[{"cylinder_id":"20000000-0000-0000-0000-000000000001","result":"Pass"}]');
  raise exception 'Cross-department session write accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'SCBA hydro synthetic assertions passed' as result;
