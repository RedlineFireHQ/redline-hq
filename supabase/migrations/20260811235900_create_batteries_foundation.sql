create table if not exists public.batteries (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  battery_number text not null,
  serial_number text,
  manufacturer text,
  model text,
  battery_type text,
  compatible_equipment text,
  in_service_date date,
  status text not null default 'Unassigned' check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, battery_number)
);

create index if not exists batteries_department_idx
on public.batteries (department_id);

create index if not exists batteries_battery_number_idx
on public.batteries (battery_number);

create index if not exists batteries_serial_number_idx
on public.batteries (serial_number);

create index if not exists batteries_status_idx
on public.batteries (status);

create index if not exists batteries_battery_type_idx
on public.batteries (battery_type);

create unique index if not exists batteries_department_serial_number_unique_idx
on public.batteries (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create or replace function public.set_batteries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_batteries_updated_at on public.batteries;
create trigger trg_batteries_updated_at
before update on public.batteries
for each row
execute function public.set_batteries_updated_at();

alter table public.batteries enable row level security;

drop policy if exists batteries_select_by_department on public.batteries;
create policy batteries_select_by_department
on public.batteries
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists batteries_insert_by_department on public.batteries;
create policy batteries_insert_by_department
on public.batteries
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists batteries_update_by_department on public.batteries;
create policy batteries_update_by_department
on public.batteries
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists batteries_delete_by_department on public.batteries;
create policy batteries_delete_by_department
on public.batteries
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = batteries.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.battery_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  battery_id uuid not null references public.batteries (id) on delete cascade,
  assignment_type text not null check (assignment_type in ('Apparatus', 'Station', 'Equipment', 'Unassigned')),
  apparatus_id uuid references public.apparatus (id) on delete set null,
  station_name text,
  equipment_reference text,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (assignment_type = 'Apparatus' and apparatus_id is not null and station_name is null and equipment_reference is null)
    or (
      assignment_type = 'Station'
      and apparatus_id is null
      and station_name is not null
      and btrim(station_name) <> ''
      and equipment_reference is null
    )
    or (
      assignment_type = 'Equipment'
      and apparatus_id is null
      and station_name is null
      and equipment_reference is not null
      and btrim(equipment_reference) <> ''
    )
    or (assignment_type = 'Unassigned' and apparatus_id is null and station_name is null and equipment_reference is null)
  ),
  check (ended_at is null or ended_at >= assigned_at)
);

create index if not exists battery_assignments_department_idx
on public.battery_assignments (department_id);

create index if not exists battery_assignments_battery_id_idx
on public.battery_assignments (battery_id);

create index if not exists battery_assignments_assignment_type_idx
on public.battery_assignments (assignment_type);

create index if not exists battery_assignments_apparatus_id_idx
on public.battery_assignments (apparatus_id)
where apparatus_id is not null;

create index if not exists battery_assignments_open_lookup_idx
on public.battery_assignments (battery_id, ended_at)
where ended_at is null;

create unique index if not exists battery_assignments_one_open_per_battery_idx
on public.battery_assignments (battery_id)
where ended_at is null;

alter table public.battery_assignments enable row level security;

drop policy if exists battery_assignments_select_by_department on public.battery_assignments;
create policy battery_assignments_select_by_department
on public.battery_assignments
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists battery_assignments_insert_by_department on public.battery_assignments;
create policy battery_assignments_insert_by_department
on public.battery_assignments
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists battery_assignments_update_by_department on public.battery_assignments;
create policy battery_assignments_update_by_department
on public.battery_assignments
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists battery_assignments_delete_by_department on public.battery_assignments;
create policy battery_assignments_delete_by_department
on public.battery_assignments
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = battery_assignments.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table if exists public.deficiencies
add column if not exists battery_id uuid references public.batteries (id) on delete set null;

create index if not exists deficiencies_battery_id_idx
on public.deficiencies (battery_id);