create table if not exists public.portable_radios (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  radio_number text not null,
  serial_number text not null,
  manufacturer text,
  model text,
  radio_unit_id text,
  status text not null check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, radio_number),
  unique (department_id, serial_number)
);

create index if not exists portable_radios_department_idx
on public.portable_radios (department_id);

create index if not exists portable_radios_radio_number_idx
on public.portable_radios (radio_number);

create index if not exists portable_radios_serial_number_idx
on public.portable_radios (serial_number);

create index if not exists portable_radios_status_idx
on public.portable_radios (status);

create or replace function public.set_portable_radios_updated_at()
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
    select 1 from pg_trigger
    where tgname = 'trg_portable_radios_updated_at'
      and tgrelid = 'public.portable_radios'::regclass
  ) then
    create trigger trg_portable_radios_updated_at
    before update on public.portable_radios
    for each row
    execute function public.set_portable_radios_updated_at();
  end if;
end
$$;

create table if not exists public.portable_radio_mics (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  mic_number text not null,
  serial_number text not null,
  manufacturer text,
  model text,
  status text not null check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, mic_number),
  unique (department_id, serial_number)
);

create index if not exists portable_radio_mics_department_idx
on public.portable_radio_mics (department_id);

create index if not exists portable_radio_mics_mic_number_idx
on public.portable_radio_mics (mic_number);

create index if not exists portable_radio_mics_serial_number_idx
on public.portable_radio_mics (serial_number);

create index if not exists portable_radio_mics_status_idx
on public.portable_radio_mics (status);

create or replace function public.set_portable_radio_mics_updated_at()
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
    select 1 from pg_trigger
    where tgname = 'trg_portable_radio_mics_updated_at'
      and tgrelid = 'public.portable_radio_mics'::regclass
  ) then
    create trigger trg_portable_radio_mics_updated_at
    before update on public.portable_radio_mics
    for each row
    execute function public.set_portable_radio_mics_updated_at();
  end if;
end
$$;

alter table public.portable_radios enable row level security;
alter table public.portable_radio_mics enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['portable_radios', 'portable_radio_mics'] loop
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