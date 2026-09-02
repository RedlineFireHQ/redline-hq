alter table public.apparatus enable row level security;

drop policy if exists apparatus_select_by_department on public.apparatus;
create policy apparatus_select_by_department
on public.apparatus
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = apparatus.department_id
  )
);

drop policy if exists apparatus_insert_by_admin on public.apparatus;
create policy apparatus_insert_by_admin
on public.apparatus
for insert
to authenticated
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = apparatus.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus.department_id, 'apparatus_management')
      )
  )
);

drop policy if exists apparatus_update_by_admin on public.apparatus;
create policy apparatus_update_by_admin
on public.apparatus
for update
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = apparatus.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus.department_id, 'apparatus_management')
      )
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = apparatus.department_id
      and (
        lower(coalesce(m.role, '')) = 'administrator'
        or public.member_has_app_permission(apparatus.department_id, 'apparatus_management')
      )
  )
);

revoke all on table public.apparatus from public;
revoke all on table public.apparatus from anon;
grant select, insert, update on table public.apparatus to authenticated;
