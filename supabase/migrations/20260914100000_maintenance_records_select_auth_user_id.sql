-- The Cedar Bluff Administrator's Supabase Auth login email differs from
-- their roster members.email, so the email-only select predicate on
-- maintenance_records silently hides rows that genuinely belong to their
-- department (same root cause already fixed on ~55 other tables via
-- 20260909150000_department_scoped_select_policies_auth_user_id.sql, which
-- missed this table). Add the same auth_user_id-first, email-fallback
-- identity match to the SELECT policy only.

drop policy if exists maintenance_records_select_by_department on public.maintenance_records;

create policy maintenance_records_select_by_department
on public.maintenance_records
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where (m.auth_user_id = auth.uid())
       or (lower(m.email) = lower(coalesce(auth.email(), '')))
  )
);
