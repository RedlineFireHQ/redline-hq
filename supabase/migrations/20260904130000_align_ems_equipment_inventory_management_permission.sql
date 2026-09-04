drop policy if exists ems_equipment_insert_by_department on public.ems_equipment;
create policy ems_equipment_insert_by_department
on public.ems_equipment
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists ems_equipment_update_by_department on public.ems_equipment;
create policy ems_equipment_update_by_department
on public.ems_equipment
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists ems_equipment_delete_by_department on public.ems_equipment;
create policy ems_equipment_delete_by_department
on public.ems_equipment
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);
