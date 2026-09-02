alter table public.auth_user_department_memberships
  add column if not exists can_manage_personnel boolean not null default false;

create index if not exists auth_user_department_memberships_manage_idx
  on public.auth_user_department_memberships (department_id, auth_user_id, can_manage_personnel);

create or replace function public.recompute_auth_user_department_membership_for_member(
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member record;
  v_has_delegated_personnel_permission boolean := false;
  v_can_manage_personnel boolean := false;
begin
  select
    m.id,
    m.auth_user_id,
    m.department_id,
    lower(coalesce(m.role, '')) as role_normalized,
    coalesce(m.active, false) as is_active,
    coalesce(m.special_permissions_enabled, false) as special_permissions_enabled
  into v_member
  from public.members m
  where m.id = p_member_id
  limit 1;

  if v_member.id is null then
    delete from public.auth_user_department_memberships audm
    where audm.member_id = p_member_id;
    return;
  end if;

  delete from public.auth_user_department_memberships audm
  where audm.member_id = v_member.id;

  if v_member.auth_user_id is null or not v_member.is_active then
    return;
  end if;

  if v_member.special_permissions_enabled then
    select exists (
      select 1
      from public.member_app_permissions map
      where map.member_id = v_member.id
        and map.department_id = v_member.department_id
        and map.permission_key = 'personnel_management'
    )
    into v_has_delegated_personnel_permission;
  end if;

  v_can_manage_personnel :=
    (v_member.role_normalized = 'administrator')
    or (v_member.special_permissions_enabled and v_has_delegated_personnel_permission);

  insert into public.auth_user_department_memberships (
    auth_user_id,
    department_id,
    member_id,
    can_manage_personnel
  )
  values (
    v_member.auth_user_id,
    v_member.department_id,
    v_member.id,
    v_can_manage_personnel
  )
  on conflict (auth_user_id, department_id) do update
  set
    member_id = excluded.member_id,
    can_manage_personnel = excluded.can_manage_personnel,
    updated_at = now();
end;
$$;

create or replace function public.sync_auth_user_department_memberships_from_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.auth_user_department_memberships audm
    where audm.member_id = old.id;
    return old;
  end if;

  perform public.recompute_auth_user_department_membership_for_member(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sync_auth_user_department_memberships_from_members on public.members;

create trigger trg_sync_auth_user_department_memberships_from_members
after insert or update of auth_user_id, department_id, active, role, special_permissions_enabled or delete
on public.members
for each row
execute function public.sync_auth_user_department_memberships_from_members();

create or replace function public.sync_auth_user_department_memberships_from_member_app_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.permission_key = 'personnel_management' then
      perform public.recompute_auth_user_department_membership_for_member(old.member_id);
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.permission_key = 'personnel_management' then
      perform public.recompute_auth_user_department_membership_for_member(new.member_id);
    end if;
    return new;
  end if;

  if old.permission_key = 'personnel_management' then
    perform public.recompute_auth_user_department_membership_for_member(old.member_id);
  end if;

  if new.permission_key = 'personnel_management' then
    perform public.recompute_auth_user_department_membership_for_member(new.member_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_auth_user_department_memberships_from_member_app_permissions
on public.member_app_permissions;

create trigger trg_sync_auth_user_department_memberships_from_member_app_permissions
after insert or update of member_id, department_id, permission_key or delete
on public.member_app_permissions
for each row
execute function public.sync_auth_user_department_memberships_from_member_app_permissions();

with recompute_target as (
  select m.id
  from public.members m
)
select public.recompute_auth_user_department_membership_for_member(id)
from recompute_target;

drop policy if exists members_update_by_department_admin on public.members;

create policy members_update_by_department_admin
on public.members
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = public.members.department_id
      and audm.can_manage_personnel = true
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = public.members.department_id
      and audm.can_manage_personnel = true
  )
);
