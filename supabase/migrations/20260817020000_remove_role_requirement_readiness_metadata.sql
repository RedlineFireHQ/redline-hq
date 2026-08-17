alter table public.role_required_certifications
  drop constraint if exists role_required_certifications_readiness_weight_nonnegative;

alter table public.role_required_certifications
  drop column if exists contributes_to_readiness,
  drop column if exists readiness_weight_percent;

alter table public.role_required_qualifications
  drop constraint if exists role_required_qualifications_readiness_weight_nonnegative;

alter table public.role_required_qualifications
  drop column if exists contributes_to_readiness,
  drop column if exists readiness_weight_percent;
