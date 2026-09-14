create or replace function public.can_manage_document_revision(
  p_department_id uuid,
  p_document_id uuid,
  p_operation text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_source_kind text;
  v_operation text := lower(coalesce(p_operation, ''));
begin
  select d.source_kind
  into v_source_kind
  from public.documents d
  where d.id = p_document_id
    and d.department_id = p_department_id;

  if v_source_kind is null then
    return false;
  end if;

  if v_operation = 'insert' then
    if v_source_kind = 'library' then
      return public.member_has_app_permission(p_department_id, 'documents_management');
    elsif v_source_kind = 'personnel_qualification' then
      return public.member_has_app_permission(p_department_id, 'certification_management');
    elsif v_source_kind = 'pre_plan' then
      return public.can_manage_document_source(p_department_id, v_source_kind, p_document_id);
    end if;
    return false;
  elsif v_operation = 'update' then
    return public.can_update_document_source(p_department_id, v_source_kind, p_document_id);
  elsif v_operation = 'delete' then
    return public.can_delete_document_source(p_department_id, v_source_kind, p_document_id);
  end if;

  return false;
end;
$$;

comment on function public.can_manage_document_revision(uuid, uuid, text) is
  'Authorizes a document revision only when its parent document belongs to the same department. Library revisions require documents_management, qualification revisions require certification_management, existing Pre-Plan revisions require pre_plans_management, and unsupported sources are denied. Administrator bypass is preserved.';

revoke all on function public.can_manage_document_revision(uuid, uuid, text) from public;
revoke all on function public.can_manage_document_revision(uuid, uuid, text) from anon;
grant execute on function public.can_manage_document_revision(uuid, uuid, text) to authenticated;

drop policy if exists document_revisions_insert_by_source_permission on public.document_revisions;
create policy document_revisions_insert_by_source_permission
on public.document_revisions
for insert to authenticated
with check (public.can_manage_document_revision(department_id, document_id, 'insert'));

drop policy if exists document_revisions_update_by_source_permission on public.document_revisions;
create policy document_revisions_update_by_source_permission
on public.document_revisions
for update to authenticated
using (public.can_manage_document_revision(department_id, document_id, 'update'))
with check (public.can_manage_document_revision(department_id, document_id, 'update'));

drop policy if exists document_revisions_delete_by_source_permission on public.document_revisions;
create policy document_revisions_delete_by_source_permission
on public.document_revisions
for delete to authenticated
using (public.can_manage_document_revision(department_id, document_id, 'delete'));