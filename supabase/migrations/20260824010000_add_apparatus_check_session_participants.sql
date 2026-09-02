create table if not exists public.apparatus_check_session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.apparatus_check_sessions (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  added_by_member_id uuid not null references public.members (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create index if not exists apparatus_check_session_members_session_idx
on public.apparatus_check_session_members (session_id, created_at desc);

create index if not exists apparatus_check_session_members_member_idx
on public.apparatus_check_session_members (member_id, created_at desc);

alter table public.apparatus_check_session_members enable row level security;

drop policy if exists apparatus_check_session_members_select_owner_or_participant on public.apparatus_check_session_members;
create policy apparatus_check_session_members_select_owner_or_participant
on public.apparatus_check_session_members
for select
using (
  exists (
    select 1
    from public.apparatus_check_sessions s
    join public.members requester
      on requester.department_id = s.department_id
     and coalesce(requester.active, false) = true
    where s.id = apparatus_check_session_members.session_id
      and (
        (auth.uid() is not null and requester.auth_user_id = auth.uid())
        or lower(coalesce(requester.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        requester.id = s.member_id
        or requester.id = apparatus_check_session_members.member_id
      )
  )
);

drop policy if exists apparatus_check_session_members_insert_owner_only on public.apparatus_check_session_members;
create policy apparatus_check_session_members_insert_owner_only
on public.apparatus_check_session_members
for insert
with check (
  exists (
    select 1
    from public.apparatus_check_sessions s
    join public.members requester
      on requester.department_id = s.department_id
     and coalesce(requester.active, false) = true
    join public.members helper_member
      on helper_member.id = apparatus_check_session_members.member_id
     and coalesce(helper_member.active, false) = true
    where s.id = apparatus_check_session_members.session_id
      and s.state = 'in_progress'
      and s.completed_at is null
      and s.abandoned_at is null
      and s.expired_at is null
      and apparatus_check_session_members.department_id = s.department_id
      and apparatus_check_session_members.member_id <> s.member_id
      and helper_member.department_id = s.department_id
      and apparatus_check_session_members.added_by_member_id = requester.id
      and requester.id = s.member_id
      and (
        (auth.uid() is not null and requester.auth_user_id = auth.uid())
        or lower(coalesce(requester.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists apparatus_check_session_members_delete_owner_only on public.apparatus_check_session_members;
create policy apparatus_check_session_members_delete_owner_only
on public.apparatus_check_session_members
for delete
using (
  exists (
    select 1
    from public.apparatus_check_sessions s
    join public.members requester
      on requester.department_id = s.department_id
     and coalesce(requester.active, false) = true
    where s.id = apparatus_check_session_members.session_id
      and s.state = 'in_progress'
      and s.completed_at is null
      and s.abandoned_at is null
      and s.expired_at is null
      and requester.id = s.member_id
      and (
        (auth.uid() is not null and requester.auth_user_id = auth.uid())
        or lower(coalesce(requester.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

revoke all on table public.apparatus_check_session_members from public;
revoke all on table public.apparatus_check_session_members from anon;
grant select, insert, delete on table public.apparatus_check_session_members to authenticated;

create or replace function public.validate_deficiency_check_session()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_session public.apparatus_check_sessions%rowtype;
  v_reporter public.members%rowtype;
  v_helper_allowed boolean := false;
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

  if new.department_id is not null and new.department_id is distinct from v_session.department_id then
    raise exception 'Deficiency department does not match the active check session department.';
  end if;

  if new.reported_by is null then
    raise exception 'Deficiency reporter is required for the active check session.';
  end if;

  select *
  into v_reporter
  from public.members m
  where m.id = new.reported_by
  limit 1;

  if not found then
    raise exception 'Deficiency reporter is invalid for this active check session.';
  end if;

  if coalesce(v_reporter.active, false) = false then
    raise exception 'Deficiency reporter is inactive for this active check session.';
  end if;

  if v_reporter.department_id is distinct from v_session.department_id then
    raise exception 'Deficiency reporter does not belong to the active check session department.';
  end if;

  if new.reported_by is not distinct from v_session.member_id then
    return new;
  end if;

  select exists (
    select 1
    from public.apparatus_check_session_members sm
    join public.members helper
      on helper.id = sm.member_id
    where sm.session_id = v_session.id
      and sm.member_id = new.reported_by
      and sm.department_id = v_session.department_id
      and helper.department_id = v_session.department_id
      and coalesce(helper.active, false) = true
  )
  into v_helper_allowed;

  if not v_helper_allowed then
    raise exception 'Deficiency reporter is not a participant in this active check session.';
  end if;

  return new;
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
  v_invalid_session_member_count integer := 0;
  v_helper_participant_count integer := 0;
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

  select count(*)
  into v_helper_participant_count
  from public.apparatus_check_session_members sm
  where sm.session_id = v_session.id;

  if v_session.completed_at is not null or v_session.state = 'completed' then
    return jsonb_build_object(
      'session_id', v_session.id,
      'already_completed', true,
      'inspection_id', v_session.completed_inspection_id,
      'status', p_final_status,
      'helper_participant_count', v_helper_participant_count,
      'total_participant_count', v_helper_participant_count + 1
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
  into v_invalid_session_member_count
  from public.apparatus_check_session_members sm
  left join public.members member_row
    on member_row.id = sm.member_id
  where sm.session_id = v_session.id
    and (
      sm.department_id is distinct from v_session.department_id
      or sm.member_id = v_session.member_id
      or member_row.id is null
      or member_row.department_id is distinct from v_session.department_id
      or coalesce(member_row.active, false) = false
    );

  if v_invalid_session_member_count > 0 then
    raise exception 'Session participants are invalid for this department or session owner.';
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
    'helper_participant_count', v_helper_participant_count,
    'total_participant_count', v_helper_participant_count + 1,
    'out_of_service_source', case when p_final_status = 'out_of_service' then 'deficiency' else null end
  );
end;
$$;

revoke all on function public.complete_apparatus_check(uuid, text, text, integer, numeric) from public;
revoke all on function public.complete_apparatus_check(uuid, text, text, integer, numeric) from anon;
grant execute on function public.complete_apparatus_check(uuid, text, text, integer, numeric) to authenticated;
