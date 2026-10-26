-- ===========================================================================
-- FOUNDATION BASELINE — VERIFIED AGAINST PRODUCTION COLUMN EXPORT
-- ===========================================================================
-- PURPOSE:
--   These 12 tables were created by hand in the production Supabase project
--   BEFORE migration history began. No migration creates them, yet later
--   migrations ALTER/REFERENCE them, so a fresh database cannot replay the
--   migration history without this baseline.
--
-- SOURCE OF TRUTH:
--   Every column below (name, data type, nullability, default) is transcribed
--   1:1 from the production column export:
--     redline-production-columns-complete.csv (1,543 public columns).
--   Only columns belonging to each table's PRE-MIGRATION state are defined
--   here. Columns added later by committed migrations (e.g. members.role,
--   members.auth_user_id, departments.latitude, deficiencies photo_path and
--   per-inventory link columns, certifications description/active/...,
--   apparatus check_frequency/mileage/engine_hours + later spec columns,
--   apparatus_inspections mileage/engine_hours) are intentionally OMITTED
--   here because the migration history adds them with correct definitions.
--
--   HOW THE SPLIT WAS DERIVED: for each foundation table, columns named in a
--   later migration's `alter table ... add column` were excluded; everything
--   remaining is the pre-migration base defined below.
--
-- SAFETY DESIGN:
--   * Idempotent throughout (IF NOT EXISTS / guarded DO blocks): running this
--     against production is a no-op.
--   * The post-check block at the bottom FAILS LOUDLY if any table the later
--     migrations rely on is missing columns.
--
-- KNOWN GAPS — DELIBERATELY NOT INVENTED (staging runbook must cover these):
--   1. (RECOVERED 2026-10-25) public.generate_deficiency_number() and its
--      sequence public.deficiency_number_seq are now restored verbatim from
--      production below. The sequence intentionally starts at 1 here — this
--      baseline is for fresh databases; production's counter continues from
--      its own existing sequence (this statement is a no-op there).
--   2. CHECK constraints and non-default indexes originally created by hand
--      on these tables (migrations layer their own on top; anything else is
--      unknown).
--   3. (RECOVERED 2026-10-25) Seed ROWS for deficiency lookup tables are now
--      handled by 20260701010000_seed_deficiency_lookup_reference_values.sql
--      with production values and UUIDs.
--   4. Original GRANT / RLS-enabled state of these tables at creation
--      (current state is enforced by later migrations regardless).
-- ===========================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid(); required by migration 001

-- ---------------------------------------------------------------------------
-- departments — production: 8 columns; latitude/longitude and
-- restrict_deficiency_resolution are added by 20260909160000 / 20260912270000
-- as `add column if not exists` (safe no-ops). All 8 are defined here so the
-- baseline alone reflects the verified production export.
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id                             uuid primary key default gen_random_uuid(),
  name                           text not null,
  city                           text,
  state                          text,
  created_at                     timestamptz default now(),
  latitude                       numeric,  -- also added by 20260909160000
  longitude                      numeric,  -- also added by 20260909160000
  restrict_deficiency_resolution boolean not null default false  -- also added by 20260912270000
);

-- ---------------------------------------------------------------------------
-- members — production: 19 columns. Columns that later migrations add via
-- `add column if not exists` are still defined here so the baseline alone
-- matches the verified production export (the migrations then no-op):
--   role (20260808), department_role_id (20260816000000),
--   auth_user_id (20260817030000), special_permissions_enabled (20260820060000),
--   hire_start_date / inactive_date (20260826143000).
-- Legacy free-text `certifications` and `status` columns exist in production
-- (text, nullable) — kept; the export is authoritative.
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id                         uuid primary key default gen_random_uuid(),
  department_id              uuid,
  first_name                 text not null,
  last_name                  text not null,
  rank                       text default 'Firefighter'::text,
  email                      text,
  phone                      text,
  active                     boolean default true,
  created_at                 timestamptz default now(),
  role                       text not null default 'Firefighter'::text,  -- constraint added by 20260808
  status                     text,
  certifications             text,
  station                    text,
  shift                      text,
  department_role_id         uuid,   -- FK to department_roles wired by 20260816000000
  auth_user_id               uuid,   -- FK to auth.users wired by 20260817030000
  special_permissions_enabled boolean not null default false,  -- 20260820060000
  hire_start_date            date,   -- 20260826143000
  inactive_date              date    -- 20260826143000
);

-- ---------------------------------------------------------------------------
-- certifications — production: 11 columns, ALL defined here (the migrations
-- cited per column use `add column if not exists` and therefore no-op on top
-- of this baseline).
-- ---------------------------------------------------------------------------
create table if not exists public.certifications (
  id                       uuid primary key default gen_random_uuid(),
  department_id            uuid not null,
  name                     text not null,
  created_at               timestamptz not null default now(),
  description              text,          -- 20260814020000
  active                   boolean not null default true,  -- 20260814020000
  created_by               uuid,          -- 20260814020000 (FK to members wired there)
  updated_by               uuid,          -- 20260814020000 (FK to members wired there)
  updated_at               timestamptz not null default now(),  -- 20260814020000
  ems_authority            text,          -- 20260827143000
  ems_certification_level  text           -- 20260827143000
);

-- ---------------------------------------------------------------------------
-- deficiency lookup tables — production column sets below.
-- ---------------------------------------------------------------------------
create table if not exists public.deficiency_categories (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text,
  description    text,
  display_order  bigint default 0,
  active         boolean default true
);

create table if not exists public.deficiency_statuses (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null,
  description    text,
  display_order  integer not null,
  active         boolean not null default true
);

create table if not exists public.deficiency_priorities (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null,
  description    text,
  display_order  integer not null,
  active         boolean not null default true
);

-- ---------------------------------------------------------------------------
-- apparatus — production: 43 columns, ALL defined here verbatim from the
-- export. The later migrations cited per column use `add column if not exists`
-- and no-op on top of this baseline.
-- ---------------------------------------------------------------------------
create table if not exists public.apparatus (
  id                             uuid primary key default gen_random_uuid(),
  department_id                  uuid,
  name                           text not null,
  type                           text,
  year                           integer,
  make                           text,
  model                          text,
  radio_number                   text,
  active                         boolean default true,
  created_at                     timestamptz default now(),
  status                         text not null default 'ready'::text,
  last_inspection_at             timestamptz,
  last_inspected_by              uuid,
  notes                          text,
  pump_oil                       text,
  generator_oil                  text,
  oil_type                       text,
  oil_capacity                   text,
  oil_filter_part_number         text,
  fuel_filter_part_number        text,
  air_filter_part_number         text,
  hydraulic_fluid                text,
  transmission_fluid             text,
  coolant_type                   text,
  belt_numbers                   text,
  battery_type                   text,
  tire_size                      text,
  other_common_parts             text,
  check_frequency                text,       -- 20260818010000
  mileage                        integer,    -- 20260818010000
  engine_hours                   numeric,    -- 20260818010000 (numeric(10,1) there)
  include_in_department_readiness boolean not null default true,  -- 20260819020000
  out_of_service_source          text,       -- 20260823190000
  lifecycle_status               text not null default 'active'::text,  -- 20260901020000
  vin                            text,       -- 20260807010000
  pump_capacity                  numeric,    -- 20260807010000
  water_tank_capacity            numeric,    -- 20260807010000
  checklist_required_override    boolean,    -- 20260917120000
  oil_plug_size                  text,       -- 20261020120000
  cabin_air_filter_part_number   text,       -- 20261020120000
  bay_schedule_id                uuid,       -- 20261021130000
  job_number                     text,       -- 20261021140000
  checklist_instructions         text        -- 20261022120000
);

-- ---------------------------------------------------------------------------
-- deficiencies — production: 37 columns, ALL defined here verbatim from the
-- export. Per-inventory link columns were added by later migrations
-- (20260809010000 fire_hose_id, 20260810 scba_cylinder_id, 20260811 scba_pack_id,
-- 20260811235900 battery_id, 20260812 pie_equipment_id, 20260813
-- ground_ladder_id, 20260823120000-era radio/TIC/gas columns, 20260823213000
-- inspection_id + check_session_id, 20260825060000 ems_equipment_id,
-- 20260825071000 ppe_item_id, 20260825* rope_item_id, 20260826120000
-- fire_extinguisher_id, 20260826130000 misc_fire_equipment_id, 20260918130000
-- pager_id) — all use `add column if not exists` and no-op on this baseline.
-- Base (18 columns), including legacy columns that exist in production
-- (asset_id, location, reported_by, resolved_by, repair_notes, updated_at)
-- — kept because the export is authoritative, and later migrations/code
-- reference reported_by/resolved_by/repair_notes.
--
-- deficiency_number: production type is TEXT with default
-- generate_deficiency_number(). Both the function and its sequence were
-- recovered verbatim from production on 2026-10-25 (pg_get_functiondef).
-- Format: DEF-<year>-<four-digit counter>, e.g. DEF-2026-0001.
-- ---------------------------------------------------------------------------
create sequence if not exists public.deficiency_number_seq;

create or replace function public.generate_deficiency_number()
returns text
language plpgsql
as $$
declare
    next_number bigint;
begin
    next_number := nextval('deficiency_number_seq');

    return 'DEF-' ||
           extract(year from current_date)::text ||
           '-' ||
           lpad(next_number::text, 4, '0');
end;
$$;

create table if not exists public.deficiencies (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  department_id      uuid,
  deficiency_number  text default public.generate_deficiency_number(),
  apparatus_id       uuid,
  asset_id           uuid,
  priority           uuid references public.deficiency_priorities (id) on delete set null,
  status             uuid references public.deficiency_statuses (id) on delete set null,
  description        text,
  location           text,
  reported_by        uuid,
  reported_at        timestamptz,
  resolved_by        uuid,
  resolved_at        timestamptz,
  repair_notes       text,
  updated_at         timestamptz default now(),
  category_id        uuid references public.deficiency_categories (id) on delete set null,
  assigned_to        uuid,
  photo_path         text,  -- 20260803
  fire_hose_id       uuid,  -- 20260809010000
  scba_cylinder_id   uuid,  -- 20260810
  scba_pack_id       uuid,  -- 20260811
  portable_radio_id  uuid,  -- 20260825* radio foundation
  portable_radio_mic_id uuid,
  thermal_imaging_camera_id uuid,
  gas_monitor_id     uuid,
  battery_id         uuid,  -- 20260811235900
  pie_equipment_id   uuid,  -- 20260812
  ground_ladder_id   uuid,  -- 20260813
  inspection_id      uuid,  -- 20260823213000 (FK to apparatus_inspections wired there)
  check_session_id   uuid,  -- 20260823213000
  ems_equipment_id   uuid,  -- 20260825060000
  ppe_item_id        uuid,  -- 20260825071000
  rope_item_id       uuid,  -- 20260825* rope foundation
  fire_extinguisher_id uuid,  -- 20260826120000
  misc_fire_equipment_id uuid,  -- 20260826130000
  pager_id           uuid   -- 20260918130000
);

-- ---------------------------------------------------------------------------
-- apparatus_inspections — production: 9 columns, ALL defined here
-- (mileage/engine_hours also added by 20260818010000 — no-op on this baseline).
-- ---------------------------------------------------------------------------
create table if not exists public.apparatus_inspections (
  id             uuid primary key default gen_random_uuid(),
  apparatus_id   uuid not null references public.apparatus (id) on delete cascade,
  department_id  uuid not null,
  member_id      uuid,
  status         text not null,
  notes          text,
  created_at     timestamptz not null default now(),
  mileage        integer,      -- 20260818010000
  engine_hours   numeric       -- 20260818010000 (numeric(10,1) there)
);

-- ---------------------------------------------------------------------------
-- deficiency_history — production: 6 columns (verbatim):
-- ---------------------------------------------------------------------------
create table if not exists public.deficiency_history (
  id                uuid primary key default gen_random_uuid(),
  deficiency_id     uuid not null,
  event_type        text not null,
  event_description text,
  member_id         uuid,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- deficiency_notification_settings — production: 6 columns.
-- Primary key is bigint. Production auto-generates it (the Cedar Bluff seed
-- inserts without an id and succeeds there; the 2026-10-25 replay confirmed
-- a bare bigint PK fails). `generated by default as identity` reproduces that
-- behavior and is the minimal faithful definition.
-- ---------------------------------------------------------------------------
create table if not exists public.deficiency_notification_settings (
  id             bigint primary key generated by default as identity,
  created_at     timestamptz not null default now(),
  department_id  uuid,
  category_id    uuid,
  member_id      uuid,
  active         boolean default true
);

-- ---------------------------------------------------------------------------
-- daily_checks (LEGACY) — production: 16 columns; referenced by migration
-- 001 (inspection_results.daily_check_id bigint references daily_checks(id)).
-- Unused by the current app, but must exist for a full history replay.
-- id is a plain bigint in the export with NO default — the original sequence
-- mechanism is unknown; defined with an identity default so inserts work
-- (production-origin sequences cannot be confirmed from the repo).
-- ---------------------------------------------------------------------------
create table if not exists public.daily_checks (
  id                 bigint primary key generated by default as identity,
  created_at         timestamptz not null default now(),
  apparatus_id       uuid,
  check_date         date,
  fuel               boolean default false,
  oil                boolean default false,
  coolant            boolean default false,
  tires              boolean default false,
  emergency_lights   boolean default false,
  warning_lights     boolean default false,
  radios             boolean default false,
  medical_equipment  boolean default false,
  pump_panel         boolean default false,
  water_tank         boolean default false,
  notes              text,
  completed_by       text
);

-- ===========================================================================
-- POST-CHECK — fail loudly if the baseline is insufficient for the migrations
-- that follow. Each assertion names the migration that requires the column.
-- ===========================================================================
do $$
declare
  missing text;
begin
  with required(table_name, column_name, required_by) as (
    values
      ('departments', 'name',          '20260909130000'),
      ('members',     'department_id', '20260821093000'),
      ('members',     'email',         '20260817030000'),
      ('members',     'active',        '20260821093000'),
      ('apparatus',   'department_id', '20260818010000 (id,department_id) unique idx'),
      ('apparatus',   'status',        '20260823190000'),
      ('deficiencies','assigned_to',   '20260908130000 (trigger target)'),
      ('deficiencies','category_id',   '20260908130000'),
      ('deficiencies','status',        '20260904103000'),
      ('deficiency_categories',  'name',          '20260918130000'),
      ('deficiency_categories',  'display_order', '20260918130000'),
      ('deficiency_statuses',    'name',          '20260904103000'),
      ('deficiency_statuses',    'display_order', '20260904103000'),
      ('deficiency_statuses',    'active',        '20260904103000'),
      ('deficiency_history',     'deficiency_id', '20260908130000'),
      ('deficiency_history',     'event_type',    '20260908130000'),
      ('deficiency_notification_settings', 'category_id', '20260908130000'),
      ('deficiency_notification_settings', 'active',      '20260908130000'),
      ('certifications',         'department_id', '20260814020000'),
      ('certifications',         'name',          '20260814020000'),
      ('apparatus_inspections',  'apparatus_id',  '20260818010000'),
      ('daily_checks',           'id',            '20260720 inspection_results FK')
  )
  select string_agg(r.table_name || '.' || r.column_name || ' (needed by ' || r.required_by || ')', '; ')
    into missing
  from required r
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = r.table_name
      and c.column_name = r.column_name
  );

  if missing is not null then
    raise exception 'FOUNDATION BASELINE INCOMPLETE — missing columns: %', missing;
  end if;
end $$;

-- ===========================================================================
-- END OF FOUNDATION BASELINE
-- ===========================================================================
