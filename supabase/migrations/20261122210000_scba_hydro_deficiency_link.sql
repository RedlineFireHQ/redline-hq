alter table public.scba_hydro_results
  add constraint scba_hydro_results_id_cylinder_department_key unique (id, cylinder_id, department_id);

alter table public.deficiencies
  add column scba_hydro_result_id uuid,
  add constraint deficiencies_hydro_result_context_check
    check (scba_hydro_result_id is null or (scba_cylinder_id is not null and department_id is not null)),
  add constraint deficiencies_hydro_result_fkey
    foreign key (scba_hydro_result_id, scba_cylinder_id, department_id)
    references public.scba_hydro_results (id, cylinder_id, department_id);

create function public.validate_scba_hydro_deficiency_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.scba_hydro_result_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and row(new.scba_hydro_result_id, new.scba_cylinder_id, new.department_id)
    is not distinct from row(old.scba_hydro_result_id, old.scba_cylinder_id, old.department_id) then
    return new;
  end if;
  if public.scba_hydro_can_read(new.department_id) is not true then
    raise exception 'Not authorized for SCBA cylinder testing' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.scba_hydro_results r
    where r.id = new.scba_hydro_result_id and r.cylinder_id = new.scba_cylinder_id
      and r.department_id = new.department_id and r.result = 'Fail'
  ) then
    raise exception 'Hydrostatic result must be a failed test of this cylinder';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_scba_hydro_deficiency_link() from public, anon, authenticated;
create trigger trg_scba_hydro_deficiency_link
  before insert or update of scba_hydro_result_id, scba_cylinder_id, department_id
  on public.deficiencies for each row execute function public.validate_scba_hydro_deficiency_link();
