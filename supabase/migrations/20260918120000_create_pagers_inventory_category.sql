create table if not exists public.pagers (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pager_number text not null,
  serial_number text,
  manufacturer text,
  model text,
  pager_type text,
  location text,
  status text not null default 'Unassigned' check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, pager_number)
);

create index if not exists pagers_department_idx
on public.pagers (department_id);

create index if not exists pagers_pager_number_idx
on public.pagers (pager_number);

create index if not exists pagers_serial_number_idx
on public.pagers (serial_number);

create index if not exists pagers_status_idx
on public.pagers (status);

create unique index if not exists pagers_department_serial_number_unique_idx
on public.pagers (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create or replace function public.set_pagers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pagers_updated_at on public.pagers;
create trigger trg_pagers_updated_at
before update on public.pagers
for each row
execute function public.set_pagers_updated_at();

alter table public.pagers enable row level security;

drop policy if exists pagers_select_by_department on public.pagers;
create policy pagers_select_by_department
on public.pagers
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pagers.department_id
  )
);

drop policy if exists pagers_insert_special_permission on public.pagers;
create policy pagers_insert_special_permission
on public.pagers
for insert
to authenticated
with check (public.member_has_inventory_permission(department_id, 'pager_management'));

drop policy if exists pagers_update_special_permission on public.pagers;
create policy pagers_update_special_permission
on public.pagers
for update
to authenticated
using (public.member_has_inventory_permission(department_id, 'pager_management'))
with check (public.member_has_inventory_permission(department_id, 'pager_management'));

drop policy if exists pagers_delete_special_permission on public.pagers;
create policy pagers_delete_special_permission
on public.pagers
for delete
to authenticated
using (public.member_has_inventory_permission(department_id, 'pager_retire_delete'));

insert into public.app_permissions (key, label, description, sort_order, active)
values
  ('pager_management', 'Pager Management', 'Special permission for pager management.', 260, true),
  ('pager_inspection_testing', 'Pager Inspection & Testing', 'Special permission for pager inspection testing.', 261, true),
  ('pager_assignment', 'Pager Assignment', 'Special permission for pager assignment.', 262, true),
  ('pager_retire_delete', 'Pager Retire / Delete', 'Special permission for pager retire delete.', 263, true)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;

alter table public.deficiencies
add column if not exists pager_id uuid references public.pagers (id) on delete set null;

create index if not exists deficiencies_pager_id_idx
on public.deficiencies (pager_id)
where pager_id is not null;
