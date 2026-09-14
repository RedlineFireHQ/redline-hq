create table if not exists public.apparatus_pump_tests (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null references public.apparatus (id) on delete cascade,
  test_date date not null,
  tester_type text not null check (tester_type in ('department_member', 'external_tester')),
  tester_member_id uuid references public.members (id) on delete set null,
  external_tester_name text,
  external_tester_company text,
  result text not null check (result in ('Pass', 'Fail')),
  notes text,
  created_at timestamptz not null default now(),
  check (
    (
      tester_type = 'department_member'
      and tester_member_id is not null
      and external_tester_name is null
      and external_tester_company is null
    )
    or (
      tester_type = 'external_tester'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
    )
  )
);

create index if not exists apparatus_pump_tests_department_idx
on public.apparatus_pump_tests (department_id);

create index if not exists apparatus_pump_tests_apparatus_id_idx
on public.apparatus_pump_tests (apparatus_id);

create index if not exists apparatus_pump_tests_test_date_idx
on public.apparatus_pump_tests (test_date);

alter table public.apparatus_pump_tests enable row level security;

revoke all on table public.apparatus_pump_tests from public;
revoke all on table public.apparatus_pump_tests from anon;
grant select, insert, update, delete on table public.apparatus_pump_tests to authenticated;

drop policy if exists apparatus_pump_tests_select_by_department on public.apparatus_pump_tests;
create policy apparatus_pump_tests_select_by_department
on public.apparatus_pump_tests
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_pump_tests_insert_by_department on public.apparatus_pump_tests;
create policy apparatus_pump_tests_insert_by_department
on public.apparatus_pump_tests
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_pump_tests_update_by_department on public.apparatus_pump_tests;
create policy apparatus_pump_tests_update_by_department
on public.apparatus_pump_tests
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

drop policy if exists apparatus_pump_tests_delete_by_department on public.apparatus_pump_tests;
create policy apparatus_pump_tests_delete_by_department
on public.apparatus_pump_tests
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_pump_tests.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);
