\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_database() not like 'redline_assignment_email_dev_%' then
    raise exception 'Tests require an owned schema-only assignment email development database';
  end if;
  if exists(select 1 from public.members) then
    raise exception 'Tests require empty member data';
  end if;
end;
$$;
set local request.jwt.claim.role = 'service_role';
create function pg_temp.check_assignment(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
  raise notice 'PASS: %', p_message;
end;
$$;

insert into public.departments(id, name) values
('339028ba-a3d9-4f16-9ee4-80be662fb9ee', 'Synthetic Elliott'),
('82f50d14-216a-4dd1-80f4-58459dc97b97', 'Synthetic Red Oak'),
('44a25960-7d46-45c4-94e9-115833072da8', 'Synthetic Cedar Bluff'),
('19000000-0000-0000-0000-000000000001', 'Synthetic other department');
do $$
declare
  v_department uuid;
  v_holder uuid;
  v_other uuid;
  v_deficiency uuid;
  v_notification public.notifications%rowtype;
  v_delivery public.notification_email_deliveries%rowtype;
  v_frozen jsonb;
begin
  for v_department in select id from public.departments order by id loop
    perform pg_temp.check_assignment(public.assignment_email_department_enabled(v_department),
      'department eligible: ' || v_department);
    v_holder := gen_random_uuid();
    v_other := gen_random_uuid();
    insert into public.members(id, department_id, first_name, last_name, active, email, role) values
    (v_holder, v_department, 'Synthetic', 'Holder', true, 'holder@example.test', 'Firefighter'),
    (v_other, v_department, 'Synthetic', 'Administrator', true, 'admin@example.test', 'Administrator');
    v_deficiency := gen_random_uuid();
    insert into public.deficiencies(id, department_id, reported_by, assigned_to, description)
    values(v_deficiency, v_department, v_other, v_holder, 'Synthetic assignment');
    select * into strict v_notification from public.notifications
    where href = '/operations/deficiencies/' || v_deficiency::text and type = 'deficiency_assigned';
    perform pg_temp.check_assignment(
      (select count(*) = 1 and bool_and(member_id = v_holder and recipient_email = 'holder@example.test'
        and department_id = v_department and status = 'pending')
       from public.notification_email_deliveries where deficiency_id = v_deficiency),
      'assignment creates one holder-only event without administrator copies');
    perform public.enqueue_deficiency_assignment_email(v_notification,
      (select event_sequence from public.notification_email_deliveries where notification_id = v_notification.id));
    update public.deficiencies set description = 'Synthetic edit', assigned_to = assigned_to where id = v_deficiency;
    perform pg_temp.check_assignment(
      (select count(*) = 1 from public.notification_email_deliveries where deficiency_id = v_deficiency),
      'duplicate enqueue and unchanged assignment do not duplicate events');
    select * into strict v_delivery from public.claim_notification_email();
    perform pg_temp.check_assignment(v_delivery.member_id = v_holder
      and v_delivery.department_id = v_department
      and not exists(select 1 from public.claim_notification_email()),
      'same-department assignee is claimed exclusively');
    v_frozen := public.prepare_notification_email(v_delivery.id, v_delivery.lease_token,
      jsonb_build_object('from','sender@example.test','to',v_delivery.recipient_email,
        'subject','Assignment','text','Synthetic frozen body','html','<p>Synthetic frozen body</p>'));
    perform pg_temp.check_assignment(
      (select count(*) = 5 from jsonb_object_keys(v_frozen)) and v_frozen->>'to' = 'holder@example.test',
      'frozen message has exactly one recipient and no CC or BCC');
    perform public.finish_notification_email(v_delivery.id,v_delivery.lease_token,null,'synthetic_timeout',true);
    update public.notification_email_deliveries set next_attempt_at = now() where id = v_delivery.id;
    select * into strict v_delivery from public.claim_notification_email();
    perform pg_temp.check_assignment(v_delivery.email_message = v_frozen and v_delivery.attempt_count = 2
      and public.prepare_notification_email(v_delivery.id,v_delivery.lease_token,'{}') = v_frozen,
      'retry retains event identity, frozen recipient and message');
    perform public.finish_notification_email(v_delivery.id,v_delivery.lease_token,'synthetic-provider-id',null,false);
    perform pg_temp.check_assignment(not exists(select 1 from public.claim_notification_email()),
      'accepted event cannot be reclaimed');
    update public.deficiencies set assigned_to = v_other where id = v_deficiency;
    select * into strict v_delivery from public.claim_notification_email();
    update public.deficiencies set assigned_to = v_holder where id = v_deficiency;
    perform pg_temp.check_assignment(
      public.prepare_notification_email(v_delivery.id,v_delivery.lease_token,'{}') is null,
      'reassignment invalidates old queued recipient instead of redirecting');
    update public.notification_email_deliveries set status='skipped'
    where deficiency_id = v_deficiency and status in ('pending','retry','processing');
    update public.members set active=false where id=v_holder;
    insert into public.deficiencies(department_id,reported_by,assigned_to,description)
    values(v_department,v_other,v_holder,'Synthetic inactive');
    perform pg_temp.check_assignment(
      exists(select 1 from public.notification_email_deliveries where member_id=v_holder
        and status='skipped' and last_error='recipient_inactive'),
      'inactive assignee excluded');
    update public.members set active=true,email='invalid' where id=v_holder;
    insert into public.deficiencies(department_id,reported_by,assigned_to,description)
    values(v_department,v_other,v_holder,'Synthetic invalid email');
    perform pg_temp.check_assignment(
      exists(select 1 from public.notification_email_deliveries where member_id=v_holder
        and status='skipped' and last_error='recipient_email_invalid'),
      'invalid recipient excluded');
    update public.members set email='holder@example.test' where id=v_holder;
    insert into public.deficiencies(department_id,reported_by,assigned_to,description)
    select d.id,v_other,v_holder,'Synthetic forged department'
    from public.departments d where d.id<>v_department order by d.id limit 1;
    perform pg_temp.check_assignment(
      exists(select 1 from public.notification_email_deliveries where member_id=v_holder
        and status='skipped' and last_error='ownership_missing_ambiguous_or_mismatched'),
      'cross-department ownership is rejected');
    perform pg_temp.check_assignment(not exists(select 1 from public.claim_notification_email()),
      'no ineligible deliveries can be dispatched');
  end loop;
end;
$$;
select pg_temp.check_assignment(
  not public.assignment_email_department_enabled(null)
  and not public.assignment_email_department_enabled(gen_random_uuid())
  and not has_function_privilege('authenticated','public.assignment_email_department_enabled(uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.assignment_email_department_enabled(uuid)','EXECUTE'),
  'missing departments fail closed and internal gate remains private');
select pg_temp.check_assignment(
  not has_table_privilege('authenticated','public.notification_email_deliveries','SELECT')
  and not has_table_privilege('service_role','public.notification_email_deliveries','UPDATE'),
  'outbox permissions remain unchanged');
rollback;
