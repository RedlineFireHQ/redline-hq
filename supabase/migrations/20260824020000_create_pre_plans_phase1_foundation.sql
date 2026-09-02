create table if not exists public.pre_plans (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  business_name text not null check (btrim(business_name) <> ''),
  address text not null check (btrim(address) <> ''),
  city text not null check (btrim(city) <> ''),
  state text not null check (btrim(state) <> ''),
  zip text not null check (btrim(zip) <> ''),
  business_phone text,
  occupancy_id_number text,
  property_owner_name text,
  property_owner_phone text,
  primary_contact_name text,
  primary_contact_phone text,
  secondary_contact_name text,
  secondary_contact_phone text,
  additional_comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null
);

create index if not exists pre_plans_department_idx
on public.pre_plans (department_id);

create index if not exists pre_plans_department_updated_at_idx
on public.pre_plans (department_id, updated_at desc);

create index if not exists pre_plans_business_name_search_idx
on public.pre_plans (department_id, lower(btrim(business_name)));

create index if not exists pre_plans_address_search_idx
on public.pre_plans (department_id, lower(btrim(address)));

create index if not exists pre_plans_city_search_idx
on public.pre_plans (department_id, lower(btrim(city)));

create index if not exists pre_plans_occupancy_id_search_idx
on public.pre_plans (department_id, lower(btrim(coalesce(occupancy_id_number, ''))));

create or replace function public.set_pre_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pre_plans_updated_at on public.pre_plans;
create trigger trg_pre_plans_updated_at
before update on public.pre_plans
for each row
execute function public.set_pre_plans_updated_at();

alter table public.pre_plans enable row level security;

drop policy if exists pre_plans_select_by_department_member on public.pre_plans;
create policy pre_plans_select_by_department_member
on public.pre_plans
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plans.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pre_plans_insert_by_department_member on public.pre_plans;
create policy pre_plans_insert_by_department_member
on public.pre_plans
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plans.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plans.created_by = m.id
      and pre_plans.updated_by = m.id
  )
);

drop policy if exists pre_plans_update_by_department_member on public.pre_plans;
create policy pre_plans_update_by_department_member
on public.pre_plans
for update
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plans.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plans.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plans.updated_by = m.id
  )
);

revoke all on table public.pre_plans from public;
revoke all on table public.pre_plans from anon;
grant select, insert, update on table public.pre_plans to authenticated;
