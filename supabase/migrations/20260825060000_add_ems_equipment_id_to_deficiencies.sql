alter table public.deficiencies
  add column if not exists ems_equipment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deficiencies_ems_equipment_id_fkey'
      and conrelid = 'public.deficiencies'::regclass
  ) then
    alter table public.deficiencies
      add constraint deficiencies_ems_equipment_id_fkey
      foreign key (ems_equipment_id)
      references public.ems_equipment (id)
      on delete set null;
  end if;
end
$$;

create index if not exists deficiencies_ems_equipment_id_idx
on public.deficiencies (ems_equipment_id);
