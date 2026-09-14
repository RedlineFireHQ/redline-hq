create table if not exists public.rope_testing_sessions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  test_date date not null,
  tester text not null,
  created_at timestamptz not null default now()
);

create index if not exists rope_testing_sessions_department_idx
on public.rope_testing_sessions (department_id);

create index if not exists rope_testing_sessions_test_date_idx
on public.rope_testing_sessions (test_date);

create table if not exists public.rope_testing_results (
  id uuid primary key default gen_random_uuid(),
  testing_session_id uuid not null references public.rope_testing_sessions (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  rope_item_id uuid not null references public.rope_items (id) on delete cascade,
  rope_identifier text not null,
  test_date date not null,
  tester text not null,
  result text not null check (result in ('pass', 'fail')),
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rope_testing_results_session_idx
on public.rope_testing_results (testing_session_id);

create index if not exists rope_testing_results_rope_idx
on public.rope_testing_results (rope_item_id);

create index if not exists rope_testing_results_department_idx
on public.rope_testing_results (department_id);

create index if not exists rope_testing_results_date_idx
on public.rope_testing_results (test_date);

alter table public.rope_testing_sessions enable row level security;
alter table public.rope_testing_results enable row level security;

drop policy if exists rope_testing_sessions_select_by_department on public.rope_testing_sessions;
create policy rope_testing_sessions_select_by_department
on public.rope_testing_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = rope_testing_sessions.department_id
  )
);

drop policy if exists rope_testing_sessions_insert_by_department on public.rope_testing_sessions;
create policy rope_testing_sessions_insert_by_department
on public.rope_testing_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = rope_testing_sessions.department_id
  )
);

drop policy if exists rope_testing_results_select_by_department on public.rope_testing_results;
create policy rope_testing_results_select_by_department
on public.rope_testing_results
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = rope_testing_results.department_id
  )
);

drop policy if exists rope_testing_results_insert_by_department on public.rope_testing_results;
create policy rope_testing_results_insert_by_department
on public.rope_testing_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = rope_testing_results.department_id
  )
);
