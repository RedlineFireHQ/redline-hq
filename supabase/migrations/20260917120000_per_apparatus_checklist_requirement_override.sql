alter table public.apparatus
  add column if not exists checklist_required_override boolean;

comment on column public.apparatus.checklist_required_override is
  'Null uses the department checklist setting; true requires a checklist; false explicitly disables it for this apparatus.';

create or replace function public.apparatus_checklist_required(
  p_apparatus_id uuid,
  p_department_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(a.checklist_required_override, s.require_checklist, false)
  from public.apparatus a
  left join public.apparatus_inspection_settings s
    on s.department_id = a.department_id
  where a.id = p_apparatus_id
    and (p_department_id is null or a.department_id = p_department_id)
  limit 1;
$$;

revoke all on function public.apparatus_checklist_required(uuid, uuid) from public;
revoke all on function public.apparatus_checklist_required(uuid, uuid) from anon;
grant execute on function public.apparatus_checklist_required(uuid, uuid) to authenticated;

do $$
declare
  v_definition text;
  v_old_lookup constant text := $lookup$
  select s.require_checklist
  into v_require_checklist
  from public.apparatus_inspection_settings s
  where s.department_id = v_department_id
  limit 1;

  v_require_checklist := coalesce(v_require_checklist, false);$lookup$;
  v_new_lookup constant text := $lookup$
  v_require_checklist := public.apparatus_checklist_required(v_apparatus_id, v_department_id);$lookup$;
begin
  v_definition := pg_get_functiondef('public.complete_apparatus_check(uuid,text,text,integer,numeric)'::regprocedure);
  if position(v_old_lookup in v_definition) = 0 then
    raise exception 'Expected checklist lookup not found in complete_apparatus_check.';
  end if;
  execute replace(v_definition, v_old_lookup, v_new_lookup);

  v_definition := pg_get_functiondef('public.save_apparatus_inspection(uuid,text,text,integer,numeric)'::regprocedure);
  if position(v_old_lookup in v_definition) = 0 then
    raise exception 'Expected checklist lookup not found in save_apparatus_inspection.';
  end if;
  execute replace(v_definition, v_old_lookup, v_new_lookup);
end;
$$;
