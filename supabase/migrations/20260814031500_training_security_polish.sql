-- ==========================================
-- Training Security Polish
-- 1) Remove officer delete permissions from operational training records.
-- 2) Lock firefighter edits on outside training after submission.
-- ==========================================

-- -------------------------------------------------
-- Outside submission status model: add draft state.
-- -------------------------------------------------

alter table public.training_outside_submissions
drop constraint if exists training_outside_submissions_status_check;

alter table public.training_outside_submissions
add constraint training_outside_submissions_status_check
check (status in ('draft', 'submitted', 'pending_review', 'approved', 'rejected'));

-- -------------------------------------------------
-- Trigger logic: enforce department review setting and lock flow.
-- -------------------------------------------------

create or replace function public.apply_outside_training_submission_defaults()
returns trigger
language plpgsql
as $$
declare
  department_requires_review boolean;
begin
  select s.outside_training_requires_review
  into department_requires_review
  from public.department_training_settings s
  where s.department_id = new.department_id
  limit 1;

  department_requires_review := coalesce(department_requires_review, true);

  -- Department policy is the source of truth.
  new.review_required := department_requires_review;

  if tg_op = 'INSERT' then
    if new.status = 'draft' then
      -- Keep draft editable by the submitting firefighter.
      null;
    elsif new.review_required then
      -- Any non-draft firefighter submission requires review.
      new.status := 'pending_review';
    else
      -- Auto-approve when review is disabled by department setting.
      new.status := 'approved';
    end if;
  elsif tg_op = 'UPDATE' then
    -- Resubmission path: rejected -> submitted.
    if new.status = 'submitted' then
      if new.review_required then
        new.status := 'pending_review';
      else
        new.status := 'approved';
      end if;
    end if;
  end if;

  -- Keep review fields in sync with state.
  if new.status in ('draft', 'submitted', 'pending_review') then
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif new.status = 'approved' and new.reviewed_at is null then
    new.reviewed_at := now();
  elsif new.status = 'rejected' and new.reviewed_by is not null and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

-- -------------------------------------------------
-- Firefighter self-update policy: editable only in draft/rejected.
-- -------------------------------------------------

drop policy if exists training_outside_submissions_update_self_before_review on public.training_outside_submissions;

create policy training_outside_submissions_update_self_editable_only
on public.training_outside_submissions
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('draft', 'rejected')
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('draft', 'submitted', 'rejected')
  and (
    training_outside_submissions.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_outside_submissions.category_id
        and c.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.status = 'rejected'
    or (
      training_outside_submissions.reviewed_by is null
      and training_outside_submissions.reviewed_at is null
    )
  )
);

-- -------------------------------------------------
-- Remove officer delete permissions (admin-only deletes).
-- -------------------------------------------------

drop policy if exists training_events_delete_by_department_role on public.training_events;
create policy training_events_delete_by_department_admin
on public.training_events
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_events.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_event_attendance_delete_by_department_role on public.training_event_attendance;
create policy training_event_attendance_delete_by_department_admin
on public.training_event_attendance
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_assignments_delete_by_department_role on public.training_assignments;
create policy training_assignments_delete_by_department_admin
on public.training_assignments
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignments.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_assignment_members_delete_by_department_role on public.training_assignment_members;
create policy training_assignment_members_delete_by_department_admin
on public.training_assignment_members
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_outside_submissions_delete_by_department_role on public.training_outside_submissions;
create policy training_outside_submissions_delete_by_department_admin
on public.training_outside_submissions
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_outside_submission_evidence_delete_self_or_role on public.training_outside_submission_evidence;
create policy training_outside_submission_evidence_delete_by_department_admin
on public.training_outside_submission_evidence
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submission_evidence.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_event_attendance_evidence_delete_self_or_role on public.training_event_attendance_evidence;
create policy training_event_attendance_evidence_delete_by_department_admin
on public.training_event_attendance_evidence
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance_evidence.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_assignment_member_evidence_delete_self_or_role on public.training_assignment_member_evidence;
create policy training_assignment_member_evidence_delete_by_department_admin
on public.training_assignment_member_evidence
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_member_evidence.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);