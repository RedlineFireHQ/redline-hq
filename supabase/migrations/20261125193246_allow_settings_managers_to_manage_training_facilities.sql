-- Training facilities are configured in Department Settings. Keep the existing
-- training-management permission while also allowing authorized settings managers.
drop policy if exists training_facilities_insert_by_training_manager on public.training_facilities;
create policy training_facilities_insert_by_training_manager
on public.training_facilities for insert to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  or public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
);

drop policy if exists training_facilities_update_by_training_manager on public.training_facilities;
create policy training_facilities_update_by_training_manager
on public.training_facilities for update to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
  or public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  or public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
);

drop policy if exists training_facilities_delete_by_training_manager on public.training_facilities;
create policy training_facilities_delete_by_training_manager
on public.training_facilities for delete to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
  or public.member_has_app_permission(department_id, 'training_program_management')
  or public.member_has_app_permission(department_id, 'training_management')
);
