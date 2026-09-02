create table if not exists public.thermal_imaging_cameras (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  camera_number text not null,
  serial_number text not null,
  manufacturer text,
  model text,
  status text not null check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, camera_number),
  unique (department_id, serial_number)
);

create index if not exists thermal_imaging_cameras_camera_number_idx
on public.thermal_imaging_cameras (camera_number);

create index if not exists thermal_imaging_cameras_department_idx
on public.thermal_imaging_cameras (department_id);

create index if not exists thermal_imaging_cameras_serial_number_idx
on public.thermal_imaging_cameras (serial_number);

create index if not exists thermal_imaging_cameras_status_idx
on public.thermal_imaging_cameras (status);

create or replace function public.set_thermal_imaging_cameras_updated_at()
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
    where tgname = 'trg_thermal_imaging_cameras_updated_at'
      and tgrelid = 'public.thermal_imaging_cameras'::regclass
  ) then
    create trigger trg_thermal_imaging_cameras_updated_at
    before update on public.thermal_imaging_cameras
    for each row
    execute function public.set_thermal_imaging_cameras_updated_at();
  end if;
end
$$;

alter table public.thermal_imaging_cameras enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'thermal_imaging_cameras'
      and policyname = 'thermal_imaging_cameras_select_by_department'
  ) then
    execute $policy$
      create policy thermal_imaging_cameras_select_by_department
      on public.thermal_imaging_cameras
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
      and tablename = 'thermal_imaging_cameras'
      and policyname = 'thermal_imaging_cameras_insert_by_department'
  ) then
    execute $policy$
      create policy thermal_imaging_cameras_insert_by_department
      on public.thermal_imaging_cameras
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
      and tablename = 'thermal_imaging_cameras'
      and policyname = 'thermal_imaging_cameras_update_by_department'
  ) then
    execute $policy$
      create policy thermal_imaging_cameras_update_by_department
      on public.thermal_imaging_cameras
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
      and tablename = 'thermal_imaging_cameras'
      and policyname = 'thermal_imaging_cameras_delete_by_department'
  ) then
    execute $policy$
      create policy thermal_imaging_cameras_delete_by_department
      on public.thermal_imaging_cameras
      for delete
      using (
        exists (
          select 1
          from public.members m
          where lower(m.email) = lower(coalesce(auth.email(), ''))
            and m.department_id = thermal_imaging_cameras.department_id
            and lower(coalesce(m.role, '')) = 'administrator'
        )
      )
    $policy$;
  end if;
end
$$;