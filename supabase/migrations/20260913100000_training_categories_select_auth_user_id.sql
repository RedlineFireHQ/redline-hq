-- Align training category reads with the auth_user_id member identity path.
-- Keep email matching for legacy accounts while preserving department scoping.
drop policy if exists training_categories_select_by_department on public.training_categories;

create policy training_categories_select_by_department
on public.training_categories
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where m.auth_user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);
