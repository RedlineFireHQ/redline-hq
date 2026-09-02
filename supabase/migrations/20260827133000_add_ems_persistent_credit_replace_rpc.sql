alter table public.ems_credit_sources
  add column if not exists updated_at timestamptz not null default now();

alter table public.ems_credit_allocations
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_ems_credit_sources_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_credit_allocations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ems_credit_sources_updated_at on public.ems_credit_sources;
create trigger trg_ems_credit_sources_updated_at
before update on public.ems_credit_sources
for each row execute function public.set_ems_credit_sources_updated_at();

drop trigger if exists trg_ems_credit_allocations_updated_at on public.ems_credit_allocations;
create trigger trg_ems_credit_allocations_updated_at
before update on public.ems_credit_allocations
for each row execute function public.set_ems_credit_allocations_updated_at();

create or replace function public.replace_ems_auto_credit_accounting(
  p_department_id uuid,
  p_member_id uuid,
  p_requested_by uuid,
  p_sources jsonb,
  p_allocations jsonb,
  p_allocator_version text default 'ems-persistent-v1'
)
returns table (
  source_count integer,
  allocation_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_department_id uuid;
  v_requester_role text;
  v_requester_allowed boolean := false;
  v_source_count integer := 0;
  v_allocation_count integer := 0;
begin
  if p_department_id is null or p_member_id is null or p_requested_by is null then
    raise exception 'Validation error: department, member, and requested_by are required.';
  end if;

  select m.department_id, lower(coalesce(m.role, ''))
  into v_requester_department_id, v_requester_role
  from public.members m
  where m.id = p_requested_by
    and coalesce(m.active, false) = true
  limit 1;

  if v_requester_department_id is null then
    raise exception 'Unauthorized: requesting member not found or inactive.';
  end if;

  if v_requester_department_id <> p_department_id then
    raise exception 'Forbidden: requester does not belong to target department.';
  end if;

  v_requester_allowed := p_requested_by = p_member_id
    or v_requester_role in ('administrator', 'officer');

  if not v_requester_allowed then
    raise exception 'Forbidden: requester may only recalculate their own EMS credits.';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and m.department_id = p_department_id
      and coalesce(m.active, false) = true
  ) then
    raise exception 'Validation error: target member not found in department.';
  end if;

  create temporary table tmp_ems_sources (
    source_type text not null,
    source_record_id uuid not null,
    source_occurred_at date not null,
    source_title text not null,
    source_hours numeric(6,2) not null,
    training_category_id uuid,
    ems_core_topic text,
    provider_name text,
    course_definition_id uuid,
    approval_state text not null,
    metadata_json jsonb not null
  ) on commit drop;

  if p_sources is not null and jsonb_typeof(p_sources) = 'array' and jsonb_array_length(p_sources) > 0 then
    insert into tmp_ems_sources (
      source_type,
      source_record_id,
      source_occurred_at,
      source_title,
      source_hours,
      training_category_id,
      ems_core_topic,
      provider_name,
      course_definition_id,
      approval_state,
      metadata_json
    )
    select
      x.source_type,
      x.source_record_id,
      x.source_occurred_at,
      x.source_title,
      x.source_hours,
      x.training_category_id,
      x.ems_core_topic,
      x.provider_name,
      x.course_definition_id,
      x.approval_state,
      coalesce(x.metadata_json, '{}'::jsonb)
    from jsonb_to_recordset(p_sources) as x(
      source_type text,
      source_record_id uuid,
      source_occurred_at date,
      source_title text,
      source_hours numeric(6,2),
      training_category_id uuid,
      ems_core_topic text,
      provider_name text,
      course_definition_id uuid,
      approval_state text,
      metadata_json jsonb
    );
  end if;

  create temporary table tmp_ems_allocations (
    source_type text not null,
    source_record_id uuid not null,
    member_cycle_id uuid,
    requirement_set_id uuid not null,
    requirement_component_id uuid,
    requirement_topic_id uuid,
    allocated_hours numeric(6,2) not null,
    allocation_status text not null,
    allocation_reason text,
    rule_trace_json jsonb not null
  ) on commit drop;

  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' and jsonb_array_length(p_allocations) > 0 then
    insert into tmp_ems_allocations (
      source_type,
      source_record_id,
      member_cycle_id,
      requirement_set_id,
      requirement_component_id,
      requirement_topic_id,
      allocated_hours,
      allocation_status,
      allocation_reason,
      rule_trace_json
    )
    select
      x.source_type,
      x.source_record_id,
      x.member_cycle_id,
      x.requirement_set_id,
      x.requirement_component_id,
      x.requirement_topic_id,
      x.allocated_hours,
      x.allocation_status,
      x.allocation_reason,
      coalesce(x.rule_trace_json, '{}'::jsonb)
    from jsonb_to_recordset(p_allocations) as x(
      source_type text,
      source_record_id uuid,
      member_cycle_id uuid,
      requirement_set_id uuid,
      requirement_component_id uuid,
      requirement_topic_id uuid,
      allocated_hours numeric(6,2),
      allocation_status text,
      allocation_reason text,
      rule_trace_json jsonb
    );
  end if;

  delete from public.ems_credit_sources ecs
  where ecs.department_id = p_department_id
    and ecs.member_id = p_member_id
    and ecs.source_type in ('training_event_attendance', 'training_outside_submission')
    and not exists (
      select 1
      from tmp_ems_sources ts
      where ts.source_type = ecs.source_type
        and ts.source_record_id = ecs.source_record_id
    );

  insert into public.ems_credit_sources (
    department_id,
    member_id,
    source_type,
    source_record_id,
    source_occurred_at,
    source_title,
    source_hours,
    training_category_id,
    ems_core_topic,
    provider_name,
    course_definition_id,
    approval_state,
    metadata_json,
    created_by,
    created_at,
    updated_at
  )
  select
    p_department_id,
    p_member_id,
    ts.source_type,
    ts.source_record_id,
    ts.source_occurred_at,
    ts.source_title,
    ts.source_hours,
    ts.training_category_id,
    ts.ems_core_topic,
    ts.provider_name,
    ts.course_definition_id,
    ts.approval_state,
    ts.metadata_json,
    p_requested_by,
    now(),
    now()
  from tmp_ems_sources ts
  on conflict (department_id, member_id, source_type, source_record_id)
  do update set
    source_occurred_at = excluded.source_occurred_at,
    source_title = excluded.source_title,
    source_hours = excluded.source_hours,
    training_category_id = excluded.training_category_id,
    ems_core_topic = excluded.ems_core_topic,
    provider_name = excluded.provider_name,
    course_definition_id = excluded.course_definition_id,
    approval_state = excluded.approval_state,
    metadata_json = excluded.metadata_json,
    updated_at = now();

  delete from public.ems_credit_allocations a
  using public.ems_credit_sources s
  where a.credit_source_id = s.id
    and s.department_id = p_department_id
    and s.member_id = p_member_id
    and s.source_type in ('training_event_attendance', 'training_outside_submission');

  insert into public.ems_credit_allocations (
    department_id,
    member_id,
    member_cycle_id,
    credit_source_id,
    requirement_set_id,
    requirement_component_id,
    requirement_topic_id,
    allocated_hours,
    allocation_status,
    allocation_reason,
    allocator_version,
    rule_trace_json,
    is_manual_override,
    created_at,
    updated_at
  )
  select
    p_department_id,
    p_member_id,
    ta.member_cycle_id,
    s.id,
    ta.requirement_set_id,
    ta.requirement_component_id,
    ta.requirement_topic_id,
    ta.allocated_hours,
    ta.allocation_status,
    ta.allocation_reason,
    coalesce(nullif(btrim(p_allocator_version), ''), 'ems-persistent-v1'),
    ta.rule_trace_json,
    false,
    now(),
    now()
  from tmp_ems_allocations ta
  join public.ems_credit_sources s
    on s.department_id = p_department_id
   and s.member_id = p_member_id
   and s.source_type = ta.source_type
   and s.source_record_id = ta.source_record_id;

  select count(*)::integer into v_source_count
  from public.ems_credit_sources s
  where s.department_id = p_department_id
    and s.member_id = p_member_id
    and s.source_type in ('training_event_attendance', 'training_outside_submission');

  select count(*)::integer into v_allocation_count
  from public.ems_credit_allocations a
  where a.department_id = p_department_id
    and a.member_id = p_member_id;

  return query select v_source_count, v_allocation_count;
end;
$$;

revoke all on function public.replace_ems_auto_credit_accounting(uuid, uuid, uuid, jsonb, jsonb, text) from public;
revoke all on function public.replace_ems_auto_credit_accounting(uuid, uuid, uuid, jsonb, jsonb, text) from anon;
grant execute on function public.replace_ems_auto_credit_accounting(uuid, uuid, uuid, jsonb, jsonb, text) to authenticated;
