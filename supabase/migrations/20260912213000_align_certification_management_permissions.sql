-- Certification management is independent from Settings management.
-- member_has_app_permission retains the existing administrator bypass.

drop policy if exists certifications_insert_by_settings_manager on public.certifications;
create policy certifications_insert_by_certification_manager
on public.certifications for insert to authenticated
with check (public.member_has_app_permission(department_id, 'certification_management'));

drop policy if exists certifications_update_by_settings_manager on public.certifications;
create policy certifications_update_by_certification_manager
on public.certifications for update to authenticated
using (public.member_has_app_permission(department_id, 'certification_management'))
with check (public.member_has_app_permission(department_id, 'certification_management'));

drop policy if exists certifications_delete_by_settings_manager on public.certifications;
create policy certifications_delete_by_certification_manager
on public.certifications for delete to authenticated
using (public.member_has_app_permission(department_id, 'certification_management'));

drop policy if exists role_required_certifications_insert_by_settings_manager on public.role_required_certifications;
create policy role_required_certifications_insert_by_certification_manager
on public.role_required_certifications for insert to authenticated
with check (
  public.member_has_app_permission(department_id, 'certification_management')
  and exists (select 1 from public.department_roles dr where dr.id = department_role_id and dr.department_id = role_required_certifications.department_id)
  and exists (select 1 from public.certifications c where c.id = certification_id and c.department_id = role_required_certifications.department_id)
);

drop policy if exists role_required_certifications_update_by_settings_manager on public.role_required_certifications;
create policy role_required_certifications_update_by_certification_manager
on public.role_required_certifications for update to authenticated
using (public.member_has_app_permission(department_id, 'certification_management'))
with check (
  public.member_has_app_permission(department_id, 'certification_management')
  and exists (select 1 from public.department_roles dr where dr.id = department_role_id and dr.department_id = role_required_certifications.department_id)
  and exists (select 1 from public.certifications c where c.id = certification_id and c.department_id = role_required_certifications.department_id)
);

drop policy if exists role_required_certifications_delete_by_settings_manager on public.role_required_certifications;
create policy role_required_certifications_delete_by_certification_manager
on public.role_required_certifications for delete to authenticated
using (public.member_has_app_permission(department_id, 'certification_management'));

drop policy if exists member_certifications_insert_by_department_admin on public.member_certifications;
create policy member_certifications_insert_by_certification_manager
on public.member_certifications for insert to authenticated
with check (
  public.member_has_app_permission(department_id, 'certification_management')
  and exists (select 1 from public.members target_member where target_member.id = member_certifications.member_id and target_member.department_id = member_certifications.department_id)
  and exists (select 1 from public.certifications certification_type where certification_type.id = member_certifications.certification_id and certification_type.department_id = member_certifications.department_id)
  and (supporting_document_id is null or exists (select 1 from public.documents supporting_document where supporting_document.id = member_certifications.supporting_document_id and supporting_document.department_id = member_certifications.department_id))
  and (created_by is null or exists (select 1 from public.members created_member where created_member.id = member_certifications.created_by and created_member.department_id = member_certifications.department_id))
  and (updated_by is null or exists (select 1 from public.members updated_member where updated_member.id = member_certifications.updated_by and updated_member.department_id = member_certifications.department_id))
);

drop policy if exists member_certifications_update_by_department_admin on public.member_certifications;
create policy member_certifications_update_by_certification_manager
on public.member_certifications for update to authenticated
using (public.member_has_app_permission(department_id, 'certification_management'))
with check (
  public.member_has_app_permission(department_id, 'certification_management')
  and exists (select 1 from public.members target_member where target_member.id = member_certifications.member_id and target_member.department_id = member_certifications.department_id)
  and exists (select 1 from public.certifications certification_type where certification_type.id = member_certifications.certification_id and certification_type.department_id = member_certifications.department_id)
  and (supporting_document_id is null or exists (select 1 from public.documents supporting_document where supporting_document.id = member_certifications.supporting_document_id and supporting_document.department_id = member_certifications.department_id))
  and (created_by is null or exists (select 1 from public.members created_member where created_member.id = member_certifications.created_by and created_member.department_id = member_certifications.department_id))
  and (updated_by is null or exists (select 1 from public.members updated_member where updated_member.id = member_certifications.updated_by and updated_member.department_id = member_certifications.department_id))
);

drop policy if exists member_certifications_delete_by_department_admin on public.member_certifications;
create policy member_certifications_delete_by_certification_manager
on public.member_certifications for delete to authenticated
using (public.member_has_app_permission(department_id, 'certification_management'));