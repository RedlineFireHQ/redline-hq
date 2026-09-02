alter table public.apparatus
  add column if not exists lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'archived'));

update public.apparatus
set lifecycle_status = 'active'
where lifecycle_status is null;

create index if not exists apparatus_lifecycle_status_department_idx
on public.apparatus (department_id, lifecycle_status, name);
