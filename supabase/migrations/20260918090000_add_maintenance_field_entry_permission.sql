insert into public.app_permissions (key, label, description, sort_order)
values (
  'maintenance_field_entry',
  'Maintenance Field Entry',
  'Allows a member to create maintenance records from the mobile field workflow without granting full maintenance management access.',
  61
)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    active = true;

update public.members
set special_permissions_enabled = true
where id = 'e3fbe096-8177-4f48-b9e8-a098a89fdd98'
  and department_id = '44a25960-7d46-45c4-94e9-115833072da8';

insert into public.member_app_permissions (department_id, member_id, permission_key, created_by)
values (
  '44a25960-7d46-45c4-94e9-115833072da8',
  'e3fbe096-8177-4f48-b9e8-a098a89fdd98',
  'maintenance_field_entry',
  null
)
on conflict (department_id, member_id, permission_key) do nothing;