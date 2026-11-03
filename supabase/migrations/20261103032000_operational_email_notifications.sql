begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.operational_email_rollouts (
  event_type text primary key check (event_type in ('certification_expiration', 'ems_supply_withdrawal')),
  enabled boolean not null default false
);
insert into public.operational_email_rollouts(event_type)
values ('certification_expiration'), ('ems_supply_withdrawal');
alter table public.operational_email_rollouts enable row level security;
revoke all on public.operational_email_rollouts from public, anon, authenticated, service_role;
grant select on public.operational_email_rollouts to service_role;

create table public.operational_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null references public.operational_email_rollouts(event_type),
  event_key text not null,
  department_id uuid not null references public.departments(id),
  member_id uuid references public.members(id),
  source_id uuid not null,
  source_type text not null check (source_type in ('catalog', 'profile', 'withdrawal')),
  expires_at date,
  milestone integer check (milestone in (60, 30, 14, 7)),
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
  unique(event_type, event_key),
  unique(event_type, source_type, source_id, expires_at, milestone),
  check ((email_message is null) = (first_attempt_at is null)),
  check (
    (event_type = 'certification_expiration' and source_type in ('catalog', 'profile')
      and expires_at is not null and isfinite(expires_at) and milestone is not null)
    or (event_type = 'ems_supply_withdrawal' and source_type = 'withdrawal'
      and expires_at is null and milestone is null)
  )
);
create index operational_email_due_idx
  on public.operational_email_deliveries(event_type, next_attempt_at, created_at, id)
  where status in ('pending', 'processing', 'retry');
alter table public.operational_email_deliveries enable row level security;
revoke all on public.operational_email_deliveries from public, anon, authenticated, service_role;
grant select on public.operational_email_deliveries to service_role;

create table public.operational_email_enqueue_failures (
  transaction_item_id uuid primary key references public.ems_supply_transaction_items(id),
  event_snapshot jsonb not null,
  status text not null default 'retry' check (status in ('retry', 'needs_review')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 8),
  next_attempt_at timestamptz not null default now() + interval '2 minutes',
  last_error_code text not null
);
alter table public.operational_email_enqueue_failures enable row level security;
revoke all on public.operational_email_enqueue_failures from public, anon, authenticated, service_role;
grant select on public.operational_email_enqueue_failures to service_role;

create function public.operational_email_enabled(p_type text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select enabled from public.operational_email_rollouts where event_type = p_type), false);
$$;

-- Exact authority/level/number/date matches only. Legacy or conflicting representations require review.
create function public.operational_certification_sources()
returns table (
  department_id uuid, member_id uuid, source_id uuid, source_type text,
  credential_key text, expires_at date, name text, issue text
) language sql stable security definer set search_path = public, pg_temp as $$
  with catalog as (
    select mc.*, c.name, c.ems_authority, c.ems_certification_level,
      c.department_id as catalog_department,
      nullif(btrim(mc.certificate_number), '') as number
    from public.member_certifications mc join public.certifications c on c.id = mc.certification_id
  ), profiles as (
    select p.*, nullif(btrim(p.certification_number), '') as number
    from public.ems_member_track_profiles p
    where p.effective_end_date is null and p.expiration_date is not null and isfinite(p.expiration_date)
  ), pairs as (
    select c.id as cid, p.id as pid,
      c.ems_authority = p.track and c.ems_certification_level = p.certification_level
        and c.number is not null and c.number = p.number
        and c.expires_at = p.expiration_date as exact
    from catalog c join profiles p
      on c.department_id = p.department_id and c.member_id = p.member_id
      and (
        (c.ems_authority = p.track and c.ems_certification_level = p.certification_level)
        or (c.ems_authority is null and upper(btrim(c.name)) = 'EMT' and p.certification_level = 'emt')
      )
  )
  select c.department_id, c.member_id, c.id, 'catalog'::text,
    case when c.ems_authority is not null and c.number is not null
      then 'ems/' || c.ems_authority || '/' || c.ems_certification_level || '/' || c.number
      else 'catalog/' || c.id::text end,
    c.expires_at, c.name,
    case
      when c.department_id is distinct from c.catalog_department
        or not exists (select 1 from public.members m where m.id = c.member_id and m.department_id = c.department_id)
        then 'credential_department_mismatch'
      when exists (
        select 1 from catalog other where other.id <> c.id and other.department_id = c.department_id
          and other.member_id = c.member_id and other.ems_authority = c.ems_authority
          and other.ems_certification_level = c.ems_certification_level
          and (
            other.number = c.number
            or (other.expires_at = c.expires_at and (other.number is null or c.number is null))
          )
      ) then 'ambiguous_ems_catalog'
      when exists (select 1 from pairs where cid = c.id) and (
        (select count(*) from pairs where cid = c.id) <> 1
        or not coalesce((select bool_and(exact) from pairs where cid = c.id), false)
        or exists (select 1 from pairs mine join pairs other on other.pid = mine.pid
          where mine.cid = c.id and other.cid <> c.id)
      ) then 'ambiguous_ems_mirror'
      else null end
  from catalog c where c.expires_at is not null and isfinite(c.expires_at)
  union all
  select p.department_id, p.member_id, p.id, 'profile'::text,
    case when p.number is not null
      then 'ems/' || p.track || '/' || p.certification_level || '/' || p.number
      else 'profile/' || p.id::text end,
    p.expiration_date, upper(p.track) || ' ' || upper(p.certification_level),
    case
      when not exists (select 1 from public.members m where m.id = p.member_id and m.department_id = p.department_id)
        then 'credential_department_mismatch'
      when exists (select 1 from pairs where pid = p.id) then 'ambiguous_ems_mirror'
      when exists (select 1 from profiles other where other.id <> p.id and other.department_id = p.department_id
        and other.member_id = p.member_id and other.track = p.track
        and other.certification_level = p.certification_level) then 'ambiguous_ems_profiles'
      else null end
  from profiles p
  where not (
    (select count(*) from pairs where pid = p.id) = 1
    and coalesce((select bool_and(exact) from pairs where pid = p.id), false)
    and (select count(*) from pairs allpairs where allpairs.cid =
      (select cid from pairs where pid = p.id limit 1)) = 1
  );
$$;

create function public.scan_operational_certification_emails(p_limit integer default 200)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  if not public.operational_email_enabled('certification_expiration') then return 0; end if;
  if p_limit < 1 or p_limit > 1000 then raise exception 'Invalid certification scan limit'; end if;
  insert into public.operational_email_deliveries(
    event_type, event_key, department_id, member_id, source_id, source_type,
    expires_at, milestone, recipient_email, payload, status, last_error
  )
  select 'certification_expiration',
    s.member_id::text || '/' || s.credential_key || '/' || s.expires_at::text || '/' || due.days::text,
    s.department_id, s.member_id, s.source_id, s.source_type, s.expires_at, due.days,
    btrim(m.email),
    jsonb_build_object('departmentName', d.name, 'certificationName', s.name,
      'expirationDate', s.expires_at, 'milestone', due.days, 'memberId', s.member_id),
    case when s.issue is not null then 'needs_review'
      when m.active is distinct from true or m.department_id is distinct from s.department_id
        or m.email is null or length(btrim(m.email)) > 254
        or btrim(m.email) !~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+[.][^[:space:]@<>,;]+$'
        then 'skipped' else 'pending' end,
    case when s.issue is not null then s.issue
      when m.active is distinct from true or m.department_id is distinct from s.department_id
        then 'holder_ineligible'
      when m.email is null or length(btrim(m.email)) > 254
        or btrim(m.email) !~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+[.][^[:space:]@<>,;]+$'
        then 'holder_email_invalid' else null end
  from public.operational_certification_sources() s
  join public.members m on m.id = s.member_id
  join public.departments d on d.id = s.department_id
  cross join (values (60), (30), (14), (7)) due(days)
  where s.expires_at - (now() at time zone 'America/Chicago')::date = due.days
    and not exists (select 1 from public.operational_email_deliveries e
      where e.event_type = 'certification_expiration'
        and (
          e.event_key = s.member_id::text || '/' || s.credential_key || '/' || s.expires_at::text || '/' || due.days::text
          or (e.source_id = s.source_id and e.source_type = s.source_type
            and e.expires_at = s.expires_at and e.milestone = due.days)
        ))
  order by s.department_id, s.member_id, s.source_id, due.days
  limit p_limit
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.operational_supply_event(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item public.ems_supply_transaction_items%rowtype;
  v_transaction public.ems_supply_transactions%rowtype;
  v_supply public.ems_supply_items%rowtype;
  v_member public.members%rowtype;
  v_department_name text;
  v_issue text;
begin
  select * into strict v_item from public.ems_supply_transaction_items where id = p_item_id;
  select * into strict v_transaction from public.ems_supply_transactions where id = v_item.transaction_id;
  select * into strict v_supply from public.ems_supply_items where id = v_item.supply_item_id;
  if v_transaction.transaction_type <> 'Checkout' or v_item.quantity_delta >= 0
    or v_supply.status <> 'Active' or v_item.quantity_after > v_supply.reorder_threshold then return null; end if;
  if v_item.department_id is distinct from v_transaction.department_id
    or v_item.department_id is distinct from v_supply.department_id then
    raise exception 'EMS withdrawal department ownership mismatch';
  end if;
  select m.* into v_member from public.department_notification_recipients r
  join public.members m on m.id = r.member_id and m.department_id = r.department_id
  where r.department_id = v_item.department_id and r.notification_type = 'ems_supply_low_stock' and r.active = true;
  if v_member.id is null then v_issue := 'designation_missing';
  elsif v_member.active is distinct from true then v_issue := 'recipient_inactive';
  elsif v_member.email is null or length(btrim(v_member.email)) > 254
    or btrim(v_member.email) !~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+[.][^[:space:]@<>,;]+$'
    then v_issue := 'recipient_email_invalid';
  end if;
  select name into strict v_department_name from public.departments where id = v_item.department_id;
  return jsonb_build_object(
    'departmentId', v_item.department_id, 'memberId', v_member.id, 'recipientEmail', btrim(v_member.email),
    'issue', v_issue,
    'payload', jsonb_build_object('departmentName', v_department_name, 'itemName', v_supply.item_name,
      'quantityAfter', v_item.quantity_after, 'reorderThreshold', v_supply.reorder_threshold,
      'withdrawalQuantity', -v_item.quantity_delta, 'unit', v_item.unit_of_measure,
      'supplyItemId', v_supply.id, 'transactionItemId', v_item.id)
  );
end;
$$;

create function public.enqueue_operational_supply_email(p_item_id uuid, p_snapshot jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.operational_email_enabled('ems_supply_withdrawal') then return; end if;
  insert into public.operational_email_deliveries(
    event_type, event_key, department_id, member_id, source_id, source_type, recipient_email, payload, status, last_error
  ) values (
    'ems_supply_withdrawal', p_item_id::text, (p_snapshot->>'departmentId')::uuid,
    (p_snapshot->>'memberId')::uuid, p_item_id, 'withdrawal',
    p_snapshot->>'recipientEmail', p_snapshot->'payload',
    case when p_snapshot->>'issue' is null then 'pending' else 'skipped' end, p_snapshot->>'issue'
  ) on conflict(event_type, event_key) do nothing;
end;
$$;

create function public.queue_operational_supply_email()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_snapshot jsonb;
begin
  if not public.operational_email_enabled('ems_supply_withdrawal') then return new; end if;
  v_snapshot := public.operational_supply_event(new.id);
  if v_snapshot is null then return new; end if;
  begin
    perform public.enqueue_operational_supply_email(new.id, v_snapshot);
  exception when others then
    insert into public.operational_email_enqueue_failures(transaction_item_id, event_snapshot, last_error_code)
    values(new.id, v_snapshot, sqlstate);
    raise warning 'EMS email enqueue failed for item %, SQLSTATE %; recovery queued', new.id, sqlstate;
  end;
  return new;
end;
$$;
create trigger trg_queue_operational_supply_email after insert on public.ems_supply_transaction_items
for each row execute function public.queue_operational_supply_email();

create function public.operational_email_ineligibility(p_delivery public.operational_email_deliveries)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.operational_email_enabled(p_delivery.event_type) then return 'rollout_disabled'; end if;
  if not exists (
    select 1 from public.members m where m.id = p_delivery.member_id
      and m.department_id = p_delivery.department_id and m.active = true
      and btrim(m.email) = p_delivery.recipient_email and length(btrim(m.email)) <= 254
      and btrim(m.email) ~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+[.][^[:space:]@<>,;]+$'
  ) then return 'recipient_no_longer_eligible'; end if;
  if p_delivery.event_type = 'certification_expiration' then
    if p_delivery.first_attempt_at is null
      and p_delivery.expires_at - (now() at time zone 'America/Chicago')::date <> p_delivery.milestone then
      return 'milestone_date_passed';
    end if;
    if not exists (
      select 1 from public.operational_certification_sources() s
      where s.source_id = p_delivery.source_id and s.source_type = p_delivery.source_type
        and s.department_id = p_delivery.department_id and s.member_id = p_delivery.member_id
        and s.expires_at = p_delivery.expires_at and s.issue is null
        and p_delivery.event_key = s.member_id::text || '/' || s.credential_key || '/'
          || s.expires_at::text || '/' || p_delivery.milestone::text
    ) then return 'credential_changed_or_ambiguous'; end if;
  elsif p_delivery.event_type = 'ems_supply_withdrawal' then
    if not exists (
      select 1 from public.ems_supply_transaction_items i
      join public.ems_supply_transactions t on t.id = i.transaction_id and t.department_id = i.department_id
      join public.ems_supply_items s on s.id = i.supply_item_id and s.department_id = i.department_id
      where i.id = p_delivery.source_id and i.department_id = p_delivery.department_id
        and t.transaction_type = 'Checkout' and i.quantity_delta < 0
        and s.id::text = p_delivery.payload->>'supplyItemId'
        and i.quantity_after = (p_delivery.payload->>'quantityAfter')::numeric
        and -i.quantity_delta = (p_delivery.payload->>'withdrawalQuantity')::numeric
        and i.unit_of_measure = p_delivery.payload->>'unit'
    ) then return 'withdrawal_ownership_changed'; end if;
    if not exists (
      select 1 from public.department_notification_recipients r
      where r.department_id = p_delivery.department_id and r.member_id = p_delivery.member_id
        and r.notification_type = 'ems_supply_low_stock' and r.active = true
    ) then return 'designation_changed'; end if;
  else return 'unsupported_event'; end if;
  return null;
end;
$$;

create function public.claim_operational_email(p_type text)
returns setof public.operational_email_deliveries
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_failure public.operational_email_enqueue_failures%rowtype;
  v_delivery public.operational_email_deliveries%rowtype;
  v_issue text;
  v_iteration integer;
begin
  if p_type not in ('certification_expiration', 'ems_supply_withdrawal') then
    raise exception 'Unsupported operational email type';
  end if;
  if not public.operational_email_enabled(p_type) then return; end if;
  if p_type = 'ems_supply_withdrawal' then
    for v_failure in select * from public.operational_email_enqueue_failures
      where status = 'retry' and next_attempt_at <= now() order by next_attempt_at
      limit 10 for update skip locked
    loop
      begin
        perform public.enqueue_operational_supply_email(v_failure.transaction_item_id, v_failure.event_snapshot);
        delete from public.operational_email_enqueue_failures where transaction_item_id = v_failure.transaction_item_id;
      exception when others then
        update public.operational_email_enqueue_failures set
          attempt_count = least(8, attempt_count + 1),
          status = case when attempt_count >= 7 then 'needs_review' else 'retry' end,
          next_attempt_at = now() + make_interval(secs => least(3600, (60 * power(2, attempt_count))::integer)),
          last_error_code = sqlstate
        where transaction_item_id = v_failure.transaction_item_id;
        raise warning 'EMS email recovery failed for item %, SQLSTATE %', v_failure.transaction_item_id, sqlstate;
      end;
    end loop;
  end if;
  for v_iteration in 1..20
  loop
    select * into v_delivery from public.operational_email_deliveries
      where event_type = p_type and (
        (status in ('pending', 'retry') and next_attempt_at <= now())
        or (status = 'processing' and leased_until <= clock_timestamp())
      )
      order by created_at, id limit 1 for update skip locked;
    if not found then return; end if;
    v_issue := public.operational_email_ineligibility(v_delivery);
    if v_issue is not null then
      update public.operational_email_deliveries set status = 'skipped', last_error = v_issue,
        lease_token = null, leased_until = null, updated_at = now() where id = v_delivery.id;
      continue;
    end if;
    if v_delivery.attempt_count >= 8 or v_delivery.first_attempt_at <= now() - interval '23 hours' then
      update public.operational_email_deliveries set status = 'needs_review', last_error = 'retry_window_exhausted',
        lease_token = null, leased_until = null, updated_at = now() where id = v_delivery.id;
      continue;
    end if;
    update public.operational_email_deliveries set status = 'processing', attempt_count = attempt_count + 1,
      lease_token = gen_random_uuid(), leased_until = clock_timestamp() + interval '2 minutes', updated_at = now()
    where id = v_delivery.id returning * into v_delivery;
    return next v_delivery;
    return;
  end loop;
end;
$$;

create function public.prepare_operational_email(p_id uuid, p_lease_token uuid, p_message jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_snapshot public.operational_email_deliveries%rowtype;
  v_delivery public.operational_email_deliveries%rowtype;
  v_issue text;
begin
  select * into strict v_snapshot from public.operational_email_deliveries where id = p_id;
  -- Lock source/recipient before the outbox, matching enqueue's transaction lock order.
  if v_snapshot.source_type = 'catalog' then
    perform 1 from public.member_certifications where id = v_snapshot.source_id for share;
    perform 1 from public.certifications c join public.member_certifications mc on mc.certification_id = c.id
      where mc.id = v_snapshot.source_id for share of c;
  elsif v_snapshot.source_type = 'profile' then
    perform 1 from public.ems_member_track_profiles where id = v_snapshot.source_id for share;
  else
    perform 1 from public.ems_supply_items where id::text = v_snapshot.payload->>'supplyItemId' for share;
    perform 1 from public.ems_supply_transaction_items where id = v_snapshot.source_id for share;
    perform 1 from public.department_notification_recipients
      where department_id = v_snapshot.department_id and notification_type = 'ems_supply_low_stock' for share;
  end if;
  if v_snapshot.event_type = 'certification_expiration' then
    perform 1 from public.member_certifications
      where member_id = v_snapshot.member_id order by id for share;
    perform 1 from public.ems_member_track_profiles
      where member_id = v_snapshot.member_id order by id for share;
  end if;
  perform 1 from public.members where id = v_snapshot.member_id for share;
  perform 1 from public.operational_email_rollouts where event_type = v_snapshot.event_type for share;
  select * into strict v_delivery from public.operational_email_deliveries where id = p_id for update;
  if v_delivery.status <> 'processing' or v_delivery.lease_token is distinct from p_lease_token
    or v_delivery.leased_until <= clock_timestamp() then raise exception 'Operational email lease unavailable'; end if;
  v_issue := public.operational_email_ineligibility(v_delivery);
  if v_delivery.first_attempt_at <= clock_timestamp() - interval '23 hours' then
    update public.operational_email_deliveries set status = 'needs_review', last_error = 'retry_window_exhausted',
      lease_token = null, leased_until = null where id = p_id;
    return null;
  end if;
  if v_issue is not null then
    update public.operational_email_deliveries set status = 'skipped', last_error = v_issue,
      lease_token = null, leased_until = null where id = p_id;
    return null;
  end if;
  if v_delivery.email_message is not null then return v_delivery.email_message; end if;
  if jsonb_typeof(p_message) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_message)) <> 5
    or not p_message ?& array['from', 'to', 'subject', 'text', 'html']
    or exists (select 1 from jsonb_each(p_message) where jsonb_typeof(value) <> 'string')
    or p_message->>'to' is distinct from v_delivery.recipient_email
    or btrim(p_message->>'from') = '' then raise exception 'Invalid operational email message'; end if;
  update public.operational_email_deliveries set email_message = p_message, first_attempt_at = clock_timestamp(),
    updated_at = now() where id = p_id;
  return p_message;
end;
$$;

create function public.finish_operational_email(
  p_id uuid, p_lease_token uuid, p_provider_id text, p_error text, p_retryable boolean
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (p_provider_id is null) = (p_error is null) then raise exception 'Invalid delivery result'; end if;
  update public.operational_email_deliveries set
    status = case when p_provider_id is not null then 'sent'
      when not p_retryable then 'failed'
      when attempt_count >= 8 or first_attempt_at <= now() - interval '23 hours' then 'needs_review'
      else 'retry' end,
    provider_message_id = p_provider_id, last_error = p_error,
    sent_at = case when p_provider_id is not null then now() else null end,
    next_attempt_at = now() + make_interval(secs => least(3600, (60 * power(2, attempt_count))::integer)),
    lease_token = null, leased_until = null, updated_at = now()
  where id = p_id and status = 'processing' and lease_token = p_lease_token and email_message is not null;
  if not found then raise exception 'Operational email lease unavailable or message unprepared'; end if;
end;
$$;

do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'operational_email_enabled', 'operational_certification_sources', 'scan_operational_certification_emails',
      'operational_supply_event', 'enqueue_operational_supply_email', 'queue_operational_supply_email', 'operational_email_ineligibility',
      'claim_operational_email', 'prepare_operational_email', 'finish_operational_email'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_function);
  end loop;
end;
$$;
grant execute on function public.scan_operational_certification_emails(integer),
  public.claim_operational_email(text), public.prepare_operational_email(uuid, uuid, jsonb),
  public.finish_operational_email(uuid, uuid, text, text, boolean) to service_role;
commit;
