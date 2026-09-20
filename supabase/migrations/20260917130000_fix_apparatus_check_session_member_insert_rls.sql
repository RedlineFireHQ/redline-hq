create or replace function public.can_insert_apparatus_check_session_member(
  p_session_id uuid,
  p_department_id uuid,
  p_member_id uuid,
  p_added_by_member_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.apparatus_check_sessions s
    join public.members requester
      on requester.id = s.member_id
     and requester.department_id = s.department_id
     and coalesce(requester.active, false) = true
    join public.members helper_member
      on helper_member.id = p_member_id
     and helper_member.department_id = s.department_id
     and coalesce(helper_member.active, false) = true
    where s.id = p_session_id
      and s.state = 'in_progress'
      and s.completed_at is null
      and s.abandoned_at is null
      and s.expired_at is null
      and p_department_id = s.department_id
      and p_member_id <> s.member_id
      and p_added_by_member_id = requester.id
      and (
        (auth.uid() is not null and requester.auth_user_id = auth.uid())
        or lower(coalesce(requester.email, '')) = lower(coalesce(auth.email(), ''))
      )
  );
$$;

revoke all on function public.can_insert_apparatus_check_session_member(uuid, uuid, uuid, uuid) from public;
revoke all on function public.can_insert_apparatus_check_session_member(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.can_insert_apparatus_check_session_member(uuid, uuid, uuid, uuid) to authenticated;

drop policy if exists apparatus_check_session_members_insert_owner_only on public.apparatus_check_session_members;
create policy apparatus_check_session_members_insert_owner_only
on public.apparatus_check_session_members
for insert
to authenticated
with check (
  public.can_insert_apparatus_check_session_member(
    session_id,
    department_id,
    member_id,
    added_by_member_id
  )
);
