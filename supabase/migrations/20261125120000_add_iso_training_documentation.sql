alter table public.training_events
  add column if not exists iso_classification text,
  add column if not exists iso_qualifying_facility boolean not null default false,
  add column if not exists iso_facility_type text,
  add column if not exists iso_facility_agreement boolean not null default false;

alter table public.training_events
  drop constraint if exists training_events_iso_classification_check;
alter table public.training_events
  add constraint training_events_iso_classification_check
  check (iso_classification is null or iso_classification in (
    'training_facilities', 'company_training', 'officer_training',
    'driver_operator', 'hazmat', 'recruit', 'building_familiarization'
  ));

alter table public.training_events
  drop constraint if exists training_events_iso_facility_type_check;
alter table public.training_events
  add constraint training_events_iso_facility_type_check
  check (iso_facility_type is null or iso_facility_type in (
    'drill_tower', 'live_fire_burn_building', 'training_yard',
    'regional_academy', 'other'
  ));

alter table public.training_events
  drop constraint if exists training_events_iso_facility_details_check;
alter table public.training_events
  add constraint training_events_iso_facility_details_check
  check (
    not iso_qualifying_facility
    or (
      iso_classification = 'training_facilities'
      and iso_facility_type is not null
      and (iso_facility_type <> 'regional_academy' or iso_facility_agreement)
    )
  );

comment on column public.training_events.iso_classification is
  'Single ISO documentation classification for this training record; does not replace the regular training category.';
comment on column public.training_events.iso_qualifying_facility is
  'Whether this session took place at a qualifying ISO training facility.';
comment on column public.training_events.iso_facility_type is
  'Facility type selected when the session is marked as qualifying ISO facility training.';
comment on column public.training_events.iso_facility_agreement is
  'Whether a formal agreement is documented for a regional academy or other external facility where required.';
