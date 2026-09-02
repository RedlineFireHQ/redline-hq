create table if not exists public.gas_monitor_calibration_settings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  calibration_interval_months integer not null check (calibration_interval_months > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id)
);

create index if not exists gas_monitor_calibration_settings_department_idx
on public.gas_monitor_calibration_settings (department_id);

create or replace function public.set_gas_monitor_calibration_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_gas_monitor_calibration_settings_updated_at'
      and tgrelid = 'public.gas_monitor_calibration_settings'::regclass
  ) then
    create trigger trg_gas_monitor_calibration_settings_updated_at
    before update on public.gas_monitor_calibration_settings
    for each row
    execute function public.set_gas_monitor_calibration_settings_updated_at();
  end if;
end
$$;

create table if not exists public.gas_monitor_calibration_sessions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  calibration_date date not null,
  tester_mode text not null check (tester_mode in ('Department Person', 'External', 'Name/Company')),
  tester_member_id uuid references public.members (id) on delete set null,
  external_tester_name text,
  external_tester_company text,
  session_notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  check (
    (tester_mode = 'Department Person' and tester_member_id is not null and external_tester_name is null and external_tester_company is null)
    or (
      tester_mode = 'External'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
    )
    or (
      tester_mode = 'Name/Company'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
      and external_tester_company is not null
      and btrim(external_tester_company) <> ''
    )
  )
);

create index if not exists gas_monitor_calibration_sessions_date_idx
on public.gas_monitor_calibration_sessions (calibration_date);

create index if not exists gas_monitor_calibration_sessions_department_idx
on public.gas_monitor_calibration_sessions (department_id);

create index if not exists gas_monitor_calibration_sessions_tester_member_id_idx
on public.gas_monitor_calibration_sessions (tester_member_id)
where tester_member_id is not null;

create table if not exists public.gas_monitor_calibration_session_results (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  calibration_session_id uuid not null references public.gas_monitor_calibration_sessions (id) on delete cascade,
  gas_monitor_id uuid not null references public.gas_monitors (id) on delete cascade,
  calibration_date date not null,
  result text not null check (result in ('Passed', 'Failed')),
  tester_mode text not null check (tester_mode in ('Department Person', 'External', 'Name/Company')),
  tester_member_id uuid references public.members (id) on delete set null,
  external_tester_name text,
  external_tester_company text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  unique (calibration_session_id, gas_monitor_id),
  check (
    (tester_mode = 'Department Person' and tester_member_id is not null and external_tester_name is null and external_tester_company is null)
    or (
      tester_mode = 'External'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
    )
    or (
      tester_mode = 'Name/Company'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
      and external_tester_company is not null
      and btrim(external_tester_company) <> ''
    )
  )
);

create index if not exists gas_monitor_calibration_session_results_date_idx
on public.gas_monitor_calibration_session_results (calibration_date);

create index if not exists gas_monitor_calibration_session_results_department_idx
on public.gas_monitor_calibration_session_results (department_id);

create index if not exists gas_monitor_calibration_session_results_monitor_idx
on public.gas_monitor_calibration_session_results (gas_monitor_id);

create index if not exists gas_monitor_calibration_session_results_result_idx
on public.gas_monitor_calibration_session_results (result);

create index if not exists gas_monitor_calibration_session_results_session_idx
on public.gas_monitor_calibration_session_results (calibration_session_id);

create index if not exists gas_monitor_calibration_session_results_tester_member_idx
on public.gas_monitor_calibration_session_results (tester_member_id)
where tester_member_id is not null;

create table if not exists public.gas_monitor_calibrations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  gas_monitor_id uuid not null references public.gas_monitors (id) on delete cascade,
  calibration_date date not null,
  result text not null check (result in ('Passed', 'Failed')),
  tester_mode text not null check (tester_mode in ('Department Person', 'External', 'Name/Company')),
  tester_member_id uuid references public.members (id) on delete set null,
  external_tester_name text,
  external_tester_company text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  check (
    (tester_mode = 'Department Person' and tester_member_id is not null and external_tester_name is null and external_tester_company is null)
    or (
      tester_mode = 'External'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
    )
    or (
      tester_mode = 'Name/Company'
      and tester_member_id is null
      and external_tester_name is not null
      and btrim(external_tester_name) <> ''
      and external_tester_company is not null
      and btrim(external_tester_company) <> ''
    )
  )
);

create index if not exists gas_monitor_calibrations_date_idx
on public.gas_monitor_calibrations (calibration_date);

create index if not exists gas_monitor_calibrations_department_idx
on public.gas_monitor_calibrations (department_id);

create index if not exists gas_monitor_calibrations_monitor_id_idx
on public.gas_monitor_calibrations (gas_monitor_id);

create index if not exists gas_monitor_calibrations_result_idx
on public.gas_monitor_calibrations (result);

create index if not exists gas_monitor_calibrations_tester_member_id_idx
on public.gas_monitor_calibrations (tester_member_id)
where tester_member_id is not null;

alter table public.gas_monitor_calibration_settings enable row level security;
alter table public.gas_monitor_calibration_sessions enable row level security;
alter table public.gas_monitor_calibration_session_results enable row level security;
alter table public.gas_monitor_calibrations enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'gas_monitor_calibration_settings',
    'gas_monitor_calibration_sessions',
    'gas_monitor_calibration_session_results',
    'gas_monitor_calibrations'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_select_by_department'
    ) then
      execute format(
        'create policy %I on public.%I for select using (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''''))))',
        table_name || '_select_by_department',
        table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_insert_by_department'
    ) then
      execute format(
        'create policy %I on public.%I for insert with check (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''''))))',
        table_name || '_insert_by_department',
        table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_update_by_department'
    ) then
      execute format(
        'create policy %I on public.%I for update using (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), '''')))) with check (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''''))))',
        table_name || '_update_by_department',
        table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_delete_by_department'
    ) then
      execute format(
        'create policy %I on public.%I for delete using (exists (select 1 from public.members m where lower(m.email) = lower(coalesce(auth.email(), '''')) and m.department_id = %I.department_id and lower(coalesce(m.role, '''')) = ''administrator''))',
        table_name || '_delete_by_department',
        table_name,
        table_name
      );
    end if;
  end loop;
end
$$;