-- Group 9: Maintenance record and source-bound storage authorization.

drop policy if exists maintenance_records_insert_by_department on public.maintenance_records;
create policy maintenance_records_insert_by_permission
on public.maintenance_records
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'maintenance_management')
  and exists (
    select 1 from public.apparatus a
    where a.id = maintenance_records.apparatus_id
      and a.department_id = maintenance_records.department_id
  )
  and (deficiency_id is null or exists (
    select 1 from public.deficiencies d
    where d.id = maintenance_records.deficiency_id
      and d.department_id = maintenance_records.department_id
  ))
  and (completed_by is null or exists (
    select 1 from public.members m
    where m.id = maintenance_records.completed_by
      and m.department_id = maintenance_records.department_id
  ))
);

drop policy if exists maintenance_records_update_by_department on public.maintenance_records;
create policy maintenance_records_update_by_permission
on public.maintenance_records
for update
to authenticated
using (public.member_has_app_permission(department_id, 'maintenance_management'))
with check (
  public.member_has_app_permission(department_id, 'maintenance_management')
  and exists (
    select 1 from public.apparatus a
    where a.id = maintenance_records.apparatus_id
      and a.department_id = maintenance_records.department_id
  )
  and (deficiency_id is null or exists (
    select 1 from public.deficiencies d
    where d.id = maintenance_records.deficiency_id
      and d.department_id = maintenance_records.department_id
  ))
  and (completed_by is null or exists (
    select 1 from public.members m
    where m.id = maintenance_records.completed_by
      and m.department_id = maintenance_records.department_id
  ))
);

create or replace function public.can_manage_maintenance_storage_object(
  p_bucket_id text,
  p_object_path text,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_maintenance_id uuid;
  v_operation text := lower(coalesce(p_operation, ''));
begin
  if p_bucket_id <> 'deficiency-photos' or p_object_path is null then
    return false;
  end if;

  if split_part(p_object_path, '/', 2) <> 'maintenance'
     or split_part(p_object_path, '/', 3) = ''
     or split_part(p_object_path, '/', 4) not in ('photos', 'attachments')
     or split_part(p_object_path, '/', 5) = '' then
    return false;
  end if;

  begin
    v_department_id := split_part(p_object_path, '/', 1)::uuid;
    v_maintenance_id := split_part(p_object_path, '/', 3)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if not exists (
    select 1 from public.maintenance_records mr
    where mr.id = v_maintenance_id
      and mr.department_id = v_department_id
  ) then
    return false;
  end if;

  if not public.member_has_app_permission(v_department_id, 'maintenance_management') then
    return false;
  end if;

  return v_operation in ('insert', 'update', 'delete');
end;
$$;

comment on function public.can_manage_maintenance_storage_object(text, text, text) is
  'Authorizes only source-bound Maintenance objects in deficiency-photos. It verifies bucket, path structure, department UUID, Maintenance record UUID, parent department, active requester context through member_has_app_permission, and maintenance_management/admin access.';

revoke all on function public.can_manage_maintenance_storage_object(text, text, text) from public;
revoke all on function public.can_manage_maintenance_storage_object(text, text, text) from anon;
grant execute on function public.can_manage_maintenance_storage_object(text, text, text) to authenticated;

-- Exclude only the new Maintenance namespace from the shared Deficiency
-- mutation policies. Existing Deficiency paths remain unchanged.
drop policy if exists authenticated_can_upload_deficiency_photos on storage.objects;
create policy authenticated_can_upload_deficiency_photos
on storage.objects for insert to authenticated
with check (
  bucket_id = 'deficiency-photos'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 2) <> 'maintenance'
);

drop policy if exists authenticated_can_update_deficiency_photos on storage.objects;
create policy authenticated_can_update_deficiency_photos
on storage.objects for update to authenticated
using (bucket_id = 'deficiency-photos' and auth.role() = 'authenticated' and split_part(name, '/', 2) <> 'maintenance')
with check (bucket_id = 'deficiency-photos' and auth.role() = 'authenticated' and split_part(name, '/', 2) <> 'maintenance');

drop policy if exists authenticated_can_delete_deficiency_photos on storage.objects;
create policy authenticated_can_delete_deficiency_photos
on storage.objects for delete to authenticated
using (bucket_id = 'deficiency-photos' and auth.role() = 'authenticated' and split_part(name, '/', 2) <> 'maintenance');

drop policy if exists maintenance_storage_insert_source_bound on storage.objects;
create policy maintenance_storage_insert_source_bound
on storage.objects for insert to authenticated
with check (public.can_manage_maintenance_storage_object(bucket_id, name, 'insert'));

drop policy if exists maintenance_storage_update_source_bound on storage.objects;
create policy maintenance_storage_update_source_bound
on storage.objects for update to authenticated
using (public.can_manage_maintenance_storage_object(bucket_id, name, 'update'))
with check (public.can_manage_maintenance_storage_object(bucket_id, name, 'update'));

drop policy if exists maintenance_storage_delete_source_bound on storage.objects;
create policy maintenance_storage_delete_source_bound
on storage.objects for delete to authenticated
using (public.can_manage_maintenance_storage_object(bucket_id, name, 'delete'));