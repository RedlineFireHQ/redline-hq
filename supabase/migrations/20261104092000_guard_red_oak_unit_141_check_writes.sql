-- Add write-only safeguards; retain every row, read policy and existing grant.
do $migration$
declare
  table_name text;
  target regprocedure;
  definition text;
  marker text;
  replacement text;
begin
  if not exists (
    select 1 from public.apparatus
    where id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid
      and department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
  ) or not exists (
    select 1 from public.apparatus_inspection_checklist_items
    where id = '4267b954-ca67-4a93-ac89-14d6bda940f9'::uuid
      and apparatus_id = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid
      and department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
      and btrim(item_label) = '141'
  ) then
    raise exception 'Expected Red Oak Unit 141 and Daily template identities have drifted.';
  end if;

  foreach table_name in array array[
    'apparatus_check_sessions', 'apparatus_check_session_members',
    'apparatus_inspections', 'apparatus_inspection_checklist_progress',
    'apparatus_inspection_checklist_results', 'daily_checks', 'deficiencies'
  ] loop
    if to_regclass('public.' || table_name) is null or exists (
      select 1 from pg_trigger
      where tgrelid = to_regclass('public.' || table_name)
        and tgname = 'trg_guard_red_oak_unit_141_check_write'
    ) then
      raise exception 'Expected check-write table is missing or guard already exists: %', table_name;
    end if;
  end loop;
  if to_regprocedure('public.guard_red_oak_unit_141_check_write()') is not null then
    raise exception 'Red Oak check-write guard already exists; review rather than overwrite.';
  end if;
  if exists (
    select 1 from (values
      ('apparatus_check_sessions', 'apparatus_id'),
      ('apparatus_check_sessions', 'completed_inspection_id'),
      ('apparatus_check_session_members', 'session_id'),
      ('apparatus_inspections', 'apparatus_id'),
      ('apparatus_inspection_checklist_progress', 'apparatus_id'),
      ('apparatus_inspection_checklist_progress', 'checklist_item_id'),
      ('apparatus_inspection_checklist_results', 'apparatus_id'),
      ('apparatus_inspection_checklist_results', 'inspection_id'),
      ('apparatus_inspection_checklist_results', 'checklist_item_id'),
      ('daily_checks', 'apparatus_id'),
      ('deficiencies', 'apparatus_id'),
      ('deficiencies', 'department_id'),
      ('deficiencies', 'inspection_id'),
      ('deficiencies', 'check_session_id'),
      ('deficiencies', 'reported_by')
    ) as expected(table_name, column_name)
    left join pg_attribute a
      on a.attrelid = to_regclass('public.' || expected.table_name)
      and a.attname = expected.column_name and not a.attisdropped
    where a.atttypid is distinct from 'uuid'::regtype
  ) or not exists (
    select 1 from pg_attribute
    where attrelid = 'public.apparatus_inspection_checklist_results'::regclass
      and attname = 'item_label_snapshot' and atttypid = 'text'::regtype and not attisdropped
  ) then
    raise exception 'Check-write reference columns have drifted; review before installing guards.';
  end if;

  foreach marker in array array[
    'public.get_or_create_apparatus_check_session(uuid,uuid,text)',
    'public.complete_apparatus_check(uuid,text,text,integer,numeric)',
    'public.save_apparatus_inspection(uuid,text,text,integer,numeric)'
  ] loop
    target := to_regprocedure(marker);
    if target is null or position(
      'Unit 141 is excluded from Red Oak apparatus checks.' in pg_get_functiondef(target)
    ) = 0 then
      raise exception 'Apply the reviewed 20261104091000 RPC draft first: %', marker;
    end if;
  end loop;

  execute $function_definition$
    create function public.guard_red_oak_unit_141_check_write()
    returns trigger
    language plpgsql
    security definer
    set search_path = pg_catalog, public, pg_temp
    as $body$
    declare
      row_data jsonb := to_jsonb(new);
      apparatus_ids uuid[] := array[(row_data ->> 'apparatus_id')::uuid];
      session_id uuid := coalesce(
        (row_data ->> 'session_id')::uuid, (row_data ->> 'check_session_id')::uuid
      );
      inspection_ids uuid[] := array[
        (row_data ->> 'inspection_id')::uuid, (row_data ->> 'completed_inspection_id')::uuid
      ];
      checklist_item_id uuid := (row_data ->> 'checklist_item_id')::uuid;
      parent_row record;
      excluded_item boolean := false;
    begin
      if tg_table_schema <> 'public' or tg_table_name not in (
        'apparatus_check_sessions', 'apparatus_check_session_members',
        'apparatus_inspections', 'apparatus_inspection_checklist_progress',
        'apparatus_inspection_checklist_results', 'daily_checks', 'deficiencies'
      ) then
        raise exception 'Red Oak check-write guard attached to an unexpected table.';
      end if;

      -- Historical deficiency resolution remains subject to its existing authorization.
      if tg_table_name = 'deficiencies' and tg_op = 'UPDATE' then
        if row(new.apparatus_id, new.department_id, new.inspection_id, new.check_session_id, new.reported_by)
          is not distinct from
          row(old.apparatus_id, old.department_id, old.inspection_id, old.check_session_id, old.reported_by) then
          return new;
        end if;
      end if;

      -- Resolve actual parents under definer visibility, not a caller-supplied department.
      if session_id is not null then
        select s.apparatus_id, s.completed_inspection_id into parent_row
        from public.apparatus_check_sessions s where s.id = session_id for share;
        if found then
          apparatus_ids := array_append(apparatus_ids, parent_row.apparatus_id);
          inspection_ids := array_append(inspection_ids, parent_row.completed_inspection_id);
        end if;
      end if;
      for parent_row in
        select i.apparatus_id from public.apparatus_inspections i
        where i.id = any(inspection_ids) for share
      loop
        apparatus_ids := array_append(apparatus_ids, parent_row.apparatus_id);
      end loop;
      if checklist_item_id is not null then
        select i.id, i.apparatus_id, i.department_id, i.item_label into parent_row
        from public.apparatus_inspection_checklist_items i
        where i.id = checklist_item_id for share;
        if found then
          apparatus_ids := array_append(apparatus_ids, parent_row.apparatus_id);
          excluded_item :=
            parent_row.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
            and parent_row.apparatus_id = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid
            and (
              parent_row.id = '4267b954-ca67-4a93-ac89-14d6bda940f9'::uuid
              or btrim(parent_row.item_label) = '141'
            );
        end if;
      end if;
      if tg_table_name = 'apparatus_inspection_checklist_results' then
        excluded_item := excluded_item or (
          (row_data ->> 'apparatus_id')::uuid = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid
          and btrim(row_data ->> 'item_label_snapshot') = '141'
          and exists (
            select 1 from public.apparatus a
            where a.id = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid
              and a.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
          )
        );
      end if;
      if coalesce(excluded_item, false) or (
        '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid = any(apparatus_ids)
        and exists (
          select 1 from public.apparatus a
          where a.id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid
            and a.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
        )
      ) then
        raise exception using
          errcode = '23514',
          constraint = 'red_oak_unit_141_check_exclusion',
          message = 'Unit 141 is excluded from Red Oak apparatus checks.';
      end if;
      return new;
    end;
    $body$;
  $function_definition$;
  execute 'revoke all on function public.guard_red_oak_unit_141_check_write() from public, anon, authenticated, service_role';

  foreach table_name in array array[
    'apparatus_check_sessions', 'apparatus_check_session_members',
    'apparatus_inspections', 'apparatus_inspection_checklist_progress',
    'apparatus_inspection_checklist_results', 'daily_checks', 'deficiencies'
  ] loop
    execute format(
      'create trigger trg_guard_red_oak_unit_141_check_write before insert or update on public.%I for each row execute function public.guard_red_oak_unit_141_check_write()',
      table_name
    );
  end loop;

  target := to_regprocedure('public.can_insert_apparatus_check_session_member(uuid,uuid,uuid,uuid)');
  if target is null then
    raise exception 'Expected participant validation helper is missing.';
  end if;
  definition := pg_get_functiondef(target);
  marker := '    where s.id = p_session_id';
  replacement := marker || $participant$
      and not (
        s.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
        and s.apparatus_id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid
      )$participant$;
  if (length(definition) - length(replace(definition, marker, ''))) / length(marker) <> 1 then
    raise exception 'Participant validation helper has drifted; review before changing.';
  end if;
  execute replace(definition, marker, replacement);

  target := to_regprocedure('public.validate_deficiency_check_session()');
  if target is null then
    raise exception 'Expected deficiency session validation helper is missing.';
  end if;
  definition := pg_get_functiondef(target);
  marker := '  if v_session.state is distinct from ''in_progress''';
  replacement := $deficiency$  if v_session.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
    and v_session.apparatus_id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid
    and (
      tg_op = 'INSERT'
      or row(new.apparatus_id, new.department_id, new.inspection_id, new.check_session_id, new.reported_by)
        is distinct from
        row(old.apparatus_id, old.department_id, old.inspection_id, old.check_session_id, old.reported_by)
    ) then
    raise exception using
      errcode = '23514',
      constraint = 'red_oak_unit_141_check_exclusion',
      message = 'Unit 141 is excluded from Red Oak apparatus checks.';
  end if;

$deficiency$ || marker;
  if (length(definition) - length(replace(definition, marker, ''))) / length(marker) <> 1 then
    raise exception 'Deficiency session validation helper has drifted; review before changing.';
  end if;
  execute replace(definition, marker, replacement);
end;
$migration$;
