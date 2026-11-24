alter table public.certifications
  add column if not exists canonical_certification_id uuid;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.certifications'::regclass and conname='certifications_department_id_id_unique') then
    alter table public.certifications add constraint certifications_department_id_id_unique unique(department_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.certifications'::regclass and conname='certifications_canonical_not_self') then
    alter table public.certifications add constraint certifications_canonical_not_self check(canonical_certification_id is distinct from id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.certifications'::regclass and conname='certifications_canonical_same_department_fk') then
    alter table public.certifications add constraint certifications_canonical_same_department_fk
      foreign key(department_id,canonical_certification_id)
      references public.certifications(department_id,id) on delete restrict;
  end if;
end $$;

create index if not exists certifications_department_ems_type_idx
  on public.certifications(department_id,ems_authority,ems_certification_level)
  where ems_authority is not null;
