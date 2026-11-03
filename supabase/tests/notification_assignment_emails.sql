\set ON_ERROR_STOP on
-- Historical Cedar-only baseline: run before the all-department expansion migration.
-- Current full-schema coverage is in notification_assignment_all_departments.sql.
begin;

create temp table assertion_results(message text);
create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'Assertion failed: %', p_message; end if;
  insert into pg_temp.assertion_results values(p_message);
end;
$$;

insert into public.departments(id, name) values
('44a25960-7d46-45c4-94e9-115833072da8', 'Email Test A'),
('10000000-0000-0000-0000-000000000002', 'Email Test B');
insert into public.members(id, department_id, first_name, active, email) values
('20000000-0000-0000-0000-000000000001', '44a25960-7d46-45c4-94e9-115833072da8', 'A', true, 'a@example.test'),
('20000000-0000-0000-0000-000000000002', '44a25960-7d46-45c4-94e9-115833072da8', 'B', true, 'b@example.test'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Other Dept', true, 'other@example.test'),
('20000000-0000-0000-0000-000000000004', '44a25960-7d46-45c4-94e9-115833072da8', 'Missing Email', true, null),
('20000000-0000-0000-0000-000000000005', '44a25960-7d46-45c4-94e9-115833072da8', 'Inactive', false, 'inactive@example.test'),
('20000000-0000-0000-0000-000000000006', '44a25960-7d46-45c4-94e9-115833072da8', 'Malformed', true, 'a@example.test,b@example.test');
insert into public.deficiency_categories(id, name) values
('30000000-0000-0000-0000-000000000001', 'Hose');
insert into public.deficiency_priorities(id, name) values
('30000000-0000-0000-0000-000000000002', 'High');

insert into public.deficiencies(id, department_id, assigned_to, category_id, description, priority) values
('40000000-0000-0000-0000-000000000001', '44a25960-7d46-45c4-94e9-115833072da8',
 '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Broken hose', '30000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(
  (select count(*) = 1 from public.notifications where member_id = '20000000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.deficiency_history),
  'created-and-assigned preserves existing in-app notification and assignment history'
);
select pg_temp.assert_true(
  (select recipient_email = 'a@example.test' and status = 'pending'
    and payload->>'description' = 'Broken hose' and payload->>'category' = 'Hose'
    and payload->>'priority' = 'High' and payload->>'departmentName' = 'Email Test A'
   from public.notification_email_deliveries where deficiency_id = '40000000-0000-0000-0000-000000000001'),
  'assignment queues only assigned member and snapshots required fields'
);

update public.deficiencies set description = 'Edited', assigned_to = assigned_to
where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select count(*) = 1 from public.notifications) and (select count(*) = 1 from public.notification_email_deliveries)
  and (select count(*) = 1 from public.deficiency_history), 'unchanged assignment and edits do not notify or change history'
);

update public.deficiencies set assigned_to = '20000000-0000-0000-0000-000000000002'
where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select count(*) = 1 from public.notifications where member_id = '20000000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.notifications where member_id = '20000000-0000-0000-0000-000000000001')
  and (select count(*) = 2 from public.deficiency_history), 'reassignment notifies new member only and retains history'
);

create temp table claimed as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select count(*) = 1 and min(recipient_email) = 'b@example.test' from claimed)
  and (select status = 'skipped' from public.notification_email_deliveries where member_id = '20000000-0000-0000-0000-000000000001'),
  'stale old assignment is skipped and only new assignee is claimed'
);
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()), 'active lease cannot be claimed twice');

select public.prepare_notification_email(id, lease_token, jsonb_build_object(
  'from', 'Existing Sender <sender@example.test>', 'to', recipient_email,
  'subject', 'Assignment', 'text', 'Frozen text', 'html', '<p>Frozen HTML</p>'
)) from claimed;
select public.finish_notification_email(id, lease_token, null, 'resend_rate_limit_exceeded', true) from claimed;
select pg_temp.assert_true(
  (select status = 'retry' and attempt_count = 1 and last_error = 'resend_rate_limit_exceeded'
    and next_attempt_at > now() from public.notification_email_deliveries where id = (select id from claimed)),
  'provider failure tracked with backoff independently of in-app event'
);
select pg_temp.assert_true((select count(*) = 2 from public.notifications), 'email failure preserves all in-app notifications');

update public.notification_email_deliveries set next_attempt_at = now() where status = 'retry';
create temp table retried as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select r.id = c.id and r.lease_token <> c.lease_token and r.attempt_count = 2
    and r.email_message->>'text' = 'Frozen text' from retried r cross join claimed c),
  'retry retains event ID, frozen request and new exclusive lease'
);
do $$
begin
  begin
    perform public.finish_notification_email(id, lease_token, 'stale-provider-result', null, false) from claimed;
    raise exception 'stale lease unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm not like 'Email delivery lease%' then raise; end if;
  end;
end;
$$;
select pg_temp.assert_true(
  (select public.prepare_notification_email(id, lease_token, '{"to":"other@example.test"}') = email_message from retried),
  'retry ignores changed content and returns exact original message'
);
select public.finish_notification_email(id, lease_token, 'provider-accepted-id', null, false) from retried;
select pg_temp.assert_true(
  (select status = 'sent' and sent_at is not null and provider_message_id = 'provider-accepted-id'
    and last_error = 'resend_rate_limit_exceeded'
   from public.notification_email_deliveries where id = (select id from retried)), 'provider acceptance recorded'
);
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()), 'accepted email is never reclaimed');

insert into public.deficiencies(id, department_id, description) values
('40000000-0000-0000-0000-000000000002', '44a25960-7d46-45c4-94e9-115833072da8', 'Unassigned');
select pg_temp.assert_true(
  (select count(*) = 2 from public.notifications) and (select count(*) = 2 from public.notification_email_deliveries),
  'unassigned deficiency produces no notification or email'
);
update public.deficiencies set assigned_to = '20000000-0000-0000-0000-000000000001'
where id = '40000000-0000-0000-0000-000000000002';
select pg_temp.assert_true(
  (select count(*) = 1 from public.notification_email_deliveries where deficiency_id = '40000000-0000-0000-0000-000000000002'),
  'manual assignment of previously unassigned deficiency queues email'
);

insert into public.deficiency_notification_settings(id, department_id, category_id, member_id, active) values
('50000000-0000-0000-0000-000000000001', '44a25960-7d46-45c4-94e9-115833072da8',
 '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', true);
insert into public.deficiencies(id, department_id, category_id, description, reported_by) values
('40000000-0000-0000-0000-000000000003', null,
 '30000000-0000-0000-0000-000000000001', 'Auto assignment', '20000000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (select assigned_to = '20000000-0000-0000-0000-000000000002'
    and department_id = '44a25960-7d46-45c4-94e9-115833072da8'
   from public.deficiencies where id = '40000000-0000-0000-0000-000000000003')
  and (select recipient_email = 'b@example.test' and status = 'pending'
   from public.notification_email_deliveries where deficiency_id = '40000000-0000-0000-0000-000000000003'),
  'existing automatic category assignment and department resolution queue assigned firefighter only'
);

insert into public.deficiencies(id, department_id, assigned_to, description) values
('40000000-0000-0000-0000-000000000004', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000004', 'No email'),
('40000000-0000-0000-0000-000000000005', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000005', 'Inactive'),
('40000000-0000-0000-0000-000000000006', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000006', 'Malformed email'),
('40000000-0000-0000-0000-000000000007', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000003', 'Wrong department');
select pg_temp.assert_true(
  (select count(*) = 4 from public.notification_email_deliveries where status = 'skipped'
    and last_error in ('recipient_email_invalid', 'recipient_inactive', 'recipient_department_or_assignment_mismatch')),
  'missing/malformed/inactive/cross-department recipients are explicitly skipped without fallback'
);
select pg_temp.assert_true(
  (select count(*) = 8 from public.notifications), 'invalid email recipients do not prevent existing in-app event creation'
);

insert into public.notifications(department_id, member_id, type, title, href) values
('44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000001', 'ems_supply_low_stock', 'Supply', '/inventory/ems-supplies');
select pg_temp.assert_true(
  (select count(*) = 8 from public.notification_email_deliveries), 'other notification types do not queue email'
);

do $$
declare v_notification public.notifications%rowtype;
begin
  select * into v_notification from public.notifications where type = 'deficiency_assigned' limit 1;
  begin
    insert into public.notification_email_deliveries(notification_id, department_id, member_id, event_type, payload)
    values(v_notification.id, v_notification.department_id, v_notification.member_id, 'deficiency_assigned', '{}');
    raise exception 'duplicate event unexpectedly accepted';
  exception when unique_violation then null;
  end;
end;
$$;

-- Isolate remaining queue-state checks from the preceding event fixtures.
update public.notification_email_deliveries set status = 'skipped'
where status in ('pending', 'retry', 'processing');
insert into public.deficiencies(id, department_id, assigned_to, description) values
('40000000-0000-0000-0000-000000000008', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000001', 'Lease recovery');
create temp table lease_expired as select * from public.claim_notification_email();
update public.notification_email_deliveries set leased_until = now() - interval '1 minute'
where id = (select id from lease_expired);
create temp table lease_recovered as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select a.id = b.id and a.lease_token <> b.lease_token from lease_expired a cross join lease_recovered b),
  'expired processing lease is recoverable'
);
select public.prepare_notification_email(id, lease_token, jsonb_build_object(
  'from', 'sender@example.test', 'to', recipient_email, 'subject', 'Subject', 'text', 'Text', 'html', '<p>Text</p>'
)) from lease_recovered;
update public.notification_email_deliveries
set first_attempt_at = now() - interval '23 hours', leased_until = now() - interval '1 minute'
where id = (select id from lease_recovered);
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()), 'old uncertain delivery cannot be resent outside safety window');
select pg_temp.assert_true(
  (select status = 'needs_review' from public.notification_email_deliveries where id = (select id from lease_recovered)),
  'uncertain delivery requires investigation rather than risking duplicate send'
);

insert into public.deficiencies(id, department_id, assigned_to, description) values
('40000000-0000-0000-0000-000000000009', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000001', 'Return assignment');
update public.deficiencies set assigned_to = '20000000-0000-0000-0000-000000000002'
where id = '40000000-0000-0000-0000-000000000009';
update public.deficiencies set assigned_to = '20000000-0000-0000-0000-000000000001'
where id = '40000000-0000-0000-0000-000000000009';
create temp table latest_assignment as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select event_sequence = (select max(event_sequence) from public.notification_email_deliveries
    where deficiency_id = '40000000-0000-0000-0000-000000000009') from latest_assignment),
  'A-to-B-to-A skips superseded events even when original member is assigned again'
);
update public.notification_email_deliveries set status = 'retry', attempt_count = 8 where id = (select id from latest_assignment);
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()), 'attempt limit cannot be bypassed');

insert into public.deficiencies(id, department_id, assigned_to, description) values
('40000000-0000-0000-0000-000000000010', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000001', 'Email changed'),
('40000000-0000-0000-0000-000000000011', '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000002', 'Unassigned before send');
update public.members set email = 'changed@example.test' where id = '20000000-0000-0000-0000-000000000001';
update public.deficiencies set assigned_to = null where id = '40000000-0000-0000-0000-000000000011';
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()), 'changed email and removed assignment do not send or redirect');
select pg_temp.assert_true(
  (select status = 'skipped' and last_error = 'recipient_no_longer_eligible'
    from public.notification_email_deliveries where deficiency_id = '40000000-0000-0000-0000-000000000010')
  and (select status = 'skipped' and last_error = 'assignment_no_longer_current'
    from public.notification_email_deliveries where deficiency_id = '40000000-0000-0000-0000-000000000011'),
  'eligibility changes have explicit skip reasons'
);

select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.notification_email_deliveries', 'SELECT')
  and not has_table_privilege('authenticated', 'public.notification_email_deliveries', 'INSERT')
  and not has_table_privilege('anon', 'public.notification_email_deliveries', 'SELECT')
  and not has_function_privilege('authenticated', 'public.claim_notification_email()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.prepare_notification_email(uuid,uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finish_notification_email(uuid,uuid,text,text,boolean)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.claim_notification_email()', 'EXECUTE')
  and (select relrowsecurity from pg_class where oid = 'public.notification_email_deliveries'::regclass),
  'outbox is private, RLS-enabled, and worker RPCs are service-role only'
);
select pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT')
  and has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'),
  'existing notification permissions remain intact'
);

set local role authenticated;
do $$
begin
  begin
    perform public.claim_notification_email();
    raise exception 'authenticated worker execution unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.notification_email_deliveries;
    raise exception 'authenticated outbox read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- A real UUID priority FK and independently resolved ownership are used below.
update public.members set email = 'a@example.test'
where id = '20000000-0000-0000-0000-000000000001';
insert into public.apparatus(id, department_id) values
('70000000-0000-0000-0000-000000000001', '44a25960-7d46-45c4-94e9-115833072da8'),
('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
insert into public.deficiencies(id, department_id, assigned_to, reported_by, apparatus_id, description) values
('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
 '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
 '70000000-0000-0000-0000-000000000001', 'Spoofed stored department'),
('80000000-0000-0000-0000-000000000002', '44a25960-7d46-45c4-94e9-115833072da8',
 '20000000-0000-0000-0000-000000000001', null, null, 'No ownership links'),
('80000000-0000-0000-0000-000000000003', '44a25960-7d46-45c4-94e9-115833072da8',
 '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 '70000000-0000-0000-0000-000000000002', 'Ambiguous equipment/reporter ownership'),
('80000000-0000-0000-0000-000000000004', '44a25960-7d46-45c4-94e9-115833072da8',
 '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 '70000000-0000-0000-0000-000000000099', 'Broken ownership reference');
select pg_temp.assert_true(
  (select count(*) = 3 from public.notification_email_deliveries
   where deficiency_id::text like '80000000-%' and status = 'skipped'
     and last_error = 'ownership_missing_ambiguous_or_mismatched')
  and not exists(select 1 from public.notification_email_deliveries
    where deficiency_id = '80000000-0000-0000-0000-000000000001'),
  'spoofed, missing, ambiguous and unresolved ownership never queue a sendable email'
);
insert into public.deficiencies(id, department_id, assigned_to, reported_by, description) values
('80000000-0000-0000-0000-000000000005', null,
 '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Missing stored department');
select pg_temp.assert_true(
  (select status = 'skipped' and last_error = 'ownership_missing_ambiguous_or_mismatched'
   from public.notification_email_deliveries where deficiency_id = '80000000-0000-0000-0000-000000000005'),
  'missing stored department is rejected without changing legacy deficiency or in-app behavior'
);

do $$
declare
  v_case text;
  v_id uuid;
  v_claim public.notification_email_deliveries%rowtype;
  v_result jsonb;
begin
  foreach v_case in array array['reassign', 'unassign', 'inactive', 'email', 'member_department', 'equipment_department', 'retry_reassign', 'window_expired'] loop
    v_id := gen_random_uuid();
    insert into public.deficiencies(id, department_id, assigned_to, reported_by, apparatus_id, description)
    values(v_id, '44a25960-7d46-45c4-94e9-115833072da8', '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', v_case);
    select * into strict v_claim from public.claim_notification_email();
    if v_case in ('retry_reassign', 'window_expired') then
      perform public.prepare_notification_email(v_claim.id, v_claim.lease_token, jsonb_build_object(
        'from', 'sender@example.test', 'to', v_claim.recipient_email,
        'subject', 'Assignment', 'text', 'Frozen', 'html', '<p>Frozen</p>'));
      perform public.finish_notification_email(v_claim.id, v_claim.lease_token, null, 'uncertain_transport', true);
      update public.notification_email_deliveries set next_attempt_at = now() where id = v_claim.id;
      select * into strict v_claim from public.claim_notification_email();
    end if;
    case v_case
      when 'reassign', 'retry_reassign' then
        update public.deficiencies set assigned_to = '20000000-0000-0000-0000-000000000002' where id = v_id;
      when 'unassign' then
        update public.deficiencies set assigned_to = null where id = v_id;
      when 'inactive' then
        update public.members set active = false where id = v_claim.member_id;
      when 'email' then
        update public.members set email = 'changed@example.test' where id = v_claim.member_id;
      when 'member_department' then
        update public.members set department_id = '10000000-0000-0000-0000-000000000002' where id = v_claim.member_id;
      when 'equipment_department' then
        update public.apparatus set department_id = '10000000-0000-0000-0000-000000000002'
        where id = '70000000-0000-0000-0000-000000000001';
      when 'window_expired' then
        update public.notification_email_deliveries set first_attempt_at = now() - interval '23 hours' where id = v_claim.id;
    end case;
    v_result := public.prepare_notification_email(v_claim.id, v_claim.lease_token, jsonb_build_object(
      'from', 'sender@example.test', 'to', v_claim.recipient_email,
      'subject', 'Assignment', 'text', 'Text', 'html', '<p>Text</p>'));
    perform pg_temp.assert_true(v_result is null and (
      select status = case when v_case = 'window_expired' then 'needs_review' else 'skipped' end
        and lease_token is null from public.notification_email_deliveries where id = v_claim.id
    ), 'dispatch gate rejects post-claim eligibility change: ' || v_case);
    update public.members set active = true, email = 'a@example.test',
      department_id = '44a25960-7d46-45c4-94e9-115833072da8'
    where id = '20000000-0000-0000-0000-000000000001';
    update public.apparatus set department_id = '44a25960-7d46-45c4-94e9-115833072da8'
    where id = '70000000-0000-0000-0000-000000000001';
    update public.notification_email_deliveries set status = 'skipped' where status in ('pending', 'retry', 'processing');
  end loop;
end;
$$;

do $$
declare v_link record; v_id uuid; v_equipment uuid; v_claim public.notification_email_deliveries%rowtype;
begin
  for v_link in select * from (values
    ('apparatus_id', 'apparatus'), ('asset_id', 'assets'), ('fire_hose_id', 'fire_hose'),
    ('scba_cylinder_id', 'scba_cylinders'), ('scba_pack_id', 'scba_packs'),
    ('pie_equipment_id', 'pie_equipment'), ('ems_equipment_id', 'ems_equipment'),
    ('ppe_item_id', 'ppe_items'), ('rope_item_id', 'rope_items'),
    ('fire_extinguisher_id', 'fire_extinguishers'), ('misc_fire_equipment_id', 'misc_fire_equipment'),
    ('gas_monitor_id', 'gas_monitors'), ('battery_id', 'batteries'),
    ('thermal_imaging_camera_id', 'thermal_imaging_cameras'), ('ground_ladder_id', 'ground_ladders'),
    ('portable_radio_id', 'portable_radios'), ('portable_radio_mic_id', 'portable_radio_mics'),
    ('pager_id', 'pagers'), ('inspection_id', 'apparatus_inspections'), ('check_session_id', 'apparatus_check_sessions')
  ) as links(column_name, table_name) loop
    v_id := gen_random_uuid(); v_equipment := gen_random_uuid();
    execute format('insert into public.%I(id,department_id) values($1,$2)', v_link.table_name)
      using v_equipment, '44a25960-7d46-45c4-94e9-115833072da8'::uuid;
    execute format('insert into public.deficiencies(id,department_id,assigned_to,reported_by,%I) values($1,$2,$3,null,$4)', v_link.column_name)
      using v_id, '44a25960-7d46-45c4-94e9-115833072da8'::uuid,
        '20000000-0000-0000-0000-000000000001'::uuid, v_equipment;
    select * into strict v_claim from public.claim_notification_email();
    perform pg_temp.assert_true(v_claim.deficiency_id = v_id
      and public.resolve_deficiency_email_department(v_id) = v_claim.department_id,
      'each equipment/session relationship independently establishes ownership: ' || v_link.column_name);
    execute format('update public.%I set department_id=$1 where id=$2', v_link.table_name)
      using '10000000-0000-0000-0000-000000000002'::uuid, v_equipment;
    perform pg_temp.assert_true(public.prepare_notification_email(v_claim.id, v_claim.lease_token,
      jsonb_build_object('from','sender@example.test','to',v_claim.recipient_email,
        'subject','Assignment','text','Text','html','<p>Text</p>')) is null,
      'dispatch revalidates each ownership source: ' || v_link.column_name);
  end loop;
end;
$$;

-- An enqueue failure preserves the original workflow and a durable recovery job.
alter table public.notification_email_deliveries add constraint test_enqueue_failure
check (payload->>'description' <> 'Force enqueue failure');
do $$
declare v_notifications bigint; v_history bigint;
begin
  select count(*) into v_notifications from public.notifications;
  select count(*) into v_history from public.deficiency_history;
  insert into public.deficiencies(id, department_id, assigned_to, description)
  values('80000000-0000-0000-0000-000000000006', '44a25960-7d46-45c4-94e9-115833072da8',
    '20000000-0000-0000-0000-000000000001', 'Force enqueue failure');
  perform pg_temp.assert_true(
    exists(select 1 from public.deficiencies where id = '80000000-0000-0000-0000-000000000006')
    and (select count(*) = v_notifications + 1 from public.notifications)
    and (select count(*) = v_history + 1 from public.deficiency_history)
    and (select count(*) = 1 from public.notification_email_enqueue_failures where last_error_code = '23514'),
    'enqueue database error is tracked durably without blocking assignment, notification or history'
  );
end;
$$;
update public.notification_email_enqueue_failures set next_attempt_at = now();
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()),
  'persistent enqueue failure does not produce a sendable event');
select pg_temp.assert_true(
  (select attempt_count = 2 and next_attempt_at > now() and last_error_code = '23514'
   from public.notification_email_enqueue_failures),
  'enqueue recovery tracks errors and backs off'
);
update public.notification_email_enqueue_failures set attempt_count = 7, next_attempt_at = now();
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()),
  'enqueue recovery limit does not send an event');
select pg_temp.assert_true(
  (select attempt_count = 8 and status = 'needs_review' from public.notification_email_enqueue_failures),
  'persistent enqueue failures stop after eight attempts for operator review'
);
create temp table failed_enqueue as select * from public.notification_email_enqueue_failures;
alter table public.notification_email_deliveries drop constraint test_enqueue_failure;
update public.notification_email_enqueue_failures set status = 'retry', attempt_count = 1, next_attempt_at = now();
create temp table recovered_enqueue as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select count(*) = 1 from recovered_enqueue)
  and (select d.event_sequence = f.event_sequence and d.notification_id = f.notification_id
       from recovered_enqueue d cross join failed_enqueue f)
  and not exists(select 1 from public.notification_email_enqueue_failures),
  'recovery retains original event order, creates exactly one delivery and clears failure state'
);
select pg_temp.assert_true((select count(*) = 0 from public.claim_notification_email()),
  'reconciled notification is never enqueued or claimed twice');
update public.notification_email_deliveries set status = 'skipped' where status = 'processing';

insert into public.deficiencies(id, department_id, assigned_to, description)
values('80000000-0000-0000-0000-000000000008', '44a25960-7d46-45c4-94e9-115833072da8',
 '20000000-0000-0000-0000-000000000001', 'Accepted but completion connection lost');
create temp table accepted_before_disconnect as select * from public.claim_notification_email();
select public.prepare_notification_email(id, lease_token, jsonb_build_object(
  'from','sender@example.test','to',recipient_email,'subject','Assignment','text','Frozen accepted request','html','<p>Frozen</p>'
)) from accepted_before_disconnect;
-- Simulate provider acceptance with no finish RPC, then a later lease recovery.
update public.notification_email_deliveries set leased_until = now() - interval '1 minute'
where id = (select id from accepted_before_disconnect);
create temp table disconnected_retry as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select d.id = original.id and d.lease_token <> original.lease_token
    and d.email_message->>'text' = 'Frozen accepted request'
    and public.prepare_notification_email(d.id, d.lease_token, '{}'::jsonb) = d.email_message
   from disconnected_retry d cross join accepted_before_disconnect original),
  'acceptance-before-completion recovery preserves provider key and exact request after lease expiry'
);
select public.finish_notification_email(id, lease_token, 'original-accepted-provider-id', null, false) from disconnected_retry;
select pg_temp.assert_true(
  (select status = 'sent' and provider_message_id = 'original-accepted-provider-id'
   from public.notification_email_deliveries where id = (select id from disconnected_retry)),
  'recovered provider acceptance can be recorded without creating another event'
);

-- A recovered A event must not supersede a later A after A -> B -> A.
alter table public.notification_email_deliveries add constraint test_late_enqueue_failure
check (payload->>'description' <> 'Late recovery');
insert into public.deficiencies(id, department_id, assigned_to, description)
values('80000000-0000-0000-0000-000000000007', '44a25960-7d46-45c4-94e9-115833072da8',
 '20000000-0000-0000-0000-000000000001', 'Late recovery');
update public.deficiencies set description = 'New assignment', assigned_to = '20000000-0000-0000-0000-000000000002'
where id = '80000000-0000-0000-0000-000000000007';
update public.deficiencies set assigned_to = '20000000-0000-0000-0000-000000000001'
where id = '80000000-0000-0000-0000-000000000007';
alter table public.notification_email_deliveries drop constraint test_late_enqueue_failure;
update public.notification_email_enqueue_failures set next_attempt_at = now();
create temp table late_recovery_claim as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select count(*) = 1 and min(recipient_email) = 'a@example.test' from late_recovery_claim)
  and (select event_sequence = (select max(event_sequence) from public.notification_email_deliveries
       where deficiency_id = '80000000-0000-0000-0000-000000000007') from late_recovery_claim)
  and (select count(*) = 2 from public.notification_email_deliveries
       where deficiency_id = '80000000-0000-0000-0000-000000000007' and status = 'skipped'),
  'late recovery cannot reorder or revive an old A assignment after A to B to A'
);

alter table public.notification_email_deliveries add constraint test_double_failure
check (payload->>'description' <> 'Fail both records');
alter table public.notification_email_enqueue_failures add constraint test_recovery_unavailable check (false);
do $$
declare v_count bigint;
begin
  select count(*) into v_count from public.notifications;
  begin
    insert into public.deficiencies(id, department_id, assigned_to, description)
    values('80000000-0000-0000-0000-000000000009','44a25960-7d46-45c4-94e9-115833072da8',
      '20000000-0000-0000-0000-000000000001','Fail both records');
    raise exception 'Lost event was incorrectly treated as success';
  exception when check_violation then null;
  end;
  perform pg_temp.assert_true(
    not exists(select 1 from public.deficiencies where id = '80000000-0000-0000-0000-000000000009')
    and (select count(*) = v_count from public.notifications),
    'failure of both durable records raises an error and does not commit an untracked event'
  );
end;
$$;
alter table public.notification_email_deliveries drop constraint test_double_failure;
alter table public.notification_email_enqueue_failures drop constraint test_recovery_unavailable;

select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.resolve_deficiency_email_department(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.resolve_deficiency_email_department(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.notification_email_ineligibility(public.notification_email_deliveries)', 'EXECUTE'),
  'internal ownership helpers are not exposed even under broad default grants'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.notification_email_enqueue_failures', 'SELECT')
  and not has_table_privilege('anon', 'public.notification_email_enqueue_failures', 'SELECT')
  and not has_table_privilege('service_role', 'public.notification_email_enqueue_failures', 'UPDATE')
  and has_table_privilege('service_role', 'public.notification_email_enqueue_failures', 'SELECT')
  and not has_function_privilege('authenticated', 'public.enqueue_deficiency_assignment_email(public.notifications,bigint)', 'EXECUTE'),
  'enqueue failure tracking and reconciliation are protected from ordinary users and direct service mutations'
);

set local notification_test.member_id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$
begin
  if exists(select 1 from public.notifications where member_id <> '20000000-0000-0000-0000-000000000001') then
    raise exception 'Existing notification RLS leaked another recipient';
  end if;
  if not exists(select 1 from public.notifications) then
    raise exception 'Existing notification RLS no longer permits own notifications';
  end if;
  update public.notifications set read_at = now();
end;
$$;
reset role;

select pg_temp.assert_true(
  public.assignment_email_department_enabled('44a25960-7d46-45c4-94e9-115833072da8')
  and not public.assignment_email_department_enabled('339028ba-a3d9-4f16-9ee4-80be662fb9ee')
  and not public.assignment_email_department_enabled('82f50d14-216a-4dd1-80f4-58459dc97b97')
  and not public.assignment_email_department_enabled(null)
  and not public.assignment_email_department_enabled(gen_random_uuid()),
  'immutable rollout allowlist enables exact Cedar Bluff UUID only and fails closed'
);
insert into public.departments(id,name) values
('339028ba-a3d9-4f16-9ee4-80be662fb9ee','Elliott synthetic fixture'),
('82f50d14-216a-4dd1-80f4-58459dc97b97','Red Oak synthetic fixture');
insert into public.members(id,department_id,first_name,active,email) values
('90000000-0000-0000-0000-000000000001','339028ba-a3d9-4f16-9ee4-80be662fb9ee','Excluded A',true,'excluded-a@example.test'),
('90000000-0000-0000-0000-000000000002','82f50d14-216a-4dd1-80f4-58459dc97b97','Excluded B',true,'excluded-b@example.test');
insert into public.deficiencies(id,department_id,reported_by,assigned_to,description) values
('90000000-0000-0000-0000-000000000003','339028ba-a3d9-4f16-9ee4-80be662fb9ee',
 '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','Excluded Elliott synthetic'),
('90000000-0000-0000-0000-000000000004','82f50d14-216a-4dd1-80f4-58459dc97b97',
 '90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','Excluded Red Oak synthetic');
select pg_temp.assert_true(
  (select count(*) = 2 from public.notifications where href in (
    '/operations/deficiencies/90000000-0000-0000-0000-000000000003',
    '/operations/deficiencies/90000000-0000-0000-0000-000000000004'))
  and not exists(select 1 from public.notification_email_deliveries where department_id <> '44a25960-7d46-45c4-94e9-115833072da8')
  and not exists(select 1 from public.notification_email_enqueue_failures),
  'Elliott and Red Oak preserve in-app notifications but generate no email work'
);
update public.notification_email_deliveries set status='skipped' where status in ('pending','retry','processing');
insert into public.notification_email_deliveries(notification_id,department_id,member_id,deficiency_id,event_type,recipient_email,payload)
select n.id,n.department_id,n.member_id,d.id,'deficiency_assigned',m.email,'{}'
from public.notifications n join public.deficiencies d on n.href='/operations/deficiencies/'||d.id::text
join public.members m on m.id=n.member_id where d.id in (
 '90000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000004');
create temp table excluded_department_claim as select * from public.claim_notification_email();
select pg_temp.assert_true(
  (select count(*) = 0 from excluded_department_claim)
  and (select count(*) = 2 from public.notification_email_deliveries where last_error='department_not_enabled'),
  'claim rejects even manually injected email rows for Elliott and Red Oak'
);
do $$
declare v_delivery public.notification_email_deliveries%rowtype;
begin
  for v_delivery in update public.notification_email_deliveries
    set status='processing', lease_token=gen_random_uuid(), leased_until=clock_timestamp()+interval '2 minutes'
    where last_error='department_not_enabled' returning * loop
    perform pg_temp.assert_true(public.prepare_notification_email(v_delivery.id,v_delivery.lease_token,'{}') is null,
      'dispatch rejects excluded department even if claim was bypassed');
    perform pg_temp.assert_true(
      (select status='skipped' and last_error='department_not_enabled'
       from public.notification_email_deliveries where id=v_delivery.id),
      'excluded dispatch has an explicit terminal reason');
  end loop;
end;
$$;
select pg_temp.assert_true(
  not has_function_privilege('authenticated','public.assignment_email_department_enabled(uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.assignment_email_department_enabled(uuid)','EXECUTE'),
  'rollout gate cannot be called or changed through ordinary application RPCs'
);

select count(*) as passed_sql_assertions from pg_temp.assertion_results;
rollback;
