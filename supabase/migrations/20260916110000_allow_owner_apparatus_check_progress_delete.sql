drop policy if exists apparatus_inspection_checklist_progress_delete_session_owner on public.apparatus_inspection_checklist_progress;

create policy apparatus_inspection_checklist_progress_delete_session_owner
on public.apparatus_inspection_checklist_progress
for delete
to authenticated
using (
  exists (
    select 1
    from public.apparatus_check_sessions s
    join public.members requester
      on requester.id = s.member_id
    where s.apparatus_id = apparatus_inspection_checklist_progress.apparatus_id
      and s.department_id = apparatus_inspection_checklist_progress.department_id
      and s.member_id = apparatus_inspection_checklist_progress.member_id
      and s.state = 'in_progress'
      and s.completed_at is null
      and s.abandoned_at is null
      and s.expired_at is null
      and coalesce(requester.active, false) = true
      and (
        (auth.uid() is not null and requester.auth_user_id = auth.uid())
        or lower(coalesce(requester.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);
