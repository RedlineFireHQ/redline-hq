-- Tighten ownership of Redline HQ system categories and snapshot full/partial
-- ISO facility eligibility using the agreement that was valid on the training date.

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
    'ems ce',
    'ems training',
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
  v_role text := coalesce(auth.role(), '');
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
  elsif new.system_key is not null then
    if v_role <> 'service_role' and current_user not in ('postgres','supabase_admin') then
      raise exception 'Only Redline HQ may create or assign system training category keys.';
    end if;
  else
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

-- Run the new-department seeder with owner privileges so the product catalog is
-- provisioned centrally while department users remain unable to assign keys.
create or replace function public.seed_department_system_training_categories()
returns trigger
language plpgsql
security definer
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

create or replace function public.validate_training_facility_agreement_document()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.agreement_document_id is not null and not exists (
    select 1 from public.documents d
    where d.id = new.agreement_document_id
      and d.department_id = new.department_id
  ) then
    raise exception 'The facility agreement document must belong to the same department.';
  end if;

  if new.ownership_type <> 'department_owned'
    and new.formal_agreement = true
    and new.agreement_end_date is not null
    and new.agreement_start_date is not null
    and new.agreement_end_date < new.agreement_start_date then
    raise exception 'Agreement end date cannot be before the agreement start date.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_training_facility_agreement_document on public.training_facilities;
create trigger trg_validate_training_facility_agreement_document
before insert or update on public.training_facilities
for each row execute function public.validate_training_facility_agreement_document();

alter table public.training_events
  add column if not exists iso_facility_credit_level text not null default 'none';

alter table public.training_events
  drop constraint if exists training_events_iso_facility_credit_level_check;
alter table public.training_events
  add constraint training_events_iso_facility_credit_level_check
  check (iso_facility_credit_level in ('full','partial','none'));

create or replace function public.sync_training_event_iso_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_facility public.training_facilities%rowtype;
  v_credit_level text := 'none';
  v_event_date date;
  v_agreement_valid boolean := false;
begin
  v_event_date := new.starts_at::date;

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

    v_agreement_valid :=
      v_facility.ownership_type = 'department_owned'
      or (
        v_facility.formal_agreement = true
        and (nullif(btrim(v_facility.agreement_reference), '') is not null or v_facility.agreement_document_id is not null)
        and (v_facility.agreement_start_date is null or v_facility.agreement_start_date <= v_event_date)
        and (v_facility.agreement_end_date is null or v_facility.agreement_end_date >= v_event_date)
      );

    if v_agreement_valid then
      v_credit_level :=
        case
          when v_facility.facility_type = 'drill_tower' and coalesce(v_facility.tower_stories, 0) >= 3 then 'full'
          when v_facility.facility_type = 'drill_tower' and coalesce(v_facility.tower_stories, 0) = 2 then 'partial'
          when v_facility.facility_type = 'live_fire_burn_building' and v_facility.purpose_built_live_fire then 'full'
          when v_facility.facility_type = 'training_yard' and coalesce(v_facility.yard_acres, 0) >= 2 then 'full'
          when v_facility.facility_type = 'regional_academy' and v_facility.formal_agreement then 'full'
          else 'none'
        end;
    end if;

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
  else
    new.iso_facility_type := null;
    new.iso_facility_agreement := false;
    new.iso_facility_name := null;
    new.iso_facility_location := null;
    new.iso_facility_owner := null;
    new.iso_facility_stories := null;
    new.iso_facility_acres := null;
    new.iso_facility_purpose_built := false;
    new.iso_facility_agreement_reference := null;
    new.iso_facility_agreement_document_id := null;
  end if;

  new.iso_facility_credit_level := v_credit_level;
  new.iso_qualifying_facility := v_credit_level <> 'none';

  if 'training_facilities' = any(coalesce(new.iso_classifications, '{}'::text[]))
    and new.iso_facility_credit_level = 'none' then
    raise exception 'Training Facilities ISO credit requires a qualifying facility and a valid agreement for the training date. Station drills do not qualify for this category.';
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
