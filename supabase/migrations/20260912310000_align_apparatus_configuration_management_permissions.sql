do $$
declare
  policy_row record;
begin
  for policy_row in
    select * from (values
      ('apparatus_check_requirements', 'apparatus_check_requirements_write_by_admin'),
      ('apparatus_maintenance_requirements', 'apparatus_maintenance_requirements_write_by_admin'),
      ('apparatus_maintenance_requirement_methods', 'apparatus_maintenance_requirement_methods_write_by_admin'),
      ('apparatus_equipment_requirements', 'apparatus_equipment_requirements_write_by_admin')
    ) as policies(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', policy_row.policy_name, policy_row.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.member_has_app_permission(department_id, ''apparatus_management'')) with check (public.member_has_app_permission(department_id, ''apparatus_management''))',
      policy_row.policy_name,
      policy_row.table_name
    );
  end loop;
end;
$$;