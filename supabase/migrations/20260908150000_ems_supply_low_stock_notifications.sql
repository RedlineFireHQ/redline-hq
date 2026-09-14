-- ============================================================================
-- EMS Supplies low-stock notifications
--
-- Adds a generic per-department notification recipient table (reusable by
-- future notification types) and a trigger that notifies the configured
-- member when an active EMS supply crosses from above its reorder threshold
-- to at or below it. Uses edge detection so repeated draw-downs stay quiet.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Generic recipient configuration
-- ---------------------------------------------------------------------------

create table if not exists public.department_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  notification_type text not null check (btrim(notification_type) <> ''),
  member_id uuid not null references public.members (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, notification_type)
);

create index if not exists department_notification_recipients_department_idx
  on public.department_notification_recipients (department_id, notification_type);

create or replace function public.set_department_notification_recipients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_department_notification_recipients_updated_at
  on public.department_notification_recipients;
create trigger trg_department_notification_recipients_updated_at
before update on public.department_notification_recipients
for each row
execute function public.set_department_notification_recipients_updated_at();

alter table public.department_notification_recipients enable row level security;

-- Department members can read their own department's configuration (Settings UI).
drop policy if exists department_notification_recipients_select_by_department
  on public.department_notification_recipients;
create policy department_notification_recipients_select_by_department
on public.department_notification_recipients
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_notification_recipients.department_id
  )
);

-- Writes require the existing settings_management permission.
-- member_has_app_permission preserves the administrator bypass.
drop policy if exists department_notification_recipients_insert_by_settings_manager
  on public.department_notification_recipients;
create policy department_notification_recipients_insert_by_settings_manager
on public.department_notification_recipients
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists department_notification_recipients_update_by_settings_manager
  on public.department_notification_recipients;
create policy department_notification_recipients_update_by_settings_manager
on public.department_notification_recipients
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists department_notification_recipients_delete_by_settings_manager
  on public.department_notification_recipients;
create policy department_notification_recipients_delete_by_settings_manager
on public.department_notification_recipients
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- ---------------------------------------------------------------------------
-- Low-stock notification trigger
-- ---------------------------------------------------------------------------

create or replace function public.notify_ems_supply_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient_member_id uuid;
  v_quantity_text text;
  v_threshold_text text;
begin
  if coalesce(new.status, '') <> 'Active' then
    return new;
  end if;

  -- Edge detection: only fire on the transition into low stock. Items already
  -- at or below their threshold stay quiet until replenished and crossed again.
  if not (
    old.quantity_on_hand > old.reorder_threshold
    and new.quantity_on_hand <= new.reorder_threshold
  ) then
    return new;
  end if;

  select dnr.member_id
  into v_recipient_member_id
  from public.department_notification_recipients dnr
  join public.members m
    on m.id = dnr.member_id
   and coalesce(m.active, false) = true
  where dnr.department_id = new.department_id
    and dnr.notification_type = 'ems_supply_low_stock'
    and dnr.active = true
  limit 1;

  if v_recipient_member_id is null then
    return new;
  end if;

  v_quantity_text := trim_scale(new.quantity_on_hand)::text;
  v_threshold_text := trim_scale(new.reorder_threshold)::text;

  insert into public.notifications (
    department_id,
    member_id,
    type,
    title,
    body,
    href
  ) values (
    new.department_id,
    v_recipient_member_id,
    'ems_supply_low_stock',
    'EMS Supply Low',
    new.item_name || ' is at ' || v_quantity_text
      || ' (reorder threshold ' || v_threshold_text || ').',
    '/inventory/ems-supplies'
  );

  return new;
end;
$$;

drop trigger if exists trg_ems_supply_low_stock_notification on public.ems_supply_items;
create trigger trg_ems_supply_low_stock_notification
after update of quantity_on_hand on public.ems_supply_items
for each row
execute function public.notify_ems_supply_low_stock();
