alter table public.certifications
  add column if not exists ems_authority text,
  add column if not exists ems_certification_level text;

alter table public.certifications
  drop constraint if exists certifications_ems_authority_valid;

alter table public.certifications
  add constraint certifications_ems_authority_valid
  check (
    ems_authority is null
    or ems_authority in ('iowa', 'nremt')
  );

alter table public.certifications
  drop constraint if exists certifications_ems_certification_level_valid;

alter table public.certifications
  add constraint certifications_ems_certification_level_valid
  check (
    ems_certification_level is null
    or ems_certification_level in ('emr', 'emt', 'aemt', 'paramedic')
  );

alter table public.certifications
  drop constraint if exists certifications_ems_metadata_pairing;

alter table public.certifications
  add constraint certifications_ems_metadata_pairing
  check (
    (ems_authority is null and ems_certification_level is null)
    or (ems_authority is not null and ems_certification_level is not null)
  );

create index if not exists certifications_department_ems_type_idx
on public.certifications (department_id, ems_authority, ems_certification_level)
where ems_authority is not null;
