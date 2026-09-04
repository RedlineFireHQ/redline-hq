alter table public.ems_equipment
  drop constraint if exists ems_equipment_status_check;

alter table public.ems_equipment
  add constraint ems_equipment_status_check
  check (status in ('Active', 'Inactive', 'Out of Service'));
