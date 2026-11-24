alter table public.member_certifications
  add constraint member_certifications_department_id_unique unique(department_id,id);

create table public.certification_mapping_guards (
  department_id uuid primary key references public.departments(id) on delete cascade,
  revision boolean not null default false
);

create table public.member_certification_details (
  member_certification_id uuid primary key,
  department_id uuid not null,
  edition_details text not null,
  source_reference text null,
  constraint member_certification_details_certification_fkey
    foreign key(department_id,member_certification_id)
    references public.member_certifications(department_id,id) on delete cascade,
  constraint member_certification_details_edition_check check(btrim(edition_details) <> '')
);

alter table public.member_certification_details enable row level security;
create policy member_certification_details_select on public.member_certification_details
  for select to authenticated using (
    exists(select 1 from public.member_certifications mc
      where mc.id=member_certification_details.member_certification_id
        and mc.department_id=member_certification_details.department_id)
  );
create policy member_certification_details_insert on public.member_certification_details
  for insert to authenticated with check(public.member_has_app_permission(department_id,'certification_management'));
create policy member_certification_details_update on public.member_certification_details
  for update to authenticated using(public.member_has_app_permission(department_id,'certification_management'))
  with check(public.member_has_app_permission(department_id,'certification_management'));
create policy member_certification_details_delete on public.member_certification_details
  for delete to authenticated using(public.member_has_app_permission(department_id,'certification_management'));
grant select on public.member_certification_details to authenticated;
grant all on public.member_certification_details,public.certification_mapping_guards to service_role;

create or replace function public.guard_certification_canonical_mapping()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  insert into public.certification_mapping_guards(department_id) values(new.department_id)
    on conflict(department_id) do update set revision=not certification_mapping_guards.revision;
  if (new.ems_authority is not null or new.ems_certification_level is not null)
    and exists(select 1 from public.certifications where canonical_certification_id=new.id) then
    raise exception 'A canonical type with mapped variants cannot become an EMS certification';
  end if;
  if new.canonical_certification_id is not null then
    if exists(select 1 from public.certifications where id=new.canonical_certification_id
      and (department_id<>new.department_id or canonical_certification_id is not null))
      or exists(select 1 from public.certifications where canonical_certification_id=new.id) then
      raise exception 'Certification mapping must target an unmapped type in the same department';
    end if;
    if new.ems_authority is not null or new.ems_certification_level is not null
      or exists(select 1 from public.certifications where id=new.canonical_certification_id
        and (ems_authority is not null or ems_certification_level is not null)) then
      raise exception 'EMS certification equivalence is not supported';
    end if;
  end if;
  return new;
end;
$function$;

create trigger guard_certification_canonical_mapping
before insert or update of canonical_certification_id,department_id,ems_authority,ems_certification_level
on public.certifications for each row execute function public.guard_certification_canonical_mapping();

create or replace function public.save_member_certification_with_details(
  p_department_id uuid,p_member_id uuid,p_record_id uuid,p_certification_id uuid,
  p_certificate_number text,p_issued_at date,p_expires_at date,p_supporting_document_id uuid,
  p_notes text,p_editor_member_id uuid,p_edition_details text
)
returns jsonb language plpgsql set search_path to 'public','pg_temp'
as $function$
declare saved public.member_certifications; original public.member_certifications;
begin
  if not public.member_has_app_permission(p_department_id,'certification_management') then
    raise exception 'Forbidden: certification management required';
  end if;
  if p_record_id is not null then
    select * into original from public.member_certifications
      where id=p_record_id and department_id=p_department_id and member_id=p_member_id for update;
    if not found then raise exception 'Certification not found in this department'; end if;
  end if;
  perform 1 from public.certifications where id=p_certification_id and department_id=p_department_id
    and ((active and canonical_certification_id is null) or id=original.certification_id) for share;
  if not found then raise exception 'Select an available certification type from this department'; end if;
  if p_record_id is null then
    insert into public.member_certifications(department_id,member_id,certification_id,certificate_number,
      issued_at,expires_at,supporting_document_id,notes,created_by,updated_by)
    values(p_department_id,p_member_id,p_certification_id,p_certificate_number,p_issued_at,p_expires_at,
      p_supporting_document_id,p_notes,p_editor_member_id,p_editor_member_id) returning * into saved;
  elsif row(original.certification_id,original.certificate_number,original.issued_at,original.expires_at,
      original.supporting_document_id,original.notes)
    is distinct from row(p_certification_id,p_certificate_number,p_issued_at,p_expires_at,
      p_supporting_document_id,p_notes) then
    update public.member_certifications set certification_id=p_certification_id,
      certificate_number=p_certificate_number,issued_at=p_issued_at,expires_at=p_expires_at,
      supporting_document_id=p_supporting_document_id,notes=p_notes,updated_by=p_editor_member_id
      where id=original.id returning * into saved;
    if not found then raise exception 'Forbidden: certification update denied'; end if;
  else
    saved:=original;
  end if;
  if nullif(btrim(p_edition_details),'') is null then
    delete from public.member_certification_details where member_certification_id=saved.id;
  else
    insert into public.member_certification_details(member_certification_id,department_id,edition_details)
      values(saved.id,p_department_id,btrim(p_edition_details))
      on conflict(member_certification_id) do update set edition_details=excluded.edition_details
      where member_certification_details.edition_details is distinct from excluded.edition_details;
  end if;
  return to_jsonb(saved)||jsonb_build_object('member_certification_details',coalesce(
    (select jsonb_agg(jsonb_build_object('edition_details',edition_details,'source_reference',source_reference))
      from public.member_certification_details where member_certification_id=saved.id),'[]'::jsonb));
end;
$function$;

grant execute on function public.save_member_certification_with_details(uuid,uuid,uuid,uuid,text,date,date,uuid,text,uuid,text)
  to authenticated,service_role;
