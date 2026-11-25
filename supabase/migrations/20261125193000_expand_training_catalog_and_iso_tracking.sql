-- System-owned training catalog, reusable qualifying facilities, and
-- structured ISO training documentation. Existing training/event/member rows
-- and category IDs are preserved.
--
-- Temporarily replace the earlier EMS-only guard so existing EMS aliases can
-- be normalized safely before the final catalog guard is installed.
drop trigger if exists trg_protect_system_training_categories on public.training_categories;

-- Preserve duplicate legacy EMS categories and their foreign keys, but stop
-- them being offered for new entries. Historical rows keep their original IDs.
update public.training_categories
set name = 'EMS Continuing Education (Legacy)',
    active = false,
    system_key = 'legacy_ems_continuing_education'
where system_key is null
  and lower(btrim(name)) = 'ems continuing education'
  and exists (
    select 1 from public.training_categories canonical
    where canonical.department_id = training_categories.department_id
      and canonical.system_key = 'ems_continuing_education'
  );

-- Normalize the existing EMS category label without changing its ID.
update public.training_categories
set name = 'EMS Continuing Education',
    compliance_bucket = 'ems_ce',
    active = true
where system_key = 'ems_continuing_education';

-- Adopt existing department categories into the shared product catalog where
-- names already match a standard. Their IDs are retained.
with desired(system_key, standard_name, compliance_bucket, aliases) as (
  values
    ('fire_training', 'Fire Training', 'fire_annual', array['fire training']),
    ('driver_operator', 'Driver/Operator', 'fire_annual', array['driver/operator','driver operator','drivers/operators']),
    ('hazmat', 'HazMat', 'fire_annual', array['hazmat','hazardous materials']),
    ('incident_command', 'Incident Command', 'fire_annual', array['incident command','incident command/leadership','incident command & leadership']),
    ('officer_development', 'Officer Development', 'fire_annual', array['officer development','officer training']),
    ('building_familiarization', 'Building Familiarization / Pre-Planning', 'fire_annual', array['building familiarization','building familiarization / pre-planning','pre-plans / site visits','preplans','pre-plans']),
    ('recruit_training', 'Recruit Training', 'fire_annual', array['recruit training','recruit']),
    ('safety', 'Safety', 'fire_annual', array['safety','safety/ppe','safety & ppe','safety and ppe']),
    ('other_training', 'Other Training', 'other', array['other','other training'])
),
candidates as (
  select
    c.id,
    c.department_id,
    d.system_key,
    d.standard_name,
    d.compliance_bucket,
    row_number() over (
      partition by c.department_id, d.system_key
      order by
        (lower(btrim(c.name)) = lower(d.standard_name)) desc,
        c.created_at asc,
        c.id
    ) as position
  from public.training_categories c
  join desired d on lower(btrim(c.name)) = any(d.aliases)
  where c.system_key is null
    and not exists (
      select 1 from public.training_categories existing
      where existing.department_id = c.department_id
        and existing.system_key = d.system_key
    )
)
update public.training_categories c
set system_key = candidates.system_key,
    name = candidates.standard_name,
    compliance_bucket = candidates.compliance_bucket,
    active = true
from candidates
where c.id = candidates.id
  and candidates.position = 1;

-- Seed the complete standard catalog for every existing department. Existing
-- custom categories remain untouched.
with standard_categories(system_key, name, description, compliance_bucket, sort_order) as (
  values
    ('fire_training', 'Fire Training', 'General fire-service training and skills development.', 'fire_annual', 10),
    ('ems_continuing_education', 'EMS Continuing Education', 'Standard Redline HQ EMS continuing education category. Use the EMS topic selector to classify credit.', 'ems_ce', 20),
    ('driver_operator', 'Driver/Operator', 'Apparatus driving, pump operations, water supply, and operator qualification.', 'fire_annual', 30),
    ('hazmat', 'HazMat', 'Hazardous materials awareness, operations, and annual refresher training.', 'fire_annual', 40),
    ('incident_command', 'Incident Command', 'Incident command, size-up, tactics, and incident management.', 'fire_annual', 50),
    ('officer_development', 'Officer Development', 'Company officer and chief officer leadership development.', 'fire_annual', 60),
    ('building_familiarization', 'Building Familiarization / Pre-Planning', 'Building visits, pre-incident planning, and property familiarization.', 'fire_annual', 70),
    ('recruit_training', 'Recruit Training', 'Structured initial training for new members.', 'fire_annual', 80),
    ('safety', 'Safety', 'Firefighter safety, PPE, SCBA, and risk management training.', 'fire_annual', 90),
    ('other_training', 'Other Training', 'Training that does not belong in another standard category.', 'other', 100)
)
insert into public.training_categories (
  department_id, name, description, active, compliance_bucket, system_key
)
select d.id, s.name, s.description, true, s.compliance_bucket, s.system_key
from public.departments d
cross join standard_categories s
where not exists (
  select 1 from public.training_categories c
  where c.department_id = d.id and c.system_key = s.system_key
)
and not exists (
  select 1 from public.training_categories c
  where c.department_id = d.id and lower(btrim(c.name)) = lower(s.name)
);

-- Protect all Redline HQ categories, not just EMS. Departments may add custom
-- categories, but cannot rename, disable, delete, move, or reclassify standards.
create or replace function public.protect_system_training_categories()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reserved_names text[] := array[
    'fire training',
    'ems continuing education',
    'ems',
    'driver/operator',
    'driver operator',
    'hazmat',
    'hazardous materials',
    'incident command',
    'officer development',
    'officer training',
    'building familiarization',
    'building familiarization / pre-planning',
    'pre-plans / site visits',
    'preplans',
    'pre-plans',
    'recruit training',
    'recruit',
    'safety',
    'safety/ppe',
    'safety & ppe',
    'safety and ppe',
    'other training',
    'other'
  ];
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then
      raise exception 'Redline HQ standard training categories cannot be deleted.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.system_key is not null then
    if new.system_key is distinct from old.system_key
      or new.department_id is distinct from old.department_id
      or new.name is distinct from old.name
      or new.active is distinct from old.active
      or new.compliance_bucket is distinct from old.compliance_bucket then
      raise exception 'Redline HQ standard training categories cannot be renamed, deactivated, moved, or reclassified.';
    end if;
  elsif new.system_key is null then
    if new.compliance_bucket = 'ems_ce' then
      raise exception 'EMS Continuing Education is a Redline HQ standard category. Departments may add custom categories but cannot create or replace the EMS category.';
    end if;
    if lower(btrim(new.name)) = any(v_reserved_names) then
      raise exception 'This name is reserved for a Redline HQ standard training category.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_protect_system_training_categories
before insert or update or delete on public.training_categories
for each row execute function public.protect_system_training_categories();

-- New departments receive the same ten standard categories automatically.
create or replace function public.seed_department_system_training_categories()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.training_categories (
    department_id, name, description, active, compliance_bucket, system_key
  )
  values
    (new.id, 'Fire Training', 'General fire-service training and skills development.', true, 'fire_annual', 'fire_training'),
    (new.id, 'EMS Continuing Education', 'Standard Redline HQ EMS continuing education category. Use the EMS topic selector to classify credit.', true, 'ems_ce', 'ems_continuing_education'),
    (new.id, 'Driver/Operator', 'Apparatus driving, pump operations, water supply, and operator qualification.', true, 'fire_annual', 'driver_operator'),
    (new.id, 'HazMat', 'Hazardous materials awareness, operations, and annual refresher training.', true, 'fire_annual', 'hazmat'),
    (new.id, 'Incident Command', 'Incident command, size-up, tactics, and incident management.', true, 'fire_annual', 'incident_command'),
    (new.id, 'Officer Development', 'Company officer and chief officer leadership development.', true, 'fire_annual', 'officer_development'),
    (new.id, 'Building Familiarization / Pre-Planning', 'Building visits, pre-incident planning, and property familiarization.', true, 'fire_annual', 'building_familiarization'),
    (new.id, 'Recruit Training', 'Structured initial training for new members.', true, 'fire_annual', 'recruit_training'),
    (new.id, 'Safety', 'Firefighter safety, PPE, SCBA, and risk management training.', true, 'fire_annual', 'safety'),
    (new.id, 'Other Training', 'Training that does not belong in another standard category.', true, 'other', 'other_training')
  on conflict (department_id, system_key) where system_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_department_system_training_categories on public.departments;
create trigger trg_seed_department_system_training_categories
after insert on public.departments
for each row execute function public.seed_department_system_training_categories();

-- Reusable department-owned, neighboring-department, and regional academy
-- facility directory. A non-owned facility requires a documented formal
-- agreement. Qualifying thresholds follow the supplied ISO quick guide.
create table if not exists public.training_facilities (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  facility_type text not null check (facility_type in ('drill_tower','live_fire_burn_building','training_yard','regional_academy','other')),
  ownership_type text not null default 'department_owned' check (ownership_type in ('department_owned','neighboring_department','regional_academy')),
  address text,
  city text,
  state text,
  zip text,
  tower_stories integer check (tower_stories is null or tower_stories between 1 and 100),
  yard_acres numeric(8,2) check (yard_acres is null or yard_acres >= 0),
  purpose_built_live_fire boolean not null default false,
  formal_agreement boolean not null default false,
  agreement_reference text,
  agreement_start_date date,
  agreement_end_date date,
  agreement_document_id uuid references public.documents(id) on delete set null,
  active boolean not null default true,
  created_by uuid references public.members(id) on delete set null,
  updated_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, id),
  check (
    ownership_type = 'department_owned'
    or (
      formal_agreement = true
      and (nullif(btrim(agreement_reference), '') is not null or agreement_document_id is not null)
      and (agreement_end_date is null or agreement_start_date is null or agreement_end_date >= agreement_start_date)
    )
  )
);

create index if not exists training_facilities_department_active_idx
  on public.training_facilities(department_id, active, name);

alter table public.training_facilities enable row level security;

drop policy if exists training_facilities_select_by_department_member on public.training_facilities;
create policy training_facilities_select_by_department_member
on public.training_facilities for select to authenticated
using (
  department_id in (
    select m.department_id from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists training_facilities_insert_by_training_manager on public.training_facilities;
create policy training_facilities_insert_by_training_manager
on public.training_facilities for insert to authenticated
with check (
  public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
);

drop policy if exists training_facilities_update_by_training_manager on public.training_facilities;
create policy training_facilities_update_by_training_manager
on public.training_facilities for update to authenticated
using (
  public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
)
with check (
  public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
);

drop policy if exists training_facilities_delete_by_training_manager on public.training_facilities;
create policy training_facilities_delete_by_training_manager
on public.training_facilities for delete to authenticated
using (
  public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
);

alter table public.training_events
  add column if not exists iso_classifications text[] not null default '{}',
  add column if not exists iso_facility_id uuid,
  add column if not exists iso_facility_name text,
  add column if not exists iso_facility_location text,
  add column if not exists iso_facility_owner text,
  add column if not exists iso_facility_stories integer,
  add column if not exists iso_facility_acres numeric(8,2),
  add column if not exists iso_facility_purpose_built boolean not null default false,
  add column if not exists iso_facility_agreement_reference text,
  add column if not exists iso_facility_agreement_document_id uuid references public.documents(id) on delete set null,
  add column if not exists iso_driver_operator_training_type text,
  add column if not exists iso_pre_plan_id uuid references public.pre_plans(id) on delete set null;

alter table public.training_events
  drop constraint if exists training_events_iso_facility_details_check;
alter table public.training_events
  add constraint training_events_iso_facility_details_check
  check (
    iso_qualifying_facility = false
    or (
      'training_facilities' = any(iso_classifications)
      and iso_facility_type is not null
      and (iso_facility_type <> 'regional_academy' or iso_facility_agreement = true)
    )
  );

alter table public.training_events
  add constraint training_events_iso_classifications_check
  check (
    iso_classifications <@ array[
      'training_facilities',
      'company_training',
      'officer_training',
      'driver_operator',
      'hazmat',
      'recruit',
      'building_familiarization'
    ]::text[]
  );

alter table public.training_events
  add constraint training_events_iso_driver_operator_training_type_check
  check (iso_driver_operator_training_type is null or iso_driver_operator_training_type in ('initial','refresher'));

alter table public.training_events
  add constraint training_events_iso_facility_id_department_fk
  foreign key (department_id, iso_facility_id)
  references public.training_facilities(department_id, id)
  on delete restrict;

alter table public.pre_plans
  add column if not exists iso_high_hazard boolean not null default false;

-- Copy existing single ISO classifications into the new multi-classification
-- array without changing their historical primary classification.
update public.training_events
set iso_classifications = array[iso_classification]
where iso_classification is not null
  and cardinality(iso_classifications) = 0;

-- Keep the legacy single value and the new multi-value field synchronized.
create or replace function public.sync_training_event_iso_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_facility public.training_facilities%rowtype;
  v_qualifies boolean := false;
begin
  if cardinality(coalesce(new.iso_classifications, '{}'::text[])) = 0 and new.iso_classification is not null then
    new.iso_classifications := array[new.iso_classification];
  elsif cardinality(coalesce(new.iso_classifications, '{}'::text[])) > 0 then
    new.iso_classification := new.iso_classifications[1];
  end if;

  if new.iso_facility_id is not null then
    select * into v_facility
    from public.training_facilities f
    where f.id = new.iso_facility_id
      and f.department_id = new.department_id
      and f.active = true;

    if not found then
      raise exception 'Select an active training facility belonging to this department.';
    end if;

    v_qualifies :=
      case
        when v_facility.ownership_type <> 'department_owned'
          and (v_facility.formal_agreement is distinct from true
            or (nullif(btrim(v_facility.agreement_reference), '') is null and v_facility.agreement_document_id is null))
          then false
        when v_facility.facility_type = 'drill_tower' then coalesce(v_facility.tower_stories, 0) >= 2
        when v_facility.facility_type = 'live_fire_burn_building' then v_facility.purpose_built_live_fire
        when v_facility.facility_type = 'training_yard' then coalesce(v_facility.yard_acres, 0) >= 2
        when v_facility.facility_type = 'regional_academy' then v_facility.formal_agreement
        else false
      end;

    new.iso_facility_type := v_facility.facility_type;
    new.iso_facility_agreement := v_facility.formal_agreement;
    new.iso_facility_name := v_facility.name;
    new.iso_facility_location := concat_ws(', ', v_facility.address, v_facility.city, v_facility.state, v_facility.zip);
    new.iso_facility_owner := v_facility.ownership_type;
    new.iso_facility_stories := v_facility.tower_stories;
    new.iso_facility_acres := v_facility.yard_acres;
    new.iso_facility_purpose_built := v_facility.purpose_built_live_fire;
    new.iso_facility_agreement_reference := v_facility.agreement_reference;
    new.iso_facility_agreement_document_id := v_facility.agreement_document_id;
    new.iso_qualifying_facility := v_qualifies;
  else
    new.iso_qualifying_facility := false;
  end if;

  if 'training_facilities' = any(coalesce(new.iso_classifications, '{}'::text[]))
    and new.iso_qualifying_facility is distinct from true then
    raise exception 'Training Facilities ISO credit requires a qualifying facility. Station drills do not qualify for this category.';
  end if;

  if 'building_familiarization' = any(coalesce(new.iso_classifications, '{}'::text[]))
    and new.iso_pre_plan_id is not null
    and not exists (
      select 1 from public.pre_plans p
      where p.id = new.iso_pre_plan_id
        and p.department_id = new.department_id
        and p.lifecycle_status = 'active'
    ) then
    raise exception 'Select an active pre-plan belonging to this department.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_training_event_iso_fields on public.training_events;
create trigger trg_sync_training_event_iso_fields
before insert or update of
  department_id, iso_classification, iso_classifications, iso_facility_id,
  iso_pre_plan_id, iso_qualifying_facility, iso_facility_type, iso_facility_agreement
on public.training_events
for each row execute function public.sync_training_event_iso_fields();

create index if not exists training_events_iso_classification_idx
  on public.training_events(department_id, starts_at, iso_classification)
  where iso_classification is not null;
create index if not exists training_events_iso_facility_idx
  on public.training_events(department_id, iso_facility_id)
  where iso_facility_id is not null;
create index if not exists training_events_iso_pre_plan_idx
  on public.training_events(department_id, iso_pre_plan_id)
  where iso_pre_plan_id is not null;
