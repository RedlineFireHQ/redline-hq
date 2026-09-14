-- The current department-documents path is shared by library and qualification uploads.
-- Keep it out of the library creation branch until Phase 2 introduces source-bound paths.
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

  if not exists (select 1 from public.requesting_active_document_member(v_department_id)) then
    return false;
  end if;

  select d.source_kind, d.id into v_source_kind, v_document_id
  from public.document_revisions revision
  join public.documents d on d.id = revision.document_id
  where revision.department_id = v_department_id
    and d.department_id = v_department_id
    and revision.file_path = p_object_path
  limit 1;

  if v_document_id is not null then
    if v_operation = 'select' then return true;
    elsif v_operation = 'update' then return public.can_update_document_source(v_department_id, v_source_kind, v_document_id);
    elsif v_operation = 'delete' then return public.can_delete_document_source(v_department_id, v_source_kind, v_document_id);
    end if;
    return false;
  end if;

  if split_part(p_object_path, '/', 2) = 'ppe'
     and exists (select 1 from public.ppe_items item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select' or (v_operation in ('update', 'delete') and public.member_has_inventory_permission(v_department_id, 'ppe_management'));
  elsif split_part(p_object_path, '/', 2) = 'rope'
     and exists (select 1 from public.rope_items item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select' or (v_operation in ('update', 'delete') and public.member_has_inventory_permission(v_department_id, 'rope_management'));
  elsif split_part(p_object_path, '/', 2) = 'ems-equipment'
     and exists (select 1 from public.ems_equipment item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select' or (v_operation in ('update', 'delete') and public.member_has_inventory_permission(v_department_id, 'ems_equipment_management'));
  elsif split_part(p_object_path, '/', 2) = 'fire-extinguishers'
     and exists (select 1 from public.fire_extinguishers item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select' or (v_operation in ('update', 'delete') and public.member_has_inventory_permission(v_department_id, 'fire_extinguisher_management'));
  elsif split_part(p_object_path, '/', 2) = 'misc-fire-equipment'
     and exists (select 1 from public.misc_fire_equipment item where item.department_id = v_department_id and item.photo_path = p_object_path) then
    return v_operation = 'select' or (v_operation in ('update', 'delete') and public.member_has_inventory_permission(v_department_id, 'misc_fire_equipment_management'));
  end if;

  if v_operation = 'insert' and split_part(p_object_path, '/', 2) = 'pre-plans' then
    return public.can_upload_document_source(v_department_id, 'pre_plan');
  end if;

  if v_operation = 'insert'
     and split_part(p_object_path, '/', 2) not in ('pre-plans', 'department-documents', 'ppe', 'rope', 'ems-equipment', 'fire-extinguishers', 'misc-fire-equipment') then
    return public.can_upload_document_source(v_department_id, 'library');
  end if;

  return v_operation = 'select';
end;
$$;

comment on function public.can_manage_storage_object(text, text, text) is
  'Authorizes department-documents storage operations by source and verified parent. Existing documents use source permissions; existing inventory photos use their parent category permission; new Pre-Plan objects use the active-member creation exception; ambiguous department-documents and unbound inventory writes are denied until Phase 2 adds source-bound paths or orchestration.';

revoke all on function public.can_manage_storage_object(text, text, text) from public;
revoke all on function public.can_manage_storage_object(text, text, text) from anon;
grant execute on function public.can_manage_storage_object(text, text, text) to authenticated;