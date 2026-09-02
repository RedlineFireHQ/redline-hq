create table if not exists public.portable_radio_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  portable_radio_id uuid not null references public.portable_radios (id) on delete cascade,
  assignment_type text not null check (assignment_type in ('Member', 'Apparatus', 'Unassigned')),
  member_id uuid references public.members (id) on delete set null,
  apparatus_id uuid references public.apparatus (id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (assignment_type = 'Member' and member_id is not null and apparatus_id is null)
    or (assignment_type = 'Apparatus' and apparatus_id is not null and member_id is null)
    or (assignment_type = 'Unassigned' and member_id is null and apparatus_id is null)
  ),
  check (ended_at is null or ended_at >= assigned_at)
);

create index if not exists portable_radio_assignments_apparatus_id_idx
on public.portable_radio_assignments (apparatus_id)
where apparatus_id is not null;

create index if not exists portable_radio_assignments_assignment_type_idx
on public.portable_radio_assignments (assignment_type);

create index if not exists portable_radio_assignments_department_idx
on public.portable_radio_assignments (department_id);

create index if not exists portable_radio_assignments_member_id_idx
on public.portable_radio_assignments (member_id)
where member_id is not null;

create index if not exists portable_radio_assignments_open_lookup_idx
on public.portable_radio_assignments (portable_radio_id, ended_at)
where ended_at is null;

create index if not exists portable_radio_assignments_portable_radio_id_idx
on public.portable_radio_assignments (portable_radio_id);

create unique index if not exists portable_radio_assignments_one_open_per_radio_idx
on public.portable_radio_assignments (portable_radio_id)
where ended_at is null;

create table if not exists public.portable_radio_mic_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  portable_radio_mic_id uuid not null references public.portable_radio_mics (id) on delete cascade,
  assignment_type text not null check (assignment_type in ('Portable Radio', 'Unassigned')),
  portable_radio_id uuid references public.portable_radios (id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (assignment_type = 'Portable Radio' and portable_radio_id is not null)
    or (assignment_type = 'Unassigned' and portable_radio_id is null)
  ),
  check (ended_at is null or ended_at >= assigned_at)
);

create index if not exists portable_radio_mic_assignments_department_idx
on public.portable_radio_mic_assignments (department_id);

create index if not exists portable_radio_mic_assignments_mic_id_idx
on public.portable_radio_mic_assignments (portable_radio_mic_id);

create index if not exists portable_radio_mic_assignments_open_lookup_idx
on public.portable_radio_mic_assignments (portable_radio_mic_id, ended_at)
where ended_at is null;

create index if not exists portable_radio_mic_assignments_radio_id_idx
on public.portable_radio_mic_assignments (portable_radio_id)
where portable_radio_id is not null;

create unique index if not exists portable_radio_mic_assignments_one_open_per_mic_idx
on public.portable_radio_mic_assignments (portable_radio_mic_id)
where ended_at is null;

alter table public.portable_radio_assignments enable row level security;
alter table public.portable_radio_mic_assignments enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['portable_radio_assignments', 'portable_radio_mic_assignments'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_select_by_department'
    ) then
      execute format(
        'create policy %I on public.%I for select using (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''''))))',
        table_name || '_select_by_department', table_name
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
        table_name || '_insert_by_department', table_name
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
        table_name || '_update_by_department', table_name
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
        table_name || '_delete_by_department', table_name, table_name
      );
    end if;
  end loop;
end
$$;