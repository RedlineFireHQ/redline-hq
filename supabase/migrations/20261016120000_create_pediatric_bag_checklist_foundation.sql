-- Pediatric Bags checklist foundation for Red Oak Fire Department.
--
-- Creates dedicated pediatric-bag infrastructure (bags, shared checklist
-- template, per-bag progress, sessions, inspection history, item-result
-- snapshots). Pediatric bags are intentionally NOT modeled as apparatus rows:
-- they are a separate EMS inventory asset type and must not flow into
-- apparatus readiness, maintenance, or inspection features.
--
-- Mirrors the proven apparatus inspection checklist patterns:
--   - department_id on every table, composite FKs, RLS department scoping
--   - SECURITY DEFINER RPCs with fixed search_path, member + department +
--     ownership validation, and EXECUTE granted to authenticated only
--   - snapshot-on-completion history (section/label/quantity frozen at
--     inspection time)
--
-- Seeding is idempotent and scoped to Red Oak only:
--   department id 82f50d14-216a-4dd1-80f4-58459dc97b97
--
-- Source inventory: "#A Pediatric ALS Kit Inventory" (Red Oak FD). Bags A, B,
-- C, D share identical contents, so the checklist template is one shared set
-- per department. Item wording and quantities are preserved verbatim from the
-- source, including "24 X .56 GA IV cath" and the "***" Alcohol Preps
-- quantity (preserved in source_quantity_text with a NULL required_quantity).

-- ---------------------------------------------------------------------------
-- 1. pediatric_bags — the four physical bags (A/B/C/D) per department.
-- ---------------------------------------------------------------------------

create table if not exists public.pediatric_bags (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  bag_label text not null check (bag_label in ('A', 'B', 'C', 'D')),
  display_name text not null check (btrim(display_name) <> ''),
  is_active boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, bag_label)
);

create index if not exists pediatric_bags_department_idx
on public.pediatric_bags (department_id, is_active);

-- Composite foreign keys reference pediatric_bags (id, department_id), which
-- requires a matching unique constraint/index on that exact column set (the
-- same pattern as apparatus_id_department_unique_idx on public.apparatus).
create unique index if not exists pediatric_bags_id_department_unique_idx
on public.pediatric_bags (id, department_id);

-- ---------------------------------------------------------------------------
-- 2. pediatric_bag_checklist_items — ONE shared template per department.
--    All four bags render the same item set. required_quantity is a real
--    integer (nullable); source_quantity_text preserves the verbatim source
--    quantity notation (e.g. "1 each", "2 pak", "***").
-- ---------------------------------------------------------------------------

create table if not exists public.pediatric_bag_checklist_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  section_name text not null check (btrim(section_name) <> ''),
  item_label text not null check (btrim(item_label) <> ''),
  required_quantity integer check (required_quantity is null or required_quantity >= 0),
  source_quantity_text text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pediatric_bag_checklist_items_unique_idx
on public.pediatric_bag_checklist_items (department_id, lower(btrim(section_name)), lower(btrim(item_label)));

create index if not exists pediatric_bag_checklist_items_department_idx
on public.pediatric_bag_checklist_items (department_id, is_active, display_order, created_at);

-- ---------------------------------------------------------------------------
-- 3. pediatric_bag_checklist_sessions — in-progress check session per
--    (member, bag). Enables a reliable atomic completion flow, mirroring
--    apparatus_check_sessions (minus mileage/engine hours).
-- ---------------------------------------------------------------------------

create table if not exists public.pediatric_bag_checklist_sessions (
  id uuid primary key default gen_random_uuid(),
  pediatric_bag_id uuid not null,
  department_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  state text not null default 'in_progress' check (state in ('in_progress', 'completed', 'abandoned', 'expired')),
  selected_result_draft text check (selected_result_draft in ('ready', 'needs_attention', 'out_of_service')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  expired_at timestamptz,
  completed_inspection_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pediatric_bag_checklist_sessions_bag_fk
    foreign key (pediatric_bag_id, department_id)
    references public.pediatric_bags (id, department_id)
    on delete cascade
);

create index if not exists pediatric_bag_checklist_sessions_member_state_idx
on public.pediatric_bag_checklist_sessions (member_id, pediatric_bag_id, state, started_at desc);

create unique index if not exists pediatric_bag_checklist_sessions_one_active_idx
on public.pediatric_bag_checklist_sessions (member_id, pediatric_bag_id)
where state = 'in_progress'
  and completed_at is null
  and abandoned_at is null
  and expired_at is null;

-- ---------------------------------------------------------------------------
-- 4. pediatric_bag_inspections — permanent per-bag completion history.
-- ---------------------------------------------------------------------------

create table if not exists public.pediatric_bag_inspections (
  id uuid primary key default gen_random_uuid(),
  pediatric_bag_id uuid not null,
  department_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  status text not null check (status in ('ready', 'needs_attention', 'out_of_service')),
  notes text,
  created_at timestamptz not null default now(),
  constraint pediatric_bag_inspections_bag_fk
    foreign key (pediatric_bag_id, department_id)
    references public.pediatric_bags (id, department_id)
    on delete cascade
);

create index if not exists pediatric_bag_inspections_bag_idx
on public.pediatric_bag_inspections (department_id, pediatric_bag_id, created_at desc);

create index if not exists pediatric_bag_inspections_member_idx
on public.pediatric_bag_inspections (department_id, member_id, created_at desc);

-- Completed sessions point at their inspection (added now that inspections exists).
alter table public.pediatric_bag_checklist_sessions
drop constraint if exists pediatric_bag_checklist_sessions_completed_inspection_fkey;

alter table public.pediatric_bag_checklist_sessions
add constraint pediatric_bag_checklist_sessions_completed_inspection_fkey
foreign key (completed_inspection_id)
references public.pediatric_bag_inspections (id)
on delete set null;

-- ---------------------------------------------------------------------------
-- 5. pediatric_bag_checklist_progress — live per-item status per (bag, member).
-- ---------------------------------------------------------------------------

create table if not exists public.pediatric_bag_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pediatric_bag_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  checklist_item_id uuid not null references public.pediatric_bag_checklist_items (id) on delete cascade,
  status text not null check (status in ('checked', 'deficiency', 'not_applicable', 'needs_review')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pediatric_bag_checklist_progress_bag_fk
    foreign key (pediatric_bag_id, department_id)
    references public.pediatric_bags (id, department_id)
    on delete cascade,
  unique (department_id, pediatric_bag_id, member_id, checklist_item_id)
);

create index if not exists pediatric_bag_checklist_progress_member_idx
on public.pediatric_bag_checklist_progress (department_id, member_id, pediatric_bag_id);

create index if not exists pediatric_bag_checklist_progress_item_idx
on public.pediatric_bag_checklist_progress (checklist_item_id);

-- ---------------------------------------------------------------------------
-- 6. pediatric_bag_checklist_results — immutable per-item snapshot captured at
--    completion time (section, label, required quantity frozen).
-- ---------------------------------------------------------------------------

create table if not exists public.pediatric_bag_checklist_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.pediatric_bag_inspections (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  pediatric_bag_id uuid not null,
  checklist_item_id uuid references public.pediatric_bag_checklist_items (id) on delete set null,
  section_name_snapshot text not null,
  item_label_snapshot text not null,
  required_quantity_snapshot integer,
  source_quantity_text_snapshot text,
  is_required_snapshot boolean not null,
  result_status text not null check (result_status in ('checked', 'deficiency', 'not_applicable', 'needs_review')),
  item_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint pediatric_bag_checklist_results_bag_fk
    foreign key (pediatric_bag_id, department_id)
    references public.pediatric_bags (id, department_id)
    on delete cascade
);

create index if not exists pediatric_bag_checklist_results_inspection_idx
on public.pediatric_bag_checklist_results (inspection_id, item_order, created_at);

-- ---------------------------------------------------------------------------
-- 7. updated_at triggers.
-- ---------------------------------------------------------------------------

create or replace function public.set_pediatric_bags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_pediatric_bag_checklist_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_pediatric_bag_checklist_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_pediatric_bag_checklist_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pediatric_bags_updated_at on public.pediatric_bags;
create trigger trg_pediatric_bags_updated_at
before update on public.pediatric_bags
for each row
execute function public.set_pediatric_bags_updated_at();

drop trigger if exists trg_pediatric_bag_checklist_items_updated_at on public.pediatric_bag_checklist_items;
create trigger trg_pediatric_bag_checklist_items_updated_at
before update on public.pediatric_bag_checklist_items
for each row
execute function public.set_pediatric_bag_checklist_items_updated_at();

drop trigger if exists trg_pediatric_bag_checklist_sessions_updated_at on public.pediatric_bag_checklist_sessions;
create trigger trg_pediatric_bag_checklist_sessions_updated_at
before update on public.pediatric_bag_checklist_sessions
for each row
execute function public.set_pediatric_bag_checklist_sessions_updated_at();

drop trigger if exists trg_pediatric_bag_checklist_progress_updated_at on public.pediatric_bag_checklist_progress;
create trigger trg_pediatric_bag_checklist_progress_updated_at
before update on public.pediatric_bag_checklist_progress
for each row
execute function public.set_pediatric_bag_checklist_progress_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Row level security. Every policy scopes to the requesting member's own
--    department (via auth.uid()/auth.email() matched to public.members) and,
--    where relevant, to the member's own rows or an administrative permission.
-- ---------------------------------------------------------------------------

alter table public.pediatric_bags enable row level security;
alter table public.pediatric_bag_checklist_items enable row level security;
alter table public.pediatric_bag_checklist_sessions enable row level security;
alter table public.pediatric_bag_inspections enable row level security;
alter table public.pediatric_bag_checklist_progress enable row level security;
alter table public.pediatric_bag_checklist_results enable row level security;

-- pediatric_bags: read by department; manage by administrator or inventory_management.
drop policy if exists pediatric_bags_select_by_department on public.pediatric_bags;
create policy pediatric_bags_select_by_department
on public.pediatric_bags
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bags.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bags_write_by_admin on public.pediatric_bags;
create policy pediatric_bags_write_by_admin
on public.pediatric_bags
for all
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bags.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(pediatric_bags.department_id, 'inventory_management')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bags.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(pediatric_bags.department_id, 'inventory_management')
      )
  )
);

-- pediatric_bag_checklist_items (shared template): read by department; manage by
-- administrator or inventory_management.
drop policy if exists pediatric_bag_checklist_items_select_by_department on public.pediatric_bag_checklist_items;
create policy pediatric_bag_checklist_items_select_by_department
on public.pediatric_bag_checklist_items
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_items.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bag_checklist_items_write_by_admin on public.pediatric_bag_checklist_items;
create policy pediatric_bag_checklist_items_write_by_admin
on public.pediatric_bag_checklist_items
for all
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_items.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(pediatric_bag_checklist_items.department_id, 'inventory_management')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_items.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(pediatric_bag_checklist_items.department_id, 'inventory_management')
      )
  )
);

-- pediatric_bag_checklist_sessions: self-scoped AND department-matched (mirrors
-- the hardened apparatus session policies).
drop policy if exists pediatric_bag_checklist_sessions_select_self on public.pediatric_bag_checklist_sessions;
create policy pediatric_bag_checklist_sessions_select_self
on public.pediatric_bag_checklist_sessions
for select
using (
  exists (
    select 1
    from public.members m
    where m.id = pediatric_bag_checklist_sessions.member_id
      and m.department_id = pediatric_bag_checklist_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bag_checklist_sessions_insert_self on public.pediatric_bag_checklist_sessions;
create policy pediatric_bag_checklist_sessions_insert_self
on public.pediatric_bag_checklist_sessions
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.id = pediatric_bag_checklist_sessions.member_id
      and m.department_id = pediatric_bag_checklist_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bag_checklist_sessions_update_self on public.pediatric_bag_checklist_sessions;
create policy pediatric_bag_checklist_sessions_update_self
on public.pediatric_bag_checklist_sessions
for update
using (
  exists (
    select 1
    from public.members m
    where m.id = pediatric_bag_checklist_sessions.member_id
      and m.department_id = pediatric_bag_checklist_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = pediatric_bag_checklist_sessions.member_id
      and m.department_id = pediatric_bag_checklist_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- pediatric_bag_inspections: read by department; insert by department member.
drop policy if exists pediatric_bag_inspections_select_by_department on public.pediatric_bag_inspections;
create policy pediatric_bag_inspections_select_by_department
on public.pediatric_bag_inspections
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_inspections.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bag_inspections_insert_by_department on public.pediatric_bag_inspections;
create policy pediatric_bag_inspections_insert_by_department
on public.pediatric_bag_inspections
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_inspections.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- pediatric_bag_checklist_progress: select by own rows (or admin/officer/
-- inventory_management); insert/update/delete own rows within the department.
drop policy if exists pediatric_bag_checklist_progress_select_by_department on public.pediatric_bag_checklist_progress;
create policy pediatric_bag_checklist_progress_select_by_department
on public.pediatric_bag_checklist_progress
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_progress.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        m.id = pediatric_bag_checklist_progress.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
        or public.member_has_app_permission(pediatric_bag_checklist_progress.department_id, 'inventory_management')
      )
  )
);

drop policy if exists pediatric_bag_checklist_progress_insert_self on public.pediatric_bag_checklist_progress;
create policy pediatric_bag_checklist_progress_insert_self
on public.pediatric_bag_checklist_progress
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_progress.department_id
      and m.id = pediatric_bag_checklist_progress.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
  and exists (
    select 1
    from public.pediatric_bag_checklist_items i
    where i.id = pediatric_bag_checklist_progress.checklist_item_id
      and i.department_id = pediatric_bag_checklist_progress.department_id
      and i.is_active = true
  )
);

drop policy if exists pediatric_bag_checklist_progress_update_self on public.pediatric_bag_checklist_progress;
create policy pediatric_bag_checklist_progress_update_self
on public.pediatric_bag_checklist_progress
for update
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_progress.department_id
      and m.id = pediatric_bag_checklist_progress.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_progress.department_id
      and m.id = pediatric_bag_checklist_progress.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bag_checklist_progress_delete_self on public.pediatric_bag_checklist_progress;
create policy pediatric_bag_checklist_progress_delete_self
on public.pediatric_bag_checklist_progress
for delete
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_progress.department_id
      and m.id = pediatric_bag_checklist_progress.member_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- pediatric_bag_checklist_results: read by department; insert by department
-- (the completion RPC is the normal write path).
drop policy if exists pediatric_bag_checklist_results_select_by_department on public.pediatric_bag_checklist_results;
create policy pediatric_bag_checklist_results_select_by_department
on public.pediatric_bag_checklist_results
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_results.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pediatric_bag_checklist_results_insert_by_department on public.pediatric_bag_checklist_results;
create policy pediatric_bag_checklist_results_insert_by_department
on public.pediatric_bag_checklist_results
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_checklist_results.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- ---------------------------------------------------------------------------
-- 9. SECURITY DEFINER RPCs. Fixed search_path, member + department + bag
--    ownership validation; EXECUTE granted to authenticated only.
-- ---------------------------------------------------------------------------

create or replace function public.get_or_create_pediatric_bag_check_session(
  p_pediatric_bag_id uuid,
  p_existing_session_id uuid default null,
  p_selected_result text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_bag_id uuid;
  v_department_id uuid;
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_requester_email text;
  v_session_id uuid;
begin
  if p_selected_result is not null and p_selected_result not in ('ready', 'needs_attention', 'out_of_service') then
    raise exception 'Invalid selected result.';
  end if;

  select b.id, b.department_id
  into v_bag_id, v_department_id
  from public.pediatric_bags b
  where b.id = p_pediatric_bag_id
    and b.is_active = true
  limit 1;

  if v_bag_id is null then
    raise exception 'Pediatric bag not found.';
  end if;

  if v_department_id is null then
    raise exception 'No department found for pediatric bag.';
  end if;

  if auth.uid() is not null then
    select m.id, m.department_id
    into v_requester_id, v_requester_department_id
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = v_department_id
      and coalesce(m.active, false) = true
    order by m.id
    limit 1;
  end if;

  if v_requester_id is null then
    select lower(coalesce(u.email, ''))
    into v_requester_email
    from auth.users u
    where u.id = auth.uid()
      and u.deleted_at is null
    limit 1;

    if coalesce(v_requester_email, '') = '' then
      v_requester_email := lower(coalesce(auth.email(), ''));
    end if;

    if coalesce(v_requester_email, '') <> '' then
      select m.id, m.department_id
      into v_requester_id, v_requester_department_id
      from public.members m
      where lower(coalesce(m.email, '')) = v_requester_email
        and m.department_id = v_department_id
        and coalesce(m.active, false) = true
      order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
      limit 1;
    end if;
  end if;

  if v_requester_id is null then
    raise exception 'Unable to resolve requesting member for this pediatric bag department.';
  end if;

  if v_requester_department_id is distinct from v_department_id then
    raise exception 'Requesting member does not belong to the pediatric bag department.';
  end if;

  if p_existing_session_id is not null then
    select s.id
    into v_session_id
    from public.pediatric_bag_checklist_sessions s
    where s.id = p_existing_session_id
      and s.pediatric_bag_id = v_bag_id
      and s.department_id = v_department_id
      and s.member_id = v_requester_id
      and s.state = 'in_progress'
      and s.completed_at is null
      and s.abandoned_at is null
      and s.expired_at is null
    order by s.started_at desc
    limit 1
    for update;

    if v_session_id is not null then
      update public.pediatric_bag_checklist_sessions
      set
        selected_result_draft = coalesce(p_selected_result, selected_result_draft),
        updated_at = now()
      where id = v_session_id;

      return v_session_id;
    end if;
  end if;

  select s.id
  into v_session_id
  from public.pediatric_bag_checklist_sessions s
  where s.pediatric_bag_id = v_bag_id
    and s.department_id = v_department_id
    and s.member_id = v_requester_id
    and s.state = 'in_progress'
    and s.completed_at is null
    and s.abandoned_at is null
    and s.expired_at is null
  order by s.started_at desc
  limit 1
  for update;

  if v_session_id is not null then
    update public.pediatric_bag_checklist_sessions
    set
      selected_result_draft = coalesce(p_selected_result, selected_result_draft),
      updated_at = now()
    where id = v_session_id;

    return v_session_id;
  end if;

  insert into public.pediatric_bag_checklist_sessions (
    pediatric_bag_id,
    department_id,
    member_id,
    state,
    selected_result_draft,
    started_at,
    created_at,
    updated_at
  )
  values (
    v_bag_id,
    v_department_id,
    v_requester_id,
    'in_progress',
    p_selected_result,
    now(),
    now(),
    now()
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.complete_pediatric_bag_check(
  p_session_id uuid,
  p_final_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_session public.pediatric_bag_checklist_sessions%rowtype;
  v_bag_id uuid;
  v_department_id uuid;
  v_requester_id uuid;
  v_requester_department_id uuid;
  v_requester_email text;
  v_required_count integer := 0;
  v_completed_required_count integer := 0;
  v_unresolved_quantity_count integer := 0;
  v_deficiency_count integer := 0;
  v_inspection_id uuid;
begin
  if p_session_id is null then
    raise exception 'Session id is required.';
  end if;

  if p_final_status not in ('ready', 'needs_attention', 'out_of_service') then
    raise exception 'Invalid final inspection status.';
  end if;

  select s.*
  into v_session
  from public.pediatric_bag_checklist_sessions s
  where s.id = p_session_id
  limit 1
  for update;

  if not found then
    raise exception 'Pediatric bag check session not found.';
  end if;

  if v_session.department_id is null then
    raise exception 'Session department is required.';
  end if;

  if auth.uid() is not null then
    select m.id, m.department_id
    into v_requester_id, v_requester_department_id
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = v_session.department_id
      and coalesce(m.active, false) = true
    order by m.id
    limit 1;
  end if;

  if v_requester_id is null then
    select lower(coalesce(u.email, ''))
    into v_requester_email
    from auth.users u
    where u.id = auth.uid()
      and u.deleted_at is null
    limit 1;

    if coalesce(v_requester_email, '') = '' then
      v_requester_email := lower(coalesce(auth.email(), ''));
    end if;

    if coalesce(v_requester_email, '') <> '' then
      select m.id, m.department_id
      into v_requester_id, v_requester_department_id
      from public.members m
      where lower(coalesce(m.email, '')) = v_requester_email
        and m.department_id = v_session.department_id
        and coalesce(m.active, false) = true
      order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
      limit 1;
    end if;
  end if;

  if v_requester_id is null then
    raise exception 'Unable to resolve requesting member for this pediatric bag department.';
  end if;

  if v_requester_department_id is distinct from v_session.department_id then
    raise exception 'Requesting member does not belong to the pediatric bag check department.';
  end if;

  if v_session.member_id is distinct from v_requester_id then
    raise exception 'This pediatric bag check session belongs to a different member.';
  end if;

  if v_session.completed_at is not null or v_session.state = 'completed' then
    return jsonb_build_object(
      'session_id', v_session.id,
      'already_completed', true,
      'inspection_id', v_session.completed_inspection_id,
      'status', p_final_status
    );
  end if;

  if v_session.state in ('abandoned', 'expired')
    or v_session.abandoned_at is not null
    or v_session.expired_at is not null then
    raise exception 'This pediatric bag check session is no longer active.';
  end if;

  select b.id, b.department_id
  into v_bag_id, v_department_id
  from public.pediatric_bags b
  where b.id = v_session.pediatric_bag_id
    and b.is_active = true
  limit 1;

  if v_bag_id is null then
    raise exception 'Pediatric bag not found for this session.';
  end if;

  if v_department_id is distinct from v_session.department_id then
    raise exception 'Session department does not match pediatric bag department.';
  end if;

  -- Completion gating. Two distinct rules keep completion honest:
  --   (1) Every active required item with a CONFIRMED numeric quantity must be
  --       marked (checked / deficiency / not_applicable) before any completion.
  --   (2) An item whose quantity is UNCONFIRMED in the source (required_quantity
  --       IS NULL, e.g. the "***" Alcohol Preps) is a "needs review" item. It can
  --       never be silently satisfied: while any such item remains unresolved,
  --       the bag cannot be completed as fully 'ready'. The only honest outcome
  --       is 'needs_attention' ("Needs Review") until Red Oak confirms the
  --       quantity. Deficiency-marked confirmed items likewise require at least
  --       'needs_attention', never 'ready'.
  select count(*)
  into v_required_count
  from public.pediatric_bag_checklist_items i
  where i.department_id = v_department_id
    and i.is_active = true
    and i.is_required = true
    and i.required_quantity is not null;

  if v_required_count = 0 then
    raise exception 'No active required checklist items with confirmed quantities are configured for this pediatric bag department.';
  end if;

  select count(*)
  into v_completed_required_count
  from public.pediatric_bag_checklist_progress p
  join public.pediatric_bag_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
  where p.department_id = v_department_id
    and p.pediatric_bag_id = v_bag_id
    and p.member_id = v_requester_id
    and i.is_active = true
    and i.is_required = true
    and i.required_quantity is not null
    and p.status in ('checked', 'expired');

  if v_completed_required_count < v_required_count then
    raise exception 'Complete all required checklist items before submitting this pediatric bag check.';
  end if;

  -- Unresolved unknown-quantity items in the active template (e.g. "***" Alcohol
  -- Preps). While any exist, the bag cannot be declared fully Ready for Service.
  select count(*)
  into v_unresolved_quantity_count
  from public.pediatric_bag_checklist_items i
  where i.department_id = v_department_id
    and i.is_active = true
    and i.is_required = true
    and i.required_quantity is null;

  if p_final_status = 'ready' and v_unresolved_quantity_count > 0 then
    raise exception 'Cannot complete as Ready for Service: % required item(s) have an unconfirmed quantity pending review (e.g. Alcohol Preps "***"). Complete as Needs Review until Red Oak confirms the quantity.', v_unresolved_quantity_count;
  end if;

  -- Confirmed items explicitly marked EXPIRED also block 'ready'.
  select count(*)
  into v_deficiency_count
  from public.pediatric_bag_checklist_progress p
  join public.pediatric_bag_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
  where p.department_id = v_department_id
    and p.pediatric_bag_id = v_bag_id
    and p.member_id = v_requester_id
    and i.is_active = true
    and p.status = 'expired';

  if p_final_status = 'ready' and v_deficiency_count > 0 then
    raise exception 'Cannot complete as Ready for Service: % checklist item(s) are marked as expired. Document them and complete as Items Expired instead.', v_deficiency_count;
  end if;

  insert into public.pediatric_bag_inspections (
    pediatric_bag_id,
    department_id,
    member_id,
    status,
    notes
  )
  values (
    v_bag_id,
    v_department_id,
    v_requester_id,
    p_final_status,
    p_notes
  )
  returning id into v_inspection_id;

  insert into public.pediatric_bag_checklist_results (
    inspection_id,
    department_id,
    pediatric_bag_id,
    checklist_item_id,
    section_name_snapshot,
    item_label_snapshot,
    required_quantity_snapshot,
    source_quantity_text_snapshot,
    is_required_snapshot,
    result_status,
    item_order
  )
  select
    v_inspection_id,
    i.department_id,
    v_bag_id,
    i.id,
    i.section_name,
    i.item_label,
    i.required_quantity,
    i.source_quantity_text,
    i.is_required,
    p.status,
    i.display_order
  from public.pediatric_bag_checklist_progress p
  join public.pediatric_bag_checklist_items i
    on i.id = p.checklist_item_id
   and i.department_id = p.department_id
  where p.department_id = v_department_id
    and p.pediatric_bag_id = v_bag_id
    and p.member_id = v_requester_id
    and i.is_active = true;

  update public.pediatric_bag_checklist_sessions
  set
    state = 'completed',
    selected_result_draft = p_final_status,
    completed_at = now(),
    completed_inspection_id = v_inspection_id,
    updated_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'already_completed', false,
    'inspection_id', v_inspection_id,
    'status', p_final_status
  );
end;
$$;

revoke all on function public.get_or_create_pediatric_bag_check_session(uuid, uuid, text) from public;
revoke all on function public.get_or_create_pediatric_bag_check_session(uuid, uuid, text) from anon;
grant execute on function public.get_or_create_pediatric_bag_check_session(uuid, uuid, text) to authenticated;

revoke all on function public.complete_pediatric_bag_check(uuid, text, text) from public;
revoke all on function public.complete_pediatric_bag_check(uuid, text, text) from anon;
grant execute on function public.complete_pediatric_bag_check(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Idempotent seeding — Red Oak Fire Department only.
--     Four bags (A/B/C/D) + the single shared checklist template.
--     Safe to re-run: bags use ON CONFLICT (department_id, bag_label) DO
--     NOTHING; items use a NOT EXISTS guard on the department template.
-- ---------------------------------------------------------------------------

insert into public.pediatric_bags (department_id, bag_label, display_name)
select d.id, seed.bag_label, 'Pediatric Bag ' || seed.bag_label
from public.departments d
cross join (values ('A'), ('B'), ('C'), ('D')) as seed(bag_label)
where d.id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
on conflict (department_id, bag_label) do nothing;

-- Shared checklist template for Red Oak (one row per inventory item, in source
-- order). Inserted only if the department has no pediatric template yet, so
-- re-running never creates duplicates. Quantities: required_quantity holds the
-- confirmed numeric count; source_quantity_text preserves the verbatim source
-- notation. Alcohol Preps has NO confirmed quantity in the source ("***"), so
-- required_quantity is NULL and source_quantity_text is '***'.

insert into public.pediatric_bag_checklist_items (
  department_id,
  section_name,
  item_label,
  required_quantity,
  source_quantity_text,
  display_order
)
select
  seed.department_id,
  seed.section_name,
  seed.item_label,
  seed.required_quantity,
  seed.source_quantity_text,
  seed.display_order
from (
  values
    -- Top-Misc
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', '6.0 ETT', 1, '1', 1),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', '5.0 ETT', 1, '1', 2),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', '4.0 ETT', 1, '1', 3),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', '3.0 ETT', 1, '1', 4),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', '14 Fr Stylette', 1, '1', 5),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', '6 Fr Stylette', 1, '1', 6),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'ECG Electrodes', 2, '2 pak', 7),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'Ped Nasal', 1, '1', 8),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'Infant Nasal', 1, '1', 9),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'Bulb Syringe', 1, '1', 10),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'Magill Forceps', 1, '1', 11),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'ETT Tube Holder', 1, '1', 12),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Top-Misc', 'Laryngoscope Handle', 1, '1', 13),
    -- Back
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Back', 'Infant & Ped B/P', 1, '1 each', 14),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Back', 'Stethoscope', 1, '1', 15),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Back', 'Cheat Sheet', 1, '1', 16),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Back', 'Pulse Ox', 1, '1', 17),
    -- Left
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Left', 'Infant BVM', 1, '1', 18),
    -- Right
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Right', 'Ped BVM', 1, '1', 19),
    -- Front-IV Kits
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Front-IV Kits', 'Arm Boards', 2, '2', 20),
    -- Out — IV Kit #1
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Out — IV Kit #1', '24 GA, 22 GA IV cath', 1, '1 each', 21),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Out — IV Kit #1', '20 GA, 24 X .56 GA IV cath', 1, '1 each', 22),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Out — IV Kit #1', 'Alcohol Preps', 10, '10', 23),
    -- Inside — IV Kit #1
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', 'Roll tape', 1, '1', 24),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', '500ml Normal Saline', 1, '1', 25),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', 'IV Prep kit', 1, '1', 26),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', '60gtt Drip Set', 1, '1', 27),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', '3-way Stopcock, max', 1, '1', 28),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', '60ml Syringe', 1, '1', 29),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', 'STAT lock start kit', 1, '1', 30),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #1', 'IV Extension', 1, '1', 31),
    -- Out — IV Kit #2
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Out — IV Kit #2', '24 GA, 22GA IV cath', 1, '1 each', 32),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Out — IV Kit #2', '20 GA, 24 X .56 GA IV cath', 1, '1 each', 33),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Out — IV Kit #2', 'Alcohol Preps', 10, '10', 34),
    -- Inside — IV Kit #2
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', 'Roll tape', 1, '1', 35),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', '500ml Normal Saline', 1, '1', 36),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', 'IV Prep kit', 1, '1', 37),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', '15 gtt Drip Set', 1, '1', 38),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', '3-way Stopcock, max', 1, '1', 39),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', '60ml Syringe', 1, '1', 40),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', 'STAT lock start kit', 1, '1', 41),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside — IV Kit #2', 'IV Extension', 1, '1', 42),
    -- Inside
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside', 'King 2.0 & 2.5', 1, '1 each', 43),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside', 'Pedi Kits', 7, '7', 44),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside', 'Pedi Wheel', 1, '1', 45),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Inside', 'Sharps container', 1, '1', 46),
    -- Neonate Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Neonate Kit', '30mm & 40mm Oral', 1, '1 each', 47),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Neonate Kit', 'BVM Mask', 1, '1', 48),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Neonate Kit', '2.5 ETT', 1, '1', 49),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Neonate Kit', '3.0 ETT', 1, '1', 50),
    -- 4–7 kg Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '4–7 kg Kit', '40mm & 60mm Oral', 1, '1 each', 51),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '4–7 kg Kit', 'Infant O2 Mask', 1, '1', 52),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '4–7 kg Kit', '6-fr suction cath', 1, '1', 53),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '4–7 kg Kit', '3.5 ETT', 1, '1', 54),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '4–7 kg Kit', '#0 & #1 Miller Blade', 1, '1 each', 55),
    -- 8–11 kg Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '8–11 kg Kit', '60mm Oral', 1, '1', 56),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '8–11 kg Kit', 'Ped NRB mask', 1, '1', 57),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '8–11 kg Kit', '8&10-fr suction cath', 1, '1 each', 58),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '8–11 kg Kit', '4.0 ETT', 1, '1', 59),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '8–11 kg Kit', '10mL syringe', 1, '1', 60),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '8–11 kg Kit', '#1 Miller Blade', 1, '1', 61),
    -- 12–14 kg Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '12–14 kg Kit', '60mm Oral', 1, '1', 62),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '12–14 kg Kit', 'Ped NRB mask', 1, '1', 63),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '12–14 kg Kit', '8&10-fr suction cath', 1, '1 each', 64),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '12–14 kg Kit', '4.5 ETT', 1, '1', 65),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '12–14 kg Kit', '10mL syringe', 1, '1', 66),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '12–14 kg Kit', '#1 Miller, #2 Mac', 1, '1 each', 67),
    -- 14–17 kg Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '14–17 kg Kit', '60mm Oral', 1, '1', 68),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '14–17 kg Kit', 'Ped NRB mask', 1, '1', 69),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '14–17 kg Kit', '10-fr suction cath', 1, '1', 70),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '14–17 kg Kit', '5.0 ETT', 1, '1', 71),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '14–17 kg Kit', '10 mL syringe', 1, '1', 72),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '14–17 kg Kit', '#2 Miller, #2 Mac', 1, '1 each', 73),
    -- 18–22 kg Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', '60mm & 80mm Oral', 1, '1 each', 74),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', 'Ped NRB mask', 1, '1', 75),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', '10-fr suction cath', 1, '1', 76),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', '5.5 ETT', 1, '1', 77),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', 'Stylet, 14-fr', 1, '1', 78),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', '10mL syringe', 1, '1', 79),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '18–22 kg Kit', '#2 Miller, #2 Mac', 1, '1ea', 80),
    -- 24–30 kg Kit
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', '80mm Oral', 1, '1', 81),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', 'Ped NRB mask', 1, '1', 82),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', '10-fr suction cath', 1, '1', 83),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', '6.0 ETT', 1, '1', 84),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', 'Stylet, 14-fr', 1, '1', 85),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', '10mL Syringe', 1, '1', 86),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '24–30 kg Kit', '#3 Miller, #2-3 Mac', 1, '1ea', 87)
) as seed(department_id, section_name, item_label, required_quantity, source_quantity_text, display_order)
where not exists (
  select 1
  from public.pediatric_bag_checklist_items existing
  where existing.department_id = seed.department_id
  limit 1
);
