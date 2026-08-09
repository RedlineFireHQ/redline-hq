create table if not exists public.fire_hose_testing_sessions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  test_date date not null,
  tester text not null,
  created_at timestamptz not null default now()
);

create index if not exists fire_hose_testing_sessions_department_idx
on public.fire_hose_testing_sessions (department_id);

create index if not exists fire_hose_testing_sessions_test_date_idx
on public.fire_hose_testing_sessions (test_date);

create table if not exists public.fire_hose_testing_results (
  id uuid primary key default gen_random_uuid(),
  testing_session_id uuid not null references public.fire_hose_testing_sessions (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  hose_id uuid not null references public.fire_hose (id) on delete cascade,
  inventory_number text not null,
  test_date date not null,
  tester text not null,
  result text not null check (result in ('pass', 'fail')),
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists fire_hose_testing_results_session_idx
on public.fire_hose_testing_results (testing_session_id);

create index if not exists fire_hose_testing_results_hose_idx
on public.fire_hose_testing_results (hose_id);

create index if not exists fire_hose_testing_results_department_idx
on public.fire_hose_testing_results (department_id);

create index if not exists fire_hose_testing_results_date_idx
on public.fire_hose_testing_results (test_date);

alter table public.fire_hose_testing_sessions enable row level security;
alter table public.fire_hose_testing_results enable row level security;

drop policy if exists fire_hose_testing_sessions_select_by_department on public.fire_hose_testing_sessions;
create policy fire_hose_testing_sessions_select_by_department
on public.fire_hose_testing_sessions
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_hose_testing_sessions_insert_by_department on public.fire_hose_testing_sessions;
create policy fire_hose_testing_sessions_insert_by_department
on public.fire_hose_testing_sessions
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_hose_testing_results_select_by_department on public.fire_hose_testing_results;
create policy fire_hose_testing_results_select_by_department
on public.fire_hose_testing_results
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_hose_testing_results_insert_by_department on public.fire_hose_testing_results;
create policy fire_hose_testing_results_insert_by_department
on public.fire_hose_testing_results
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);
