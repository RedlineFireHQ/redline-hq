-- Preserve every apparatus/template row and existing RPC authorization.
-- Abort on source drift rather than replace recovered functions wholesale.
do $migration$
declare
  signature text;
  target regprocedure;
  definition text;
  marker text;
  expected_active_filters integer;
  exclusion text := $guard$  if v_department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
    and (
      v_apparatus_id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid
      or exists (
        select 1 from public.apparatus a
        where a.id = v_apparatus_id and a.department_id = v_department_id and btrim(a.name) = '141'
      )
    ) then
    raise exception 'Unit 141 is excluded from Red Oak apparatus checks.';
  end if;

$guard$;
  active_filter text := $active$and i.is_active = true$active$;
  applicable_filter text := $applicable$and i.is_active = true
      and not (
        v_department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
        and v_apparatus_id = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid
        and btrim(i.item_label) = '141'
      )$applicable$;
  required_filter text := $required$and i.is_required = true$required$;
  scheduled_required_filter text := $scheduled$and (
        i.is_required = true or (
          v_department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
          and v_apparatus_id = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid
          and i.section_name = 'Saturday Only'
          and extract(dow from current_timestamp at time zone 'America/Chicago') = 6
        )
      )$scheduled$;
begin
  foreach signature in array array[
    'public.get_or_create_apparatus_check_session(uuid,uuid,text)',
    'public.complete_apparatus_check(uuid,text,text,integer,numeric)',
    'public.save_apparatus_inspection(uuid,text,text,integer,numeric)'
  ] loop
    target := to_regprocedure(signature);
    if target is null then
      raise exception 'Expected apparatus RPC is missing: %', signature;
    end if;
    definition := pg_get_functiondef(target);
    if signature like '%get_or_create%' then
      marker := '  if p_existing_session_id is not null then';
    else
      marker := '  v_require_checklist := public.apparatus_checklist_required(v_apparatus_id, v_department_id);';
      expected_active_filters := 3;
      if (length(definition) - length(replace(definition, active_filter, ''))) / length(active_filter)
          <> expected_active_filters
        or (length(definition) - length(replace(definition, required_filter, ''))) / length(required_filter) <> 2 then
        raise exception 'Apparatus checklist RPC has drifted; review before changing: %', signature;
      end if;
      definition := replace(definition, active_filter, applicable_filter);
      definition := replace(definition, required_filter, scheduled_required_filter);
    end if;
    if (length(definition) - length(replace(definition, marker, ''))) / length(marker) <> 1 then
      raise exception 'Apparatus RPC admission point has drifted; review before changing: %', signature;
    end if;
    execute replace(definition, marker, exclusion || marker);
  end loop;
end;
$migration$;
