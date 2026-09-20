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

  new.review_required := department_requires_review;

  if tg_op = 'INSERT' then
    if new.status = 'draft' then
      null;
    elsif new.review_required then
      new.status := 'pending_review';
    else
      new.status := 'approved';
    end if;
  elsif tg_op = 'UPDATE' and new.status = 'submitted' then
    if new.review_required then
      new.status := 'pending_review';
    else
      new.status := 'approved';
    end if;
  end if;

  if new.status in ('draft', 'submitted', 'pending_review') then
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif new.status = 'approved' and new.reviewed_by is null then
    new.reviewed_at := null;
  elsif new.status = 'approved' and new.reviewed_at is null then
    new.reviewed_at := now();
  elsif new.status = 'rejected' and new.reviewed_by is not null and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;