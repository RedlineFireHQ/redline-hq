alter table public.rope_items
  drop column if exists manufacturer,
  drop column if exists model,
  drop column if exists asset_number,
  drop column if exists location;

alter table public.rope_items
  add column if not exists placed_in_service_date date,
  add column if not exists location_type text not null default 'Station Storage',
  add column if not exists apparatus_id uuid,
  add column if not exists other_location text;

alter table public.rope_items
  drop constraint if exists rope_items_location_type_check;

alter table public.rope_items
  add constraint rope_items_location_type_check
  check (location_type in ('Apparatus', 'Station Storage', 'Other'));

alter table public.rope_items
  drop constraint if exists rope_items_location_apparatus_consistency_check;

alter table public.rope_items
  add constraint rope_items_location_apparatus_consistency_check
  check (
    (location_type = 'Apparatus' and apparatus_id is not null and btrim(coalesce(other_location, '')) = '')
    or (location_type = 'Station Storage' and apparatus_id is null and btrim(coalesce(other_location, '')) = '')
    or (location_type = 'Other' and apparatus_id is null and btrim(coalesce(other_location, '')) <> '')
  );

create index if not exists rope_items_department_location_type_idx
on public.rope_items (department_id, location_type);

create index if not exists rope_items_department_apparatus_idx
on public.rope_items (department_id, apparatus_id)
where apparatus_id is not null;

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
  result text not null check (result in ('Pass', 'Fail')),
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

alter table public.rope_inspections enable row level security;
alter table public.rope_inspection_participants enable row level security;

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

drop policy if exists rope_inspections_delete_by_department on public.rope_inspections;
create policy rope_inspections_delete_by_department
on public.rope_inspections
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists rope_inspection_participants_delete_by_department on public.rope_inspection_participants;
create policy rope_inspection_participants_delete_by_department
on public.rope_inspection_participants
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

alter table public.rope_items
  add constraint rope_items_apparatus_fk
  foreign key (apparatus_id)
  references public.apparatus (id)
  on delete set null;
