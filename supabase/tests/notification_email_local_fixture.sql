\set ON_ERROR_STOP on

-- A deliberately minimal disposable database, never a customer database.
do $$
begin
  if current_database() <> 'notification_email_test' then
    raise exception 'This fixture is restricted to the disposable notification_email_test database';
  end if;
end;
$$;

create role anon;
create role authenticated;
create role service_role bypassrls;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.departments (id uuid primary key, name text not null);
create table public.members (
  id uuid primary key, department_id uuid references public.departments(id),
  first_name text, last_name text, active boolean, email text
);
create table public.deficiency_categories (id uuid primary key, name text);
create table public.deficiency_priorities (id uuid primary key, name text);
create table public.deficiency_notification_settings (
  id uuid primary key, department_id uuid, category_id uuid, member_id uuid,
  active boolean, created_at timestamptz default now()
);
create table public.deficiencies (
  id uuid primary key, department_id uuid, category_id uuid, assigned_to uuid,
  description text, priority uuid references public.deficiency_priorities(id), deficiency_number text,
  reported_by uuid default '20000000-0000-0000-0000-000000000001',
  apparatus_id uuid, fire_hose_id uuid, scba_cylinder_id uuid, scba_pack_id uuid,
  pie_equipment_id uuid, ems_equipment_id uuid, ppe_item_id uuid, rope_item_id uuid,
  fire_extinguisher_id uuid, misc_fire_equipment_id uuid, gas_monitor_id uuid,
  battery_id uuid, thermal_imaging_camera_id uuid, ground_ladder_id uuid,
  asset_id uuid, portable_radio_id uuid, portable_radio_mic_id uuid, pager_id uuid,
  inspection_id uuid, check_session_id uuid
);
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'apparatus', 'assets', 'fire_hose', 'scba_cylinders', 'scba_packs',
    'pie_equipment', 'ems_equipment', 'ppe_items', 'rope_items', 'fire_extinguishers',
    'misc_fire_equipment', 'gas_monitors', 'batteries', 'thermal_imaging_cameras',
    'ground_ladders', 'portable_radios', 'portable_radio_mics', 'pagers',
    'apparatus_inspections', 'apparatus_check_sessions'
  ] loop
    execute format('create table public.%I (id uuid primary key, department_id uuid references public.departments(id))', v_table);
  end loop;
end;
$$;
create table public.deficiency_history (
  id uuid default gen_random_uuid(), deficiency_id uuid, member_id uuid,
  event_type text, event_description text
);
create function public.resolve_requesting_member_access_context()
returns table(member_id uuid) language sql as $$
  select nullif(current_setting('notification_test.member_id', true), '')::uuid
$$;
create function public.resolve_deficiency_department_id_from_links(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
)
returns uuid language sql as $$
  select coalesce(
    (select department_id from public.apparatus where id = $1),
    (select department_id from public.members where id = $15)
  )
$$;

\ir ../migrations/20260908130000_notification_center_and_deficiency_auto_assign.sql
\ir ../migrations/20261102210000_queue_deficiency_assignment_emails.sql
\ir notification_assignment_emails.sql
