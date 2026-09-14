-- Apply the active-member/auth_user_id hardening to the already-deployed
-- self-submission update policy while preserving its status restrictions.
drop policy if exists training_outside_submissions_update_self_editable_only on public.training_outside_submissions;
create policy training_outside_submissions_update_self_editable_only
on public.training_outside_submissions for update
using (
  exists (
    select 1 from public.members m
    where (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), '')))
      and coalesce(m.active, false) = true
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('draft', 'rejected')
)
with check (
  exists (
    select 1 from public.members m
    where (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), '')))
      and coalesce(m.active, false) = true
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('draft', 'submitted', 'rejected')
  and (
    training_outside_submissions.category_id is null
    or exists (
      select 1 from public.training_categories c
      where c.id = training_outside_submissions.category_id
        and c.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.status = 'rejected'
    or (training_outside_submissions.reviewed_by is null and training_outside_submissions.reviewed_at is null)
  )
);