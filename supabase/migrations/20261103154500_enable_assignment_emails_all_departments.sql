begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.assignment_email_department_enabled(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.departments d where d.id = p_department_id);
$$;

revoke all on function public.assignment_email_department_enabled(uuid)
  from public, anon, authenticated, service_role;
commit;
