create or replace function public.add_homework_completed_together_members(
  p_source_assignment_member_id uuid,
  p_selected_member_ids uuid[]
)
returns table(member_id uuid, result text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_requester_name text;
  v_assignment_id uuid;
  v_assignment_status text;
  v_source_completion_status text;
  v_effective_due_at timestamptz;
  v_target_ids uuid[];
  v_target_count int;
  v_valid_target_count int;
begin
  select m.id,
         m.department_id,
         coalesce(nullif(trim(concat_ws(' ', m.first_name, m.last_name)), ''), m.email)
  into v_requester_id, v_requester_department_id, v_requester_name
  from public.members m
  where
    (auth.uid() is not null and m.auth_user_id = auth.uid())
    or (auth.uid() is null and lower(m.email) = lower(coalesce(auth.email(), '')))
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
         a.status,
      am.completion_status,
         coalesce(am.due_at, a.due_at)
    into v_assignment_id, v_assignment_status, v_source_completion_status, v_effective_due_at
  from public.training_assignment_members am
  join public.training_assignments a
    on a.id = am.training_assignment_id
   and a.department_id = am.department_id
  where am.id = p_source_assignment_member_id
    and am.member_id = v_requester_id
    and am.department_id = v_requester_department_id
  limit 1;

  if v_assignment_id is null then
    raise exception 'Forbidden: requester is not associated with the source assignment member row.';
  end if;

  if v_assignment_status = 'archived' then
    raise exception 'Forbidden: source assignment is archived.';
  end if;

  if v_source_completion_status <> 'pending_review' then
    raise exception 'Forbidden: submit your own homework for review before adding members who completed it with you.';
  end if;

  v_target_ids := array(
    select distinct x.member_id
    from unnest(coalesce(p_selected_member_ids, '{}'::uuid[])) as x(member_id)
    where x.member_id is not null
      and x.member_id <> v_requester_id
  );

  v_target_count := coalesce(array_length(v_target_ids, 1), 0);

  if v_target_count = 0 then
    raise exception 'Validation error: select at least one other department member.';
  end if;

  if v_target_count > 25 then
    raise exception 'Validation error: cannot add more than 25 members at once.';
  end if;

  select count(*)
  into v_valid_target_count
  from public.members m
  where m.id = any(v_target_ids)
    and m.department_id = v_requester_department_id
    and coalesce(m.active, true) = true;

  if v_valid_target_count <> v_target_count then
    raise exception 'Validation error: one or more selected members are invalid, inactive, or outside department.';
  end if;

  return query
  with target as (
    select unnest(v_target_ids) as member_id
  ),
  preexisting as (
    select t.member_id
    from target t
    join public.training_assignment_members am
      on am.department_id = v_requester_department_id
     and am.training_assignment_id = v_assignment_id
     and am.member_id = t.member_id
  ),
  upserted as (
    insert into public.training_assignment_members (
      department_id,
      training_assignment_id,
      member_id,
      due_at,
      completion_status,
      completed_at,
      hours_earned,
      completion_notes,
      reviewed_by,
      reviewed_at,
      review_notes,
      created_by,
      updated_by
    )
    select
      v_requester_department_id,
      v_assignment_id,
      t.member_id,
      v_effective_due_at,
      'pending_review',
      now(),
      null,
      coalesce('Completed together with ' || coalesce(v_requester_name, 'crew member') || '.', 'Completed together with crew.'),
      null,
      null,
      null,
      v_requester_id,
      v_requester_id
    from target t
    on conflict (department_id, training_assignment_id, member_id)
    do update
      set completion_status = 'pending_review',
          completed_at = now(),
          hours_earned = null,
          completion_notes = coalesce(
            public.training_assignment_members.completion_notes,
            coalesce('Completed together with ' || coalesce(v_requester_name, 'crew member') || '.', 'Completed together with crew.')
          ),
          reviewed_by = null,
          reviewed_at = null,
          review_notes = null,
          updated_by = v_requester_id
    where public.training_assignment_members.completion_status <> 'approved'
    returning training_assignment_members.member_id
  )
  select
    u.member_id,
    case when p.member_id is null then 'added' else 'updated_to_pending_review' end as result
  from upserted u
  left join preexisting p on p.member_id = u.member_id;
end;
$$;

revoke all on function public.add_homework_completed_together_members(uuid, uuid[]) from public;
grant execute on function public.add_homework_completed_together_members(uuid, uuid[]) to authenticated;
