-- Explicit per-category training compliance classification.
--
-- Replaces fragile keyword matching as the authority for whether a training
-- category counts toward Fire (ISO/annual) hours, EMS continuing education,
-- or Other training. Every category keeps its own identity and all hours
-- always count toward total training hours; this classification only controls
-- the Fire/EMS/Other compliance grouping.
--
-- The seed below reproduces the current keyword-based classification exactly,
-- so existing compliance numbers do not shift on deploy. Department
-- administrators can then correct individual categories (for example
-- classifying "Vehicle Extrication" as Fire) from Settings; application code
-- falls back to the legacy keyword matcher only when compliance_bucket is
-- NULL (for example, rows created before this column is populated).

alter table public.training_categories
  add column if not exists compliance_bucket text;

alter table public.training_categories
  drop constraint if exists training_categories_compliance_bucket_check;

alter table public.training_categories
  add constraint training_categories_compliance_bucket_check
  check (compliance_bucket is null or compliance_bucket in ('fire_annual', 'ems_ce', 'other'));

comment on column public.training_categories.compliance_bucket is
  'Explicit compliance grouping for this category: fire_annual (ISO/annual fire training), ems_ce (EMS continuing education), or other. Null falls back to legacy keyword matching. Never excludes hours from totals.';

-- Seed existing rows with the classification the keyword matcher produces
-- today so behavior is unchanged until an administrator edits a category.
update public.training_categories c
set compliance_bucket = classified.bucket
from (
  select
    id,
    case
      when btrim(lower(coalesce(name, ''))) = '' then 'other'
      when btrim(lower(name)) = 'ems' then 'ems_ce'
      when btrim(lower(name)) = 'other'
        or lower(name) like '%public education%'
        or lower(name) like '%administrative%'
        or lower(name) like '%meeting%'
        then 'other'
      when exists (
        select 1
        from unnest(array[
          'communications',
          'dive training',
          'driver/operator',
          'fire suppression',
          'hazmat',
          'ice rescue',
          'incident command/leadership',
          'pre-plans / site visits',
          'safety/ppe',
          'swift water',
          'technical rescue',
          'wildland'
        ]) as keyword
        where btrim(lower(training_categories.name)) like '%' || keyword || '%'
           or keyword like '%' || btrim(lower(training_categories.name)) || '%'
      ) then 'fire_annual'
      else 'other'
    end as bucket
  from public.training_categories
) as classified
where c.id = classified.id
  and c.compliance_bucket is null;
