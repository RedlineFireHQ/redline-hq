alter table public.role_required_certifications
  add column if not exists contributes_to_readiness boolean not null default false,
  add column if not exists readiness_weight_percent numeric(6,2) not null default 0;

alter table public.role_required_certifications
  drop constraint if exists role_required_certifications_readiness_weight_nonnegative;

alter table public.role_required_certifications
  add constraint role_required_certifications_readiness_weight_nonnegative
  check (readiness_weight_percent >= 0);

alter table public.role_required_qualifications
  add column if not exists contributes_to_readiness boolean not null default false,
  add column if not exists readiness_weight_percent numeric(6,2) not null default 0;

alter table public.role_required_qualifications
  drop constraint if exists role_required_qualifications_readiness_weight_nonnegative;

alter table public.role_required_qualifications
  add constraint role_required_qualifications_readiness_weight_nonnegative
  check (readiness_weight_percent >= 0);
