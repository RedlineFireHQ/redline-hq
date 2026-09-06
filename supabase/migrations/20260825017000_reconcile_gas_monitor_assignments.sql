create table if not exists public.gas_monitor_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  gas_monitor_id uuid not null references public.gas_monitors (id) on delete cascade,
  assignment_type text not null check (assignment_type in ('Member', 'Apparatus', 'Station Storage', 'Unassigned')),
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
    or (assignment_type = 'Station Storage' and member_id is null and apparatus_id is null)
    or (assignment_type = 'Unassigned' and member_id is null and apparatus_id is null)
  ),
  check (ended_at is null or ended_at >= assigned_at)
);

create index if not exists gas_monitor_assignments_apparatus_id_idx
on public.gas_monitor_assignments (apparatus_id)
where apparatus_id is not null;

create index if not exists gas_monitor_assignments_assignment_type_idx
on public.gas_monitor_assignments (assignment_type);

create index if not exists gas_monitor_assignments_department_idx
on public.gas_monitor_assignments (department_id);

create index if not exists gas_monitor_assignments_member_id_idx
on public.gas_monitor_assignments (member_id)
where member_id is not null;

create index if not exists gas_monitor_assignments_monitor_id_idx
on public.gas_monitor_assignments (gas_monitor_id);

create index if not exists gas_monitor_assignments_open_lookup_idx
on public.gas_monitor_assignments (gas_monitor_id, ended_at)
where ended_at is null;

create unique index if not exists gas_monitor_assignments_one_open_per_monitor_idx
on public.gas_monitor_assignments (gas_monitor_id)
where ended_at is null;

alter table public.gas_monitor_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gas_monitor_assignments'
      and policyname = 'gas_monitor_assignments_select_by_department'
  ) then
    execute $policy$
      create policy gas_monitor_assignments_select_by_department
      on public.gas_monitor_assignments
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
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gas_monitor_assignments'
      and policyname = 'gas_monitor_assignments_insert_by_department'
  ) then
    execute $policy$
      create policy gas_monitor_assignments_insert_by_department
      on public.gas_monitor_assignments
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gas_monitor_assignments'
      and policyname = 'gas_monitor_assignments_update_by_department'
  ) then
    execute $policy$
      create policy gas_monitor_assignments_update_by_department
      on public.gas_monitor_assignments
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
      )
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gas_monitor_assignments'
      and policyname = 'gas_monitor_assignments_delete_by_department'
  ) then
    execute $policy$
      create policy gas_monitor_assignments_delete_by_department
      on public.gas_monitor_assignments
      for delete
      using (
        exists (
          select 1
          from public.members m
          where lower(m.email) = lower(coalesce(auth.email(), ''))
            and m.department_id = gas_monitor_assignments.department_id
            and lower(coalesce(m.role, '')) = 'administrator'
        )
      )
    $policy$;
  end if;
end
$$;