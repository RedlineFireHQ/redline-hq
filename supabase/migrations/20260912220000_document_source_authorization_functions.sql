-- Phase 1 only: define source-aware authorization primitives.
-- Existing document and storage policies intentionally remain unchanged.

create or replace function public.requesting_active_document_member(
  p_department_id uuid
)
returns table (
  member_id uuid,
  role text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select m.id, lower(coalesce(m.role, ''))
  from public.members m
  where m.department_id = p_department_id
    and coalesce(m.active, false) = true
    and (
      (auth.uid() is not null and m.auth_user_id = auth.uid())
      or (auth.uid() is null and lower(m.email) = lower(coalesce(auth.email(), '')))
    )
  order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

comment on function public.requesting_active_document_member(uuid) is
  'Internal Phase 1 helper. Resolves the active authenticated member for one department using auth_user_id first and the existing email fallback second.';

revoke all on function public.requesting_active_document_member(uuid) from public;
revoke all on function public.requesting_active_document_member(uuid) from anon;
revoke all on function public.requesting_active_document_member(uuid) from authenticated;

create or replace function public.can_manage_document_source(
  p_department_id uuid,
  p_source_kind text,
  p_document_id uuid default null
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_document_source_kind text;
begin
  if p_source_kind not in ('library', 'pre_plan', 'personnel_qualification') then
    return false;
  end if;

  select ctx.role
  into v_role
  from public.requesting_active_document_member(p_department_id) ctx;

  if v_role is null then
    return false;
  end if;

  if p_document_id is not null then
    select d.source_kind
    into v_document_source_kind
    from public.documents d
    where d.id = p_document_id
      and d.department_id = p_department_id;

    if v_document_source_kind is distinct from p_source_kind then
      return false;
    end if;

    if p_source_kind = 'pre_plan'
       and not exists (
         select 1
         from public.pre_plan_document_links link
         join public.document_revisions revision on revision.id = link.document_revision_id
         where link.department_id = p_department_id
           and revision.document_id = p_document_id
       ) then
      return false;
    end if;

    if p_source_kind = 'personnel_qualification'
       and not exists (
         select 1
         from public.member_qualifications qualification
         where qualification.supporting_document_id = p_document_id
           and qualification.department_id = p_department_id
       )
       and not exists (
         select 1
         from public.member_certifications certification
         where certification.supporting_document_id = p_document_id
           and certification.department_id = p_department_id
       ) then
      return false;
    end if;
  elsif p_source_kind <> 'library' then
    return false;
  end if;

  if v_role = 'administrator' then
    return true;
  end if;

  return case p_source_kind
    when 'library' then public.member_has_app_permission(p_department_id, 'documents_management')
    when 'pre_plan' then public.member_has_app_permission(p_department_id, 'pre_plans_management')
    when 'personnel_qualification' then public.member_has_app_permission(p_department_id, 'certification_management')
    else false
  end;
end;
$$;

comment on function public.can_manage_document_source(uuid, text, uuid) is
  'Authorizes modification or deletion of an existing classified document source. Library requires documents_management, Pre-Plan documents require pre_plans_management and an existing Pre-Plan link, and qualification documents require certification_management and an existing qualification/certification reference. Administrator bypass is preserved.';

revoke all on function public.can_manage_document_source(uuid, text, uuid) from public;
revoke all on function public.can_manage_document_source(uuid, text, uuid) from anon;
grant execute on function public.can_manage_document_source(uuid, text, uuid) to authenticated;

create or replace function public.can_upload_document_source(
  p_department_id uuid,
  p_source_kind text,
  p_document_id uuid default null
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if p_source_kind not in ('library', 'pre_plan', 'personnel_qualification') then
    return false;
  end if;

  select ctx.role
  into v_role
  from public.requesting_active_document_member(p_department_id) ctx;

  if v_role is null then
    return false;
  end if;

  if v_role = 'administrator' then
    return true;
  end if;

  if p_document_id is not null then
    return public.can_manage_document_source(p_department_id, p_source_kind, p_document_id);
  end if;

  return case p_source_kind
    when 'library' then public.member_has_app_permission(p_department_id, 'documents_management')
    -- Explicit creation exception: every active department member may create a new Pre-Plan attachment.
    when 'pre_plan' then true
    -- Qualification support documents are owned by certification management, not the library.
    when 'personnel_qualification' then public.member_has_app_permission(p_department_id, 'certification_management')
    else false
  end;
end;
$$;

comment on function public.can_upload_document_source(uuid, text, uuid) is
  'Authorizes creation of a classified document source. Library uploads require documents_management, new Pre-Plan attachments are the explicit active-member creation exception, and qualification support uploads require certification_management. An existing document ID delegates to existing-source management authorization.';

revoke all on function public.can_upload_document_source(uuid, text, uuid) from public;
revoke all on function public.can_upload_document_source(uuid, text, uuid) from anon;
grant execute on function public.can_upload_document_source(uuid, text, uuid) to authenticated;

create or replace function public.can_update_document_source(
  p_department_id uuid,
  p_source_kind text,
  p_document_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.can_manage_document_source(p_department_id, p_source_kind, p_document_id);
$$;

comment on function public.can_update_document_source(uuid, text, uuid) is
  'Authorizes replacement or metadata update for an existing source through can_manage_document_source; it never grants cross-source access.';

revoke all on function public.can_update_document_source(uuid, text, uuid) from public;
revoke all on function public.can_update_document_source(uuid, text, uuid) from anon;
grant execute on function public.can_update_document_source(uuid, text, uuid) to authenticated;

create or replace function public.can_delete_document_source(
  p_department_id uuid,
  p_source_kind text,
  p_document_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.can_manage_document_source(p_department_id, p_source_kind, p_document_id);
$$;

comment on function public.can_delete_document_source(uuid, text, uuid) is
  'Authorizes deletion and controlled cleanup of an existing source through can_manage_document_source; failed new-workflow cleanup still requires the future parent-workflow orchestration boundary.';

revoke all on function public.can_delete_document_source(uuid, text, uuid) from public;
revoke all on function public.can_delete_document_source(uuid, text, uuid) from anon;
grant execute on function public.can_delete_document_source(uuid, text, uuid) to authenticated;

create or replace function public.can_manage_storage_object(
  p_bucket_id text,
  p_object_path text,
  p_operation text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_source_kind text;
  v_document_id uuid;
  v_operation text := lower(coalesce(p_operation, ''));
begin
  if p_bucket_id <> 'department-documents' or p_object_path is null then
    return false;
  end if;

  begin
    v_department_id := split_part(p_object_path, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if not exists (
    select 1 from public.requesting_active_document_member(v_department_id)
  ) then
    return false;
  end if;

  select d.source_kind, d.id
  into v_source_kind, v_document_id
  from public.document_revisions revision
  join public.documents d on d.id = revision.document_id
  where revision.department_id = v_department_id
    and d.department_id = v_department_id
    and revision.file_path = p_object_path
  limit 1;

  if v_document_id is not null then
    if v_operation = 'select' then
      return true;
    elsif v_operation = 'insert' then
      return false;
    elsif v_operation = 'update' then
      return public.can_update_document_source(v_department_id, v_source_kind, v_document_id);
    elsif v_operation = 'delete' then
      return public.can_delete_document_source(v_department_id, v_source_kind, v_document_id);
    end if;
    return false;
  end if;

  if split_part(p_object_path, '/', 2) = 'ppe'
     and exists (select 1 from public.ppe_items item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select'
      or (v_operation in ('insert', 'update', 'delete') and public.member_has_inventory_permission(v_department_id, 'ppe_management'));
  elsif split_part(p_object_path, '/', 2) = 'rope'
     and exists (select 1 from public.rope_items item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select'
      or (v_operation in ('insert', 'update', 'delete') and public.member_has_inventory_permission(v_department_id, 'rope_management'));
  elsif split_part(p_object_path, '/', 2) = 'ems-equipment'
     and exists (select 1 from public.ems_equipment item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select'
      or (v_operation in ('insert', 'update', 'delete') and public.member_has_inventory_permission(v_department_id, 'ems_equipment_management'));
  elsif split_part(p_object_path, '/', 2) = 'fire-extinguishers'
     and exists (select 1 from public.fire_extinguishers item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select'
      or (v_operation in ('insert', 'update', 'delete') and public.member_has_inventory_permission(v_department_id, 'fire_extinguisher_management'));
  elsif split_part(p_object_path, '/', 2) = 'misc-fire-equipment'
     and exists (select 1 from public.misc_fire_equipment item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select'
      or (v_operation in ('insert', 'update', 'delete') and public.member_has_inventory_permission(v_department_id, 'misc_fire_equipment_management'));
  end if;

  -- Pre-Plan creation is the only non-library storage insert exception. The
  -- parent is created by the same request and is not available yet; Phase 2
  -- must bind the attachment to that parent before tightening storage RLS.
  if v_operation = 'insert' and split_part(p_object_path, '/', 2) = 'pre-plans' then
    return public.can_upload_document_source(v_department_id, 'pre_plan');
  end if;

  -- Library paths have no parent row before the initial document insert, so
  -- the source permission is the database-backed authorization for creation.
  -- Reserved source prefixes are excluded from this branch.
  if v_operation = 'insert'
     and split_part(p_object_path, '/', 2) not in (
       'pre-plans', 'department-documents', 'ppe', 'rope', 'ems-equipment',
       'fire-extinguishers', 'misc-fire-equipment'
     ) then
    return public.can_upload_document_source(v_department_id, 'library');
  end if;

  -- Inventory uploads currently occur before the parent photo_path is set and
  -- their paths contain no parent ID. Deny unbound writes until Phase 2 adds
  -- parent-bound orchestration; path prefixes alone are never authorization.
  if v_operation in ('insert', 'update', 'delete') then
    return false;
  end if;

  -- Unknown legacy objects remain viewable to active department members while
  -- they are classified for the Phase 2 policy replacement.
  return v_operation = 'select';
end;
$$;

comment on function public.can_manage_storage_object(text, text, text) is
  'Authorizes department-documents storage operations by resolving document revisions to their source or requiring a recognized creation route. Existing document objects use source permissions; new Pre-Plan objects use the explicit active-member creation exception; unbound inventory writes are denied because current paths lack parent identity; path prefixes alone are never sufficient.';

revoke all on function public.can_manage_storage_object(text, text, text) from public;
revoke all on function public.can_manage_storage_object(text, text, text) from anon;
grant execute on function public.can_manage_storage_object(text, text, text) to authenticated;