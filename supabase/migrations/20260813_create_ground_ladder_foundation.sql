create extension if not exists pgcrypto;

create table if not exists public.ground_ladders (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  ladder_number text not null,
  ladder_type text not null,
  ladder_length_ft integer not null check (ladder_length_ft > 0),
  manufacturer text,
  model text,
  serial_number text,
  status text not null default 'Unassigned' check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  in_service_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, ladder_number)
);

create index if not exists ground_ladders_department_idx
on public.ground_ladders (department_id);

create index if not exists ground_ladders_ladder_number_idx
on public.ground_ladders (ladder_number);

create index if not exists ground_ladders_status_idx
on public.ground_ladders (status);

create index if not exists ground_ladders_ladder_type_idx
on public.ground_ladders (ladder_type);

create index if not exists ground_ladders_ladder_length_ft_idx
on public.ground_ladders (ladder_length_ft);

create unique index if not exists ground_ladders_department_serial_number_unique_idx
on public.ground_ladders (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create or replace function public.set_ground_ladders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ground_ladders_updated_at on public.ground_ladders;
create trigger trg_ground_ladders_updated_at
before update on public.ground_ladders
for each row
execute function public.set_ground_ladders_updated_at();

alter table public.ground_ladders enable row level security;

drop policy if exists ground_ladders_select_by_department on public.ground_ladders;
create policy ground_ladders_select_by_department
on public.ground_ladders
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladders_insert_by_department on public.ground_ladders;
create policy ground_ladders_insert_by_department
on public.ground_ladders
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladders_update_by_department on public.ground_ladders;
create policy ground_ladders_update_by_department
on public.ground_ladders
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

drop policy if exists ground_ladders_delete_by_department on public.ground_ladders;
create policy ground_ladders_delete_by_department
on public.ground_ladders
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladders.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.ground_ladder_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  ground_ladder_id uuid not null references public.ground_ladders (id) on delete cascade,
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

create index if not exists ground_ladder_assignments_department_idx
on public.ground_ladder_assignments (department_id);

create index if not exists ground_ladder_assignments_ground_ladder_id_idx
on public.ground_ladder_assignments (ground_ladder_id);

create index if not exists ground_ladder_assignments_assignment_type_idx
on public.ground_ladder_assignments (assignment_type);

create index if not exists ground_ladder_assignments_apparatus_id_idx
on public.ground_ladder_assignments (apparatus_id)
where apparatus_id is not null;

create index if not exists ground_ladder_assignments_open_lookup_idx
on public.ground_ladder_assignments (ground_ladder_id, ended_at)
where ended_at is null;

create unique index if not exists ground_ladder_assignments_one_open_per_ladder_idx
on public.ground_ladder_assignments (ground_ladder_id)
where ended_at is null;

alter table public.ground_ladder_assignments enable row level security;

drop policy if exists ground_ladder_assignments_select_by_department on public.ground_ladder_assignments;
create policy ground_ladder_assignments_select_by_department
on public.ground_ladder_assignments
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_assignments_insert_by_department on public.ground_ladder_assignments;
create policy ground_ladder_assignments_insert_by_department
on public.ground_ladder_assignments
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_assignments_update_by_department on public.ground_ladder_assignments;
create policy ground_ladder_assignments_update_by_department
on public.ground_ladder_assignments
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

drop policy if exists ground_ladder_assignments_delete_by_department on public.ground_ladder_assignments;
create policy ground_ladder_assignments_delete_by_department
on public.ground_ladder_assignments
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_assignments.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.ground_ladder_service_tests (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  ground_ladder_id uuid not null references public.ground_ladders (id) on delete cascade,
  test_date date not null,
  tester_type text not null check (tester_type in ('Department Member', 'External Tester', 'Company')),
  member_id uuid references public.members (id) on delete set null,
  external_tester_name text,
  company_name text,
  result text not null check (result in ('Pass', 'Fail')),
  notes text,
  next_test_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tester_type = 'Department Member' and member_id is not null and external_tester_name is null and company_name is null)
    or (
      tester_type = 'External Tester'
      and member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
      and company_name is null
    )
    or (
      tester_type = 'Company'
      and member_id is null
      and external_tester_name is null
      and company_name is not null
      and btrim(company_name) <> ''
    )
  )
);

create index if not exists ground_ladder_service_tests_department_idx
on public.ground_ladder_service_tests (department_id);

create index if not exists ground_ladder_service_tests_ground_ladder_id_idx
on public.ground_ladder_service_tests (ground_ladder_id);

create index if not exists ground_ladder_service_tests_test_date_idx
on public.ground_ladder_service_tests (test_date);

create index if not exists ground_ladder_service_tests_next_test_due_date_idx
on public.ground_ladder_service_tests (next_test_due_date);

create index if not exists ground_ladder_service_tests_member_id_idx
on public.ground_ladder_service_tests (member_id)
where member_id is not null;

create or replace function public.set_ground_ladder_service_tests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ground_ladder_service_tests_updated_at on public.ground_ladder_service_tests;
create trigger trg_ground_ladder_service_tests_updated_at
before update on public.ground_ladder_service_tests
for each row
execute function public.set_ground_ladder_service_tests_updated_at();

alter table public.ground_ladder_service_tests enable row level security;

drop policy if exists ground_ladder_service_tests_select_by_department on public.ground_ladder_service_tests;
create policy ground_ladder_service_tests_select_by_department
on public.ground_ladder_service_tests
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_service_tests_insert_by_department on public.ground_ladder_service_tests;
create policy ground_ladder_service_tests_insert_by_department
on public.ground_ladder_service_tests
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_service_tests_update_by_department on public.ground_ladder_service_tests;
create policy ground_ladder_service_tests_update_by_department
on public.ground_ladder_service_tests
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

drop policy if exists ground_ladder_service_tests_delete_by_department on public.ground_ladder_service_tests;
create policy ground_ladder_service_tests_delete_by_department
on public.ground_ladder_service_tests
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_service_tests.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.ground_ladder_maintenance_settings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  maintenance_interval_months integer not null default 12 check (maintenance_interval_months > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id)
);

create index if not exists ground_ladder_maintenance_settings_department_idx
on public.ground_ladder_maintenance_settings (department_id);

create or replace function public.set_ground_ladder_maintenance_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ground_ladder_maintenance_settings_updated_at on public.ground_ladder_maintenance_settings;
create trigger trg_ground_ladder_maintenance_settings_updated_at
before update on public.ground_ladder_maintenance_settings
for each row
execute function public.set_ground_ladder_maintenance_settings_updated_at();

alter table public.ground_ladder_maintenance_settings enable row level security;

drop policy if exists ground_ladder_maintenance_settings_select_by_department on public.ground_ladder_maintenance_settings;
create policy ground_ladder_maintenance_settings_select_by_department
on public.ground_ladder_maintenance_settings
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_maintenance_settings_insert_by_department on public.ground_ladder_maintenance_settings;
create policy ground_ladder_maintenance_settings_insert_by_department
on public.ground_ladder_maintenance_settings
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_maintenance_settings_update_by_department on public.ground_ladder_maintenance_settings;
create policy ground_ladder_maintenance_settings_update_by_department
on public.ground_ladder_maintenance_settings
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

drop policy if exists ground_ladder_maintenance_settings_delete_by_department on public.ground_ladder_maintenance_settings;
create policy ground_ladder_maintenance_settings_delete_by_department
on public.ground_ladder_maintenance_settings
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_maintenance_settings.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.ground_ladder_maintenance (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  ground_ladder_id uuid not null references public.ground_ladders (id) on delete cascade,
  maintenance_date date not null,
  performed_by_member_id uuid references public.members (id) on delete set null,
  performed_by_name text,
  result text not null check (result in ('Pass', 'Fail', 'Needs Attention')),
  notes text,
  next_maintenance_due date,
  maintenance_interval_months integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (performed_by_member_id is not null and performed_by_name is null)
    or (performed_by_member_id is null and performed_by_name is not null and btrim(performed_by_name) <> '')
    or (performed_by_member_id is null and performed_by_name is null)
  )
);

create index if not exists ground_ladder_maintenance_department_idx
on public.ground_ladder_maintenance (department_id);

create index if not exists ground_ladder_maintenance_ground_ladder_id_idx
on public.ground_ladder_maintenance (ground_ladder_id);

create index if not exists ground_ladder_maintenance_maintenance_date_idx
on public.ground_ladder_maintenance (maintenance_date);

create index if not exists ground_ladder_maintenance_next_maintenance_due_idx
on public.ground_ladder_maintenance (next_maintenance_due);

create index if not exists ground_ladder_maintenance_member_id_idx
on public.ground_ladder_maintenance (performed_by_member_id)
where performed_by_member_id is not null;

create or replace function public.set_ground_ladder_maintenance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ground_ladder_maintenance_updated_at on public.ground_ladder_maintenance;
create trigger trg_ground_ladder_maintenance_updated_at
before update on public.ground_ladder_maintenance
for each row
execute function public.set_ground_ladder_maintenance_updated_at();

alter table public.ground_ladder_maintenance enable row level security;

drop policy if exists ground_ladder_maintenance_select_by_department on public.ground_ladder_maintenance;
create policy ground_ladder_maintenance_select_by_department
on public.ground_ladder_maintenance
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_maintenance_insert_by_department on public.ground_ladder_maintenance;
create policy ground_ladder_maintenance_insert_by_department
on public.ground_ladder_maintenance
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_maintenance_update_by_department on public.ground_ladder_maintenance;
create policy ground_ladder_maintenance_update_by_department
on public.ground_ladder_maintenance
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

drop policy if exists ground_ladder_maintenance_delete_by_department on public.ground_ladder_maintenance;
create policy ground_ladder_maintenance_delete_by_department
on public.ground_ladder_maintenance
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_maintenance.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.ground_ladder_maintenance_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  maintenance_id uuid not null references public.ground_ladder_maintenance (id) on delete cascade,
  check_order integer not null check (check_order > 0),
  check_name text not null,
  result text not null check (result in ('Pass', 'Fail', 'N/A')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maintenance_id, check_order)
);

create index if not exists ground_ladder_maintenance_items_department_idx
on public.ground_ladder_maintenance_items (department_id);

create index if not exists ground_ladder_maintenance_items_maintenance_id_idx
on public.ground_ladder_maintenance_items (maintenance_id);

create index if not exists ground_ladder_maintenance_items_check_name_idx
on public.ground_ladder_maintenance_items (check_name);

create index if not exists ground_ladder_maintenance_items_result_idx
on public.ground_ladder_maintenance_items (result);

create or replace function public.set_ground_ladder_maintenance_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ground_ladder_maintenance_items_updated_at on public.ground_ladder_maintenance_items;
create trigger trg_ground_ladder_maintenance_items_updated_at
before update on public.ground_ladder_maintenance_items
for each row
execute function public.set_ground_ladder_maintenance_items_updated_at();

alter table public.ground_ladder_maintenance_items enable row level security;

drop policy if exists ground_ladder_maintenance_items_select_by_department on public.ground_ladder_maintenance_items;
create policy ground_ladder_maintenance_items_select_by_department
on public.ground_ladder_maintenance_items
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_maintenance_items_insert_by_department on public.ground_ladder_maintenance_items;
create policy ground_ladder_maintenance_items_insert_by_department
on public.ground_ladder_maintenance_items
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists ground_ladder_maintenance_items_update_by_department on public.ground_ladder_maintenance_items;
create policy ground_ladder_maintenance_items_update_by_department
on public.ground_ladder_maintenance_items
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

drop policy if exists ground_ladder_maintenance_items_delete_by_department on public.ground_ladder_maintenance_items;
create policy ground_ladder_maintenance_items_delete_by_department
on public.ground_ladder_maintenance_items
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_maintenance_items.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table if exists public.deficiencies
add column if not exists ground_ladder_id uuid references public.ground_ladders (id) on delete set null;

create index if not exists deficiencies_ground_ladder_id_idx
on public.deficiencies (ground_ladder_id);
