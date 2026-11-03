\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_database() not like 'redline_operational_email_dev_%' then
    raise exception 'Tests require an owned schema-only operational email development database';
  end if;
end;
$$;
set local request.jwt.claim.role = 'service_role';
create function pg_temp.check_notification(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_message; end if;
  raise notice 'PASS: %', p_message;
end;
$$;
select pg_temp.check_notification(
  (select count(*) = 2 and bool_and(not enabled) from public.operational_email_rollouts),
  'both new rollout controls initially disabled');
select pg_temp.check_notification(public.scan_operational_certification_emails() = 0,
  'disabled certification scan creates nothing');
select pg_temp.check_notification(not exists(select 1 from public.claim_operational_email('ems_supply_withdrawal')),
  'disabled withdrawal worker claims nothing');

insert into public.departments(id, name) values
('10000000-0000-0000-0000-000000000001', 'Synthetic Iowa Department'),
('10000000-0000-0000-0000-000000000002', 'Synthetic Other Department');
insert into public.members(id, department_id, first_name, last_name, active, email, role) values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Test', 'Holder', true, 'holder@example.test', 'Administrator'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Test', 'Replacement', true, 'replacement@example.test', 'Firefighter'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Test', 'Other', true, 'other@example.test', 'Administrator');
update public.operational_email_rollouts set enabled = true;

savepoint certification_matching_regressions;
insert into public.certifications(id, department_id, name) values
('39000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Firefighter I');
insert into public.member_certifications(id, department_id, member_id, certification_id, issued_at, expires_at)
values ('49000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001',
 current_date - 365, (now() at time zone 'America/Chicago')::date + 60);
insert into public.ems_member_track_profiles(department_id, member_id, track, certification_level,
  track_status, maintain_track, certification_number, expiration_date, effective_start_date) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 'nremt', 'emt', 'active', true, 'FIRE-DATE-NREMT', (now() at time zone 'America/Chicago')::date + 60, current_date - 365);
select pg_temp.check_notification(
  (select count(*) = 2 and bool_and(issue is null) from public.operational_certification_sources()),
  'Firefighter I and NREMT with identical expiration dates remain independently eligible');
select pg_temp.check_notification(public.scan_operational_certification_emails() = 2,
  'matching fire/NREMT dates enqueue two distinct credentials, not review exclusions');
insert into public.ems_member_track_profiles(department_id, member_id, track, certification_level,
  track_status, maintain_track, certification_number, expiration_date, effective_start_date) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 'iowa', 'emt', 'active', true, 'FIRE-DATE-IOWA', (now() at time zone 'America/Chicago')::date + 60, current_date - 365);
select pg_temp.check_notification(
  (select count(*) = 3 and bool_and(issue is null) from public.operational_certification_sources()),
  'unrelated fire credential stays eligible with multiple same-date EMS profiles');
select pg_temp.check_notification(public.scan_operational_certification_emails() = 1,
  'adding another same-date EMS profile does not replace or duplicate the fire reminder');
update public.member_certifications set certificate_number = 'FIRE-DATE-NREMT'
where id = '49000000-0000-0000-0000-000000000001';
select pg_temp.check_notification(
  exists(select 1 from public.operational_certification_sources()
    where source_id = '49000000-0000-0000-0000-000000000001' and issue is null),
  'shared certificate number cannot identify an unrelated fire credential as an EMS mirror');
select pg_temp.check_notification(
  (select count(*) = 3 and bool_and(status = 'pending' and recipient_email = 'holder@example.test'
    and department_id = '10000000-0000-0000-0000-000000000001')
    from public.operational_email_deliveries),
  'matching regressions preserve holder-only recipients and department ownership');
rollback to savepoint certification_matching_regressions;
release savepoint certification_matching_regressions;

savepoint missing_certificate_number_regressions;
-- Reproduce malformed legacy blanks only in this guarded, rolled-back test transaction.
alter table public.member_certifications drop constraint member_certifications_certificate_number_check;
do $$
declare
  v_number text; v_cert_a uuid; v_cert_b uuid; v_source_a uuid; v_source_b uuid;
begin
  foreach v_number in array array[null::text, '', '   '] loop
    v_cert_a := gen_random_uuid(); v_cert_b := gen_random_uuid();
    v_source_a := gen_random_uuid(); v_source_b := gen_random_uuid();
    insert into public.certifications(id, department_id, name, ems_authority, ems_certification_level) values
    (v_cert_a, '10000000-0000-0000-0000-000000000001', 'EMS missing identity A', 'iowa', 'emt'),
    (v_cert_b, '10000000-0000-0000-0000-000000000001', 'EMS missing identity B', 'iowa', 'emt');
    insert into public.member_certifications(id, department_id, member_id, certification_id,
      certificate_number, issued_at, expires_at) values
    (v_source_a, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      v_cert_a, v_number, current_date - 365, (now() at time zone 'America/Chicago')::date + 30),
    (v_source_b, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      v_cert_b, v_number, current_date - 365, (now() at time zone 'America/Chicago')::date + 30);
    perform pg_temp.check_notification(
      (select count(*) = 2 and bool_and(issue = 'ambiguous_ems_catalog')
        from public.operational_certification_sources() where source_id in (v_source_a, v_source_b)),
      'matching EMS catalog group excluded for ' || coalesce(quote_literal(v_number), 'NULL') || ' numbers');
    perform public.scan_operational_certification_emails();
    perform pg_temp.check_notification(
      (select count(*) = 2 and bool_and(status = 'needs_review' and last_error = 'ambiguous_ems_catalog')
        from public.operational_email_deliveries where source_id in (v_source_a, v_source_b)),
      'missing-number catalog group creates review-only events, never sendable reminders');
    perform pg_temp.check_notification(
      not exists(select 1 from public.claim_operational_email('certification_expiration')),
      'worker cannot claim ambiguous missing-number catalog reminders');
    update public.member_certifications set certificate_number = 'KNOWN-A' where id = v_source_a;
    perform pg_temp.check_notification(
      (select count(*) = 2 and bool_and(issue = 'ambiguous_ems_catalog')
        from public.operational_certification_sources() where source_id in (v_source_a, v_source_b)),
      'one missing number still leaves the same-date EMS group ambiguous');
    update public.member_certifications set certificate_number = 'KNOWN-B' where id = v_source_b;
    perform pg_temp.check_notification(
      (select count(*) = 2 and bool_and(issue is null)
        from public.operational_certification_sources() where source_id in (v_source_a, v_source_b)),
      'distinct nonblank EMS identities are not excluded solely for sharing an expiration');
    delete from public.operational_email_deliveries where source_id in (v_source_a, v_source_b);
    delete from public.member_certifications where id in (v_source_a, v_source_b);
    delete from public.certifications where id in (v_cert_a, v_cert_b);
  end loop;
end;
$$;
rollback to savepoint missing_certificate_number_regressions;
release savepoint missing_certificate_number_regressions;

do $$
declare v_days integer; v_offset integer; v_category text; v_cert uuid;
begin
  foreach v_category in array array['Fire', 'EMS', 'Other'] loop
    foreach v_days in array array[60, 30, 14, 7] loop
      foreach v_offset in array array[-1, 0, 1] loop
        v_cert := gen_random_uuid();
        insert into public.certifications(id, department_id, name)
        values(v_cert, '10000000-0000-0000-0000-000000000001', v_category || '/' || v_days || '/' || v_offset);
        insert into public.member_certifications(department_id, member_id, certification_id, issued_at, expires_at)
        values('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
          v_cert, (now() at time zone 'America/Chicago')::date - 365,
          (now() at time zone 'America/Chicago')::date + v_days + v_offset);
      end loop;
    end loop;
  end loop;
end;
$$;
set local timezone = 'Pacific/Auckland';
select pg_temp.check_notification(public.scan_operational_certification_emails() = 12,
  'all categories: exactly 60/30/14/7 Chicago calendar days, adjacent days excluded despite session timezone');
select pg_temp.check_notification(public.scan_operational_certification_emails() = 0,
  'repeated scheduler scan is idempotent');
select pg_temp.check_notification(
  (select count(*) = 12 and bool_and(recipient_email = 'holder@example.test')
    from public.operational_email_deliveries),
  'only certification holder receives milestones');
insert into public.certifications(id, department_id, name) values
('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'No expiration'),
('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Infinite expiration');
insert into public.member_certifications(department_id, member_id, certification_id, issued_at, expires_at) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date - 365, null),
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', current_date - 365, 'infinity');
select pg_temp.check_notification(public.scan_operational_certification_emails() = 0, 'null/infinite expiration never enqueues');
do $$
begin
  begin
    perform '2027-02-29'::date;
    raise exception 'Invalid date accepted';
  exception when datetime_field_overflow then null;
  end;
  perform pg_temp.check_notification(true, 'database rejects invalid calendar dates');
end;
$$;

create temp table cert_claim as select * from public.claim_operational_email('certification_expiration');
update public.member_certifications set expires_at = expires_at + 1
where id = (select source_id from cert_claim);
select pg_temp.check_notification(
  (select public.prepare_operational_email(id, lease_token, '{}'::jsonb) is null from cert_claim),
  'renewal after claim cancels stale reminder');
update public.member_certifications set expires_at = (now() at time zone 'America/Chicago')::date
  + case when (select milestone from cert_claim) = 7 then 30 else 7 end
where id = (select source_id from cert_claim);
select pg_temp.check_notification(public.scan_operational_certification_emails() = 1,
  'new expiration date starts a new schedule');

insert into public.certifications(id, department_id, name, ems_authority, ems_certification_level) values
('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Iowa EMT', 'iowa', 'emt'),
('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'EMT', null, null);
insert into public.member_certifications(id, department_id, member_id, certification_id, certificate_number, issued_at, expires_at) values
('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
 '30000000-0000-0000-0000-000000000003', 'SYNTHETIC-1', current_date - 365, (now() at time zone 'America/Chicago')::date + 30);
insert into public.ems_member_track_profiles(id, department_id, member_id, track, certification_level,
  track_status, maintain_track, certification_number, expiration_date, effective_start_date) values
('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
 'iowa', 'emt', 'active', true, 'SYNTHETIC-1', (now() at time zone 'America/Chicago')::date + 30, current_date - 365);
select pg_temp.check_notification(public.scan_operational_certification_emails() = 1,
  'exact EMS authority/level/number/date mirror generates one reminder');
select pg_temp.check_notification(
  (select count(*) = 1 from public.operational_certification_sources()
    where member_id = '20000000-0000-0000-0000-000000000002' and issue is null),
  'matched EMS profile is not an independent credential');
update public.ems_member_track_profiles set expiration_date = expiration_date + 1
where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.check_notification(
  (select bool_and(issue = 'ambiguous_ems_mirror') from public.operational_certification_sources()
    where member_id = '20000000-0000-0000-0000-000000000002'),
  'conflicting mirrored dates require review, never guessed');
update public.ems_member_track_profiles set expiration_date = expiration_date - 1
where id = '50000000-0000-0000-0000-000000000001';
insert into public.member_certifications(department_id, member_id, certification_id, issued_at, expires_at) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 '30000000-0000-0000-0000-000000000004', current_date - 365, (now() at time zone 'America/Chicago')::date + 14);
insert into public.ems_member_track_profiles(department_id, member_id, track, certification_level,
  track_status, maintain_track, certification_number, expiration_date, effective_start_date) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
 'nremt', 'emt', 'active', true, 'SYNTHETIC-LEGACY', (now() at time zone 'America/Chicago')::date + 14, current_date - 365);
select public.scan_operational_certification_emails();
select pg_temp.check_notification(
  (select count(*) = 2 and bool_and(status = 'needs_review') from public.operational_email_deliveries
    where milestone = 14 and payload->>'certificationName' in ('EMT', 'NREMT EMT')),
  'legacy missing metadata/number creates explicit review exclusions');

update public.members set active = false where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.check_notification(not exists(
  select 1 from public.claim_operational_email('certification_expiration')
  where member_id = '20000000-0000-0000-0000-000000000002'), 'inactive holder cannot be claimed');
update public.members set active = true where id = '20000000-0000-0000-0000-000000000002';
update public.operational_email_deliveries set status = 'skipped'
where event_type = 'certification_expiration' and status in ('pending', 'processing', 'retry');

insert into public.department_notification_recipients(department_id, notification_type, member_id) values
('10000000-0000-0000-0000-000000000001', 'ems_supply_low_stock', '20000000-0000-0000-0000-000000000001');
do $$
begin
  begin
    update public.department_notification_recipients set member_id = '20000000-0000-0000-0000-000000000003';
    raise exception 'Cross-department designation allowed';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.members set department_id = '10000000-0000-0000-0000-000000000002'
    where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'Designated member move allowed';
  exception when foreign_key_violation then null;
  end;
  perform pg_temp.check_notification(true, 'composite FK rejects cross-department designation and member move');
end;
$$;
insert into auth.users(id, email) values ('60000000-0000-0000-0000-000000000001', 'local-auth@example.test');
update public.members set auth_user_id = '60000000-0000-0000-0000-000000000001'
where id = '20000000-0000-0000-0000-000000000001';
insert into public.auth_user_department_memberships(auth_user_id, department_id, member_id) values
('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')
on conflict (auth_user_id, department_id) do nothing;
set local request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001';
insert into public.ems_supply_items(id, department_id, item_name, unit_of_measure, quantity_on_hand, reorder_threshold, qr_identifier) values
('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Synthetic Gauze', 'each', 12, 10, 'local-gauze'),
('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Synthetic Gloves', 'each', 12, 10, 'local-gloves');
select pg_temp.check_notification(not exists(
  select 1 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  'initial inventory creation generates no withdrawal emails');
create function pg_temp.checkout(p_quantity numeric)
returns void language sql as $$
  select from public.apply_ems_supply_transaction('Checkout',
    jsonb_build_array(jsonb_build_object('supply_item_id', '70000000-0000-0000-0000-000000000001', 'quantity', p_quantity)));
$$;
select pg_temp.checkout(2);
select pg_temp.checkout(1);
select pg_temp.checkout(1);
select pg_temp.checkout(1);
select pg_temp.check_notification(
  (select count(*) = 4 and count(distinct event_key) = 4 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  '12->10, 10->9, 9->8, 8->7 each generates a separate transaction-item email');
select pg_temp.check_notification(
  (select count(*) = 1 from public.notifications where type = 'ems_supply_low_stock'),
  'existing in-app behavior remains threshold-crossing only');
select public.apply_ems_supply_transaction('Restock',
  '[{"supply_item_id":"70000000-0000-0000-0000-000000000001","quantity":8}]');
select pg_temp.checkout(6);
select pg_temp.check_notification(
  (select count(*) = 5 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  'restock 7->15 sends nothing; later checkout 15->9 sends again');
select public.apply_ems_supply_transaction('Return',
  '[{"supply_item_id":"70000000-0000-0000-0000-000000000001","quantity":1}]');
select public.apply_ems_supply_correction('70000000-0000-0000-0000-000000000001', 9, 'Synthetic adjustment', null);
update public.ems_supply_items set reorder_threshold = 11 where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.check_notification(
  (select count(*) = 5 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  'returns, corrections, threshold-only edits do not generate withdrawal emails');
select public.apply_ems_supply_transaction('Checkout',
  '[{"supply_item_id":"70000000-0000-0000-0000-000000000001","quantity":1},{"supply_item_id":"70000000-0000-0000-0000-000000000002","quantity":2}]');
select pg_temp.check_notification(
  (select count(*) = 7 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  'multiple qualifying checkout items generate independent emails');
select public.enqueue_operational_supply_email(source_id, public.operational_supply_event(source_id))
from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal';
select pg_temp.check_notification(
  (select count(*) = 7 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  'duplicate processing of transaction-item IDs generates no duplicates');
savepoint withdrawal_rollback;
select pg_temp.checkout(1);
rollback to withdrawal_rollback;
select pg_temp.check_notification(
  (select count(*) = 7 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'),
  'checkout rollback also rolls back email event');

create temp table supply_claim as select * from public.claim_operational_email('ems_supply_withdrawal');
update public.department_notification_recipients set member_id = '20000000-0000-0000-0000-000000000002';
select pg_temp.check_notification(
  (select public.prepare_operational_email(id, lease_token, '{}'::jsonb) is null from supply_claim),
  'designation change after claim invalidates old delivery without rerouting');
select pg_temp.checkout(1);
select pg_temp.check_notification(
  (select count(*) = 1 from public.operational_email_deliveries where event_type = 'ems_supply_withdrawal'
    and recipient_email = 'replacement@example.test'),
  'subsequent withdrawal uses newly designated recipient');
create temp table fresh_claim as select * from public.claim_operational_email('ems_supply_withdrawal');
select public.prepare_operational_email(id, lease_token, jsonb_build_object(
  'from', 'sender@example.test', 'to', recipient_email, 'subject', 'Synthetic', 'text', 'Synthetic', 'html', '<p>Synthetic</p>'
)) from fresh_claim;
select public.finish_operational_email(id, lease_token, null, 'synthetic_retry', true) from fresh_claim;
select pg_temp.check_notification(
  (select status = 'retry' and attempt_count = 1 and next_attempt_at > now() from public.operational_email_deliveries
    where id = (select id from fresh_claim)), 'retryable provider failure uses bounded backoff');
update public.operational_email_deliveries set next_attempt_at = now() where id = (select id from fresh_claim);
create temp table retry_claim as select * from public.claim_operational_email('ems_supply_withdrawal');
select pg_temp.check_notification(
  (select public.prepare_operational_email(id, lease_token, '{"to":"chief@example.test"}') = email_message from retry_claim),
  'retry reuses frozen message and recipient, ignoring changed rendering');
select public.finish_operational_email(id, lease_token, null, 'synthetic_invalid_key', false) from retry_claim;
select pg_temp.check_notification(
  (select status = 'failed' from public.operational_email_deliveries where id = (select id from retry_claim)),
  'nonretryable failures stop');
select pg_temp.checkout(1);
create temp table expired_claim as select * from public.claim_operational_email('ems_supply_withdrawal');
update public.operational_email_deliveries set leased_until = now() - interval '1 second'
where id = (select id from expired_claim);
do $$
begin
  begin
    perform public.prepare_operational_email(id, lease_token, '{}') from expired_claim;
    raise exception 'Expired lease accepted';
  exception when raise_exception then
    if sqlerrm not like '%lease unavailable%' then raise; end if;
  end;
  perform pg_temp.check_notification(true, 'expired lease cannot prepare a send');
end;
$$;
update public.operational_email_deliveries set attempt_count = 8 where id = (select id from expired_claim);
select public.claim_operational_email('ems_supply_withdrawal');
select pg_temp.check_notification(
  (select status = 'needs_review' from public.operational_email_deliveries where id = (select id from expired_claim)),
  'eight attempts require review');
update public.department_notification_recipients set active = false;
select pg_temp.checkout(1);
select pg_temp.check_notification(
  exists(select 1 from public.operational_email_deliveries where last_error = 'designation_missing' and status = 'skipped'),
  'inactive/missing designation is explicitly skipped');
update public.department_notification_recipients set active = true;
update public.members set email = 'not-an-email' where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.checkout(1);
select pg_temp.check_notification(
  exists(select 1 from public.operational_email_deliveries where last_error = 'recipient_email_invalid' and status = 'skipped'),
  'invalid designated email is skipped without fallback');
update public.members set email = 'replacement@example.test', active = false
where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.checkout(1);
select pg_temp.check_notification(
  exists(select 1 from public.operational_email_deliveries where last_error = 'recipient_inactive' and status = 'skipped'),
  'inactive designated recipient is explicitly skipped');
update public.members set active = true where id = '20000000-0000-0000-0000-000000000002';

create function pg_temp.fail_operational_insert()
returns trigger language plpgsql as $$
begin
  if current_setting('operational_test.fail_enqueue', true) = 'true' then
    raise exception 'Synthetic enqueue failure';
  end if;
  return new;
end;
$$;
create trigger synthetic_fail_enqueue before insert on public.operational_email_deliveries
for each row execute function pg_temp.fail_operational_insert();
set local operational_test.fail_enqueue = 'true';
select pg_temp.checkout(1);
select pg_temp.check_notification(
  (select count(*) = 1 from public.operational_email_enqueue_failures),
  'enqueue failure does not lose checkout: durable original event snapshot retained');
set local operational_test.fail_enqueue = 'false';
update public.department_notification_recipients set member_id = '20000000-0000-0000-0000-000000000001';
update public.ems_supply_items set reorder_threshold = 1 where id = '70000000-0000-0000-0000-000000000001';
update public.operational_email_enqueue_failures set next_attempt_at = now();
select public.claim_operational_email('ems_supply_withdrawal');
select pg_temp.check_notification(
  exists(select 1 from public.operational_email_deliveries where recipient_email = 'replacement@example.test'
    and payload->>'reorderThreshold' = '11.00' and last_error = 'designation_changed' and status = 'skipped')
  and not exists(select 1 from public.operational_email_enqueue_failures),
  'enqueue recovery preserves original threshold/recipient and never reroutes to replacement');

-- A fresh independent fixture exercises the 23-hour cutoff without changing provider state.
update public.ems_supply_items set quantity_on_hand = 12, reorder_threshold = 10
where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.checkout(2);
create temp table cutoff_claim as select * from public.claim_operational_email('ems_supply_withdrawal');
select public.prepare_operational_email(id, lease_token, jsonb_build_object(
  'from', 'sender@example.test', 'to', recipient_email, 'subject', 'Synthetic', 'text', 'Synthetic', 'html', '<p>Synthetic</p>'
)) from cutoff_claim;
update public.operational_email_deliveries set first_attempt_at = now() - interval '23 hours',
  leased_until = now() - interval '1 second' where id = (select id from cutoff_claim);
select public.claim_operational_email('ems_supply_withdrawal');
select pg_temp.check_notification(
  (select status = 'needs_review' from public.operational_email_deliveries where id = (select id from cutoff_claim)),
  '23-hour retry window requires review rather than risking a new provider send');

do $$
declare v_id uuid;
begin
  v_id := gen_random_uuid();
  insert into public.ems_supply_transactions(id, department_id, transaction_type)
  values(v_id, '10000000-0000-0000-0000-000000000002', 'Checkout');
  begin
    insert into public.ems_supply_transaction_items(transaction_id, department_id, supply_item_id,
      unit_of_measure, quantity_delta, quantity_before, quantity_after)
    values(v_id, '10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
      'each', -1, 10, 9);
    raise exception 'Forged department relation accepted';
  exception when raise_exception then
    if sqlerrm not like '%department ownership mismatch%' then raise; end if;
  end;
  perform pg_temp.check_notification(true, 'forged withdrawal relationships fail closed before enqueue');
end;
$$;

insert into public.certifications(id, department_id, name) values
('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Foreign certification');
insert into public.member_certifications(department_id, member_id, certification_id, issued_at, expires_at) values
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
 '30000000-0000-0000-0000-000000000005', current_date - 365, (now() at time zone 'America/Chicago')::date + 60);
select public.scan_operational_certification_emails();
select pg_temp.check_notification(
  exists(select 1 from public.operational_email_deliveries where last_error = 'credential_department_mismatch' and status = 'needs_review'),
  'foreign catalog ownership is explicitly excluded for review');
insert into public.ems_member_track_profiles(department_id, member_id, track, certification_level,
  track_status, maintain_track, certification_number, expiration_date, effective_start_date) values
('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003',
 'iowa', 'paramedic', 'active', true, 'PROFILE-ONLY', (now() at time zone 'America/Chicago')::date + 7, current_date - 365);
select pg_temp.check_notification(public.scan_operational_certification_emails() = 1,
  'unambiguous profile-only EMS certification receives one milestone');
update public.members set email = 'invalid' where id = '20000000-0000-0000-0000-000000000003';
select pg_temp.check_notification(
  exists(select 1 from public.operational_email_deliveries d
    where source_type = 'profile' and status = 'pending'
      and public.operational_email_ineligibility(d) = 'recipient_no_longer_eligible'),
  'changed invalid holder email is rechecked before dispatch');
select pg_temp.check_notification(
  not has_function_privilege('authenticated', 'public.claim_operational_email(text)', 'EXECUTE')
  and not has_table_privilege('authenticated', 'public.operational_email_deliveries', 'SELECT')
  and not has_table_privilege('service_role', 'public.operational_email_rollouts', 'UPDATE'),
  'outbox and RPCs are private; worker cannot enable rollouts');
select pg_temp.check_notification(
  public.assignment_email_department_enabled('10000000-0000-0000-0000-000000000001'),
  'deficiency assignments remain enabled for an existing non-Cedar department');
rollback;
