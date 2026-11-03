\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_database() not like 'redline_operational_email_dev_%' then
    raise exception 'Tests require an owned schema-only operational email development database';
  end if;
  if exists(select 1 from public.members)
    or (select count(*) <> 2 or bool_or(enabled) from public.operational_email_rollouts) then
    raise exception 'Tests require empty member data and both rollout controls disabled';
  end if;
end;
$$;
create function pg_temp.check_legacy_emt(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
  raise notice 'PASS: %', p_message;
end;
$$;
insert into public.departments(id, name)
values ('19000000-0000-0000-0000-000000000001', 'Synthetic EMT matching department');
insert into public.members(id, department_id, first_name, last_name, active, email, role)
values ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001',
 'Synthetic', 'Holder', true, 'holder@example.test', 'Firefighter');
insert into public.certifications(id, department_id, name)
values ('39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'EMT');
insert into public.member_certifications(id, department_id, member_id, certification_id, issued_at, expires_at)
values ('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001',
 '29000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001',
 current_date - 365, (now() at time zone 'America/Chicago')::date + 60);
insert into public.ems_member_track_profiles(id, department_id, member_id, track, certification_level,
 track_status, maintain_track, certification_number, expiration_date, effective_start_date)
values ('59000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001',
 '29000000-0000-0000-0000-000000000001', 'nremt', 'paramedic', 'active', true, 'SYNTHETIC-PARAMEDIC',
 (now() at time zone 'America/Chicago')::date + 60, current_date - 365);
select pg_temp.check_legacy_emt(
 (select count(*) = 2 and bool_and(issue is null) from public.operational_certification_sources()),
 'generic EMT and unrelated same-date NREMT paramedic remain independently eligible');
select pg_temp.check_legacy_emt(
 exists(select 1 from public.operational_certification_sources()
   where source_id = '59000000-0000-0000-0000-000000000001' and source_type = 'profile'
     and name = 'NREMT PARAMEDIC' and issue is null
     and expires_at - (now() at time zone 'America/Chicago')::date = 60),
 'paramedic source remains eligible on its reminder milestone without enabling email delivery');
update public.ems_member_track_profiles set certification_level = 'emt'
where id = '59000000-0000-0000-0000-000000000001';
select pg_temp.check_legacy_emt(
 (select count(*) = 2 and bool_and(issue = 'ambiguous_ems_mirror')
   from public.operational_certification_sources()),
 'legitimate EMT-level legacy candidates still require review without authoritative identity');
select pg_temp.check_legacy_emt(
 (select count(*) = 2 and bool_and(not enabled) from public.operational_email_rollouts)
 and not exists(select 1 from public.operational_email_deliveries),
 'both rollout controls stay disabled and matching tests enqueue no emails');
rollback;
