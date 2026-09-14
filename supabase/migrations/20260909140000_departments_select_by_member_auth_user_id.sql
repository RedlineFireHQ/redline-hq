-- The departments_select_by_member policy only matched by email, so a member
-- whose auth account email differs from their roster email (e.g. a demo
-- login email) could not read their own department row. Add the auth_user_id
-- match already used by every other department-scoped policy in the app.

drop policy if exists departments_select_by_member on public.departments;
create policy departments_select_by_member
on public.departments
for select
using (
  id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);
