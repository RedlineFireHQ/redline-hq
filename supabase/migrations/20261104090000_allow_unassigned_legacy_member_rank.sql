-- Forward-only RPC alignment. No rows, constraints, positions or permissions change.
do $migration$
declare
  signature text;
  target regprocedure;
  definition text;
  existing text := $old$  v_rank := btrim(coalesce(p_rank, ''));
  if v_rank = '' then
    raise exception 'Validation error: rank is required.';
  end if;$old$;
  replacement text := $new$  v_rank := nullif(btrim(coalesce(p_rank, '')), '');$new$;
begin
  foreach signature in array array[
    'public.create_department_member(text,text,text,text,text,boolean,boolean,text[],date,date)',
    'public.update_department_member(uuid,text,text,text,text,text,boolean,boolean,text[],date,date)'
  ] loop
    target := to_regprocedure(signature);
    if target is null then
      raise exception 'Expected member RPC is missing: %', signature;
    end if;
    definition := pg_get_functiondef(target);
    if (length(definition) - length(replace(definition, existing, ''))) / length(existing) <> 1 then
      raise exception 'Member RPC definition has drifted; review before changing: %', signature;
    end if;
    execute replace(definition, existing, replacement);
  end loop;
end;
$migration$;
