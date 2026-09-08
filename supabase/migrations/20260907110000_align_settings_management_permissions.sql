-- Align Settings writes with the existing settings_management permission.
-- member_has_app_permission preserves the administrator bypass.

-- Certification Catalog
drop policy if exists certifications_insert_by_department_admin on public.certifications;
create policy certifications_insert_by_settings_manager
on public.certifications
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists certifications_update_by_department_admin on public.certifications;
create policy certifications_update_by_settings_manager
on public.certifications
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists certifications_delete_by_department_admin on public.certifications;
create policy certifications_delete_by_settings_manager
on public.certifications
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Department Roles
drop policy if exists department_roles_insert_by_department_admin on public.department_roles;
create policy department_roles_insert_by_settings_manager
on public.department_roles
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists department_roles_update_by_department_admin on public.department_roles;
create policy department_roles_update_by_settings_manager
on public.department_roles
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists department_roles_delete_by_department_admin on public.department_roles;
create policy department_roles_delete_by_settings_manager
on public.department_roles
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Role Requirements
drop policy if exists role_required_certifications_insert_by_department_admin on public.role_required_certifications;
create policy role_required_certifications_insert_by_settings_manager
on public.role_required_certifications
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  and exists (
    select 1
    from public.department_roles dr
    where dr.id = department_role_id
      and dr.department_id = role_required_certifications.department_id
  )
  and exists (
    select 1
    from public.certifications c
    where c.id = certification_id
      and c.department_id = role_required_certifications.department_id
  )
);

drop policy if exists role_required_certifications_update_by_department_admin on public.role_required_certifications;
create policy role_required_certifications_update_by_settings_manager
on public.role_required_certifications
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  and exists (
    select 1
    from public.department_roles dr
    where dr.id = department_role_id
      and dr.department_id = role_required_certifications.department_id
  )
  and exists (
    select 1
    from public.certifications c
    where c.id = certification_id
      and c.department_id = role_required_certifications.department_id
  )
);

drop policy if exists role_required_certifications_delete_by_department_admin on public.role_required_certifications;
create policy role_required_certifications_delete_by_settings_manager
on public.role_required_certifications
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Training Categories
drop policy if exists training_categories_insert_by_department_admin on public.training_categories;
create policy training_categories_insert_by_settings_manager
on public.training_categories
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  and (
    training_categories.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_categories.created_by
        and creator.department_id = training_categories.department_id
    )
  )
  and (
    training_categories.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_categories.updated_by
        and updater.department_id = training_categories.department_id
    )
  )
);

drop policy if exists training_categories_update_by_department_admin on public.training_categories;
create policy training_categories_update_by_settings_manager
on public.training_categories
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  and (
    training_categories.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_categories.created_by
        and creator.department_id = training_categories.department_id
    )
  )
  and (
    training_categories.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_categories.updated_by
        and updater.department_id = training_categories.department_id
    )
  )
);

drop policy if exists training_categories_delete_by_department_admin on public.training_categories;
create policy training_categories_delete_by_settings_manager
on public.training_categories
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Readiness Requirements
drop policy if exists training_requirements_insert_by_department_admin on public.training_requirements;
create policy training_requirements_insert_by_settings_manager
on public.training_requirements
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  and (
    training_requirements.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_requirements.category_id
        and c.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_requirements.created_by
        and creator.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_requirements.updated_by
        and updater.department_id = training_requirements.department_id
    )
  )
);

drop policy if exists training_requirements_update_by_department_admin on public.training_requirements;
create policy training_requirements_update_by_settings_manager
on public.training_requirements
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
  and (
    training_requirements.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_requirements.category_id
        and c.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_requirements.created_by
        and creator.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_requirements.updated_by
        and updater.department_id = training_requirements.department_id
    )
  )
);

drop policy if exists training_requirements_delete_by_department_admin on public.training_requirements;
create policy training_requirements_delete_by_settings_manager
on public.training_requirements
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Apparatus Inspection Settings
drop policy if exists apparatus_inspection_settings_write_by_admin on public.apparatus_inspection_settings;
create policy apparatus_inspection_settings_write_by_settings_manager
on public.apparatus_inspection_settings
for all
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Ground Ladder Inspection Settings
drop policy if exists ground_ladder_inspection_settings_write_by_admin on public.ground_ladder_inspection_settings;
create policy ground_ladder_inspection_settings_write_by_settings_manager
on public.ground_ladder_inspection_settings
for all
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

-- Gas Monitor Calibration Settings
drop policy if exists gas_monitor_calibration_settings_insert_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_insert_by_settings_manager
on public.gas_monitor_calibration_settings
for insert
to authenticated
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists gas_monitor_calibration_settings_update_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_update_by_settings_manager
on public.gas_monitor_calibration_settings
for update
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
)
with check (
  public.member_has_app_permission(department_id, 'settings_management')
);

drop policy if exists gas_monitor_calibration_settings_delete_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_delete_by_settings_manager
on public.gas_monitor_calibration_settings
for delete
to authenticated
using (
  public.member_has_app_permission(department_id, 'settings_management')
);
