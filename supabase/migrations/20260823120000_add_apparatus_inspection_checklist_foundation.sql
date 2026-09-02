create extension if not exists pgcrypto;

create table if not exists public.apparatus_inspection_settings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  require_checklist boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id)
);

create table if not exists public.apparatus_inspection_checklist_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null,
  section_name text not null default 'General' check (btrim(section_name) <> ''),
  item_label text not null check (btrim(item_label) <> ''),
  is_required boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_inspection_checklist_items_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade
);

create unique index if not exists apparatus_inspection_checklist_items_unique_label_idx
on public.apparatus_inspection_checklist_items (apparatus_id, lower(btrim(section_name)), lower(btrim(item_label)));

create index if not exists apparatus_inspection_checklist_items_department_idx
on public.apparatus_inspection_checklist_items (department_id);

create index if not exists apparatus_inspection_checklist_items_apparatus_idx
on public.apparatus_inspection_checklist_items (apparatus_id, is_active, display_order, created_at);

create table if not exists public.apparatus_inspection_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  checklist_item_id uuid not null references public.apparatus_inspection_checklist_items (id) on delete cascade,
  status text not null check (status in ('checked', 'deficiency', 'not_applicable')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apparatus_inspection_checklist_progress_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade,
  unique (department_id, apparatus_id, member_id, checklist_item_id)
);

create index if not exists apparatus_inspection_checklist_progress_member_idx
on public.apparatus_inspection_checklist_progress (department_id, member_id, apparatus_id);

create index if not exists apparatus_inspection_checklist_progress_item_idx
on public.apparatus_inspection_checklist_progress (checklist_item_id);

create table if not exists public.apparatus_inspection_checklist_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.apparatus_inspections (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  apparatus_id uuid not null,
  checklist_item_id uuid references public.apparatus_inspection_checklist_items (id) on delete set null,
  section_name_snapshot text not null,
  item_label_snapshot text not null,
  is_required_snapshot boolean not null,
  result_status text not null check (result_status in ('checked', 'deficiency', 'not_applicable')),
  item_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint apparatus_inspection_checklist_results_apparatus_fk
    foreign key (apparatus_id, department_id)
    references public.apparatus (id, department_id)
    on delete cascade
);

create index if not exists apparatus_inspection_checklist_results_inspection_idx
on public.apparatus_inspection_checklist_results (inspection_id, item_order, created_at);

create or replace function public.set_apparatus_inspection_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_apparatus_inspection_checklist_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_apparatus_inspection_checklist_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apparatus_inspection_settings_updated_at on public.apparatus_inspection_settings;
create trigger trg_apparatus_inspection_settings_updated_at
before update on public.apparatus_inspection_settings
for each row
execute function public.set_apparatus_inspection_settings_updated_at();

drop trigger if exists trg_apparatus_inspection_checklist_items_updated_at on public.apparatus_inspection_checklist_items;
create trigger trg_apparatus_inspection_checklist_items_updated_at
before update on public.apparatus_inspection_checklist_items
for each row
execute function public.set_apparatus_inspection_checklist_items_updated_at();

drop trigger if exists trg_apparatus_inspection_checklist_progress_updated_at on public.apparatus_inspection_checklist_progress;
create trigger trg_apparatus_inspection_checklist_progress_updated_at
before update on public.apparatus_inspection_checklist_progress
for each row
execute function public.set_apparatus_inspection_checklist_progress_updated_at();

alter table public.apparatus_inspection_settings enable row level security;
alter table public.apparatus_inspection_checklist_items enable row level security;
alter table public.apparatus_inspection_checklist_progress enable row level security;
alter table public.apparatus_inspection_checklist_results enable row level security;

drop policy if exists apparatus_inspection_settings_select_by_department on public.apparatus_inspection_settings;
create policy apparatus_inspection_settings_select_by_department
on public.apparatus_inspection_settings
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_settings.department_id
  )
);

drop policy if exists apparatus_inspection_settings_write_by_admin on public.apparatus_inspection_settings;
create policy apparatus_inspection_settings_write_by_admin
on public.apparatus_inspection_settings
for all
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_settings.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus_inspection_settings.department_id, 'apparatus_management')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_settings.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus_inspection_settings.department_id, 'apparatus_management')
      )
  )
);

drop policy if exists apparatus_inspection_checklist_items_select_by_department on public.apparatus_inspection_checklist_items;
create policy apparatus_inspection_checklist_items_select_by_department
on public.apparatus_inspection_checklist_items
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_items.department_id
  )
);

drop policy if exists apparatus_inspection_checklist_items_write_by_admin on public.apparatus_inspection_checklist_items;
create policy apparatus_inspection_checklist_items_write_by_admin
on public.apparatus_inspection_checklist_items
for all
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_items.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus_inspection_checklist_items.department_id, 'apparatus_management')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_items.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus_inspection_checklist_items.department_id, 'apparatus_management')
      )
  )
);

drop policy if exists apparatus_inspection_checklist_progress_select_by_department on public.apparatus_inspection_checklist_progress;
create policy apparatus_inspection_checklist_progress_select_by_department
on public.apparatus_inspection_checklist_progress
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_progress.department_id
      and (
        m.id = apparatus_inspection_checklist_progress.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
        or public.member_has_app_permission(apparatus_inspection_checklist_progress.department_id, 'apparatus_management')
      )
  )
);

drop policy if exists apparatus_inspection_checklist_progress_insert_self on public.apparatus_inspection_checklist_progress;
create policy apparatus_inspection_checklist_progress_insert_self
on public.apparatus_inspection_checklist_progress
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_progress.department_id
      and m.id = apparatus_inspection_checklist_progress.member_id
      and coalesce(m.active, true) = true
  )
  and exists (
    select 1
    from public.apparatus_inspection_checklist_items i
    where i.id = apparatus_inspection_checklist_progress.checklist_item_id
      and i.department_id = apparatus_inspection_checklist_progress.department_id
      and i.apparatus_id = apparatus_inspection_checklist_progress.apparatus_id
      and i.is_active = true
  )
);

drop policy if exists apparatus_inspection_checklist_progress_update_self on public.apparatus_inspection_checklist_progress;
create policy apparatus_inspection_checklist_progress_update_self
on public.apparatus_inspection_checklist_progress
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_progress.department_id
      and m.id = apparatus_inspection_checklist_progress.member_id
      and coalesce(m.active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_progress.department_id
      and m.id = apparatus_inspection_checklist_progress.member_id
      and coalesce(m.active, true) = true
  )
  and exists (
    select 1
    from public.apparatus_inspection_checklist_items i
    where i.id = apparatus_inspection_checklist_progress.checklist_item_id
      and i.department_id = apparatus_inspection_checklist_progress.department_id
      and i.apparatus_id = apparatus_inspection_checklist_progress.apparatus_id
      and i.is_active = true
  )
);

drop policy if exists apparatus_inspection_checklist_results_select_by_department on public.apparatus_inspection_checklist_results;
create policy apparatus_inspection_checklist_results_select_by_department
on public.apparatus_inspection_checklist_results
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus_inspection_checklist_results.department_id
  )
);

drop policy if exists apparatus_inspection_checklist_results_write_by_service_role on public.apparatus_inspection_checklist_results;
create policy apparatus_inspection_checklist_results_write_by_service_role
on public.apparatus_inspection_checklist_results
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.apparatus_inspection_checklist_items (
  department_id,
  apparatus_id,
  section_name,
  item_label,
  is_required,
  is_active,
  display_order
)
select
  a.department_id,
  a.id,
  seed.section_name,
  seed.item_label,
  true,
  true,
  seed.display_order
from public.apparatus a
cross join (
  values
    ('Cab & Controls', 'Warning lights and sirens operational', 10),
    ('Cab & Controls', 'Radio and communication equipment operational', 20),
    ('Engine & Pump', 'Engine fluids visually checked', 30),
    ('Engine & Pump', 'Pump panel gauges and controls functioning', 40),
    ('Body & Safety', 'Tires and wheel area visually checked', 50),
    ('Body & Safety', 'Scene and safety equipment present and secured', 60),
    ('Readiness', 'Critical inventory compartments secure', 70),
    ('Readiness', 'Apparatus ready for response deployment', 80)
) as seed(section_name, item_label, display_order)
where not exists (
  select 1
  from public.apparatus_inspection_checklist_items existing
  where existing.apparatus_id = a.id
);

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
  v_requester_id uuid;
  v_require_checklist boolean := false;
  v_required_count integer := 0;
  v_completed_required_count integer := 0;
  v_inspection_id uuid;
begin
  select department_id
  into v_department_id
  from public.apparatus
  where id = p_apparatus_id;

  if v_department_id is null then
    raise exception 'No department found for apparatus.';
  end if;

  select m.id
  into v_requester_id
  from public.members m
  where (
      auth.uid() is not null
      and m.auth_user_id = auth.uid()
    )
    or (
      auth.uid() is null
      and lower(m.email) = lower(coalesce(auth.email(), ''))
    )
  order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  select s.require_checklist
  into v_require_checklist
  from public.apparatus_inspection_settings s
  where s.department_id = v_department_id
  limit 1;

  v_require_checklist := coalesce(v_require_checklist, false);

  if v_require_checklist then
    if v_requester_id is null then
      raise exception 'Checklist required: unable to resolve requesting member.';
    end if;

    select count(*)
    into v_required_count
    from public.apparatus_inspection_checklist_items i
    where i.department_id = v_department_id
      and i.apparatus_id = p_apparatus_id
      and i.is_active = true
      and i.is_required = true;

    if v_required_count = 0 then
      raise exception 'Checklist required: no active required checklist items are configured for this apparatus.';
    end if;

    select count(*)
    into v_completed_required_count
    from public.apparatus_inspection_checklist_progress p
    join public.apparatus_inspection_checklist_items i
      on i.id = p.checklist_item_id
     and i.department_id = p.department_id
    where p.department_id = v_department_id
      and p.apparatus_id = p_apparatus_id
      and p.member_id = v_requester_id
      and i.is_active = true
      and i.is_required = true
      and p.status in ('checked', 'deficiency', 'not_applicable');

    if v_completed_required_count < v_required_count then
      raise exception 'Checklist required: complete all required inspection items before submitting.';
    end if;
  end if;

  insert into public.apparatus_inspections (
    apparatus_id,
    department_id,
    member_id,
    status,
    notes,
    mileage,
    engine_hours
  )
  values (
    p_apparatus_id,
    v_department_id,
    v_requester_id,
    p_status,
    p_notes,
    p_mileage,
    p_engine_hours
  )
  returning id into v_inspection_id;

  if v_requester_id is not null then
    insert into public.apparatus_inspection_checklist_results (
      inspection_id,
      department_id,
      apparatus_id,
      checklist_item_id,
      section_name_snapshot,
      item_label_snapshot,
      is_required_snapshot,
      result_status,
      item_order
    )
    select
      v_inspection_id,
      i.department_id,
      i.apparatus_id,
      i.id,
      i.section_name,
      i.item_label,
      i.is_required,
      p.status,
      i.display_order
    from public.apparatus_inspection_checklist_progress p
    join public.apparatus_inspection_checklist_items i
      on i.id = p.checklist_item_id
     and i.department_id = p.department_id
     and i.apparatus_id = p.apparatus_id
    where p.department_id = v_department_id
      and p.apparatus_id = p_apparatus_id
      and p.member_id = v_requester_id
      and i.is_active = true;
  end if;

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