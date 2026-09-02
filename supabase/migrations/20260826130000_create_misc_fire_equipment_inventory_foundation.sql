create table if not exists public.misc_fire_equipment (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  equipment_name text not null,
  asset_number text,
  location_type text not null default 'Station Storage' check (location_type in ('Apparatus', 'Station Storage', 'Other')),
  apparatus_id uuid references public.apparatus (id) on delete set null,
  other_location text,
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Out of Service')),
  date_placed_in_service date,
  manufacturer text,
  model text,
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(equipment_name) <> ''),
  check (asset_number is null or btrim(asset_number) <> ''),
  check (other_location is null or btrim(other_location) <> ''),
  check (photo_path is null or btrim(photo_path) <> ''),
  check (
    (location_type = 'Apparatus' and apparatus_id is not null and other_location is null)
    or (location_type = 'Station Storage' and apparatus_id is null and other_location is null)
    or (location_type = 'Other' and apparatus_id is null and other_location is not null)
  )
);

create index if not exists misc_fire_equipment_department_idx
on public.misc_fire_equipment (department_id);

create index if not exists misc_fire_equipment_department_status_idx
on public.misc_fire_equipment (department_id, status);

create index if not exists misc_fire_equipment_department_name_idx
on public.misc_fire_equipment (department_id, equipment_name);

create index if not exists misc_fire_equipment_department_asset_idx
on public.misc_fire_equipment (department_id, asset_number)
where asset_number is not null;

create index if not exists misc_fire_equipment_department_apparatus_idx
on public.misc_fire_equipment (department_id, apparatus_id)
where apparatus_id is not null;

create or replace function public.set_misc_fire_equipment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_misc_fire_equipment_updated_at on public.misc_fire_equipment;
create trigger trg_misc_fire_equipment_updated_at
before update on public.misc_fire_equipment
for each row
execute function public.set_misc_fire_equipment_updated_at();

alter table public.misc_fire_equipment enable row level security;

drop policy if exists misc_fire_equipment_select_by_department on public.misc_fire_equipment;
create policy misc_fire_equipment_select_by_department
on public.misc_fire_equipment
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = misc_fire_equipment.department_id
  )
);

drop policy if exists misc_fire_equipment_insert_by_department on public.misc_fire_equipment;
create policy misc_fire_equipment_insert_by_department
on public.misc_fire_equipment
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = misc_fire_equipment.department_id
  )
);

drop policy if exists misc_fire_equipment_update_by_department on public.misc_fire_equipment;
create policy misc_fire_equipment_update_by_department
on public.misc_fire_equipment
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = misc_fire_equipment.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = misc_fire_equipment.department_id
  )
);

drop policy if exists misc_fire_equipment_delete_by_department on public.misc_fire_equipment;
create policy misc_fire_equipment_delete_by_department
on public.misc_fire_equipment
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = misc_fire_equipment.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table public.deficiencies
add column if not exists misc_fire_equipment_id uuid references public.misc_fire_equipment (id) on delete set null;

create index if not exists deficiencies_misc_fire_equipment_id_idx
on public.deficiencies (misc_fire_equipment_id);
