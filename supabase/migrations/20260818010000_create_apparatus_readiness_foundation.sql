create extension if not exists pgcrypto;

alter table public.apparatus
  add column if not exists check_frequency text,
  add column if not exists mileage integer,
  add column if not exists engine_hours numeric(10,1);

alter table public.apparatus_inspections
  add column if not exists mileage integer,
  add column if not exists engine_hours numeric(10,1);

create unique index if not exists apparatus_id_department_unique_idx
on public.apparatus (id, department_id);

create table if not exists public.apparatus_check_requirements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null,
  score_profile text not null check (score_profile in ('daily', 'monthly')),
  interval_days integer not null check (interval_days > 0),
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_check_requirements_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade,
  unique (apparatus_id)
);

create index if not exists apparatus_check_requirements_department_idx
on public.apparatus_check_requirements (department_id);

create or replace function public.set_apparatus_check_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apparatus_check_requirements_updated_at on public.apparatus_check_requirements;
create trigger trg_apparatus_check_requirements_updated_at
before update on public.apparatus_check_requirements
for each row
execute function public.set_apparatus_check_requirements_updated_at();

create table if not exists public.apparatus_maintenance_requirements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null,
  name text not null,
  maintenance_type text,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_maintenance_requirements_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade,
  constraint apparatus_maintenance_requirements_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists apparatus_maintenance_requirements_id_department_unique_idx
on public.apparatus_maintenance_requirements (id, department_id);

create index if not exists apparatus_maintenance_requirements_department_idx
on public.apparatus_maintenance_requirements (department_id);

create index if not exists apparatus_maintenance_requirements_apparatus_idx
on public.apparatus_maintenance_requirements (apparatus_id);

create or replace function public.set_apparatus_maintenance_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apparatus_maintenance_requirements_updated_at on public.apparatus_maintenance_requirements;
create trigger trg_apparatus_maintenance_requirements_updated_at
before update on public.apparatus_maintenance_requirements
for each row
execute function public.set_apparatus_maintenance_requirements_updated_at();

create table if not exists public.apparatus_maintenance_requirement_methods (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_maintenance_requirement_id uuid not null,
  method_type text not null check (method_type in ('time_days', 'mileage', 'engine_hours')),
  interval_value numeric(12,2) not null check (interval_value > 0),
  due_soon_threshold_value numeric(12,2) not null check (due_soon_threshold_value >= 0),
  early_overdue_threshold_value numeric(12,2) not null check (early_overdue_threshold_value >= 0),
  moderate_overdue_threshold_value numeric(12,2) not null check (moderate_overdue_threshold_value >= early_overdue_threshold_value),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_maintenance_requirement_methods_parent_fk
    foreign key (apparatus_maintenance_requirement_id, department_id)
    references public.apparatus_maintenance_requirements (id, department_id)
    on delete cascade,
  unique (apparatus_maintenance_requirement_id, method_type)
);

create index if not exists apparatus_maintenance_requirement_methods_department_idx
on public.apparatus_maintenance_requirement_methods (department_id);

create index if not exists apparatus_maintenance_requirement_methods_requirement_idx
on public.apparatus_maintenance_requirement_methods (apparatus_maintenance_requirement_id);

create or replace function public.set_apparatus_maintenance_requirement_methods_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apparatus_maintenance_requirement_methods_updated_at on public.apparatus_maintenance_requirement_methods;
create trigger trg_apparatus_maintenance_requirement_methods_updated_at
before update on public.apparatus_maintenance_requirement_methods
for each row
execute function public.set_apparatus_maintenance_requirement_methods_updated_at();

create table if not exists public.apparatus_equipment_requirements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null,
  equipment_source text not null check (
    equipment_source in (
      'asset',
      'fire_hose',
      'scba_cylinder',
      'scba_pack',
      'pie_equipment',
      'gas_monitor',
      'battery',
      'thermal_imaging_camera',
      'ground_ladder',
      'portable_radio',
      'portable_radio_mic'
    )
  ),
  equipment_id uuid not null,
  display_name text,
  is_required boolean not null default true,
  is_critical boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_equipment_requirements_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade,
  unique (apparatus_id, equipment_source, equipment_id)
);

create index if not exists apparatus_equipment_requirements_department_idx
on public.apparatus_equipment_requirements (department_id);

create index if not exists apparatus_equipment_requirements_apparatus_idx
on public.apparatus_equipment_requirements (apparatus_id);

create or replace function public.set_apparatus_equipment_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_apparatus_equipment_requirement_reference()
returns trigger
language plpgsql
as $$
declare
  v_exists boolean := false;
begin
  case new.equipment_source
    when 'asset' then
      select exists(select 1 from public.assets a where a.id = new.equipment_id) into v_exists;
    when 'fire_hose' then
      select exists(select 1 from public.fire_hose fh where fh.id = new.equipment_id) into v_exists;
    when 'scba_cylinder' then
      select exists(select 1 from public.scba_cylinders sc where sc.id = new.equipment_id) into v_exists;
    when 'scba_pack' then
      select exists(select 1 from public.scba_packs sp where sp.id = new.equipment_id) into v_exists;
    when 'pie_equipment' then
      select exists(select 1 from public.pie_equipment pe where pe.id = new.equipment_id) into v_exists;
    when 'gas_monitor' then
      select exists(select 1 from public.gas_monitors gm where gm.id = new.equipment_id) into v_exists;
    when 'battery' then
      select exists(select 1 from public.batteries b where b.id = new.equipment_id) into v_exists;
    when 'thermal_imaging_camera' then
      select exists(select 1 from public.thermal_imaging_cameras tic where tic.id = new.equipment_id) into v_exists;
    when 'ground_ladder' then
      select exists(select 1 from public.ground_ladders gl where gl.id = new.equipment_id) into v_exists;
    when 'portable_radio' then
      select exists(select 1 from public.portable_radios pr where pr.id = new.equipment_id) into v_exists;
    when 'portable_radio_mic' then
      select exists(select 1 from public.portable_radio_mics prm where prm.id = new.equipment_id) into v_exists;
    else
      v_exists := false;
  end case;

  if not v_exists then
    raise exception
      'Invalid apparatus equipment requirement reference for source % and id %',
      new.equipment_source,
      new.equipment_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apparatus_equipment_requirements_updated_at on public.apparatus_equipment_requirements;
create trigger trg_apparatus_equipment_requirements_updated_at
before update on public.apparatus_equipment_requirements
for each row
execute function public.set_apparatus_equipment_requirements_updated_at();

drop trigger if exists trg_validate_apparatus_equipment_requirement_reference on public.apparatus_equipment_requirements;
create trigger trg_validate_apparatus_equipment_requirement_reference
before insert or update on public.apparatus_equipment_requirements
for each row
execute function public.validate_apparatus_equipment_requirement_reference();

alter table public.apparatus_check_requirements enable row level security;
alter table public.apparatus_maintenance_requirements enable row level security;
alter table public.apparatus_maintenance_requirement_methods enable row level security;
alter table public.apparatus_equipment_requirements enable row level security;

drop policy if exists apparatus_check_requirements_select_by_department on public.apparatus_check_requirements;
create policy apparatus_check_requirements_select_by_department
on public.apparatus_check_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_check_requirements_write_by_admin on public.apparatus_check_requirements;
create policy apparatus_check_requirements_write_by_admin
on public.apparatus_check_requirements
for all
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists apparatus_maintenance_requirements_select_by_department on public.apparatus_maintenance_requirements;
create policy apparatus_maintenance_requirements_select_by_department
on public.apparatus_maintenance_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_maintenance_requirements_write_by_admin on public.apparatus_maintenance_requirements;
create policy apparatus_maintenance_requirements_write_by_admin
on public.apparatus_maintenance_requirements
for all
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists apparatus_maintenance_requirement_methods_select_by_department on public.apparatus_maintenance_requirement_methods;
create policy apparatus_maintenance_requirement_methods_select_by_department
on public.apparatus_maintenance_requirement_methods
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_maintenance_requirement_methods_write_by_admin on public.apparatus_maintenance_requirement_methods;
create policy apparatus_maintenance_requirement_methods_write_by_admin
on public.apparatus_maintenance_requirement_methods
for all
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists apparatus_equipment_requirements_select_by_department on public.apparatus_equipment_requirements;
create policy apparatus_equipment_requirements_select_by_department
on public.apparatus_equipment_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_equipment_requirements_write_by_admin on public.apparatus_equipment_requirements;
create policy apparatus_equipment_requirements_write_by_admin
on public.apparatus_equipment_requirements
for all
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop function if exists public.save_apparatus_inspection(uuid, text, text);

create or replace function public.save_apparatus_inspection(
  p_apparatus_id uuid,
  p_status text,
  p_notes text default null,
  p_mileage integer default null,
  p_engine_hours numeric default null
)
returns void
language plpgsql
as $$
declare
  v_department_id uuid;
begin
  select department_id
  into v_department_id
  from public.apparatus
  where id = p_apparatus_id;

  if v_department_id is null then
    raise exception 'No department found for apparatus.';
  end if;

  insert into public.apparatus_inspections (
    apparatus_id,
    department_id,
    status,
    notes,
    mileage,
    engine_hours
  )
  values (
    p_apparatus_id,
    v_department_id,
    p_status,
    p_notes,
    p_mileage,
    p_engine_hours
  );

  update public.apparatus
  set
    status = p_status,
    last_inspection_at = now(),
    notes = p_notes,
    mileage = coalesce(p_mileage, mileage),
    engine_hours = coalesce(p_engine_hours, engine_hours)
  where id = p_apparatus_id;
end;
$$;
