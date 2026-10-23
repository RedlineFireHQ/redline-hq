-- Stage B: Department-scoped "Training Entry — Bypass Review" permission.
--
-- Adds a new catalog permission that lets a department explicitly grant selected
-- members the ability to have their own self-reported training auto-approved.
-- The grant lives in member_app_permissions (department_id + member_id + key), so
-- it is scoped per department and never leaks across departments for
-- multi-department members.
--
-- The submission-defaults trigger checks the submitter's own grant for the row's
-- department. It is SECURITY DEFINER with a fixed search_path so the grant lookup
-- is not subject to the member_app_permissions RLS policy (which resolves a single
-- membership via resolve_requesting_member_access_context and could otherwise read
-- the wrong department for multi-department members). The check is narrowly scoped
-- to (department_id = new.department_id, member_id = new.member_id), so it only ever
-- reads the submitter's own grant for the department the submission belongs to.
--
-- Auditability: a dedicated, authoritative approval_path column records how each
-- submission reached 'approved' ('system_bypass' | 'system_department' | 'human'),
-- with NULL left on historical rows whose path is unknown. reviewed_by stays NULL for
-- system approvals (no human reviewer is impersonated) and is populated for human
-- approvals; review_notes is a non-authoritative convenience marker only. The
-- submitting member remains recorded in member_id. Existing behavior for members
-- without the permission (department_training_settings.outside_training_requires_review)
-- is unchanged, and no historical rows are modified.

insert into public.app_permissions (key, label, description, sort_order)
values
  ('training_entry_bypass_review', 'Training Entry — Bypass Review', 'Self-reported training submitted by this member is automatically approved without requiring another member''s review.', 45)
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- Explicit audit trail for how a submission reached 'approved'. Nullable: historical
-- rows keep NULL (approval path unknown) — no guesswork backfill. This is the
-- authoritative approval-path field; review_notes remains a human-readable convenience
-- only and is never used to determine the path.
alter table public.training_outside_submissions
  add column if not exists approval_path text;

alter table public.training_outside_submissions
  drop constraint if exists training_outside_submissions_approval_path_check;

alter table public.training_outside_submissions
  add constraint training_outside_submissions_approval_path_check
  check (approval_path in ('system_bypass', 'system_department', 'human'));

create or replace function public.apply_outside_training_submission_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  department_requires_review boolean;
  member_bypasses_review boolean;
begin
  select s.outside_training_requires_review
  into department_requires_review
  from public.department_training_settings s
  where s.department_id = new.department_id
  limit 1;

  department_requires_review := coalesce(department_requires_review, true);

  -- Per-member bypass: does THIS submitter hold the bypass grant in THIS department?
  select exists (
    select 1
    from public.member_app_permissions map
    where map.department_id = new.department_id
      and map.member_id = new.member_id
      and map.permission_key = 'training_entry_bypass_review'
  )
  into member_bypasses_review;

  if member_bypasses_review then
    new.review_required := false;
  else
    new.review_required := department_requires_review;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'draft' then
      null;
    elsif new.review_required then
      new.status := 'pending_review';
    else
      new.status := 'approved';
      -- Auto-approval path: member grant beats the department-wide setting.
      new.approval_path := case when member_bypasses_review then 'system_bypass' else 'system_department' end;
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'submitted' then
    if new.review_required then
      new.status := 'pending_review';
    else
      new.status := 'approved';
      new.approval_path := case when member_bypasses_review then 'system_bypass' else 'system_department' end;
    end if;
  end if;

  -- System auto-approval must be distinguishable and must not impersonate a human
  -- reviewer: mark it explicitly and keep reviewed_by empty. The marker is only
  -- written when no note exists yet, so it can never overwrite a human-entered note.
  if new.status = 'approved' and not new.review_required and new.reviewed_by is null and new.review_notes is null then
    new.review_notes := 'Auto-approved by system';
  end if;

  if new.status in ('draft', 'submitted', 'pending_review') then
    new.reviewed_by := null;
    new.reviewed_at := null;
    -- Not approved, so there is no approval path. Never label a pending/draft/
    -- submitted record as approved.
    new.approval_path := null;
  elsif new.status = 'approved' and new.reviewed_by is null then
    -- System approval (department or bypass) never carries a reviewer or timestamp.
    new.reviewed_at := null;
  elsif new.status = 'approved' and new.reviewed_by is not null and new.review_required then
    -- Human approval: reviewer is populated and review was required. Requires
    -- review_required so a legacy/system NULL is never silently reclassified.
    new.approval_path := 'human';
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  elsif new.status = 'approved' and new.reviewed_at is null then
    new.reviewed_at := now();
  elsif new.status = 'rejected' then
    -- Rejected is not an approval; clear any stale approval path.
    new.approval_path := null;
    if new.reviewed_by is not null and new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  end if;

  return new;
end;
$$;
