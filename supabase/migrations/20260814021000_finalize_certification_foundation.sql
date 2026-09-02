alter table public.certifications
  alter column department_id set not null,
  alter column created_at set not null;