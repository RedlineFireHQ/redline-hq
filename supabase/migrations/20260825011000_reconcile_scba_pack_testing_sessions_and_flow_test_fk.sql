create table if not exists public.scba_pack_testing_sessions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  test_date date not null,
  tester text not null,
  session_notes text,
  created_at timestamptz not null default now()
);

create index if not exists scba_pack_testing_sessions_department_idx
on public.scba_pack_testing_sessions (department_id);

create index if not exists scba_pack_testing_sessions_test_date_idx
on public.scba_pack_testing_sessions (test_date);

alter table public.scba_pack_testing_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scba_pack_testing_sessions'
      and policyname = 'scba_pack_testing_sessions_select_by_department'
  ) then
    execute $policy$
      create policy scba_pack_testing_sessions_select_by_department
      on public.scba_pack_testing_sessions
      for select
      using (
        department_id in (
          select m.department_id
          from public.members m
          where lower(m.email) = lower(coalesce(auth.email(), ''))
        )
      )
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scba_pack_testing_sessions'
      and policyname = 'scba_pack_testing_sessions_insert_by_department'
  ) then
    execute $policy$
      create policy scba_pack_testing_sessions_insert_by_department
      on public.scba_pack_testing_sessions
      for insert
      with check (
        department_id in (
          select m.department_id
          from public.members m
          where lower(m.email) = lower(coalesce(auth.email(), ''))
        )
      )
    $policy$;
  end if;
end
$$;

alter table public.scba_pack_flow_tests
add column if not exists testing_session_id uuid;

create index if not exists scba_pack_flow_tests_testing_session_id_idx
on public.scba_pack_flow_tests (testing_session_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scba_pack_flow_tests_testing_session_id_fkey'
      and conrelid = 'public.scba_pack_flow_tests'::regclass
  ) then
    alter table public.scba_pack_flow_tests
    add constraint scba_pack_flow_tests_testing_session_id_fkey
    foreign key (testing_session_id)
    references public.scba_pack_testing_sessions (id)
    on delete set null;
  end if;
end
$$;