create table if not exists public.rope_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  rope_name text not null,
  rope_identifier text not null,
  rope_type text not null check (rope_type in ('Life Safety', 'Utility')),
  manufacturer text,
  model text,
  serial_number text,
  asset_number text,
  length_ft integer,
  diameter_in numeric(6,2),
  location text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(rope_name) <> ''),
  check (btrim(rope_identifier) <> ''),
  check (photo_path is null or btrim(photo_path) <> '')
);

create index if not exists rope_items_department_idx
on public.rope_items (department_id);

create index if not exists rope_items_department_type_idx
on public.rope_items (department_id, rope_type);

create index if not exists rope_items_department_status_idx
on public.rope_items (department_id, status);

create index if not exists rope_items_department_name_idx
on public.rope_items (department_id, rope_name);

create unique index if not exists rope_items_department_identifier_unique_idx
on public.rope_items (department_id, rope_identifier);

create unique index if not exists rope_items_department_serial_unique_idx
on public.rope_items (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create unique index if not exists rope_items_department_asset_number_unique_idx
on public.rope_items (department_id, asset_number)
where asset_number is not null and btrim(asset_number) <> '';

create or replace function public.set_rope_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_rope_items_updated_at on public.rope_items;
create trigger trg_rope_items_updated_at
before update on public.rope_items
for each row
execute function public.set_rope_items_updated_at();

create table if not exists public.rope_inspections (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  rope_item_id uuid not null references public.rope_items (id) on delete cascade,
  inspection_date date not null,
  primary_inspector_member_id uuid not null references public.members (id) on delete restrict,
  result text not null check (result in ('pass', 'fail', 'needs_attention')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists rope_inspections_department_idx
on public.rope_inspections (department_id);

create index if not exists rope_inspections_rope_item_idx
on public.rope_inspections (rope_item_id, inspection_date desc, created_at desc);

create index if not exists rope_inspections_primary_inspector_idx
on public.rope_inspections (primary_inspector_member_id);

create table if not exists public.rope_inspection_participants (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  rope_inspection_id uuid not null references public.rope_inspections (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  added_by_member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rope_inspection_id, member_id)
);

create index if not exists rope_inspection_participants_department_idx
on public.rope_inspection_participants (department_id);

create index if not exists rope_inspection_participants_inspection_idx
on public.rope_inspection_participants (rope_inspection_id, created_at);

alter table public.rope_items enable row level security;
alter table public.rope_inspections enable row level security;
alter table public.rope_inspection_participants enable row level security;

drop policy if exists rope_items_select_by_department on public.rope_items;
create policy rope_items_select_by_department
on public.rope_items
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists rope_items_write_by_department_admin on public.rope_items;
create policy rope_items_write_by_department_admin
on public.rope_items
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

drop policy if exists rope_inspections_select_by_department on public.rope_inspections;
create policy rope_inspections_select_by_department
on public.rope_inspections
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists rope_inspections_write_by_department on public.rope_inspections;
create policy rope_inspections_write_by_department
on public.rope_inspections
for all
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

drop policy if exists rope_inspection_participants_select_by_department on public.rope_inspection_participants;
create policy rope_inspection_participants_select_by_department
on public.rope_inspection_participants
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists rope_inspection_participants_write_by_department on public.rope_inspection_participants;
create policy rope_inspection_participants_write_by_department
on public.rope_inspection_participants
for all
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

alter table public.deficiencies
add column if not exists rope_item_id uuid references public.rope_items (id) on delete set null;

create index if not exists deficiencies_rope_item_id_idx
on public.deficiencies (rope_item_id);