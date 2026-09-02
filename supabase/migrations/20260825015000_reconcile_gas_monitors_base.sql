create table if not exists public.gas_monitors (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  monitor_number text not null,
  serial_number text not null,
  manufacturer text,
  model text,
  status text not null check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, monitor_number),
  unique (department_id, serial_number)
);

create index if not exists gas_monitors_department_idx
on public.gas_monitors (department_id);

create index if not exists gas_monitors_monitor_number_idx
on public.gas_monitors (monitor_number);

create index if not exists gas_monitors_serial_number_idx
on public.gas_monitors (serial_number);

create index if not exists gas_monitors_status_idx
on public.gas_monitors (status);

create or replace function public.set_gas_monitors_updated_at()
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
    where tgname = 'trg_gas_monitors_updated_at'
      and tgrelid = 'public.gas_monitors'::regclass
  ) then
    create trigger trg_gas_monitors_updated_at
    before update on public.gas_monitors
    for each row
    execute function public.set_gas_monitors_updated_at();
  end if;
end
$$;

alter table public.gas_monitors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gas_monitors'
      and policyname = 'gas_monitors_select_by_department'
  ) then
    execute $policy$
      create policy gas_monitors_select_by_department
      on public.gas_monitors
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
      and tablename = 'gas_monitors'
      and policyname = 'gas_monitors_insert_by_department'
  ) then
    execute $policy$
      create policy gas_monitors_insert_by_department
      on public.gas_monitors
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
      and tablename = 'gas_monitors'
      and policyname = 'gas_monitors_update_by_department'
  ) then
    execute $policy$
      create policy gas_monitors_update_by_department
      on public.gas_monitors
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
      and tablename = 'gas_monitors'
      and policyname = 'gas_monitors_delete_by_department'
  ) then
    execute $policy$
      create policy gas_monitors_delete_by_department
      on public.gas_monitors
      for delete
      using (
        exists (
          select 1
          from public.members m
          where lower(m.email) = lower(coalesce(auth.email(), ''))
            and m.department_id = gas_monitors.department_id
            and lower(coalesce(m.role, '')) = 'administrator'
        )
      )
    $policy$;
  end if;
end
$$;