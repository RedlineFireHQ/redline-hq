drop policy if exists pie_equipment_insert_by_department on public.pie_equipment;
create policy pie_equipment_insert_by_department
on public.pie_equipment
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists pie_equipment_update_by_department on public.pie_equipment;
create policy pie_equipment_update_by_department
on public.pie_equipment
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists pie_equipment_delete_by_department on public.pie_equipment;
create policy pie_equipment_delete_by_department
on public.pie_equipment
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists pie_equipment_assignments_insert_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_insert_by_department
on public.pie_equipment_assignments
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists pie_equipment_assignments_update_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_update_by_department
on public.pie_equipment_assignments
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists pie_equipment_assignments_delete_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_delete_by_department
on public.pie_equipment_assignments
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);