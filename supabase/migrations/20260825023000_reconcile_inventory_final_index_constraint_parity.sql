alter table public.fire_hose
  alter column booster_reel drop not null,
  alter column status drop not null;

do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join unnest(c.conkey) with ordinality as cols(attnum, ord) on true
  join pg_attribute a on a.attrelid = t.oid and a.attnum = cols.attnum
  where n.nspname = 'public'
    and t.relname = 'fire_hose'
    and c.contype = 'u'
  group by c.conname
  having array_agg(a.attname::text order by cols.ord) = array['department_id', 'inventory_number'];

  if v_constraint_name is not null then
    execute format('alter table public.fire_hose drop constraint %I', v_constraint_name);
  end if;
end
$$;

create index if not exists pie_equipment_assignments_equipment_id_idx
on public.pie_equipment_assignments (pie_equipment_id);

create unique index if not exists pie_equipment_assignments_one_open_per_equipment_idx
on public.pie_equipment_assignments (pie_equipment_id)
where ended_at is null;

create index if not exists pie_equipment_assignments_station_name_idx
on public.pie_equipment_assignments (station_name)
where station_name is not null and btrim(station_name) <> '';