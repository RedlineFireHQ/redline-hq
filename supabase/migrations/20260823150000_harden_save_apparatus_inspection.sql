create or replace function public.save_apparatus_inspection(
  p_apparatus_id uuid,
  p_status text,
  p_notes text default null,
  p_mileage integer default null,
  p_engine_hours numeric default null
)
returns void
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
  v_require_checklist boolean := false;
  v_required_count integer := 0;
  v_completed_required_count integer := 0;
  v_inspection_id uuid;
  v_updated_count integer := 0;
begin
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
      and i.apparatus_id = p_apparatus_id
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
      and p.apparatus_id = p_apparatus_id
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
    p_apparatus_id,
    v_department_id,
    v_requester_id,
    p_status,
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
    and p.apparatus_id = p_apparatus_id
    and p.member_id = v_requester_id
    and i.is_active = true;

  update public.apparatus
  set
    status = p_status,
    last_inspection_at = now(),
    notes = p_notes,
    mileage = coalesce(p_mileage, mileage),
    engine_hours = coalesce(p_engine_hours, engine_hours)
  where id = p_apparatus_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception 'Inspection save failed: expected to update 1 apparatus row, updated %.', v_updated_count;
  end if;
end;
$$;