create table if not exists public.ems_supply_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  item_name text not null,
  item_category text,
  unit_of_measure text not null,
  custom_unit_of_measure text,
  quantity_on_hand numeric(12,2) not null default 0,
  reorder_threshold numeric(12,2) not null default 0,
  critical_threshold numeric(12,2),
  target_quantity numeric(12,2),
  location text,
  notes text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  qr_identifier text not null unique,
  created_by_member_id uuid references public.members (id) on delete set null,
  updated_by_member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(item_name) <> ''),
  check (btrim(qr_identifier) <> ''),
  check (
    unit_of_measure in (
      'each',
      'box',
      'bag',
      'case',
      'bottle',
      'vial',
      'pair',
      'roll',
      'kit',
      'liter',
      'milliliter',
      'custom'
    )
  ),
  check (
    (
      unit_of_measure = 'custom'
      and custom_unit_of_measure is not null
      and btrim(custom_unit_of_measure) <> ''
    )
    or (
      unit_of_measure <> 'custom'
      and (
        custom_unit_of_measure is null
        or btrim(custom_unit_of_measure) = ''
      )
    )
  ),
  check (quantity_on_hand >= 0),
  check (reorder_threshold >= 0),
  check (critical_threshold is null or critical_threshold >= 0),
  check (target_quantity is null or target_quantity >= 0)
);

create index if not exists ems_supply_items_department_idx
on public.ems_supply_items (department_id);

create index if not exists ems_supply_items_item_name_idx
on public.ems_supply_items (item_name);

create index if not exists ems_supply_items_item_category_idx
on public.ems_supply_items (item_category);

create index if not exists ems_supply_items_status_idx
on public.ems_supply_items (status);

create table if not exists public.ems_supply_transactions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('Checkout', 'Restock', 'Return', 'Correction')),
  performed_by_member_id uuid references public.members (id) on delete set null,
  destination_type text check (destination_type in ('Apparatus', 'Station', 'SupplyRoom', 'Other', 'None')),
  destination_apparatus_id uuid references public.apparatus (id) on delete set null,
  destination_label text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    destination_type is null
    or (
      destination_type = 'None'
      and destination_apparatus_id is null
      and destination_label is null
    )
    or (
      destination_type = 'Apparatus'
      and destination_apparatus_id is not null
    )
    or (
      destination_type in ('Station', 'SupplyRoom', 'Other')
      and destination_apparatus_id is null
      and destination_label is not null
      and btrim(destination_label) <> ''
    )
  )
);

create index if not exists ems_supply_transactions_department_occurred_idx
on public.ems_supply_transactions (department_id, occurred_at desc);

create index if not exists ems_supply_transactions_type_idx
on public.ems_supply_transactions (transaction_type);

create table if not exists public.ems_supply_transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ems_supply_transactions (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  supply_item_id uuid not null references public.ems_supply_items (id) on delete restrict,
  unit_of_measure text not null,
  quantity_delta numeric(12,2) not null,
  quantity_before numeric(12,2) not null,
  quantity_after numeric(12,2) not null,
  created_at timestamptz not null default now(),
  check (btrim(unit_of_measure) <> ''),
  check (quantity_before >= 0),
  check (quantity_after >= 0),
  check (quantity_after = quantity_before + quantity_delta)
);

create index if not exists ems_supply_transaction_items_transaction_idx
on public.ems_supply_transaction_items (transaction_id);

create index if not exists ems_supply_transaction_items_department_idx
on public.ems_supply_transaction_items (department_id);

create index if not exists ems_supply_transaction_items_supply_item_idx
on public.ems_supply_transaction_items (supply_item_id);

create table if not exists public.ems_supply_adjustments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  supply_item_id uuid not null references public.ems_supply_items (id) on delete restrict,
  adjusted_by_member_id uuid references public.members (id) on delete set null,
  old_quantity numeric(12,2) not null,
  new_quantity numeric(12,2) not null,
  reason text not null,
  notes text,
  adjustment_source text not null default 'ManualCountCorrection',
  transaction_id uuid references public.ems_supply_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  check (old_quantity >= 0),
  check (new_quantity >= 0),
  check (btrim(reason) <> ''),
  check (btrim(adjustment_source) <> '')
);

create index if not exists ems_supply_adjustments_department_created_idx
on public.ems_supply_adjustments (department_id, created_at desc);

create index if not exists ems_supply_adjustments_supply_item_idx
on public.ems_supply_adjustments (supply_item_id);

create unique index if not exists ems_supply_adjustments_transaction_id_unique_idx
on public.ems_supply_adjustments (transaction_id)
where transaction_id is not null;

create table if not exists public.ems_equipment (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  equipment_name text not null,
  equipment_type text,
  manufacturer text,
  model text,
  serial_number text,
  equipment_number text,
  purchase_date date,
  status text not null default 'Unassigned' check (status in ('In Service', 'Unassigned', 'Out of Service', 'Lost', 'Stolen', 'Retired')),
  location text,
  notes text,
  qr_identifier text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(equipment_name) <> ''),
  check (qr_identifier is null or btrim(qr_identifier) <> '')
);

create index if not exists ems_equipment_department_idx
on public.ems_equipment (department_id);

create index if not exists ems_equipment_department_status_idx
on public.ems_equipment (department_id, status);

create unique index if not exists ems_equipment_department_serial_number_unique_idx
on public.ems_equipment (department_id, serial_number)
where serial_number is not null and btrim(serial_number) <> '';

create unique index if not exists ems_equipment_department_equipment_number_unique_idx
on public.ems_equipment (department_id, equipment_number)
where equipment_number is not null and btrim(equipment_number) <> '';

create table if not exists public.ems_equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  ems_equipment_id uuid not null references public.ems_equipment (id) on delete cascade,
  assignment_type text not null check (assignment_type in ('Apparatus', 'Station', 'Equipment', 'Unassigned')),
  apparatus_id uuid references public.apparatus (id) on delete set null,
  station_name text,
  equipment_reference text,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by_member_id uuid references public.members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (assignment_type = 'Apparatus' and apparatus_id is not null and station_name is null and equipment_reference is null)
    or (
      assignment_type = 'Station'
      and apparatus_id is null
      and station_name is not null
      and btrim(station_name) <> ''
      and equipment_reference is null
    )
    or (
      assignment_type = 'Equipment'
      and apparatus_id is null
      and station_name is null
      and equipment_reference is not null
      and btrim(equipment_reference) <> ''
    )
    or (
      assignment_type = 'Unassigned'
      and apparatus_id is null
      and station_name is null
      and equipment_reference is null
    )
  ),
  check (ended_at is null or ended_at >= assigned_at)
);

create index if not exists ems_equipment_assignments_department_idx
on public.ems_equipment_assignments (department_id);

create index if not exists ems_equipment_assignments_equipment_idx
on public.ems_equipment_assignments (ems_equipment_id);

create index if not exists ems_equipment_assignments_apparatus_idx
on public.ems_equipment_assignments (apparatus_id)
where apparatus_id is not null;

create index if not exists ems_equipment_assignments_open_lookup_idx
on public.ems_equipment_assignments (ems_equipment_id, ended_at)
where ended_at is null;

create unique index if not exists ems_equipment_assignments_one_open_per_equipment_idx
on public.ems_equipment_assignments (ems_equipment_id)
where ended_at is null;

create or replace function public.set_ems_supply_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ems_supply_items_updated_at on public.ems_supply_items;
create trigger trg_ems_supply_items_updated_at
before update on public.ems_supply_items
for each row
execute function public.set_ems_supply_items_updated_at();

create or replace function public.set_ems_equipment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ems_equipment_updated_at on public.ems_equipment;
create trigger trg_ems_equipment_updated_at
before update on public.ems_equipment
for each row
execute function public.set_ems_equipment_updated_at();

alter table public.ems_supply_items enable row level security;
alter table public.ems_supply_transactions enable row level security;
alter table public.ems_supply_transaction_items enable row level security;
alter table public.ems_supply_adjustments enable row level security;
alter table public.ems_equipment enable row level security;
alter table public.ems_equipment_assignments enable row level security;

drop policy if exists ems_supply_items_select_by_department on public.ems_supply_items;
create policy ems_supply_items_select_by_department
on public.ems_supply_items
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_items.department_id
  )
);

drop policy if exists ems_supply_items_insert_by_department on public.ems_supply_items;
create policy ems_supply_items_insert_by_department
on public.ems_supply_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_items.department_id
  )
);

drop policy if exists ems_supply_items_update_by_department on public.ems_supply_items;
create policy ems_supply_items_update_by_department
on public.ems_supply_items
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_items.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_items.department_id
  )
);

drop policy if exists ems_supply_items_delete_by_department on public.ems_supply_items;
create policy ems_supply_items_delete_by_department
on public.ems_supply_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_items.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_supply_transactions_select_by_department on public.ems_supply_transactions;
create policy ems_supply_transactions_select_by_department
on public.ems_supply_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transactions.department_id
  )
);

drop policy if exists ems_supply_transactions_insert_by_department on public.ems_supply_transactions;
create policy ems_supply_transactions_insert_by_department
on public.ems_supply_transactions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transactions.department_id
  )
);

drop policy if exists ems_supply_transactions_update_by_department on public.ems_supply_transactions;
create policy ems_supply_transactions_update_by_department
on public.ems_supply_transactions
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transactions.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transactions.department_id
  )
);

drop policy if exists ems_supply_transactions_delete_by_department on public.ems_supply_transactions;
create policy ems_supply_transactions_delete_by_department
on public.ems_supply_transactions
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transactions.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_supply_transaction_items_select_by_department on public.ems_supply_transaction_items;
create policy ems_supply_transaction_items_select_by_department
on public.ems_supply_transaction_items
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transaction_items.department_id
  )
);

drop policy if exists ems_supply_transaction_items_insert_by_department on public.ems_supply_transaction_items;
create policy ems_supply_transaction_items_insert_by_department
on public.ems_supply_transaction_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transaction_items.department_id
  )
);

drop policy if exists ems_supply_transaction_items_update_by_department on public.ems_supply_transaction_items;
create policy ems_supply_transaction_items_update_by_department
on public.ems_supply_transaction_items
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transaction_items.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transaction_items.department_id
  )
);

drop policy if exists ems_supply_transaction_items_delete_by_department on public.ems_supply_transaction_items;
create policy ems_supply_transaction_items_delete_by_department
on public.ems_supply_transaction_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_transaction_items.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_supply_adjustments_select_by_department on public.ems_supply_adjustments;
create policy ems_supply_adjustments_select_by_department
on public.ems_supply_adjustments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_adjustments.department_id
  )
);

drop policy if exists ems_supply_adjustments_insert_by_department_admin on public.ems_supply_adjustments;
create policy ems_supply_adjustments_insert_by_department_admin
on public.ems_supply_adjustments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_adjustments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_supply_adjustments_update_by_department_admin on public.ems_supply_adjustments;
create policy ems_supply_adjustments_update_by_department_admin
on public.ems_supply_adjustments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_adjustments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_adjustments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_supply_adjustments_delete_by_department_admin on public.ems_supply_adjustments;
create policy ems_supply_adjustments_delete_by_department_admin
on public.ems_supply_adjustments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_adjustments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_equipment_select_by_department on public.ems_equipment;
create policy ems_equipment_select_by_department
on public.ems_equipment
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment.department_id
  )
);

drop policy if exists ems_equipment_insert_by_department on public.ems_equipment;
create policy ems_equipment_insert_by_department
on public.ems_equipment
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment.department_id
  )
);

drop policy if exists ems_equipment_update_by_department on public.ems_equipment;
create policy ems_equipment_update_by_department
on public.ems_equipment
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment.department_id
  )
);

drop policy if exists ems_equipment_delete_by_department on public.ems_equipment;
create policy ems_equipment_delete_by_department
on public.ems_equipment
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ems_equipment_assignments_select_by_department on public.ems_equipment_assignments;
create policy ems_equipment_assignments_select_by_department
on public.ems_equipment_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment_assignments.department_id
  )
);

drop policy if exists ems_equipment_assignments_insert_by_department on public.ems_equipment_assignments;
create policy ems_equipment_assignments_insert_by_department
on public.ems_equipment_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment_assignments.department_id
  )
);

drop policy if exists ems_equipment_assignments_update_by_department on public.ems_equipment_assignments;
create policy ems_equipment_assignments_update_by_department
on public.ems_equipment_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment_assignments.department_id
  )
);

drop policy if exists ems_equipment_assignments_delete_by_department on public.ems_equipment_assignments;
create policy ems_equipment_assignments_delete_by_department
on public.ems_equipment_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_equipment_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);
