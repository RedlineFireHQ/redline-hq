-- Keep revision RLS source-aware while avoiding a nested document-policy lookup
-- during the same transaction as a newly-created library document.

drop policy if exists document_revisions_insert_by_source_permission on public.document_revisions;
create policy document_revisions_insert_by_source_permission
on public.document_revisions
for insert to authenticated
with check (
  exists (
    select 1
    from public.documents document_row
    where document_row.id = document_revisions.document_id
      and document_row.department_id = document_revisions.department_id
      and (
        (document_row.source_kind = 'library' and public.member_has_app_permission(document_row.department_id, 'documents_management'))
        or (document_row.source_kind = 'personnel_qualification' and public.member_has_app_permission(document_row.department_id, 'certification_management'))
        or (document_row.source_kind = 'pre_plan' and public.can_manage_document_source(document_row.department_id, document_row.source_kind, document_row.id))
      )
  )
);

drop policy if exists document_revisions_update_by_source_permission on public.document_revisions;
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

drop policy if exists document_revisions_delete_by_source_permission on public.document_revisions;
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