-- ============================================================================
-- Pediatric Bags — PASS / EXPIRED item-status model.
--
-- Red Oak marks each pediatric bag checklist item as either PASS (present and
-- acceptable) or EXPIRED (expired, documented). No expiration dates are
-- captured. This widens the item-status CHECK constraints to accept 'expired'
-- while keeping the existing values so any in-progress (test) rows remain valid.
--
-- Additive only: no tables dropped, no data deleted or rewritten.
-- ============================================================================

-- Live per-item progress status: allow 'expired'.
alter table public.pediatric_bag_checklist_progress
  drop constraint if exists pediatric_bag_checklist_progress_status_check;

alter table public.pediatric_bag_checklist_progress
  add constraint pediatric_bag_checklist_progress_status_check
  check (status in ('checked', 'expired', 'deficiency', 'not_applicable', 'needs_review'));

-- Immutable per-item snapshot status: allow 'expired'.
alter table public.pediatric_bag_checklist_results
  drop constraint if exists pediatric_bag_checklist_results_result_status_check;

alter table public.pediatric_bag_checklist_results
  add constraint pediatric_bag_checklist_results_result_status_check
  check (result_status in ('checked', 'expired', 'deficiency', 'not_applicable', 'needs_review'));

-- ---------------------------------------------------------------------------
-- Update the completion RPC to the PASS/EXPIRED gate. 'expired' counts as an
-- addressed item for completion, but any EXPIRED item blocks a fully 'ready'
-- outcome (the inspection completes as 'needs_attention' / "Items Expired").
-- The function signature, auth, department/ownership validation, and snapshot
-- behavior are unchanged; EXECUTE remains granted to authenticated only.
-- ---------------------------------------------------------------------------

create or replace function public.complete_pediatric_bag_check(
  p_session_id uuid,
  p_final_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_session public.pediatric_bag_checklist_sessions%rowtype;
  v_bag_id uuid;
  v_department_id uuid;
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_requester_email text;
  v_required_count integer := 0;
  v_completed_required_count integer := 0;
  v_unresolved_quantity_count integer := 0;
  v_expired_count integer := 0;
  v_inspection_id uuid;
begin
  if p_session_id is null then
    raise exception 'Session id is required.';
  end if;

  if p_final_status not in ('ready', 'needs_attention', 'out_of_service') then
    raise exception 'Invalid final inspection status.';
  end if;

  select s.*
  into v_session
  from public.pediatric_bag_checklist_sessions s
  where s.id = p_session_id
  limit 1
  for update;

  if not found then
    raise exception 'Pediatric bag check session not found.';
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
    raise exception 'Unable to resolve requesting member for this pediatric bag department.';
  end if;

  if v_requester_department_id is distinct from v_session.department_id then
    raise exception 'Requesting member does not belong to the pediatric bag check department.';
  end if;

  if v_session.member_id is distinct from v_requester_id then
    raise exception 'This pediatric bag check session belongs to a different member.';
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
    raise exception 'This pediatric bag check session is no longer active.';
  end if;

  select b.id, b.department_id
  into v_bag_id, v_department_id
  from public.pediatric_bags b
  where b.id = v_session.pediatric_bag_id
    and b.is_active = true
  limit 1;

  if v_bag_id is null then
    raise exception 'Pediatric bag not found for this session.';
  end if;

  if v_department_id is distinct from v_session.department_id then
    raise exception 'Session department does not match pediatric bag department.';
  end if;

  -- PASS / EXPIRED gating. An item marked 'checked' (PASS) or 'expired'
  -- (EXPIRED, documented) counts as addressed. An unconfirmed-quantity item, or
  -- any EXPIRED item, means the bag is not fully 'ready' — it completes as
  -- 'needs_attention' ("Items Expired").
  select count(*)
  into v_required_count
  from public.pediatric_bag_checklist_items i
  where i.department_id = v_department_id
    and i.is_active = true
    and i.is_required = true
    and i.required_quantity is not null;

  if v_required_count = 0 then
    raise exception 'No active required checklist items with confirmed quantities are configured for this pediatric bag department.';
  end if;

  select count(*)
  into v_completed_required_count
  from public.pediatric_bag_checklist_progress p
  join public.pediatric_bag_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
  where p.department_id = v_department_id
    and p.pediatric_bag_id = v_bag_id
    and p.member_id = v_requester_id
    and i.is_active = true
    and i.is_required = true
    and i.required_quantity is not null
    and p.status in ('checked', 'expired');

  if v_completed_required_count < v_required_count then
    raise exception 'Complete all required checklist items before submitting this pediatric bag check.';
  end if;

  -- Unresolved unknown-quantity items in the active template (e.g. "***" Alcohol
  -- Preps). While any exist, the bag cannot be declared fully Ready for Service.
  select count(*)
  into v_unresolved_quantity_count
  from public.pediatric_bag_checklist_items i
  where i.department_id = v_department_id
    and i.is_active = true
    and i.is_required = true
    and i.required_quantity is null;

  if p_final_status = 'ready' and v_unresolved_quantity_count > 0 then
    raise exception 'Cannot complete as Ready for Service: % required item(s) have an unconfirmed quantity pending review (e.g. Alcohol Preps "***"). Complete as Items Expired until Red Oak confirms the quantity.', v_unresolved_quantity_count;
  end if;

  -- Items explicitly marked EXPIRED also block 'ready'.
  select count(*)
  into v_expired_count
  from public.pediatric_bag_checklist_progress p
  join public.pediatric_bag_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
  where p.department_id = v_department_id
    and p.pediatric_bag_id = v_bag_id
    and p.member_id = v_requester_id
    and i.is_active = true
    and p.status = 'expired';

  if p_final_status = 'ready' and v_expired_count > 0 then
    raise exception 'Cannot complete as Ready for Service: % checklist item(s) are marked as expired. Document them and complete as Items Expired instead.', v_expired_count;
  end if;

  insert into public.pediatric_bag_inspections (
    pediatric_bag_id,
    department_id,
    member_id,
    status,
    notes
  )
  values (
    v_bag_id,
    v_department_id,
    v_requester_id,
    p_final_status,
    p_notes
  )
  returning id into v_inspection_id;

  insert into public.pediatric_bag_checklist_results (
    inspection_id,
    department_id,
    pediatric_bag_id,
    checklist_item_id,
    section_name_snapshot,
    item_label_snapshot,
    required_quantity_snapshot,
    source_quantity_text_snapshot,
    is_required_snapshot,
    result_status,
    item_order
  )
  select
    v_inspection_id,
    i.department_id,
    v_bag_id,
    i.id,
    i.section_name,
    i.item_label,
    i.required_quantity,
    i.source_quantity_text,
    i.is_required,
    p.status,
    i.display_order
  from public.pediatric_bag_checklist_progress p
  join public.pediatric_bag_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
  where p.department_id = v_department_id
    and p.pediatric_bag_id = v_bag_id
    and p.member_id = v_requester_id
    and i.is_active = true;

  update public.pediatric_bag_checklist_sessions
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
    'status', p_final_status
  );
end;
$$;

revoke all on function public.complete_pediatric_bag_check(uuid, text, text) from public;
revoke all on function public.complete_pediatric_bag_check(uuid, text, text) from anon;
grant execute on function public.complete_pediatric_bag_check(uuid, text, text) to authenticated;
