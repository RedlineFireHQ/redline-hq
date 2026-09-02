create table if not exists public.ppe_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  item_name text not null,
  assigned_member_id uuid not null references public.members (id) on delete restrict,
  manufacturer text,
  model text,
  serial_number text,
  asset_number text,
  size text,
  date_manufactured date,
  placed_in_service_date date,
  expiration_date date,
  location text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(item_name) <> ''),
  check (photo_path is null or btrim(photo_path) <> '')
);

create index if not exists ppe_items_department_idx
on public.ppe_items (department_id);

create index if not exists ppe_items_assigned_member_idx
on public.ppe_items (assigned_member_id);

create index if not exists ppe_items_department_status_idx
on public.ppe_items (department_id, status);

create index if not exists ppe_items_department_item_name_idx
on public.ppe_items (department_id, item_name);

create unique index if not exists ppe_items_department_serial_unique_idx
on public.ppe_items (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create unique index if not exists ppe_items_department_asset_number_unique_idx
on public.ppe_items (department_id, asset_number)
where asset_number is not null and btrim(asset_number) <> '';

create or replace function public.set_ppe_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ppe_items_updated_at on public.ppe_items;
create trigger trg_ppe_items_updated_at
before update on public.ppe_items
for each row
execute function public.set_ppe_items_updated_at();

alter table public.ppe_items enable row level security;

drop policy if exists ppe_items_select_by_department on public.ppe_items;
create policy ppe_items_select_by_department
on public.ppe_items
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ppe_items.department_id
  )
);

drop policy if exists ppe_items_insert_by_department on public.ppe_items;
create policy ppe_items_insert_by_department
on public.ppe_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ppe_items.department_id
  )
);

drop policy if exists ppe_items_update_by_department on public.ppe_items;
create policy ppe_items_update_by_department
on public.ppe_items
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ppe_items.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ppe_items.department_id
  )
);

drop policy if exists ppe_items_delete_by_department on public.ppe_items;
create policy ppe_items_delete_by_department
on public.ppe_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ppe_items.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);
