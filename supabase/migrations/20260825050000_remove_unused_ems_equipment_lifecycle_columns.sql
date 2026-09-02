do $$
begin
  if exists (
    select 1
    from public.ems_equipment
    where purchase_date is not null
      or expected_lifespan is not null
      or replacement_date is not null
  ) then
    raise exception 'Refusing to drop EMS equipment lifecycle columns because existing rows contain data.';
  end if;
end
$$;

alter table public.ems_equipment
  drop column if exists purchase_date,
  drop column if exists expected_lifespan,
  drop column if exists replacement_date;
