-- ============================================================================
-- Pediatric Bags — administrator deletion of a single inspection record.
--
-- Adds public.delete_pediatric_bag_inspection(p_inspection_id uuid):
--   * SECURITY DEFINER, fixed search_path (matches existing pediatric RPCs).
--   * Resolves the requesting member WITHIN THE INSPECTION'S OWN DEPARTMENT
--     (auth.uid() first, email fallback), so a caller can never delete another
--     department's inspection.
--   * Requires the requester to be an active Administrator member of that
--     department. Officer/firefighter/member-less callers are rejected.
--   * Deletes ONLY the inspection row and its inspection-specific snapshot
--     rows (pediatric_bag_checklist_results). Bags, checklist template items,
--     sessions, session participants, members, departments, and all other
--     inspections are never touched. The completed-session link uses
--     `on delete set null`, so the producing session survives intact.
--   * Runs as a single function call (one transaction): the snapshot rows are
--     removed first, then the inspection.
-- ============================================================================

create or replace function public.delete_pediatric_bag_inspection(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_inspection public.pediatric_bag_inspections%rowtype;
  v_requester_id uuid;
  v_requester_email text;
  v_is_administrator boolean := false;
  v_results_deleted integer := 0;
begin
  if p_inspection_id is null then
    raise exception 'Inspection id is required.';
  end if;

  select i.*
  into v_inspection
  from public.pediatric_bag_inspections i
  where i.id = p_inspection_id
  limit 1;

  if not found then
    raise exception 'Pediatric bag inspection not found.';
  end if;

  if v_inspection.department_id is null then
    raise exception 'Inspection department is required.';
  end if;

  -- Resolve the requesting member, scoped to the inspection's own department.
  if auth.uid() is not null then
    select m.id
    into v_requester_id
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = v_inspection.department_id
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
      select m.id
      into v_requester_id
      from public.members m
      where lower(coalesce(m.email, '')) = v_requester_email
        and m.department_id = v_inspection.department_id
        and coalesce(m.active, false) = true
      order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
      limit 1;
    end if;
  end if;

  if v_requester_id is null then
    raise exception 'Unable to resolve requesting member for this inspection department.';
  end if;

  -- Administrator-only: deletion is an explicit administrative action.
  select lower(coalesce(m.role, '')) = 'administrator'
  into v_is_administrator
  from public.members m
  where m.id = v_requester_id;

  if not coalesce(v_is_administrator, false) then
    raise exception 'Only a department administrator can delete a pediatric bag inspection.';
  end if;

  -- Delete the inspection-specific snapshot rows first, then the inspection.
  delete from public.pediatric_bag_checklist_results r
  where r.inspection_id = v_inspection.id
    and r.department_id = v_inspection.department_id;

  get diagnostics v_results_deleted = row_count;

  delete from public.pediatric_bag_inspections i
  where i.id = v_inspection.id
    and i.department_id = v_inspection.department_id;

  return jsonb_build_object(
    'inspection_id', v_inspection.id,
    'deleted', true,
    'results_deleted', v_results_deleted
  );
end;
$$;

revoke all on function public.delete_pediatric_bag_inspection(uuid) from public;
revoke all on function public.delete_pediatric_bag_inspection(uuid) from anon;
grant execute on function public.delete_pediatric_bag_inspection(uuid) to authenticated;
