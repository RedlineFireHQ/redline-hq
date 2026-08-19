alter table public.apparatus
add column if not exists include_in_department_readiness boolean not null default true;
