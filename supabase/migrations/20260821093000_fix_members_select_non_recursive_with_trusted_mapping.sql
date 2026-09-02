create table if not exists public.auth_user_department_memberships (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, department_id)
);

create index if not exists auth_user_department_memberships_department_idx
  on public.auth_user_department_memberships (department_id);

create or replace function public.set_auth_user_department_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_auth_user_department_memberships_updated_at
  on public.auth_user_department_memberships;

create trigger trg_auth_user_department_memberships_updated_at
before update on public.auth_user_department_memberships
for each row
execute function public.set_auth_user_department_memberships_updated_at();

insert into public.auth_user_department_memberships (auth_user_id, department_id, member_id)
select distinct
  m.auth_user_id,
  m.department_id,
  m.id
from public.members m
where m.auth_user_id is not null
  and coalesce(m.active, false) = true
on conflict (auth_user_id, department_id) do update
set member_id = excluded.member_id,
    updated_at = now();

create or replace function public.sync_auth_user_department_memberships_from_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.auth_user_id is not null then
      delete from public.auth_user_department_memberships audm
      where audm.auth_user_id = old.auth_user_id
        and audm.department_id = old.department_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.auth_user_id is not null and (
      old.auth_user_id is distinct from new.auth_user_id
      or old.department_id is distinct from new.department_id
      or coalesce(new.active, false) = false
    ) then
      delete from public.auth_user_department_memberships audm
      where audm.auth_user_id = old.auth_user_id
        and audm.department_id = old.department_id;
    end if;
  end if;

  if new.auth_user_id is not null and coalesce(new.active, false) = true then
    insert into public.auth_user_department_memberships (auth_user_id, department_id, member_id)
    values (new.auth_user_id, new.department_id, new.id)
    on conflict (auth_user_id, department_id) do update
    set member_id = excluded.member_id,
        updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_auth_user_department_memberships_from_members on public.members;

create trigger trg_sync_auth_user_department_memberships_from_members
after insert or update of auth_user_id, department_id, active or delete
on public.members
for each row
execute function public.sync_auth_user_department_memberships_from_members();

alter table public.auth_user_department_memberships enable row level security;

revoke all on table public.auth_user_department_memberships from public;
revoke all on table public.auth_user_department_memberships from anon;

grant select on table public.auth_user_department_memberships to authenticated;

drop policy if exists auth_user_department_memberships_select_own
  on public.auth_user_department_memberships;

create policy auth_user_department_memberships_select_own
on public.auth_user_department_memberships
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists members_select_authenticated_active_department on public.members;

create policy members_select_authenticated_active_department
on public.members
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = public.members.department_id
  )
);
