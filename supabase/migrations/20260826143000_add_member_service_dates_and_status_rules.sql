alter table public.members
  add column if not exists hire_start_date date,
  add column if not exists inactive_date date;

alter table public.members
  drop constraint if exists members_inactive_date_after_hire_start_date_check;

alter table public.members
  add constraint members_inactive_date_after_hire_start_date_check
  check (
    inactive_date is null
    or hire_start_date is null
    or inactive_date >= hire_start_date
  );

alter table public.members
  drop constraint if exists members_inactive_date_when_active_check;

alter table public.members
  add constraint members_inactive_date_when_active_check
  check (
    coalesce(active, true) = false
    or inactive_date is null
  );

create index if not exists members_department_active_idx
  on public.members (department_id, active);

create index if not exists members_department_hire_start_date_idx
  on public.members (department_id, hire_start_date)
  where hire_start_date is not null;

create index if not exists members_department_inactive_date_idx
  on public.members (department_id, inactive_date)
  where inactive_date is not null;

create or replace function public.create_department_member(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_rank text,
  p_active boolean,
  p_special_permissions_enabled boolean,
  p_permission_keys text[],
  p_hire_start_date date,
  p_inactive_date date
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
  v_active boolean;
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

  v_active := coalesce(p_active, true);

  if p_hire_start_date is not null and p_inactive_date is not null and p_inactive_date < p_hire_start_date then
    raise exception 'Validation error: inactive date cannot be before hire/start date.';
  end if;

  if v_active and p_inactive_date is not null then
    raise exception 'Validation error: inactive date must be blank for active members.';
  end if;

  if not v_active and p_inactive_date is null then
    raise exception 'Validation error: inactive members require an exit/inactive date.';
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
    hire_start_date,
    inactive_date,
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
    v_active,
    p_hire_start_date,
    case when v_active then null else p_inactive_date end,
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

grant execute on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[], date, date) to authenticated;

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
begin
  return public.create_department_member(
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_rank,
    p_active,
    p_special_permissions_enabled,
    p_permission_keys,
    null,
    null
  );
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
  p_permission_keys text[],
  p_hire_start_date date,
  p_inactive_date date
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
  v_active boolean;
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

  v_active := coalesce(p_active, true);

  if p_hire_start_date is not null and p_inactive_date is not null and p_inactive_date < p_hire_start_date then
    raise exception 'Validation error: inactive date cannot be before hire/start date.';
  end if;

  if v_active and p_inactive_date is not null then
    raise exception 'Validation error: inactive date must be blank for active members.';
  end if;

  if not v_active and p_inactive_date is null then
    raise exception 'Validation error: inactive members require an exit/inactive date.';
  end if;

  update public.members
  set
    first_name = btrim(p_first_name),
    last_name = btrim(p_last_name),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    rank = v_rank,
    active = v_active,
    hire_start_date = p_hire_start_date,
    inactive_date = case when v_active then null else p_inactive_date end,
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

grant execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[], date, date) to authenticated;

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
  v_current_hire_start_date date;
  v_current_inactive_date date;
begin
  select m.hire_start_date, m.inactive_date
  into v_current_hire_start_date, v_current_inactive_date
  from public.members m
  where m.id = p_member_id;

  return public.update_department_member(
    p_member_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_rank,
    p_active,
    p_special_permissions_enabled,
    p_permission_keys,
    v_current_hire_start_date,
    case when coalesce(p_active, true) then null else v_current_inactive_date end
  );
end;
$$;

revoke execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from public;
revoke execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from anon;
grant execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) to authenticated;
