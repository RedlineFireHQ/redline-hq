alter table public.deficiencies
add column if not exists inspection_id uuid references public.apparatus_inspections (id) on delete set null;

alter table public.deficiencies
add column if not exists check_session_id uuid;

create table if not exists public.apparatus_check_sessions (
  id uuid primary key default gen_random_uuid(),
  apparatus_id uuid not null,
  department_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  state text not null default 'in_progress' check (state in ('in_progress', 'completed', 'abandoned', 'expired')),
  selected_result_draft text check (selected_result_draft in ('ready', 'needs_attention', 'out_of_service')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  expired_at timestamptz,
  completed_inspection_id uuid references public.apparatus_inspections (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_check_sessions_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade
);

alter table public.deficiencies
drop constraint if exists deficiencies_check_session_id_fkey;

alter table public.deficiencies
add constraint deficiencies_check_session_id_fkey
foreign key (check_session_id)
references public.apparatus_check_sessions (id)
on delete set null;

create index if not exists deficiencies_inspection_id_idx
on public.deficiencies (inspection_id);

create index if not exists deficiencies_check_session_id_idx
on public.deficiencies (check_session_id);

create index if not exists apparatus_check_sessions_member_state_idx
on public.apparatus_check_sessions (member_id, apparatus_id, state, started_at desc);

create unique index if not exists apparatus_check_sessions_one_active_per_member_apparatus_idx
on public.apparatus_check_sessions (member_id, apparatus_id)
where state = 'in_progress'
  and completed_at is null
  and abandoned_at is null
  and expired_at is null;

create or replace function public.set_apparatus_check_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apparatus_check_sessions_updated_at on public.apparatus_check_sessions;
create trigger trg_apparatus_check_sessions_updated_at
before update on public.apparatus_check_sessions
for each row
execute function public.set_apparatus_check_sessions_updated_at();

alter table public.apparatus_check_sessions enable row level security;

drop policy if exists apparatus_check_sessions_select_self on public.apparatus_check_sessions;
create policy apparatus_check_sessions_select_self
on public.apparatus_check_sessions
for select
using (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists apparatus_check_sessions_insert_self on public.apparatus_check_sessions;
create policy apparatus_check_sessions_insert_self
on public.apparatus_check_sessions
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists apparatus_check_sessions_update_self on public.apparatus_check_sessions;
create policy apparatus_check_sessions_update_self
on public.apparatus_check_sessions
for update
using (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

create or replace function public.validate_deficiency_check_session()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_session public.apparatus_check_sessions%rowtype;
begin
  if new.check_session_id is null then
    return new;
  end if;

  select *
  into v_session
  from public.apparatus_check_sessions
  where id = new.check_session_id
  limit 1;

  if not found then
    raise exception 'Invalid apparatus check session.';
  end if;

  if v_session.state is distinct from 'in_progress'
    or v_session.completed_at is not null
    or v_session.abandoned_at is not null
    or v_session.expired_at is not null then
    raise exception 'Apparatus check session is no longer active.';
  end if;

  if new.apparatus_id is distinct from v_session.apparatus_id then
    raise exception 'Deficiency apparatus does not match the active check session apparatus.';
  end if;

  if new.reported_by is not null and new.reported_by is distinct from v_session.member_id then
    raise exception 'Deficiency reporter does not match the active check session member.';
  end if;

  if new.department_id is not null and new.department_id is distinct from v_session.department_id then
    raise exception 'Deficiency department does not match the active check session department.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_deficiency_check_session on public.deficiencies;
create trigger trg_validate_deficiency_check_session
before insert or update of check_session_id, apparatus_id, reported_by, department_id
on public.deficiencies
for each row
execute function public.validate_deficiency_check_session();

create or replace function public.get_or_create_apparatus_check_session(
  p_apparatus_id uuid,
  p_existing_session_id uuid default null,
  p_selected_result text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_apparatus_id uuid;
  v_department_id uuid;
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_requester_email text;
  v_session_id uuid;
begin
  if p_selected_result is not null and p_selected_result not in ('ready', 'needs_attention', 'out_of_service') then
    raise exception 'Invalid selected result.';
  end if;

  select a.id, a.department_id
  into v_apparatus_id, v_department_id
  from public.apparatus a
  where a.id = p_apparatus_id
  limit 1;

  if v_apparatus_id is null then
    raise exception 'Apparatus not found.';
  end if;

  if v_department_id is null then
    raise exception 'No department found for apparatus.';
  end if;

  if auth.uid() is not null then
    select m.id, m.department_id
    into v_requester_id, v_requester_department_id
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = v_department_id
      and coalesce(m.active, false) = true
    order by m.id
    limit 1;
  end if;

  if v_requester_id is null then
    select lower(coalesce(u.email, ''))
    into v_requester_email
    from auth.users u
    where u.id = auth.uid()
      and u.deleted_at is null
    limit 1;

    if coalesce(v_requester_email, '') = '' then
      v_requester_email := lower(coalesce(auth.email(), ''));
    end if;

    if coalesce(v_requester_email, '') <> '' then
      select m.id, m.department_id
      into v_requester_id, v_requester_department_id
      from public.members m
      where lower(coalesce(m.email, '')) = v_requester_email
        and m.department_id = v_department_id
        and coalesce(m.active, false) = true
      order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
      limit 1;
    end if;
  end if;

  if v_requester_id is null then
    raise exception 'Unable to resolve requesting member for this apparatus department.';
  end if;

  if v_requester_department_id is distinct from v_department_id then
    raise exception 'Requesting member does not belong to the apparatus department.';
  end if;

  if p_existing_session_id is not null then
    select s.id
    into v_session_id
    from public.apparatus_check_sessions s
    where s.id = p_existing_session_id
      and s.apparatus_id = v_apparatus_id
      and s.department_id = v_department_id
      and s.member_id = v_requester_id
      and s.state = 'in_progress'
      and s.completed_at is null
      and s.abandoned_at is null
      and s.expired_at is null
    order by s.started_at desc
    limit 1
    for update;

    if v_session_id is not null then
      update public.apparatus_check_sessions
      set
        selected_result_draft = coalesce(p_selected_result, selected_result_draft),
        updated_at = now()
      where id = v_session_id;

      return v_session_id;
    end if;
  end if;

  select s.id
  into v_session_id
  from public.apparatus_check_sessions s
  where s.apparatus_id = v_apparatus_id
    and s.department_id = v_department_id
    and s.member_id = v_requester_id
    and s.state = 'in_progress'
    and s.completed_at is null
    and s.abandoned_at is null
    and s.expired_at is null
  order by s.started_at desc
  limit 1
  for update;

  if v_session_id is not null then
    update public.apparatus_check_sessions
    set
      selected_result_draft = coalesce(p_selected_result, selected_result_draft),
      updated_at = now()
    where id = v_session_id;

    return v_session_id;
  end if;

  insert into public.apparatus_check_sessions (
    apparatus_id,
    department_id,
    member_id,
    state,
    selected_result_draft,
    started_at,
    created_at,
    updated_at
  )
  values (
    v_apparatus_id,
    v_department_id,
    v_requester_id,
    'in_progress',
    p_selected_result,
    now(),
    now(),
    now()
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.complete_apparatus_check(
  p_session_id uuid,
  p_final_status text,
  p_notes text default null,
  p_mileage integer default null,
  p_engine_hours numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_session public.apparatus_check_sessions%rowtype;
  v_apparatus_id uuid;
  v_department_id uuid;
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_requester_email text;
  v_require_checklist boolean := false;
  v_required_count integer := 0;
  v_completed_required_count integer := 0;
  v_linked_deficiency_count integer := 0;
  v_mismatch_count integer := 0;
  v_inspection_id uuid;
  v_updated_count integer := 0;
begin
  if p_session_id is null then
    raise exception 'Session id is required.';
  end if;

  if p_final_status not in ('ready', 'needs_attention', 'out_of_service') then
    raise exception 'Invalid final inspection status.';
  end if;

  select s.*
  into v_session
  from public.apparatus_check_sessions s
  where s.id = p_session_id
  limit 1
  for update;

  if not found then
    raise exception 'Apparatus check session not found.';
  end if;

  if v_session.department_id is null then
    raise exception 'Session department is required.';
  end if;

  if auth.uid() is not null then
    select m.id, m.department_id
    into v_requester_id, v_requester_department_id
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = v_session.department_id
      and coalesce(m.active, false) = true
    order by m.id
    limit 1;
  end if;

  if v_requester_id is null then
    select lower(coalesce(u.email, ''))
    into v_requester_email
    from auth.users u
    where u.id = auth.uid()
      and u.deleted_at is null
    limit 1;

    if coalesce(v_requester_email, '') = '' then
      v_requester_email := lower(coalesce(auth.email(), ''));
    end if;

    if coalesce(v_requester_email, '') <> '' then
      select m.id, m.department_id
      into v_requester_id, v_requester_department_id
      from public.members m
      where lower(coalesce(m.email, '')) = v_requester_email
        and m.department_id = v_session.department_id
        and coalesce(m.active, false) = true
      order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
      limit 1;
    end if;
  end if;

  if v_requester_id is null then
    raise exception 'Unable to resolve requesting member for this apparatus department.';
  end if;

  if v_requester_department_id is distinct from v_session.department_id then
    raise exception 'Requesting member does not belong to the apparatus check department.';
  end if;

  if v_session.member_id is distinct from v_requester_id then
    raise exception 'This apparatus check session belongs to a different member.';
  end if;

  if v_session.completed_at is not null or v_session.state = 'completed' then
    return jsonb_build_object(
      'session_id', v_session.id,
      'already_completed', true,
      'inspection_id', v_session.completed_inspection_id,
      'status', p_final_status
    );
  end if;

  if v_session.state in ('abandoned', 'expired')
    or v_session.abandoned_at is not null
    or v_session.expired_at is not null then
    raise exception 'This apparatus check session is no longer active.';
  end if;

  select a.id, a.department_id
  into v_apparatus_id, v_department_id
  from public.apparatus a
  where a.id = v_session.apparatus_id
  limit 1;

  if v_apparatus_id is null then
    raise exception 'Apparatus not found for this session.';
  end if;

  if v_department_id is distinct from v_session.department_id then
    raise exception 'Session department does not match apparatus department.';
  end if;

  select count(*)
  into v_linked_deficiency_count
  from public.deficiencies d
  where d.check_session_id = v_session.id;

  select count(*)
  into v_mismatch_count
  from public.deficiencies d
  where d.check_session_id = v_session.id
    and (
      d.apparatus_id is distinct from v_session.apparatus_id
      or (d.department_id is not null and d.department_id is distinct from v_session.department_id)
    );

  if v_mismatch_count > 0 then
    raise exception 'Linked deficiencies include rows outside this apparatus check session scope.';
  end if;

  if p_final_status = 'ready' and v_linked_deficiency_count > 0 then
    raise exception 'Ready for Service cannot be completed when deficiencies are linked to this apparatus check.';
  end if;

  if p_final_status in ('needs_attention', 'out_of_service') and v_linked_deficiency_count = 0 then
    raise exception 'This inspection status requires at least one reported deficiency in the current apparatus check.';
  end if;

  select s.require_checklist
  into v_require_checklist
  from public.apparatus_inspection_settings s
  where s.department_id = v_department_id
  limit 1;

  v_require_checklist := coalesce(v_require_checklist, false);

  if v_require_checklist then
    select count(*)
    into v_required_count
    from public.apparatus_inspection_checklist_items i
    where i.department_id = v_department_id
      and i.apparatus_id = v_apparatus_id
      and i.is_active = true
      and i.is_required = true;

    if v_required_count = 0 then
      raise exception 'Checklist required: no active required checklist items are configured for this apparatus.';
    end if;

    select count(*)
    into v_completed_required_count
    from public.apparatus_inspection_checklist_progress p
    join public.apparatus_inspection_checklist_items i
      on i.id = p.checklist_item_id
     and i.department_id = p.department_id
    where p.department_id = v_department_id
      and p.apparatus_id = v_apparatus_id
      and p.member_id = v_requester_id
      and i.is_active = true
      and i.is_required = true
      and p.status in ('checked', 'deficiency', 'not_applicable');

    if v_completed_required_count < v_required_count then
      raise exception 'Checklist required: complete all required inspection items before submitting.';
    end if;
  end if;

  insert into public.apparatus_inspections (
    apparatus_id,
    department_id,
    member_id,
    status,
    notes,
    mileage,
    engine_hours
  )
  values (
    v_apparatus_id,
    v_department_id,
    v_requester_id,
    p_final_status,
    p_notes,
    p_mileage,
    p_engine_hours
  )
  returning id into v_inspection_id;

  insert into public.apparatus_inspection_checklist_results (
    inspection_id,
    department_id,
    apparatus_id,
    checklist_item_id,
    section_name_snapshot,
    item_label_snapshot,
    is_required_snapshot,
    result_status,
    item_order
  )
  select
    v_inspection_id,
    i.department_id,
    i.apparatus_id,
    i.id,
    i.section_name,
    i.item_label,
    i.is_required,
    p.status,
    i.display_order
  from public.apparatus_inspection_checklist_progress p
  join public.apparatus_inspection_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
   and i.apparatus_id = p.apparatus_id
  where p.department_id = v_department_id
    and p.apparatus_id = v_apparatus_id
    and p.member_id = v_requester_id
    and i.is_active = true;

  update public.deficiencies
  set inspection_id = v_inspection_id
  where check_session_id = v_session.id
    and inspection_id is null;

  update public.apparatus
  set
    status = p_final_status,
    out_of_service_source = case
      when p_final_status = 'out_of_service' then 'deficiency'
      when p_final_status in ('ready', 'needs_attention') then null
      else out_of_service_source
    end,
    last_inspection_at = now(),
    notes = p_notes,
    mileage = coalesce(p_mileage, mileage),
    engine_hours = coalesce(p_engine_hours, engine_hours)
  where id = v_apparatus_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception 'Inspection completion failed: expected to update 1 apparatus row, updated %.', v_updated_count;
  end if;

  update public.apparatus_check_sessions
  set
    state = 'completed',
    selected_result_draft = p_final_status,
    completed_at = now(),
    completed_inspection_id = v_inspection_id,
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'already_completed', false,
    'inspection_id', v_inspection_id,
    'status', p_final_status,
    'linked_deficiency_count', v_linked_deficiency_count,
    'out_of_service_source', case when p_final_status = 'out_of_service' then 'deficiency' else null end
  );
end;
$$;

revoke all on function public.get_or_create_apparatus_check_session(uuid, uuid, text) from public;
revoke all on function public.get_or_create_apparatus_check_session(uuid, uuid, text) from anon;
grant execute on function public.get_or_create_apparatus_check_session(uuid, uuid, text) to authenticated;

revoke all on function public.complete_apparatus_check(uuid, text, text, integer, numeric) from public;
revoke all on function public.complete_apparatus_check(uuid, text, text, integer, numeric) from anon;
grant execute on function public.complete_apparatus_check(uuid, text, text, integer, numeric) to authenticated;
