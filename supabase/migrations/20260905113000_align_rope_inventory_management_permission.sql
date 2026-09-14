drop policy if exists rope_items_write_by_department_admin on public.rope_items;
drop policy if exists rope_items_insert_by_department on public.rope_items;
drop policy if exists rope_items_update_by_department on public.rope_items;
drop policy if exists rope_items_delete_by_department on public.rope_items;

create policy rope_items_insert_by_department
on public.rope_items
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

create policy rope_items_update_by_department
on public.rope_items
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

create policy rope_items_delete_by_department
on public.rope_items
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);
