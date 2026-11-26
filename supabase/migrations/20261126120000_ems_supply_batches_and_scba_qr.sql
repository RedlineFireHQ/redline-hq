-- EMS batch-level expiration tracking and stable SCBA pack QR identifiers.
-- Additive only: existing aggregate EMS quantities and inspection history remain intact.

create table if not exists public.ems_supply_batches (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  supply_item_id uuid not null references public.ems_supply_items (id) on delete cascade,
  lot_number text,
  quantity_received numeric(12,2) not null check (quantity_received > 0),
  quantity_remaining numeric(12,2) not null check (quantity_remaining >= 0),
  expiration_date date,
  received_at timestamptz not null default now(),
  storage_location text,
  notes text,
  created_by_member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ems_supply_batches_quantity_bound check (quantity_remaining <= quantity_received)
);

create index if not exists ems_supply_batches_department_expiration_idx
  on public.ems_supply_batches (department_id, expiration_date)
  where quantity_remaining > 0;

create index if not exists ems_supply_batches_supply_item_idx
  on public.ems_supply_batches (supply_item_id, expiration_date);

create or replace function public.validate_ems_supply_batch_department()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.ems_supply_items s
    where s.id = new.supply_item_id
      and s.department_id = new.department_id
  ) then
    raise exception 'EMS supply batch must belong to the same department as its supply item.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_ems_supply_batch_department on public.ems_supply_batches;
create trigger trg_validate_ems_supply_batch_department
before insert or update on public.ems_supply_batches
for each row execute function public.validate_ems_supply_batch_department();

alter table public.ems_supply_batches enable row level security;

drop policy if exists ems_supply_batches_select_by_department on public.ems_supply_batches;
create policy ems_supply_batches_select_by_department
on public.ems_supply_batches for select to authenticated
using (
  exists (
    select 1 from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_batches.department_id
  )
);

drop policy if exists ems_supply_batches_insert_by_department on public.ems_supply_batches;
create policy ems_supply_batches_insert_by_department
on public.ems_supply_batches for insert to authenticated
with check (
  exists (
    select 1 from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_batches.department_id
  )
  and exists (
    select 1 from public.ems_supply_items s
    where s.id = ems_supply_batches.supply_item_id
      and s.department_id = ems_supply_batches.department_id
  )
);

drop policy if exists ems_supply_batches_update_by_department on public.ems_supply_batches;
create policy ems_supply_batches_update_by_department
on public.ems_supply_batches for update to authenticated
using (
  exists (
    select 1 from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_batches.department_id
  )
)
with check (
  exists (
    select 1 from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_batches.department_id
  )
  and exists (
    select 1 from public.ems_supply_items s
    where s.id = ems_supply_batches.supply_item_id
      and s.department_id = ems_supply_batches.department_id
  )
);

drop policy if exists ems_supply_batches_delete_by_department_admin on public.ems_supply_batches;
create policy ems_supply_batches_delete_by_department_admin
on public.ems_supply_batches for delete to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_supply_batches.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

grant select, insert, update, delete on public.ems_supply_batches to authenticated;

alter table public.scba_packs
  add column if not exists qr_identifier text;

update public.scba_packs
set qr_identifier = 'scba-pack:' || id::text
where qr_identifier is null or btrim(qr_identifier) = '';

create unique index if not exists scba_packs_qr_identifier_unique_idx
  on public.scba_packs (qr_identifier)
  where qr_identifier is not null;

comment on table public.ems_supply_batches is
  'Batch-level EMS supply quantities and expiration dates. Legacy aggregate stock remains valid until departments record batches.';
comment on column public.scba_packs.qr_identifier is
  'Stable opaque identifier used to resolve a QR code to this department-scoped SCBA pack.';
