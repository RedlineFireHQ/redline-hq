do $$
declare
  hose_size_type text;
  invalid_hose_size_count bigint;
  null_hose_length_count bigint;
begin
  select c.data_type
    into hose_size_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'fire_hose'
    and c.column_name = 'hose_size';

  if hose_size_type is distinct from 'numeric' then
    select count(*)
      into invalid_hose_size_count
    from public.fire_hose
    where hose_size is null
      or btrim(hose_size::text) = ''
      or btrim(hose_size::text) !~ '^[0-9]+(\.[0-9]+)?$';

    if invalid_hose_size_count > 0 then
      raise exception 'fire_hose.hose_size contains % non-numeric values; stopping reconciliation', invalid_hose_size_count;
    end if;

    alter table public.fire_hose
      alter column hose_size type numeric
      using nullif(btrim(hose_size::text), '')::numeric;
  end if;

  select count(*)
    into null_hose_length_count
  from public.fire_hose
  where hose_length is null;

  if null_hose_length_count > 0 then
    raise exception 'fire_hose.hose_length contains % null rows; stopping reconciliation', null_hose_length_count;
  end if;

  alter table public.fire_hose
    alter column hose_length set not null;
end
$$;