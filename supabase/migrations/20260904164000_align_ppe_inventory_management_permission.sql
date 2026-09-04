drop policy if exists ppe_items_insert_by_department on public.ppe_items;
create policy ppe_items_insert_by_department
on public.ppe_items
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists ppe_items_update_by_department on public.ppe_items;
create policy ppe_items_update_by_department
on public.ppe_items
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists ppe_items_delete_by_department on public.ppe_items;
create policy ppe_items_delete_by_department
on public.ppe_items
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);
