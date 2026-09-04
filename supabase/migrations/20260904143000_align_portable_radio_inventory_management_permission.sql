drop policy if exists portable_radios_insert_by_department on public.portable_radios;
create policy portable_radios_insert_by_department
on public.portable_radios
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists portable_radios_update_by_department on public.portable_radios;
create policy portable_radios_update_by_department
on public.portable_radios
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists portable_radios_delete_by_department on public.portable_radios;
create policy portable_radios_delete_by_department
on public.portable_radios
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists portable_radio_assignments_insert_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_insert_by_department
on public.portable_radio_assignments
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists portable_radio_assignments_update_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_update_by_department
on public.portable_radio_assignments
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists portable_radio_assignments_delete_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_delete_by_department
on public.portable_radio_assignments
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'inventory_management')
);
