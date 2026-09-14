drop policy if exists rope_items_select_by_department on public.rope_items;
create policy rope_items_select_by_department
on public.rope_items
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);