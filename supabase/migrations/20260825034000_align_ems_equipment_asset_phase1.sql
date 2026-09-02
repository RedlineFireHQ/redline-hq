alter table public.ems_equipment
  add column if not exists placed_in_service_date date,
  add column if not exists expected_lifespan text,
  add column if not exists replacement_date date,
  add column if not exists photo_path text;

do $$
begin
  if exists (
    select 1
    from public.ems_equipment
    where status not in ('Active', 'Inactive')
  ) then
    raise exception 'Unable to auto-align ems_equipment.status. Legacy status values exist; preserve and reconcile manually before applying Active/Inactive constraint.';
  end if;
end
$$;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_class t
      on t.oid = c.conrelid
    join pg_namespace n
      on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'ems_equipment'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.ems_equipment drop constraint %I',
      constraint_record.conname
    );
  end loop;
end
$$;

alter table public.ems_equipment
  alter column status set default 'Active';

alter table public.ems_equipment
  add constraint ems_equipment_status_check
  check (status in ('Active', 'Inactive'));
