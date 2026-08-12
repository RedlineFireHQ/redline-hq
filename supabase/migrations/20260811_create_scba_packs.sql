create table if not exists public.scba_packs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pack_number text not null,
  manufacturer text,
  model text,
  serial_number text,
  in_service_date date,
  last_flow_test_date date,
  next_flow_test_due_date date,
  status text not null default 'Ready' check (status in ('Ready', 'Flow Test Due', 'Out of Service', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, pack_number)
);

create index if not exists scba_packs_department_idx
on public.scba_packs (department_id);

create index if not exists scba_packs_status_idx
on public.scba_packs (status);

create index if not exists scba_packs_next_flow_test_due_date_idx
on public.scba_packs (next_flow_test_due_date);

create unique index if not exists scba_packs_department_serial_number_unique_idx
on public.scba_packs (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create or replace function public.set_scba_packs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_scba_packs_updated_at on public.scba_packs;
create trigger trg_scba_packs_updated_at
before update on public.scba_packs
for each row
execute function public.set_scba_packs_updated_at();

alter table public.scba_packs enable row level security;

drop policy if exists scba_packs_select_by_department on public.scba_packs;
create policy scba_packs_select_by_department
on public.scba_packs
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists scba_packs_insert_by_department on public.scba_packs;
create policy scba_packs_insert_by_department
on public.scba_packs
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists scba_packs_update_by_department on public.scba_packs;
create policy scba_packs_update_by_department
on public.scba_packs
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

drop policy if exists scba_packs_delete_by_department on public.scba_packs;
create policy scba_packs_delete_by_department
on public.scba_packs
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = scba_packs.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.scba_pack_flow_tests (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  scba_pack_id uuid not null references public.scba_packs (id) on delete cascade,
  test_date date not null,
  tester text not null,
  result text not null check (result in ('Pass', 'Fail')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists scba_pack_flow_tests_department_idx
on public.scba_pack_flow_tests (department_id);

create index if not exists scba_pack_flow_tests_scba_pack_id_idx
on public.scba_pack_flow_tests (scba_pack_id);

create index if not exists scba_pack_flow_tests_test_date_idx
on public.scba_pack_flow_tests (test_date);

alter table public.scba_pack_flow_tests enable row level security;

drop policy if exists scba_pack_flow_tests_select_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_select_by_department
on public.scba_pack_flow_tests
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists scba_pack_flow_tests_insert_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_insert_by_department
on public.scba_pack_flow_tests
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists scba_pack_flow_tests_update_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_update_by_department
on public.scba_pack_flow_tests
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

drop policy if exists scba_pack_flow_tests_delete_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_delete_by_department
on public.scba_pack_flow_tests
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = scba_pack_flow_tests.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table if exists public.deficiencies
add column if not exists scba_pack_id uuid references public.scba_packs (id) on delete set null;

create index if not exists deficiencies_scba_pack_id_idx
on public.deficiencies (scba_pack_id);