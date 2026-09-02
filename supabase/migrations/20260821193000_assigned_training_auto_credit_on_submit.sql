create or replace function public.apply_training_assignment_member_status_defaults()
returns trigger
language plpgsql
as $$
declare
  assignment_hours numeric(6,2);
begin
  select a.hours_credit
  into assignment_hours
  from public.training_assignments a
  where a.id = new.training_assignment_id
    and a.department_id = new.department_id
  limit 1;

  if new.completion_status = 'submitted' then
    new.completion_status := 'approved';
    new.completed_at := coalesce(new.completed_at, now());
    if new.hours_earned is null then
      new.hours_earned := coalesce(assignment_hours, 0);
    end if;
  end if;

  if new.completion_status not in ('approved', 'rejected') then
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_notes := null;
  elsif new.reviewed_by is not null and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;