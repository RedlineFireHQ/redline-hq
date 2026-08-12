create table if not exists public.scba_cylinders (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  cylinder_number text not null,
  cylinder_type text not null check (cylinder_type in ('Composite', 'Steel')),
  in_service_date date not null,
  last_hydrostatic_test_date date,
  next_hydrostatic_test_due_date date,
  service_life_end_date date,
  manufacturer text,
  model text,
  serial_number text,
  status text not null default 'Ready' check (status in ('Ready', 'Testing Due', 'Out of Service', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, cylinder_number)
);

create index if not exists scba_cylinders_department_idx
on public.scba_cylinders (department_id);

create index if not exists scba_cylinders_status_idx
on public.scba_cylinders (status);

create index if not exists scba_cylinders_next_hydrostatic_test_due_date_idx
on public.scba_cylinders (next_hydrostatic_test_due_date);

create index if not exists scba_cylinders_cylinder_type_idx
on public.scba_cylinders (cylinder_type);

create unique index if not exists scba_cylinders_department_serial_number_unique_idx
on public.scba_cylinders (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create or replace function public.set_scba_cylinders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_scba_cylinders_updated_at on public.scba_cylinders;
create trigger trg_scba_cylinders_updated_at
before update on public.scba_cylinders
for each row
execute function public.set_scba_cylinders_updated_at();

alter table public.scba_cylinders enable row level security;

drop policy if exists scba_cylinders_select_by_department on public.scba_cylinders;
create policy scba_cylinders_select_by_department
on public.scba_cylinders
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists scba_cylinders_insert_by_department on public.scba_cylinders;
create policy scba_cylinders_insert_by_department
on public.scba_cylinders
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists scba_cylinders_update_by_department on public.scba_cylinders;
create policy scba_cylinders_update_by_department
on public.scba_cylinders
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

drop policy if exists scba_cylinders_delete_by_department on public.scba_cylinders;
create policy scba_cylinders_delete_by_department
on public.scba_cylinders
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = scba_cylinders.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table if exists public.deficiencies
add column if not exists scba_cylinder_id uuid references public.scba_cylinders (id) on delete set null;

create index if not exists deficiencies_scba_cylinder_id_idx
on public.deficiencies (scba_cylinder_id);
