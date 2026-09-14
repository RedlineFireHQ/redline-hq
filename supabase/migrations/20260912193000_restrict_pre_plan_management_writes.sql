-- Preserve department-member read/create access while requiring the existing
-- pre_plans_management permission for changes to existing pre-plan records.

drop policy if exists pre_plans_update_by_department_member on public.pre_plans;
create policy pre_plans_update_by_management_permission
on public.pre_plans
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
)
with check (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);

drop policy if exists pre_plan_hydrants_update_by_department_member on public.pre_plan_hydrants;
create policy pre_plan_hydrants_update_by_management_permission
on public.pre_plan_hydrants
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
)
with check (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);

drop policy if exists pre_plan_hydrants_delete_by_department_member on public.pre_plan_hydrants;
create policy pre_plan_hydrants_delete_by_management_permission
on public.pre_plan_hydrants
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);

drop policy if exists pre_plan_hazards_update_by_department_member on public.pre_plan_hazards;
create policy pre_plan_hazards_update_by_management_permission
on public.pre_plan_hazards
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
)
with check (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);

drop policy if exists pre_plan_hazards_delete_by_department_member on public.pre_plan_hazards;
create policy pre_plan_hazards_delete_by_management_permission
on public.pre_plan_hazards
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);

drop policy if exists pre_plan_document_links_update_by_department_member on public.pre_plan_document_links;
create policy pre_plan_document_links_update_by_management_permission
on public.pre_plan_document_links
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
)
with check (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);

drop policy if exists pre_plan_document_links_delete_by_department_member on public.pre_plan_document_links;
create policy pre_plan_document_links_delete_by_management_permission
on public.pre_plan_document_links
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'pre_plans_management')
);