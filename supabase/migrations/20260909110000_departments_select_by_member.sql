-- Departments has RLS enabled but had zero policies, so no authenticated
-- member could read even their own department's name/city/state. This
-- blocked any department-aware branding/weather from working for any
-- department (including Elliott today, and a future second department).

drop policy if exists departments_select_by_member on public.departments;
create policy departments_select_by_member
on public.departments
for select
using (
  id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);
