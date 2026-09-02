create or replace function public.complete_assigned_training_member(
  p_assignment_member_id uuid,
  p_completion_notes text default null
)
returns table (
  id uuid,
  training_assignment_id uuid,
  member_id uuid,
  due_at timestamptz,
  completion_status text,
  completed_at timestamptz,
  hours_earned numeric(6,2),
  completion_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_target_assignment_id uuid;
  v_target_member_id uuid;
  v_target_department_id uuid;
  v_target_assignment_status text;
  v_assignment_hours numeric(6,2);
  v_sanitized_notes text;
begin
  if p_assignment_member_id is null then
    raise exception 'Validation error: assignment member id is required.';
  end if;

  select m.id,
         m.department_id
  into v_requester_id, v_requester_department_id
  from public.members m
  where (
      auth.uid() is not null
      and m.auth_user_id = auth.uid()
    )
    or (
      auth.uid() is null
      and lower(m.email) = lower(coalesce(auth.email(), ''))
    )
  order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  if v_requester_id is null or v_requester_department_id is null then
    raise exception 'Unauthorized: requester membership not found.';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = v_requester_id
      and m.department_id = v_requester_department_id
      and coalesce(m.active, true) = true
  ) then
    raise exception 'Unauthorized: requester is not an active department member.';
  end if;

  select am.training_assignment_id,
         am.member_id,
         am.department_id,
         a.status,
         a.hours_credit
  into v_target_assignment_id,
       v_target_member_id,
       v_target_department_id,
       v_target_assignment_status,
       v_assignment_hours
  from public.training_assignment_members am
  join public.training_assignments a
    on a.id = am.training_assignment_id
   and a.department_id = am.department_id
  where am.id = p_assignment_member_id
    and am.member_id = v_requester_id
    and am.department_id = v_requester_department_id
  limit 1;

  if v_target_assignment_id is null then
    raise exception 'Forbidden: requester is not associated with the target assignment member row.';
  end if;

  if v_target_assignment_status <> 'active' then
    raise exception 'Forbidden: assignment is not active.';
  end if;

  v_sanitized_notes := nullif(btrim(coalesce(p_completion_notes, '')), '');

  update public.training_assignment_members am
  set completion_status = 'approved',
      completed_at = now(),
      hours_earned = coalesce(v_assignment_hours, 0),
      completion_notes = v_sanitized_notes,
      reviewed_by = null,
      reviewed_at = null,
      review_notes = null,
      updated_by = v_requester_id
  where am.id = p_assignment_member_id
    and am.member_id = v_target_member_id
    and am.department_id = v_target_department_id;

  if not found then
    raise exception 'Unable to complete assigned training.';
  end if;

  return query
  select
    am.id,
    am.training_assignment_id,
    am.member_id,
    am.due_at,
    am.completion_status,
    am.completed_at,
    am.hours_earned,
    am.completion_notes,
    am.reviewed_by,
    am.reviewed_at,
    am.review_notes,
    am.created_at,
    am.updated_at
  from public.training_assignment_members am
  where am.id = p_assignment_member_id
  limit 1;
end;
$$;

revoke all on function public.complete_assigned_training_member(uuid, text) from public;
revoke all on function public.complete_assigned_training_member(uuid, text) from anon;
grant execute on function public.complete_assigned_training_member(uuid, text) to authenticated;
