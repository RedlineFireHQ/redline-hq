create table if not exists public.pie_equipment (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  equipment_number text not null,
  serial_number text,
  manufacturer text,
  model text,
  equipment_type text,
  power_source text,
  in_service_date date,
  status text not null default 'Unassigned' check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, equipment_number)
);

alter table public.pie_equipment add column if not exists equipment_type text;
alter table public.pie_equipment add column if not exists power_source text;
alter table public.pie_equipment add column if not exists location text;
alter table public.pie_equipment add column if not exists in_service_date date;
alter table public.pie_equipment add column if not exists serial_number text;
alter table public.pie_equipment add column if not exists manufacturer text;
alter table public.pie_equipment add column if not exists model text;
alter table public.pie_equipment add column if not exists notes text;

create index if not exists pie_equipment_department_idx
on public.pie_equipment (department_id);

create index if not exists pie_equipment_equipment_number_idx
on public.pie_equipment (equipment_number);

create index if not exists pie_equipment_serial_number_idx
on public.pie_equipment (serial_number);

create index if not exists pie_equipment_status_idx
on public.pie_equipment (status);

create index if not exists pie_equipment_type_idx
on public.pie_equipment (equipment_type);

create unique index if not exists pie_equipment_department_serial_number_unique_idx
on public.pie_equipment (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create or replace function public.set_pie_equipment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pie_equipment_updated_at on public.pie_equipment;
create trigger trg_pie_equipment_updated_at
before update on public.pie_equipment
for each row
execute function public.set_pie_equipment_updated_at();

alter table public.pie_equipment enable row level security;

drop policy if exists pie_equipment_select_by_department on public.pie_equipment;
create policy pie_equipment_select_by_department
on public.pie_equipment
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists pie_equipment_insert_by_department on public.pie_equipment;
create policy pie_equipment_insert_by_department
on public.pie_equipment
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists pie_equipment_update_by_department on public.pie_equipment;
create policy pie_equipment_update_by_department
on public.pie_equipment
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

drop policy if exists pie_equipment_delete_by_department on public.pie_equipment;
create policy pie_equipment_delete_by_department
on public.pie_equipment
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = pie_equipment.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.pie_equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pie_equipment_id uuid not null references public.pie_equipment (id) on delete cascade,
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

alter table public.pie_equipment_assignments add column if not exists pie_equipment_id uuid references public.pie_equipment (id) on delete cascade;
alter table public.pie_equipment_assignments add column if not exists assignment_type text;
alter table public.pie_equipment_assignments add column if not exists apparatus_id uuid references public.apparatus (id) on delete set null;
alter table public.pie_equipment_assignments add column if not exists station_name text;
alter table public.pie_equipment_assignments add column if not exists equipment_reference text;
alter table public.pie_equipment_assignments add column if not exists assigned_at timestamptz default now();
alter table public.pie_equipment_assignments add column if not exists ended_at timestamptz;
alter table public.pie_equipment_assignments add column if not exists assigned_by uuid references public.members (id) on delete set null;
alter table public.pie_equipment_assignments add column if not exists notes text;

create index if not exists pie_equipment_assignments_department_idx
on public.pie_equipment_assignments (department_id);

create index if not exists pie_equipment_assignments_piece_id_idx
on public.pie_equipment_assignments (pie_equipment_id);

create index if not exists pie_equipment_assignments_assignment_type_idx
on public.pie_equipment_assignments (assignment_type);

create index if not exists pie_equipment_assignments_apparatus_id_idx
on public.pie_equipment_assignments (apparatus_id)
where apparatus_id is not null;

create index if not exists pie_equipment_assignments_open_lookup_idx
on public.pie_equipment_assignments (pie_equipment_id, ended_at)
where ended_at is null;

create unique index if not exists pie_equipment_assignments_one_open_per_piece_idx
on public.pie_equipment_assignments (pie_equipment_id)
where ended_at is null;

alter table public.pie_equipment_assignments enable row level security;

drop policy if exists pie_equipment_assignments_select_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_select_by_department
on public.pie_equipment_assignments
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists pie_equipment_assignments_insert_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_insert_by_department
on public.pie_equipment_assignments
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists pie_equipment_assignments_update_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_update_by_department
on public.pie_equipment_assignments
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

drop policy if exists pie_equipment_assignments_delete_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_delete_by_department
on public.pie_equipment_assignments
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = pie_equipment_assignments.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table if exists public.deficiencies
add column if not exists pie_equipment_id uuid references public.pie_equipment (id) on delete set null;

create index if not exists deficiencies_pie_equipment_id_idx
on public.deficiencies (pie_equipment_id);
