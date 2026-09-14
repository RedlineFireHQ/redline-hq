alter table public.pre_plans
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'archived')),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.members (id) on delete set null;

update public.pre_plans
set lifecycle_status = 'active'
where lifecycle_status is null;

create index if not exists pre_plans_department_lifecycle_business_name_idx
on public.pre_plans (department_id, lifecycle_status, business_name);

insert into public.app_permissions (key, label, description, sort_order)
values ('pre_plans_management', 'Pre-Plans Management', 'Archive and restore department pre-plans.', 115)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- Documents, revisions, and their storage objects must recognize both linked
-- Auth identities and roster-email identities for department membership.
drop policy if exists documents_select_by_department on public.documents;
create policy documents_select_by_department
on public.documents
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists documents_insert_by_department on public.documents;
create policy documents_insert_by_department
on public.documents
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists documents_update_by_department on public.documents;
create policy documents_update_by_department
on public.documents
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists documents_delete_by_department on public.documents;
create policy documents_delete_by_department
on public.documents
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_revisions_select_by_department on public.document_revisions;
create policy document_revisions_select_by_department
on public.document_revisions
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_revisions_insert_by_department on public.document_revisions;
create policy document_revisions_insert_by_department
on public.document_revisions
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_revisions_update_by_department on public.document_revisions;
create policy document_revisions_update_by_department
on public.document_revisions
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_revisions_delete_by_department on public.document_revisions;
create policy document_revisions_delete_by_department
on public.document_revisions
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_documents_select on storage.objects;
create policy department_documents_select
on storage.objects
for select
using (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) in (
    select m.department_id::text
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_documents_insert on storage.objects;
create policy department_documents_insert
on storage.objects
for insert
with check (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) in (
    select m.department_id::text
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_documents_update on storage.objects;
create policy department_documents_update
on storage.objects
for update
using (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) in (
    select m.department_id::text
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) in (
    select m.department_id::text
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_documents_delete on storage.objects;
create policy department_documents_delete
on storage.objects
for delete
using (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) in (
    select m.department_id::text
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);
