-- Assignments carry ISO classification metadata; credit is counted only
-- when an individual member completes the assignment.
alter table public.training_assignments
  add column if not exists iso_classifications text[] not null default '{}'::text[],
  add column if not exists iso_facility_id uuid references public.training_facilities(id) on delete restrict,
  add column if not exists iso_pre_plan_id uuid references public.pre_plans(id) on delete restrict,
  add column if not exists iso_driver_operator_training_type text;

alter table public.training_assignments
  drop constraint if exists training_assignments_iso_classifications_check;
alter table public.training_assignments
  add constraint training_assignments_iso_classifications_check
  check (iso_classifications <@ array[
    'training_facilities','company_training','officer_training',
    'driver_operator','hazmat','recruit','building_familiarization'
  ]::text[]);

alter table public.training_assignments
  drop constraint if exists training_assignments_iso_driver_type_check;
alter table public.training_assignments
  add constraint training_assignments_iso_driver_type_check
  check (iso_driver_operator_training_type is null or iso_driver_operator_training_type in ('initial','refresher'));

create or replace function public.validate_training_assignment_iso_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if 'training_facilities' = any(coalesce(new.iso_classifications,'{}'::text[])) then
    if new.iso_facility_id is null or not exists (
      select 1 from public.training_facilities f
      where f.id = new.iso_facility_id and f.department_id = new.department_id and f.active = true
    ) then
      raise exception 'Training Facilities classification requires an active facility belonging to this department.';
    end if;
  end if;
  if 'driver_operator' = any(coalesce(new.iso_classifications,'{}'::text[]))
     and (new.iso_driver_operator_training_type is null or new.iso_driver_operator_training_type not in ('initial','refresher')) then
    raise exception 'Select initial or refresher training for ISO Driver / Operator classification.';
  end if;
  if 'building_familiarization' = any(coalesce(new.iso_classifications,'{}'::text[])) then
    if new.iso_pre_plan_id is null or not exists (
      select 1 from public.pre_plans p
      where p.id = new.iso_pre_plan_id and p.department_id = new.department_id and p.lifecycle_status = 'active'
    ) then
      raise exception 'Building Familiarization requires an active pre-plan belonging to this department.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_training_assignment_iso_fields on public.training_assignments;
create trigger trg_validate_training_assignment_iso_fields
before insert or update of department_id, iso_classifications, iso_facility_id,
  iso_pre_plan_id, iso_driver_operator_training_type
on public.training_assignments
for each row execute function public.validate_training_assignment_iso_fields();
