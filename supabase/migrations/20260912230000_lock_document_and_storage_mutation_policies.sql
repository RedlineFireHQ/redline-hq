-- Group 4 Phase 3: replace department-wide document/storage mutations.
-- SELECT policies remain unchanged. Server-side Pre-Plan, qualification, and
-- Training workflows use the service-role boundary after caller checks.

drop policy if exists documents_insert_by_department on public.documents;
create policy documents_insert_by_source_permission
on public.documents
for insert to authenticated
with check (
  (source_kind = 'library' and public.member_has_app_permission(department_id, 'documents_management'))
  or (source_kind = 'personnel_qualification' and public.member_has_app_permission(department_id, 'certification_management'))
);

drop policy if exists documents_update_by_department on public.documents;
create policy documents_update_by_source_permission
on public.documents
for update to authenticated
using (public.can_update_document_source(department_id, source_kind, id))
with check (public.can_update_document_source(department_id, source_kind, id));

drop policy if exists documents_delete_by_department on public.documents;
create policy documents_delete_by_source_permission
on public.documents
for delete to authenticated
using (public.can_delete_document_source(department_id, source_kind, id));

drop policy if exists document_revisions_insert_by_department on public.document_revisions;
create policy document_revisions_insert_by_source_permission
on public.document_revisions
for insert to authenticated
with check (
  exists (
    select 1
    from public.documents document_row
    where document_row.id = document_revisions.document_id
      and document_row.department_id = document_revisions.department_id
      and public.can_upload_document_source(document_row.department_id, document_row.source_kind, document_row.id)
  )
);

drop policy if exists document_revisions_update_by_department on public.document_revisions;
create policy document_revisions_update_by_source_permission
on public.document_revisions
for update to authenticated
using (
  exists (
    select 1
    from public.documents document_row
    where document_row.id = document_revisions.document_id
      and document_row.department_id = document_revisions.department_id
      and public.can_update_document_source(document_row.department_id, document_row.source_kind, document_row.id)
  )
)
with check (
  exists (
    select 1
    from public.documents document_row
    where document_row.id = document_revisions.document_id
      and document_row.department_id = document_revisions.department_id
      and public.can_update_document_source(document_row.department_id, document_row.source_kind, document_row.id)
  )
);

drop policy if exists document_revisions_delete_by_department on public.document_revisions;
create policy document_revisions_delete_by_source_permission
on public.document_revisions
for delete to authenticated
using (
  exists (
    select 1
    from public.documents document_row
    where document_row.id = document_revisions.document_id
      and document_row.department_id = document_revisions.department_id
      and public.can_delete_document_source(document_row.department_id, document_row.source_kind, document_row.id)
  )
);

drop policy if exists document_reference_categories_insert_by_department on public.document_reference_categories;
create policy document_reference_categories_insert_by_permission
on public.document_reference_categories
for insert to authenticated
with check (public.member_has_app_permission(department_id, 'documents_management'));

drop policy if exists document_reference_categories_update_by_department on public.document_reference_categories;
create policy document_reference_categories_update_by_permission
on public.document_reference_categories
for update to authenticated
using (public.member_has_app_permission(department_id, 'documents_management'))
with check (public.member_has_app_permission(department_id, 'documents_management'));

drop policy if exists document_reference_categories_delete_by_department on public.document_reference_categories;
create policy document_reference_categories_delete_by_permission
on public.document_reference_categories
for delete to authenticated
using (public.member_has_app_permission(department_id, 'documents_management'));

drop policy if exists department_documents_insert on storage.objects;
create policy department_documents_insert_source_aware
on storage.objects
for insert to authenticated
with check (public.can_manage_storage_object(bucket_id, name, 'insert'));

drop policy if exists department_documents_update on storage.objects;
create policy department_documents_update_source_aware
on storage.objects
for update to authenticated
using (public.can_manage_storage_object(bucket_id, name, 'update'))
with check (public.can_manage_storage_object(bucket_id, name, 'update'));

drop policy if exists department_documents_delete on storage.objects;
create policy department_documents_delete_source_aware
on storage.objects
for delete to authenticated
using (public.can_manage_storage_object(bucket_id, name, 'delete'));