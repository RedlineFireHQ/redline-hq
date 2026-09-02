create or replace function public.resolve_authenticated_member_context(
  p_department_id uuid default null
)
returns table (
  status text,
  member_id uuid,
  department_id uuid,
  role text,
  special_permissions_enabled boolean,
  active_membership_count integer
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid;
  v_count integer := 0;
  v_row record;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    return query
      select
        'unauthenticated'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::boolean,
        0::integer;
    return;
  end if;

  select count(*)::integer
  into v_count
  from public.members m
  where m.auth_user_id = v_auth_user_id
    and coalesce(m.active, false) = true;

  if p_department_id is not null then
    select
      m.id as member_id,
      m.department_id,
      lower(coalesce(m.role, '')) as role,
      coalesce(m.special_permissions_enabled, false) as special_permissions_enabled
    into v_row
    from public.members m
    where m.auth_user_id = v_auth_user_id
      and m.department_id = p_department_id
      and coalesce(m.active, false) = true;

    if v_row.member_id is null then
      return query
        select
          'membership_not_found_for_department'::text,
          null::uuid,
          null::uuid,
          null::text,
          null::boolean,
          v_count;
      return;
    end if;

    return query
      select
        'ok'::text,
        v_row.member_id,
        v_row.department_id,
        v_row.role,
        v_row.special_permissions_enabled,
        v_count;
    return;
  end if;

  if v_count = 0 then
    return query
      select
        'no_active_membership'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::boolean,
        0::integer;
    return;
  end if;

  if v_count > 1 then
    return query
      select
        'department_selection_required'::text,
        null::uuid,
        null::uuid,
        null::text,
        null::boolean,
        v_count;
    return;
  end if;

  select
    m.id as member_id,
    m.department_id,
    lower(coalesce(m.role, '')) as role,
    coalesce(m.special_permissions_enabled, false) as special_permissions_enabled
  into v_row
  from public.members m
  where m.auth_user_id = v_auth_user_id
    and coalesce(m.active, false) = true;

  return query
    select
      'ok'::text,
      v_row.member_id,
      v_row.department_id,
      v_row.role,
      v_row.special_permissions_enabled,
      1::integer;
end;
$$;

revoke all on function public.resolve_authenticated_member_context(uuid) from public;
revoke all on function public.resolve_authenticated_member_context(uuid) from anon;
grant execute on function public.resolve_authenticated_member_context(uuid) to authenticated;
