-- In-app notification when training is assigned to a member.
--
-- Reuses the existing public.notifications center (same table, RLS, and UI the
-- deficiency-assignment alerts use), so the desktop header bell and mobile
-- alerts pick it up automatically with unread tracking. Fires for every
-- department; the notification is scoped to the assignment row's department.

create or replace function public.notify_training_assignment_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_due date;
  v_assignment_title text;
  v_assignment_due timestamptz;
begin
  -- No alert when someone assigns training to themselves.
  if new.created_by is not null and new.created_by = new.member_id then
    return new;
  end if;

  select a.title, a.due_at
  into v_assignment_title, v_assignment_due
  from public.training_assignments a
  where a.id = new.training_assignment_id
    and a.department_id = new.department_id
  limit 1;

  if v_assignment_title is null then
    return new;
  end if;

  v_due := coalesce(new.due_at, v_assignment_due)::date;
  v_title := coalesce(nullif(btrim(v_assignment_title), ''), 'Assigned training');

  insert into public.notifications (
    department_id,
    member_id,
    type,
    title,
    body,
    href
  ) values (
    new.department_id,
    new.member_id,
    'training_assigned',
    'Training Assigned to You',
    v_title || case
      when v_due is not null then ' — due ' || to_char(v_due, 'Mon FMDD, YYYY')
      else ''
    end || '.',
    '/training'
  );

  return new;
end;
$$;

comment on function public.notify_training_assignment_member() is
  'Creates an in-app notification for the assigned member when a training assignment row is inserted. Skips self-assignment. Department-scoped via the assignment member row.';

drop trigger if exists trg_training_assignment_member_notification on public.training_assignment_members;
create trigger trg_training_assignment_member_notification
after insert on public.training_assignment_members
for each row
execute function public.notify_training_assignment_member();
