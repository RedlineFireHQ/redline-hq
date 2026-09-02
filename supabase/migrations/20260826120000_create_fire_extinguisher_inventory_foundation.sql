create table if not exists public.fire_extinguishers (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  extinguisher_number text not null,
  extinguisher_type text not null,
  location_type text not null default 'Station Storage',
  apparatus_id uuid,
  other_location text,
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Out of Service')),
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(extinguisher_number) <> ''),
  check (btrim(extinguisher_type) <> ''),
  check (photo_path is null or btrim(photo_path) <> '')
);

create index if not exists fire_extinguishers_department_idx
on public.fire_extinguishers (department_id);

create index if not exists fire_extinguishers_department_status_idx
on public.fire_extinguishers (department_id, status);

create index if not exists fire_extinguishers_department_location_type_idx
on public.fire_extinguishers (department_id, location_type);

create index if not exists fire_extinguishers_department_number_idx
on public.fire_extinguishers (department_id, extinguisher_number);

create unique index if not exists fire_extinguishers_department_number_unique_idx
on public.fire_extinguishers (department_id, extinguisher_number);

create index if not exists fire_extinguishers_department_apparatus_idx
on public.fire_extinguishers (department_id, apparatus_id)
where apparatus_id is not null;

create or replace function public.set_fire_extinguishers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fire_extinguishers_updated_at on public.fire_extinguishers;
create trigger trg_fire_extinguishers_updated_at
before update on public.fire_extinguishers
for each row
execute function public.set_fire_extinguishers_updated_at();

alter table public.fire_extinguishers enable row level security;

drop policy if exists fire_extinguishers_select_by_department on public.fire_extinguishers;
create policy fire_extinguishers_select_by_department
on public.fire_extinguishers
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_extinguishers_write_by_department_admin on public.fire_extinguishers;
create policy fire_extinguishers_write_by_department_admin
on public.fire_extinguishers
for all
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

alter table public.deficiencies
add column if not exists fire_extinguisher_id uuid references public.fire_extinguishers (id) on delete set null;

create index if not exists deficiencies_fire_extinguisher_id_idx
on public.deficiencies (fire_extinguisher_id);

alter table public.fire_extinguishers
  add constraint fire_extinguishers_apparatus_fk
  foreign key (apparatus_id)
  references public.apparatus (id)
  on delete set null;
