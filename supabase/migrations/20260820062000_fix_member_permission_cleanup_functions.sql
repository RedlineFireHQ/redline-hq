create or replace function public.create_department_member(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_rank text,
  p_active boolean,
  p_special_permissions_enabled boolean,
  p_permission_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_member_id uuid;
  v_department_id uuid;
  v_new_member_id uuid;
  v_rank text;
  v_permission_keys text[];
  v_valid_permission_count integer;
begin
  select ctx.member_id, ctx.department_id
  into v_requester_member_id, v_department_id
  from public.resolve_requesting_member_access_context() ctx
  limit 1;

  if v_requester_member_id is null or v_department_id is null then
    raise exception 'Unauthorized: requester membership not found.';
  end if;

  if not public.can_manage_personnel(v_department_id) then
    raise exception 'Forbidden: personnel management permission is required.';
  end if;

  if btrim(coalesce(p_first_name, '')) = '' then
    raise exception 'Validation error: first name is required.';
  end if;

  if btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'Validation error: last name is required.';
  end if;

  v_rank := btrim(coalesce(p_rank, ''));
  if v_rank = '' then
    raise exception 'Validation error: rank is required.';
  end if;

  insert into public.members (
    department_id,
    first_name,
    last_name,
    email,
    phone,
    rank,
    role,
    active,
    special_permissions_enabled
  )
  values (
    v_department_id,
    btrim(p_first_name),
    btrim(p_last_name),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    v_rank,
    'Firefighter',
    coalesce(p_active, true),
    coalesce(p_special_permissions_enabled, false)
  )
  returning id into v_new_member_id;

  if coalesce(p_special_permissions_enabled, false) then
    v_permission_keys := array(
      select distinct btrim(value)
      from unnest(coalesce(p_permission_keys, '{}'::text[])) as value
      where btrim(value) <> ''
    );

    if coalesce(array_length(v_permission_keys, 1), 0) > 0 then
      select count(*)
      into v_valid_permission_count
      from public.app_permissions ap
      where ap.key = any(v_permission_keys)
        and ap.active = true;

      if v_valid_permission_count <> array_length(v_permission_keys, 1) then
        raise exception 'Validation error: one or more permission keys are invalid.';
      end if;

      insert into public.member_app_permissions (
        department_id,
        member_id,
        permission_key,
        created_by
      )
      select
        v_department_id,
        v_new_member_id,
        key_value,
        v_requester_member_id
      from unnest(v_permission_keys) as key_value
      on conflict (department_id, member_id, permission_key) do nothing;
    end if;
  end if;

  return v_new_member_id;
end;
$$;

revoke execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) from public;
revoke execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) from anon;
grant execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) to authenticated;

create or replace function public.update_department_member(
  p_member_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_rank text,
  p_active boolean,
  p_special_permissions_enabled boolean,
  p_permission_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_member_id uuid;
  v_department_id uuid;
  v_target_exists boolean;
  v_rank text;
  v_permission_keys text[];
  v_valid_permission_count integer;
begin
  select ctx.member_id, ctx.department_id
  into v_requester_member_id, v_department_id
  from public.resolve_requesting_member_access_context() ctx
  limit 1;

  if v_requester_member_id is null or v_department_id is null then
    raise exception 'Unauthorized: requester membership not found.';
  end if;

  if not public.can_manage_personnel(v_department_id) then
    raise exception 'Forbidden: personnel management permission is required.';
  end if;

  select exists (
    select 1
    from public.members m
    where m.id = p_member_id
      and m.department_id = v_department_id
  )
  into v_target_exists;

  if not v_target_exists then
    raise exception 'Forbidden: target member is outside your department.';
  end if;

  if btrim(coalesce(p_first_name, '')) = '' then
    raise exception 'Validation error: first name is required.';
  end if;

  if btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'Validation error: last name is required.';
  end if;

  v_rank := btrim(coalesce(p_rank, ''));
  if v_rank = '' then
    raise exception 'Validation error: rank is required.';
  end if;

  update public.members
  set
    first_name = btrim(p_first_name),
    last_name = btrim(p_last_name),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    rank = v_rank,
    active = coalesce(p_active, true),
    special_permissions_enabled = coalesce(p_special_permissions_enabled, false)
  where id = p_member_id
    and department_id = v_department_id;

  if coalesce(p_special_permissions_enabled, false) then
    v_permission_keys := array(
      select distinct btrim(value)
      from unnest(coalesce(p_permission_keys, '{}'::text[])) as value
      where btrim(value) <> ''
    );

    if coalesce(array_length(v_permission_keys, 1), 0) > 0 then
      select count(*)
      into v_valid_permission_count
      from public.app_permissions ap
      where ap.key = any(v_permission_keys)
        and ap.active = true;

      if v_valid_permission_count <> array_length(v_permission_keys, 1) then
        raise exception 'Validation error: one or more permission keys are invalid.';
      end if;
    end if;

    delete from public.member_app_permissions map
    where map.department_id = v_department_id
      and map.member_id = p_member_id
      and (
        coalesce(array_length(v_permission_keys, 1), 0) = 0
        or map.permission_key <> all(v_permission_keys)
      );

    if coalesce(array_length(v_permission_keys, 1), 0) > 0 then
      insert into public.member_app_permissions (
        department_id,
        member_id,
        permission_key,
        created_by
      )
      select
        v_department_id,
        p_member_id,
        key_value,
        v_requester_member_id
      from unnest(v_permission_keys) as key_value
      on conflict (department_id, member_id, permission_key) do nothing;
    end if;
  else
    delete from public.member_app_permissions map
    where map.department_id = v_department_id
      and map.member_id = p_member_id;
  end if;

  return p_member_id;
end;
$$;

revoke execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from public;
revoke execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from anon;
grant execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) to authenticated;
