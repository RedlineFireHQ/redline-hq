-- Redline HQ owns the EMS Continuing Education category. Departments may add
-- their own training categories, but cannot rename, deactivate, delete, or
-- repurpose the system EMS category. Existing category IDs and training history
-- are preserved.
alter table public.training_categories
  add column if not exists system_key text;

-- Adopt existing EMS category rows rather than replacing them so historical
-- training_events and training_outside_submissions keep their foreign keys.
update public.training_categories
set system_key = 'ems_continuing_education',
    compliance_bucket = 'ems_ce',
    active = true,
    description = coalesce(nullif(btrim(description), ''),
      'Standard Redline HQ EMS continuing education category. Use the EMS topic selector to classify credit.')
where lower(btrim(name)) = 'ems'
  and (system_key is null or system_key = 'ems_continuing_education');

-- Create the standard EMS category for departments that do not yet have one.
insert into public.training_categories (
  department_id, name, description, active, compliance_bucket, system_key
)
select d.id, 'EMS',
       'Standard Redline HQ EMS continuing education category. Use the EMS topic selector to classify credit.',
       true, 'ems_ce', 'ems_continuing_education'
from public.departments d
where not exists (
  select 1 from public.training_categories c
  where c.department_id = d.id
    and c.system_key = 'ems_continuing_education'
)
and not exists (
  select 1 from public.training_categories c
  where c.department_id = d.id
    and lower(btrim(c.name)) = 'ems'
);

create unique index if not exists training_categories_one_system_key_per_department_idx
  on public.training_categories (department_id, system_key)
  where system_key is not null;

create or replace function public.protect_system_training_categories()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then
      raise exception 'Redline HQ standard training categories cannot be deleted.';
    end if;
    return old;
  end if;

  if old.system_key is not null then
    if new.system_key is distinct from old.system_key
      or new.department_id is distinct from old.department_id
      or new.name is distinct from old.name
      or new.active is distinct from old.active
      or new.compliance_bucket is distinct from old.compliance_bucket then
      raise exception 'Redline HQ standard training categories cannot be renamed, deactivated, moved, or reclassified.';
    end if;
  elsif new.compliance_bucket = 'ems_ce' then
    raise exception 'EMS Continuing Education is a Redline HQ standard category. Departments may add custom categories but cannot create or replace the EMS category.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_system_training_categories on public.training_categories;
create trigger trg_protect_system_training_categories
before update or delete on public.training_categories
for each row execute function public.protect_system_training_categories();

-- Every department created after this migration receives the same system EMS
-- category automatically. This does not alter any department's custom categories.
create or replace function public.seed_department_system_training_categories()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.training_categories (
    department_id, name, description, active, compliance_bucket, system_key
  )
  values (
    new.id,
    'EMS',
    'Standard Redline HQ EMS continuing education category. Use the EMS topic selector to classify credit.',
    true,
    'ems_ce',
    'ems_continuing_education'
  )
  on conflict (department_id, system_key) where system_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_seed_department_system_training_categories on public.departments;
create trigger trg_seed_department_system_training_categories
after insert on public.departments
for each row execute function public.seed_department_system_training_categories();

-- The EMS training taxonomy already includes Pediatric and Critical Care
-- Paramedic topics in application logic and requirement versions. Keep database
-- validation aligned so those standardized topics can be saved consistently.
alter table public.training_events
  drop constraint if exists training_events_ems_core_topic_check;
alter table public.training_events
  add constraint training_events_ems_core_topic_check
  check (
    ems_core_topic is null or ems_core_topic in (
      'airway_respirations_ventilations',
      'cardiology',
      'trauma',
      'medical',
      'operations',
      'pediatric',
      'critical_care_paramedic',
      'other'
    )
  );

alter table public.training_outside_submissions
  drop constraint if exists training_outside_submissions_ems_core_topic_check;
alter table public.training_outside_submissions
  add constraint training_outside_submissions_ems_core_topic_check
  check (
    ems_core_topic is null or ems_core_topic in (
      'airway_respirations_ventilations',
      'cardiology',
      'trauma',
      'medical',
      'operations',
      'pediatric',
      'critical_care_paramedic',
      'other'
    )
  );

alter table public.ems_credit_sources
  drop constraint if exists ems_credit_sources_ems_core_topic_check;
alter table public.ems_credit_sources
  add constraint ems_credit_sources_ems_core_topic_check
  check (
    ems_core_topic is null or ems_core_topic in (
      'airway_respirations_ventilations',
      'cardiology',
      'trauma',
      'medical',
      'operations',
      'pediatric',
      'critical_care_paramedic',
      'other'
    )
  );
