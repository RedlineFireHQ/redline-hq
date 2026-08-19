create extension if not exists pgcrypto;

create table if not exists public.apparatus_check_department_defaults (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  interval_days integer not null check (interval_days > 0),
  is_active boolean not null default true,
  effective_start_at timestamptz not null default now(),
  effective_end_at timestamptz,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_check_department_defaults_effective_window_check
    check (effective_end_at is null or effective_end_at > effective_start_at)
);

create index if not exists apparatus_check_department_defaults_department_idx
on public.apparatus_check_department_defaults (department_id);

create index if not exists apparatus_check_department_defaults_effective_start_idx
on public.apparatus_check_department_defaults (effective_start_at desc);

create unique index if not exists apparatus_check_department_defaults_one_active_idx
on public.apparatus_check_department_defaults (department_id)
where is_active is true and effective_end_at is null;

create or replace function public.set_apparatus_check_department_defaults_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apparatus_check_department_defaults_updated_at on public.apparatus_check_department_defaults;
create trigger trg_apparatus_check_department_defaults_updated_at
before update on public.apparatus_check_department_defaults
for each row
execute function public.set_apparatus_check_department_defaults_updated_at();

alter table public.apparatus_check_department_defaults enable row level security;

drop policy if exists apparatus_check_department_defaults_select_by_department on public.apparatus_check_department_defaults;
create policy apparatus_check_department_defaults_select_by_department
on public.apparatus_check_department_defaults
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_check_department_defaults_write_by_admin on public.apparatus_check_department_defaults;
create policy apparatus_check_department_defaults_write_by_admin
on public.apparatus_check_department_defaults
for all
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table public.apparatus_check_requirements
  add column if not exists effective_start_at timestamptz not null default now(),
  add column if not exists effective_end_at timestamptz;

alter table public.apparatus_check_requirements
  drop constraint if exists apparatus_check_requirements_apparatus_id_key;

alter table public.apparatus_check_requirements
  add constraint apparatus_check_requirements_effective_window_check
  check (effective_end_at is null or effective_end_at > effective_start_at);

create unique index if not exists apparatus_check_requirements_one_active_idx
on public.apparatus_check_requirements (apparatus_id)
where is_active is true and effective_end_at is null;

alter table public.apparatus_maintenance_requirements
  add column if not exists effective_start_at timestamptz not null default now(),
  add column if not exists effective_end_at timestamptz;

alter table public.apparatus_maintenance_requirements
  add constraint apparatus_maintenance_requirements_effective_window_check
  check (effective_end_at is null or effective_end_at > effective_start_at);

alter table public.apparatus_equipment_requirements
  add column if not exists effective_start_at timestamptz not null default now(),
  add column if not exists effective_end_at timestamptz;

alter table public.apparatus_equipment_requirements
  add constraint apparatus_equipment_requirements_effective_window_check
  check (effective_end_at is null or effective_end_at > effective_start_at);
