-- Require the data needed to substantiate Driver/Operator and
-- Building Familiarization ISO classifications at the database boundary.
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

  if not ('training_facilities' = any(coalesce(new.iso_classifications, '{}'::text[]))) then
    v_credit_level := 'none';
  end if;

  new.iso_facility_credit_level := v_credit_level;
  new.iso_qualifying_facility := v_credit_level <> 'none';

  if 'training_facilities' = any(coalesce(new.iso_classifications, '{}'::text[]))
    and new.iso_facility_credit_level = 'none' then
    raise exception 'Training Facilities ISO credit requires a qualifying facility and a valid agreement for the training date. Station drills do not qualify for this category.';
  end if;

  if 'driver_operator' = any(coalesce(new.iso_classifications, '{}'::text[]))
    and new.iso_driver_operator_training_type is null then
    raise exception 'Select initial or refresher training for ISO Driver / Operator classification.';
  end if;

  if 'building_familiarization' = any(coalesce(new.iso_classifications, '{}'::text[]))
    and new.iso_pre_plan_id is null then
    raise exception 'Select the building pre-plan visited for ISO Building Familiarization.';
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
  department_id, starts_at, iso_classification, iso_classifications, iso_facility_id,
  iso_pre_plan_id, iso_qualifying_facility, iso_facility_type, iso_facility_agreement
on public.training_events
for each row execute function public.sync_training_event_iso_fields();
drop trigger if exists trg_sync_training_event_iso_fields on public.training_events;
create trigger trg_sync_training_event_iso_fields
before insert or update of
  department_id, starts_at, iso_classification, iso_classifications, iso_facility_id,
  iso_pre_plan_id, iso_driver_operator_training_type, iso_qualifying_facility,
  iso_facility_type, iso_facility_agreement
on public.training_events
for each row execute function public.sync_training_event_iso_fields();
