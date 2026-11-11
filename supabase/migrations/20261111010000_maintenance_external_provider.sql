-- External Provider support for maintenance records.
--
-- Perform Maintenance can now record either a department member (existing
-- completed_by) or an outside person/business (new external_provider_name,
-- e.g. "Jiffy Lube"). Exactly one performer type may be set per record; both
-- columns remain nullable so existing history is untouched (no backfill).

alter table public.maintenance_records
  add column if not exists external_provider_name text;

alter table public.maintenance_records
  drop constraint if exists maintenance_records_single_performer_check;

alter table public.maintenance_records
  add constraint maintenance_records_single_performer_check
  check (completed_by is null or external_provider_name is null);
