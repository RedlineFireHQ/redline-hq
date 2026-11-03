begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.notification_email_deliveries') is not null then
    raise exception 'Assignment email migration is already installed or conflicts with an existing outbox. No changes were made; use migration history, not manual reapplication.';
  end if;
end;
$$;

create table public.notification_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity unique,
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  deficiency_id uuid,
  event_type text not null check (event_type = 'deficiency_assigned'),
  recipient_email text,
  payload jsonb not null,
  email_message jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'skipped', 'failed', 'needs_review')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  first_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((email_message is null) = (first_attempt_at is null))
);

create index notification_email_deliveries_due_idx
  on public.notification_email_deliveries(event_sequence)
  where status in ('pending', 'retry', 'processing');
create index notification_email_deliveries_deficiency_event_idx
  on public.notification_email_deliveries(deficiency_id, event_sequence desc);

alter table public.notification_email_deliveries enable row level security;
revoke all on public.notification_email_deliveries from public, anon, authenticated, service_role;
grant select on public.notification_email_deliveries to service_role;
revoke all on sequence public.notification_email_deliveries_event_sequence_seq
  from public, anon, authenticated, service_role;

create table public.notification_email_enqueue_failures (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  event_sequence bigint not null unique,
  status text not null default 'retry' check (status in ('retry', 'needs_review')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 8),
  last_error_code text not null,
  next_attempt_at timestamptz not null default now() + interval '2 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notification_email_enqueue_failures enable row level security;
revoke all on public.notification_email_enqueue_failures from public, anon, authenticated, service_role;
grant select on public.notification_email_enqueue_failures to service_role;

-- Initial Production rollout is Cedar Bluff only. Expanding it requires an
-- explicitly reviewed migration, not writable department or browser settings.
create function public.assignment_email_department_enabled(p_department_id uuid)
returns boolean
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_department_id = '44a25960-7d46-45c4-94e9-115833072da8'::uuid, false);
$$;

revoke all on function public.assignment_email_department_enabled(uuid)
  from public, anon, authenticated, service_role;

-- All populated ownership links must resolve and agree. Stored department_id is
-- checked separately; it is never an ownership source.
create function public.resolve_deficiency_email_department(p_deficiency_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when count(*) > 0
    and count(*) = count(link.department_id)
    and count(distinct link.department_id) = 1
    then (array_agg(link.department_id))[1] else null end
  from public.deficiencies d
  cross join lateral (values
    (d.reported_by, (select department_id from public.members where id = d.reported_by)),
    (d.apparatus_id, (select department_id from public.apparatus where id = d.apparatus_id)),
    (d.asset_id, (select department_id from public.assets where id = d.asset_id)),
    (d.fire_hose_id, (select department_id from public.fire_hose where id = d.fire_hose_id)),
    (d.scba_cylinder_id, (select department_id from public.scba_cylinders where id = d.scba_cylinder_id)),
    (d.scba_pack_id, (select department_id from public.scba_packs where id = d.scba_pack_id)),
    (d.pie_equipment_id, (select department_id from public.pie_equipment where id = d.pie_equipment_id)),
    (d.ems_equipment_id, (select department_id from public.ems_equipment where id = d.ems_equipment_id)),
    (d.ppe_item_id, (select department_id from public.ppe_items where id = d.ppe_item_id)),
    (d.rope_item_id, (select department_id from public.rope_items where id = d.rope_item_id)),
    (d.fire_extinguisher_id, (select department_id from public.fire_extinguishers where id = d.fire_extinguisher_id)),
    (d.misc_fire_equipment_id, (select department_id from public.misc_fire_equipment where id = d.misc_fire_equipment_id)),
    (d.gas_monitor_id, (select department_id from public.gas_monitors where id = d.gas_monitor_id)),
    (d.battery_id, (select department_id from public.batteries where id = d.battery_id)),
    (d.thermal_imaging_camera_id, (select department_id from public.thermal_imaging_cameras where id = d.thermal_imaging_camera_id)),
    (d.ground_ladder_id, (select department_id from public.ground_ladders where id = d.ground_ladder_id)),
    (d.portable_radio_id, (select department_id from public.portable_radios where id = d.portable_radio_id)),
    (d.portable_radio_mic_id, (select department_id from public.portable_radio_mics where id = d.portable_radio_mic_id)),
    (d.pager_id, (select department_id from public.pagers where id = d.pager_id)),
    (d.inspection_id, (select department_id from public.apparatus_inspections where id = d.inspection_id)),
    (d.check_session_id, (select department_id from public.apparatus_check_sessions where id = d.check_session_id))
  ) as link(id, department_id)
  where d.id = p_deficiency_id and link.id is not null;
$$;

revoke all on function public.resolve_deficiency_email_department(uuid)
  from public, anon, authenticated, service_role;

create function public.notification_email_ineligibility(p_delivery public.notification_email_deliveries)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
begin
  if not public.assignment_email_department_enabled(p_delivery.department_id) then
    return 'department_not_enabled';
  end if;
  v_department_id := public.resolve_deficiency_email_department(p_delivery.deficiency_id);
  if v_department_id is null or v_department_id is distinct from p_delivery.department_id
    or not exists (
      select 1 from public.deficiencies d
      join public.notifications n on n.id = p_delivery.notification_id
      where d.id = p_delivery.deficiency_id and d.department_id = v_department_id
        and n.department_id = v_department_id and n.member_id = p_delivery.member_id
        and n.type = 'deficiency_assigned'
        and n.href = '/operations/deficiencies/' || d.id::text
    ) then
    return 'ownership_missing_ambiguous_or_mismatched';
  end if;
  if exists (
    select 1 from public.notification_email_deliveries newer
    where newer.deficiency_id = p_delivery.deficiency_id
      and newer.event_sequence > p_delivery.event_sequence
  ) or exists (
    select 1 from public.notification_email_enqueue_failures newer
    join public.notifications n on n.id = newer.notification_id
    where n.href = '/operations/deficiencies/' || p_delivery.deficiency_id::text
      and newer.event_sequence > p_delivery.event_sequence
  ) or not exists (
    select 1 from public.deficiencies d
    where d.id = p_delivery.deficiency_id and d.assigned_to = p_delivery.member_id
  ) then
    return 'assignment_no_longer_current';
  end if;
  if not exists (
    select 1 from public.members m
    where m.id = p_delivery.member_id and m.department_id = v_department_id
      and m.active = true and btrim(m.email) = p_delivery.recipient_email
      and length(btrim(m.email)) <= 254
      and btrim(m.email) ~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+[.][^[:space:]@<>,;]+$'
  ) then
    return 'recipient_no_longer_eligible';
  end if;
  return null;
end;
$$;

revoke all on function public.notification_email_ineligibility(public.notification_email_deliveries)
  from public, anon, authenticated, service_role;

create function public.enqueue_deficiency_assignment_email(p_notification public.notifications, p_event_sequence bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deficiency public.deficiencies%rowtype;
  v_member public.members%rowtype;
  v_department_name text;
  v_category_name text;
  v_priority_name text;
  v_department_id uuid;
  v_error text;
begin
  if p_notification.type <> 'deficiency_assigned'
    or not public.assignment_email_department_enabled(p_notification.department_id) then
    return;
  end if;

  select d.* into v_deficiency
  from public.deficiencies d
  where p_notification.href = '/operations/deficiencies/' || d.id::text
    and d.assigned_to = p_notification.member_id;

  v_department_id := public.resolve_deficiency_email_department(v_deficiency.id);

  select m.* into v_member from public.members m
  where m.id = p_notification.member_id and m.department_id = p_notification.department_id;

  if v_department_id is null or v_department_id is distinct from p_notification.department_id
    or v_deficiency.department_id is distinct from v_department_id then
    v_error := 'ownership_missing_ambiguous_or_mismatched';
  elsif v_deficiency.id is null or v_member.id is null then
    v_error := 'recipient_department_or_assignment_mismatch';
  elsif v_member.active is distinct from true then
    v_error := 'recipient_inactive';
  elsif v_member.email is null or length(btrim(v_member.email)) > 254
    or btrim(v_member.email) !~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+[.][^[:space:]@<>,;]+$' then
    v_error := 'recipient_email_invalid';
  end if;

  select name into v_department_name from public.departments where id = p_notification.department_id;
  select name into v_category_name from public.deficiency_categories where id = v_deficiency.category_id;
  select name into v_priority_name from public.deficiency_priorities where id = v_deficiency.priority;

  insert into public.notification_email_deliveries (
    event_sequence, notification_id, department_id, member_id, deficiency_id, event_type,
    recipient_email, payload, status, last_error
  ) overriding system value values (
    p_event_sequence, p_notification.id, p_notification.department_id, p_notification.member_id, v_deficiency.id, 'deficiency_assigned',
    btrim(v_member.email),
    jsonb_build_object(
      'departmentName', v_department_name,
      'description', coalesce(v_deficiency.description, ''),
      'category', coalesce(v_category_name, 'Uncategorized'),
      'priority', coalesce(v_priority_name, 'Not specified'),
      'href', p_notification.href
    ),
    case when v_error is null then 'pending' else 'skipped' end,
    v_error
  ) on conflict (notification_id) do nothing;
  return;
end;
$$;

revoke all on function public.enqueue_deficiency_assignment_email(public.notifications, bigint)
  from public, anon, authenticated, service_role;

create function public.queue_deficiency_assignment_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_sequence bigint;
begin
  if new.type <> 'deficiency_assigned'
    or not public.assignment_email_department_enabled(new.department_id) then
    return new;
  end if;
  v_event_sequence := nextval('public.notification_email_deliveries_event_sequence_seq');
  begin
    perform public.enqueue_deficiency_assignment_email(new, v_event_sequence);
  exception when others then
    -- Keep the original notification/assignment; retain a durable recovery job.
    -- If even this small recovery insert fails, surface the database error
    -- rather than commit an untracked lost email event.
    insert into public.notification_email_enqueue_failures(notification_id, event_sequence, last_error_code)
    values(new.id, v_event_sequence, sqlstate);
    raise warning 'Assignment email enqueue failed for notification %, SQLSTATE %; recovery queued', new.id, sqlstate;
  end;
  return new;
end;
$$;

revoke all on function public.queue_deficiency_assignment_email() from public, anon, authenticated, service_role;

create trigger trg_queue_deficiency_assignment_email
after insert on public.notifications
for each row execute function public.queue_deficiency_assignment_email();

create function public.claim_notification_email()
returns setof public.notification_email_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.notification_email_deliveries%rowtype;
  v_error text;
  v_failure public.notification_email_enqueue_failures%rowtype;
  v_notification public.notifications%rowtype;
begin
  for v_failure in
    select * from public.notification_email_enqueue_failures
    where status = 'retry' and next_attempt_at <= now()
    order by next_attempt_at, notification_id limit 10 for update skip locked
  loop
    begin
      select * into strict v_notification from public.notifications where id = v_failure.notification_id;
      perform public.enqueue_deficiency_assignment_email(v_notification, v_failure.event_sequence);
      delete from public.notification_email_enqueue_failures where notification_id = v_failure.notification_id;
    exception when others then
      update public.notification_email_enqueue_failures
      set attempt_count = attempt_count + 1,
          status = case when attempt_count >= 7 then 'needs_review' else 'retry' end,
          last_error_code = sqlstate,
          next_attempt_at = now() + make_interval(secs => least(3600, (60 * power(2, attempt_count + 1))::integer)),
          updated_at = now()
      where notification_id = v_failure.notification_id;
      raise warning 'Assignment email enqueue recovery failed for notification %, SQLSTATE %', v_failure.notification_id, sqlstate;
    end;
  end loop;
  for i in 1..20 loop
    select * into v_delivery
    from public.notification_email_deliveries
    where (status in ('pending', 'retry') and next_attempt_at <= now())
       or (status = 'processing' and leased_until <= now())
    order by event_sequence
    limit 1 for update skip locked;
    if not found then
      return;
    end if;

    -- Resend retains idempotency keys for 24 hours. Never blindly resend after that window.
    if v_delivery.attempt_count >= 8
      or v_delivery.first_attempt_at <= now() - interval '23 hours' then
      update public.notification_email_deliveries
      set status = 'needs_review', last_error = 'retry_safety_limit',
          lease_token = null, leased_until = null, updated_at = now()
      where id = v_delivery.id;
      continue;
    end if;

    v_error := public.notification_email_ineligibility(v_delivery);
    if v_error is not null then
      update public.notification_email_deliveries
      set status = 'skipped', last_error = v_error, lease_token = null,
          leased_until = null, updated_at = now()
      where id = v_delivery.id;
      continue;
    end if;

    update public.notification_email_deliveries
    set status = 'processing', attempt_count = attempt_count + 1,
        lease_token = gen_random_uuid(), leased_until = now() + interval '2 minutes', updated_at = now()
    where id = v_delivery.id returning * into v_delivery;
    return next v_delivery;
    return;
  end loop;
end;
$$;

create function public.prepare_notification_email(p_id uuid, p_lease_token uuid, p_message jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.notification_email_deliveries%rowtype;
  v_error text;
begin
  select * into v_delivery from public.notification_email_deliveries
  where id = p_id and status = 'processing' and lease_token = p_lease_token
    and leased_until > clock_timestamp();
  if not found then
    raise exception 'Email delivery lease is unavailable';
  end if;
  -- Wait for already-running assignment/member updates, then validate with a
  -- fresh snapshot. Take these locks before the outbox lock to avoid reversing
  -- the member-delete / cascading-outbox lock order.
  perform 1 from public.deficiencies where id = v_delivery.deficiency_id for share;
  perform 1 from public.members where id = v_delivery.member_id for share;
  select * into v_delivery from public.notification_email_deliveries
  where id = p_id and status = 'processing' and lease_token = p_lease_token
    and leased_until > clock_timestamp()
  for update;
  if not found then
    raise exception 'Email delivery lease is unavailable';
  end if;
  -- This RPC is the dispatch boundary. Every attempt, including frozen retries,
  -- must pass current ownership, assignment and recipient checks here.
  v_error := public.notification_email_ineligibility(v_delivery);
  if v_error is not null or v_delivery.first_attempt_at <= clock_timestamp() - interval '23 hours' then
    update public.notification_email_deliveries
    set status = case when v_error is null then 'needs_review' else 'skipped' end,
        last_error = coalesce(v_error, 'retry_safety_limit'),
        lease_token = null, leased_until = null, updated_at = now()
    where id = p_id;
    return null;
  end if;
  if v_delivery.email_message is not null then
    return v_delivery.email_message;
  end if;
  if jsonb_typeof(p_message) is distinct from 'object'
    or p_message->>'to' is distinct from v_delivery.recipient_email
    or coalesce(p_message->>'from', '') = ''
    or coalesce(p_message->>'subject', '') = ''
    or coalesce(p_message->>'text', '') = ''
    or coalesce(p_message->>'html', '') = ''
    or p_message - array['from', 'to', 'subject', 'text', 'html'] <> '{}'::jsonb then
    raise exception 'Invalid email message';
  end if;
  update public.notification_email_deliveries
  set email_message = p_message, first_attempt_at = clock_timestamp(), updated_at = now()
  where id = p_id;
  return p_message;
end;
$$;

create function public.finish_notification_email(
  p_id uuid, p_lease_token uuid, p_provider_id text, p_error text, p_retryable boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (nullif(p_provider_id, '') is null) = (nullif(p_error, '') is null) then
    raise exception 'Supply exactly one email delivery result';
  end if;
  update public.notification_email_deliveries
  set status = case
        when p_provider_id is not null then 'sent'
        when not p_retryable then 'failed'
        when attempt_count >= 8 or first_attempt_at <= now() - interval '23 hours' then 'needs_review'
        else 'retry' end,
      provider_message_id = p_provider_id,
      last_error = case when p_error is not null then left(p_error, 200) else last_error end,
      sent_at = case when p_provider_id is not null then now() else null end,
      next_attempt_at = now() + make_interval(secs => least(3600, (60 * power(2, attempt_count))::integer)),
      lease_token = null, leased_until = null, updated_at = now()
  where id = p_id and status = 'processing' and lease_token = p_lease_token
    and email_message is not null;
  if not found then
    raise exception 'Email delivery lease is unavailable or message was not prepared';
  end if;
end;
$$;

revoke all on function public.claim_notification_email() from public, anon, authenticated;
revoke all on function public.prepare_notification_email(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.finish_notification_email(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_notification_email() to service_role;
grant execute on function public.prepare_notification_email(uuid, uuid, jsonb) to service_role;
grant execute on function public.finish_notification_email(uuid, uuid, text, text, boolean) to service_role;

commit;
