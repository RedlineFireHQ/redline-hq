create or replace function public.get_apparatus_check_member_options(
  p_session_id uuid
)
returns table (
  member_id uuid,
  first_name text,
  last_name text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_department_id uuid;
  v_owner_id uuid;
begin
  select s.department_id, s.member_id
  into v_department_id, v_owner_id
  from public.apparatus_check_sessions s
  where s.id = p_session_id
    and s.state = 'in_progress'
    and s.completed_at is null
    and s.abandoned_at is null
    and s.expired_at is null
  limit 1;

  if v_department_id is null or v_owner_id is null then
    raise exception 'Apparatus check session is not active.';
  end if;

  if not exists (
    select 1
    from public.members requester
    where requester.id = v_owner_id
      and requester.department_id = v_department_id
      and coalesce(requester.active, false) = true
      and (
        (auth.uid() is not null and requester.auth_user_id = auth.uid())
        or lower(coalesce(requester.email, '')) = lower(coalesce(auth.email(), ''))
      )
  ) then
    raise exception 'Only the active apparatus check owner can load member options.';
  end if;

  return query
  select m.id, m.first_name, m.last_name
  from public.members m
  where m.department_id = v_department_id
    and coalesce(m.active, false) = true
  order by m.last_name nulls last, m.first_name nulls last, m.id;
end;
$$;

revoke all on function public.get_apparatus_check_member_options(uuid) from public;
revoke all on function public.get_apparatus_check_member_options(uuid) from anon;
grant execute on function public.get_apparatus_check_member_options(uuid) to authenticated;
