-- ============================================================================
-- Notification Center + automatic category-based deficiency assignment
--
-- Creates a reusable per-member notifications table with strict RLS, an
-- automatic category->member assignment trigger for new deficiencies, an
-- assignment-history trigger (preserving readiness aging), and a notification
-- trigger that fires whenever a deficiency is assigned to a member.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Notifications table
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null check (btrim(type) <> ''),
  title text not null check (btrim(title) <> ''),
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_member_read_idx
  on public.notifications (member_id, read_at);

create index if not exists notifications_member_created_idx
  on public.notifications (member_id, created_at desc);

create index if not exists notifications_department_idx
  on public.notifications (department_id);

alter table public.notifications enable row level security;

-- Members can read only their own notifications.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (
  member_id = (select ctx.member_id from public.resolve_requesting_member_access_context() ctx)
);

-- Members can update only their own notifications; the trigger below restricts
-- the change to the read_at column so recipients cannot forge type/title/etc.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
using (
  member_id = (select ctx.member_id from public.resolve_requesting_member_access_context() ctx)
)
with check (
  member_id = (select ctx.member_id from public.resolve_requesting_member_access_context() ctx)
);

-- Restrict updates to the read_at column only.
create or replace function public.notifications_guard_update_read_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.department_id is distinct from old.department_id
    or new.member_id is distinct from old.member_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.href is distinct from old.href
    or new.created_at is distinct from old.created_at then
    raise exception 'Only the read state of a notification can be updated.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifications_guard_update on public.notifications;
create trigger trg_notifications_guard_update
before update on public.notifications
for each row
execute function public.notifications_guard_update_read_only();

-- Authenticated users may only SELECT and UPDATE (read_at). INSERT/DELETE are
-- intentionally not granted so notifications can only be created by trusted
-- database logic. New tables receive broad default grants in this project, so
-- explicitly revoke everything from each non-owner role before granting the
-- minimal set.
revoke all on table public.notifications from public;
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select, update (read_at) on table public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Automatic category-based deficiency assignment (BEFORE INSERT)
-- ---------------------------------------------------------------------------

create or replace function public.assign_deficiency_from_category_rule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_responsible_member_id uuid;
begin
  -- Never overwrite an explicitly supplied assignee.
  if new.assigned_to is not null then
    return new;
  end if;

  -- Resolve the department the same way the existing system does, since
  -- client-side creation does not explicitly provide department_id.
  v_department_id := coalesce(
    new.department_id,
    public.resolve_deficiency_department_id_from_links(
      new.apparatus_id,
      new.fire_hose_id,
      new.scba_cylinder_id,
      new.scba_pack_id,
      new.pie_equipment_id,
      new.ems_equipment_id,
      new.ppe_item_id,
      new.rope_item_id,
      new.fire_extinguisher_id,
      new.misc_fire_equipment_id,
      new.gas_monitor_id,
      new.battery_id,
      new.thermal_imaging_camera_id,
      new.ground_ladder_id,
      new.reported_by
    )
  );

  -- Persist the resolved department so downstream behavior stays consistent.
  if new.department_id is null and v_department_id is not null then
    new.department_id := v_department_id;
  end if;

  if v_department_id is null or new.category_id is null then
    return new;
  end if;

  select dns.member_id
  into v_responsible_member_id
  from public.deficiency_notification_settings dns
  join public.members m
    on m.id = dns.member_id
   and coalesce(m.active, false) = true
  where dns.department_id = v_department_id
    and dns.category_id = new.category_id
    and dns.active = true
  order by dns.created_at asc
  limit 1;

  if v_responsible_member_id is not null then
    new.assigned_to := v_responsible_member_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deficiency_auto_assign_category on public.deficiencies;
create trigger trg_deficiency_auto_assign_category
before insert on public.deficiencies
for each row
execute function public.assign_deficiency_from_category_rule();

-- ---------------------------------------------------------------------------
-- Assignment history (preserves readiness aging clock)
-- ---------------------------------------------------------------------------

create or replace function public.log_deficiency_assignment_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_name text;
begin
  if new.assigned_to is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then
    return new;
  end if;

  select trim(concat_ws(' ', m.first_name, m.last_name))
  into v_member_name
  from public.members m
  where m.id = new.assigned_to
  limit 1;

  insert into public.deficiency_history (
    deficiency_id,
    member_id,
    event_type,
    event_description
  ) values (
    new.id,
    new.assigned_to,
    'Assigned',
    'Assigned to ' || coalesce(nullif(v_member_name, ''), 'a department member') || '.'
  );

  return new;
end;
$$;

drop trigger if exists trg_deficiency_assignment_history on public.deficiencies;
create trigger trg_deficiency_assignment_history
after insert or update of assigned_to on public.deficiencies
for each row
execute function public.log_deficiency_assignment_history();

-- ---------------------------------------------------------------------------
-- Notification on assignment
-- ---------------------------------------------------------------------------

create or replace function public.notify_deficiency_assigned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_category_name text;
  v_label text;
begin
  if new.assigned_to is null then
    return new;
  end if;

  -- Only notify when assigned_to actually changes (handles A -> B reassignment,
  -- skips unchanged updates).
  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then
    return new;
  end if;

  v_department_id := coalesce(
    new.department_id,
    public.resolve_deficiency_department_id_from_links(
      new.apparatus_id,
      new.fire_hose_id,
      new.scba_cylinder_id,
      new.scba_pack_id,
      new.pie_equipment_id,
      new.ems_equipment_id,
      new.ppe_item_id,
      new.rope_item_id,
      new.fire_extinguisher_id,
      new.misc_fire_equipment_id,
      new.gas_monitor_id,
      new.battery_id,
      new.thermal_imaging_camera_id,
      new.ground_ladder_id,
      new.reported_by
    )
  );

  if v_department_id is null then
    return new;
  end if;

  select c.name
  into v_category_name
  from public.deficiency_categories c
  where c.id = new.category_id
  limit 1;

  v_label := coalesce(
    nullif(new.deficiency_number, ''),
    nullif(new.description, ''),
    'a deficiency'
  );

  insert into public.notifications (
    department_id,
    member_id,
    type,
    title,
    body,
    href
  ) values (
    v_department_id,
    new.assigned_to,
    'deficiency_assigned',
    'Deficiency Assigned to You',
    trim(both ' ' from concat_ws(' ',
      coalesce(v_category_name, 'Deficiency') || ' deficiency assigned to you:',
      v_label
    )) || '.',
    '/operations/deficiencies/' || new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_deficiency_assigned_notification on public.deficiencies;
create trigger trg_deficiency_assigned_notification
after insert or update of assigned_to on public.deficiencies
for each row
execute function public.notify_deficiency_assigned();
