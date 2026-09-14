create extension if not exists pgcrypto;

create table if not exists public.ground_ladder_inspection_settings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  require_checklist boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id)
);

create or replace function public.set_ground_ladder_inspection_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ground_ladder_inspection_settings_updated_at on public.ground_ladder_inspection_settings;
create trigger trg_ground_ladder_inspection_settings_updated_at
before update on public.ground_ladder_inspection_settings
for each row
execute function public.set_ground_ladder_inspection_settings_updated_at();

alter table public.ground_ladder_inspection_settings enable row level security;

drop policy if exists ground_ladder_inspection_settings_select_by_department on public.ground_ladder_inspection_settings;
create policy ground_ladder_inspection_settings_select_by_department
on public.ground_ladder_inspection_settings
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_inspection_settings.department_id
  )
);

drop policy if exists ground_ladder_inspection_settings_write_by_admin on public.ground_ladder_inspection_settings;
create policy ground_ladder_inspection_settings_write_by_admin
on public.ground_ladder_inspection_settings
for all
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_inspection_settings.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(ground_ladder_inspection_settings.department_id, 'apparatus_management')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ground_ladder_inspection_settings.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(ground_ladder_inspection_settings.department_id, 'apparatus_management')
      )
  )
);
