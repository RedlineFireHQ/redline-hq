-- Maintenance External Provider E2E tests.
-- Run against the local test stack only:
--   docker exec -i supabase_db_redline-notification-local-test \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/maintenance_external_provider.sql
--
-- Scenarios:
--   M1 department-member maintenance still saves (existing workflow intact)
--   M2 external-provider maintenance saves with completed_by null and keeps attachments
--   M3 a record can never have both a member and an external provider
--   M4 existing history is untouched (column is null for pre-existing rows)

begin;

do $$
declare
  v_dept uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_apparatus uuid := gen_random_uuid();
  v_existing uuid;
  v_member_record uuid;
  v_external_record uuid;
  v_check record;
begin
  insert into public.departments (id, name) values (v_dept, 'Maintenance EP Test Dept');
  insert into public.members (id, department_id, first_name, last_name, email, role, active)
  values (v_member, v_dept, 'Max', 'Mechanic', 'max-mechanic@test.local', 'Firefighter', true);
  insert into public.apparatus (id, department_id, name) values (v_apparatus, v_dept, 'Engine EP-1');

  -- A pre-existing record (simulating history created before the migration).
  insert into public.maintenance_records (department_id, apparatus_id, maintenance_type, completed_by, service_date, description)
  values (v_dept, v_apparatus, 'Repair', v_member, now() - interval '30 days', 'Historical record')
  returning id into v_existing;

  -- M1: department-member record still saves exactly as before.
  insert into public.maintenance_records (department_id, apparatus_id, maintenance_type, completed_by, service_date, description, photos, attachments)
  values (v_dept, v_apparatus, 'Oil Change', v_member, now(), 'Member-performed oil change', array['p/one.jpg'], array['a/receipt.pdf'])
  returning id into v_member_record;

  select completed_by, external_provider_name into v_check
  from public.maintenance_records where id = v_member_record;
  if v_check.completed_by is distinct from v_member or v_check.external_provider_name is not null then
    raise exception 'M1 FAILED: member record stored incorrectly';
  end if;
  raise notice 'M1 PASS: department-member maintenance saves unchanged';

  -- M2: external-provider record saves with completed_by null and attachments intact.
  insert into public.maintenance_records (department_id, apparatus_id, maintenance_type, completed_by, external_provider_name, service_date, description, photos, attachments)
  values (v_dept, v_apparatus, 'Oil Change', null, 'Jiffy Lube', now(), 'Outside oil change', array['p/two.jpg'], array['a/invoice.pdf', 'a/inspection.pdf'])
  returning id into v_external_record;

  select completed_by, external_provider_name,
         array_length(photos, 1) as photo_count, array_length(attachments, 1) as attachment_count
  into v_check
  from public.maintenance_records where id = v_external_record;
  if v_check.completed_by is not null or v_check.external_provider_name <> 'Jiffy Lube'
     or v_check.photo_count <> 1 or v_check.attachment_count <> 2 then
    raise exception 'M2 FAILED: external-provider record stored incorrectly';
  end if;
  raise notice 'M2 PASS: external provider saves with null completed_by and full attachments';

  -- M3: both performer types on one record must be rejected.
  begin
    insert into public.maintenance_records (department_id, apparatus_id, maintenance_type, completed_by, external_provider_name, service_date, description)
    values (v_dept, v_apparatus, 'Repair', v_member, 'Jiffy Lube', now(), 'Illegal double performer');
    raise exception 'M3 FAILED: record accepted both a member and an external provider';
  exception
    when check_violation then
      raise notice 'M3 PASS: single-performer check constraint rejected the double assignment';
  end;

  -- M4: pre-existing history untouched.
  select completed_by, external_provider_name into v_check
  from public.maintenance_records where id = v_existing;
  if v_check.completed_by is distinct from v_member or v_check.external_provider_name is not null then
    raise exception 'M4 FAILED: historical record was altered';
  end if;
  raise notice 'M4 PASS: existing maintenance history is untouched';
end $$;

rollback;
