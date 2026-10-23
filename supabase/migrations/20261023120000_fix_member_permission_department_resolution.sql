-- Fix multi-department permission resolution.
--
-- Root cause: member_has_app_permission resolved the caller's membership via
-- resolve_requesting_member_access_context(), which returns a single membership
-- (ORDER BY ... LIMIT 1) with no department filter. A user belonging to more
-- than one department could have the "wrong" membership returned, causing the
-- per-department permission check to find no row for the requested department
-- and incorrectly return false (e.g. hiding the training review queue).
--
-- Fix: resolve the caller's member row for the SPECIFIC requested department.
-- All existing checks are preserved and unchanged: active membership required,
-- administrator short-circuit, special_permissions_enabled gate, and the
-- explicit member_app_permissions grant check. No broad access is granted.
create or replace function public.member_has_app_permission(
  p_department_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_role text;
  v_special_enabled boolean;
begin
  -- Resolve the caller's active membership for the requested department only.
  select
    m.id,
    lower(coalesce(m.role, '')),
    coalesce(m.special_permissions_enabled, false)
  into v_member_id, v_role, v_special_enabled
  from public.members m
  where m.department_id = p_department_id
    and coalesce(m.active, false) = true
    and (
      (auth.uid() is not null and m.auth_user_id = auth.uid())
      or (auth.uid() is null and lower(m.email) = lower(coalesce(auth.email(), '')))
    )
  order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
  limit 1;

  if v_member_id is null then
    return false;
  end if;

  if v_role = 'administrator' then
    return true;
  end if;

  if not v_special_enabled then
    return false;
  end if;

  return exists (
    select 1
    from public.member_app_permissions map
    where map.department_id = p_department_id
      and map.member_id = v_member_id
      and map.permission_key = p_permission_key
  );
end;
$$;

revoke all on function public.member_has_app_permission(uuid, text) from public;
grant execute on function public.member_has_app_permission(uuid, text) to authenticated;
