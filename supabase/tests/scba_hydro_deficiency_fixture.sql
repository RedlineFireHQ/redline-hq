-- Minimal deficiency table for disposable database tests only.
create table public.deficiencies (
  id uuid primary key,
  department_id uuid,
  scba_cylinder_id uuid,
  description text
);
grant select, insert, update on public.deficiencies to authenticated;
grant select on public.scba_cylinders to authenticated;
create function public.fixture_assign_deficiency_department()
returns trigger language plpgsql security definer as $$
begin
  if new.department_id is null then
    select department_id into new.department_id from public.scba_cylinders where id = new.scba_cylinder_id;
  end if;
  return new;
end;
$$;
create trigger trg_deficiency_auto_assign_category
  before insert on public.deficiencies for each row execute function public.fixture_assign_deficiency_department();
