create or replace function public.apply_training_assignment_member_status_defaults()
returns trigger
language plpgsql
as $$
declare
  assignment_hours numeric(6,2);
  assignment_requires_review boolean;
begin
  select a.hours_credit,
         a.review_required
  into assignment_hours,
       assignment_requires_review
  from public.training_assignments a
  where a.id = new.training_assignment_id
    and a.department_id = new.department_id
  limit 1;

  assignment_requires_review := coalesce(assignment_requires_review, false);

  if new.completion_status = 'submitted' then
    if assignment_requires_review then
      new.completion_status := 'pending_review';
      new.completed_at := null;
      new.hours_earned := null;
    else
      new.completion_status := 'approved';
      new.completed_at := coalesce(new.completed_at, now());
      if new.hours_earned is null then
        new.hours_earned := coalesce(assignment_hours, 0);
      end if;
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
