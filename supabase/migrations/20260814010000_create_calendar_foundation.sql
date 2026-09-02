create extension if not exists pgcrypto;

create table if not exists public.department_calendar_activities (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  activity_type text not null check (
    activity_type in (
      'Training',
      'Apparatus / Operations',
      'Meeting',
      'Administrative',
      'Maintenance',
      'Drill',
      'Department Event',
      'Other'
    )
  ),
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  assigned_member_id uuid references public.members (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Canceled')),
  source_entity_type text check (
    source_entity_type is null
    or source_entity_type in ('training', 'apparatus', 'maintenance', 'operational', 'other')
  ),
  source_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at)
);

create index if not exists department_calendar_activities_department_idx
on public.department_calendar_activities (department_id);

create index if not exists department_calendar_activities_start_at_idx
on public.department_calendar_activities (start_at);

create index if not exists department_calendar_activities_department_start_at_idx
on public.department_calendar_activities (department_id, start_at);

create index if not exists department_calendar_activities_status_idx
on public.department_calendar_activities (status);

create index if not exists department_calendar_activities_assigned_member_idx
on public.department_calendar_activities (assigned_member_id)
where assigned_member_id is not null;

create or replace function public.set_department_calendar_activities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_department_calendar_activities_updated_at on public.department_calendar_activities;
create trigger trg_department_calendar_activities_updated_at
before update on public.department_calendar_activities
for each row
execute function public.set_department_calendar_activities_updated_at();

alter table public.department_calendar_activities enable row level security;

drop policy if exists department_calendar_activities_select_by_department on public.department_calendar_activities;
create policy department_calendar_activities_select_by_department
on public.department_calendar_activities
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_calendar_activities_insert_by_role on public.department_calendar_activities;
create policy department_calendar_activities_insert_by_role
on public.department_calendar_activities
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_calendar_activities.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists department_calendar_activities_update_by_role on public.department_calendar_activities;
create policy department_calendar_activities_update_by_role
on public.department_calendar_activities
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_calendar_activities.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_calendar_activities.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists department_calendar_activities_delete_by_role on public.department_calendar_activities;
create policy department_calendar_activities_delete_by_role
on public.department_calendar_activities
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_calendar_activities.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create table if not exists public.department_recurring_requirements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  requirement_type text not null check (btrim(requirement_type) <> ''),
  title text not null check (btrim(title) <> ''),
  recurrence_rule text not null check (btrim(recurrence_rule) <> ''),
  recurrence_timezone text,
  is_active boolean not null default true,
  apparatus_id uuid references public.apparatus (id) on delete set null,
  responsible_member_id uuid references public.members (id) on delete set null,
  effective_date date not null default current_date,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists department_recurring_requirements_department_idx
on public.department_recurring_requirements (department_id);

create index if not exists department_recurring_requirements_active_idx
on public.department_recurring_requirements (department_id, is_active)
where is_active = true;

create index if not exists department_recurring_requirements_apparatus_idx
on public.department_recurring_requirements (apparatus_id)
where apparatus_id is not null;

create index if not exists department_recurring_requirements_effective_date_idx
on public.department_recurring_requirements (effective_date);

create or replace function public.set_department_recurring_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_department_recurring_requirements_updated_at on public.department_recurring_requirements;
create trigger trg_department_recurring_requirements_updated_at
before update on public.department_recurring_requirements
for each row
execute function public.set_department_recurring_requirements_updated_at();

alter table public.department_recurring_requirements enable row level security;

drop policy if exists department_recurring_requirements_select_by_department on public.department_recurring_requirements;
create policy department_recurring_requirements_select_by_department
on public.department_recurring_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_recurring_requirements_insert_by_role on public.department_recurring_requirements;
create policy department_recurring_requirements_insert_by_role
on public.department_recurring_requirements
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_recurring_requirements.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists department_recurring_requirements_update_by_role on public.department_recurring_requirements;
create policy department_recurring_requirements_update_by_role
on public.department_recurring_requirements
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_recurring_requirements.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_recurring_requirements.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists department_recurring_requirements_delete_by_role on public.department_recurring_requirements;
create policy department_recurring_requirements_delete_by_role
on public.department_recurring_requirements
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_recurring_requirements.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);
