-- Ensure a container assignment always points to a real container and a batch in the same department.
create or replace function public.validate_ems_container_item_batch_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_container_department uuid;
  v_batch_department uuid;
begin
  if new.container_type = 'pediatric_bag' then
    select department_id into v_container_department
    from public.pediatric_bags
    where id = new.container_id;
  elsif new.container_type = 'drug_box' then
    select department_id into v_container_department
    from public.drug_boxes
    where id = new.container_id;
  else
    raise exception 'Invalid EMS container type.';
  end if;

  if v_container_department is null or v_container_department <> new.department_id then
    raise exception 'EMS bag or drug box does not belong to this department.';
  end if;

  select department_id into v_batch_department
  from public.ems_supply_batches
  where id = new.batch_id;

  if v_batch_department is null or v_batch_department <> new.department_id then
    raise exception 'EMS supply batch does not belong to this department.';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists validate_ems_container_item_batch_assignment on public.ems_container_item_batches;
create trigger validate_ems_container_item_batch_assignment
before insert or update of department_id, container_type, container_id, batch_id
on public.ems_container_item_batches
for each row execute function public.validate_ems_container_item_batch_assignment();

revoke all on function public.validate_ems_container_item_batch_assignment() from public;
