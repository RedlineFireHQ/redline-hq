alter table public.members
  add column if not exists special_permissions_enabled boolean not null default false;

alter table public.members
  alter column rank set default 'Firefighter';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_rank_check'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_rank_check
      check (
        rank is null or rank in (
          'Firefighter',
          'Driver Operator',
          'Lieutenant',
          'Captain',
          'Battalion Chief',
          'Assistant Chief',
          'Chief'
        )
      );
  end if;
end $$;

create table if not exists public.app_permissions (
  key text primary key,
  label text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_permissions_key_format_check check (key ~ '^[a-z_]+$'),
  constraint app_permissions_label_not_blank check (btrim(label) <> '')
);

create or replace function public.set_app_permissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_app_permissions_updated_at on public.app_permissions;
create trigger trg_app_permissions_updated_at
before update on public.app_permissions
for each row
execute function public.set_app_permissions_updated_at();

insert into public.app_permissions (key, label, description, sort_order)
values
  ('personnel_management', 'Personnel Management', 'Manage department members and member permissions.', 10),
  ('training_management', 'Training Management', 'Create and manage department training events.', 20),
  ('homework_assignment', 'Homework Assignment', 'Assign homework training to department members.', 30),
  ('training_review', 'Training Review', 'Review and approve/reject submitted training completions.', 40),
  ('apparatus_management', 'Apparatus Management', 'Manage apparatus records and apparatus-level settings.', 50),
  ('maintenance_management', 'Maintenance Management', 'Manage maintenance records and workflows.', 60),
  ('deficiency_management', 'Deficiency Management', 'Manage deficiency workflows and resolution.', 70),
  ('certification_management', 'Certification Management', 'Manage certification records and configuration.', 80),
  ('inventory_management', 'Inventory Management', 'Manage inventory categories and inventory records.', 90),
  ('reports_management', 'Reports Management', 'Access and manage operational reporting features.', 100),
  ('documents_management', 'Documents Management', 'Manage department document library content.', 110),
  ('settings_management', 'Settings Management', 'Manage department settings and configuration.', 120)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order;

create table if not exists public.member_app_permissions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  permission_key text not null references public.app_permissions (key) on delete restrict,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (department_id, member_id, permission_key)
);

create index if not exists member_app_permissions_department_idx
  on public.member_app_permissions (department_id);

create index if not exists member_app_permissions_member_idx
  on public.member_app_permissions (member_id);

create index if not exists member_app_permissions_permission_key_idx
  on public.member_app_permissions (permission_key);

create or replace function public.resolve_requesting_member_access_context()
returns table (
  member_id uuid,
  department_id uuid,
  role text,
  special_permissions_enabled boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    m.id as member_id,
    m.department_id,
    lower(coalesce(m.role, '')) as role,
    coalesce(m.special_permissions_enabled, false) as special_permissions_enabled
  from public.members m
  where
    (auth.uid() is not null and m.auth_user_id = auth.uid())
    or (auth.uid() is null and lower(m.email) = lower(coalesce(auth.email(), '')))
  order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

revoke all on function public.resolve_requesting_member_access_context() from public;
grant execute on function public.resolve_requesting_member_access_context() to authenticated;

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
  select ctx.member_id, ctx.role, ctx.special_permissions_enabled
  into v_member_id, v_role, v_special_enabled
  from public.resolve_requesting_member_access_context() ctx
  where ctx.department_id = p_department_id
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

create or replace function public.can_manage_personnel(
  p_department_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.member_has_app_permission(p_department_id, 'personnel_management');
$$;

revoke all on function public.can_manage_personnel(uuid) from public;
grant execute on function public.can_manage_personnel(uuid) to authenticated;

alter table public.app_permissions enable row level security;
alter table public.member_app_permissions enable row level security;

drop policy if exists app_permissions_select_authenticated on public.app_permissions;
create policy app_permissions_select_authenticated
on public.app_permissions
for select
to authenticated
using (true);

drop policy if exists member_app_permissions_select_by_department on public.member_app_permissions;
create policy member_app_permissions_select_by_department
on public.member_app_permissions
for select
to authenticated
using (
  department_id in (
    select ctx.department_id
    from public.resolve_requesting_member_access_context() ctx
  )
);

drop policy if exists member_app_permissions_insert_by_personnel_manager on public.member_app_permissions;
create policy member_app_permissions_insert_by_personnel_manager
on public.member_app_permissions
for insert
to authenticated
with check (
  public.can_manage_personnel(department_id)
);

drop policy if exists member_app_permissions_update_by_personnel_manager on public.member_app_permissions;
create policy member_app_permissions_update_by_personnel_manager
on public.member_app_permissions
for update
to authenticated
using (
  public.can_manage_personnel(department_id)
)
with check (
  public.can_manage_personnel(department_id)
);

drop policy if exists member_app_permissions_delete_by_personnel_manager on public.member_app_permissions;
create policy member_app_permissions_delete_by_personnel_manager
on public.member_app_permissions
for delete
to authenticated
using (
  public.can_manage_personnel(department_id)
);

drop policy if exists members_insert_by_personnel_manager on public.members;
create policy members_insert_by_personnel_manager
on public.members
for insert
to authenticated
with check (
  public.can_manage_personnel(department_id)
  and lower(coalesce(role, '')) = 'firefighter'
);

create or replace function public.update_department_member_role(
  p_member_id uuid,
  p_department_role_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_target_exists boolean;
  v_role_exists boolean;
begin
  select ctx.department_id
  into v_department_id
  from public.resolve_requesting_member_access_context() ctx
  limit 1;

  if v_department_id is null then
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

  if p_department_role_id is not null then
    select exists (
      select 1
      from public.department_roles dr
      where dr.id = p_department_role_id
        and dr.department_id = v_department_id
    )
    into v_role_exists;

    if not v_role_exists then
      raise exception 'Validation error: department role is invalid for your department.';
    end if;
  end if;

  update public.members
  set department_role_id = p_department_role_id
  where id = p_member_id
    and department_id = v_department_id;

  return p_member_id;
end;
$$;

revoke all on function public.update_department_member_role(uuid, uuid) from public;
grant execute on function public.update_department_member_role(uuid, uuid) to authenticated;

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

revoke all on function public.create_department_member(text, text, text, text, text, boolean, boolean, text[]) from public;
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

revoke all on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) from public;
grant execute on function public.update_department_member(uuid, text, text, text, text, text, boolean, boolean, text[]) to authenticated;
