create table if not exists public.fire_hose (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  inventory_number text not null,
  hose_size text not null,
  hose_length integer,
  booster_reel boolean not null default false,
  in_service_date date not null,
  status text not null default 'Ready' check (status in ('Ready', 'Testing Due', 'Out of Service')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, inventory_number)
);

create index if not exists fire_hose_department_idx
on public.fire_hose (department_id);

create index if not exists fire_hose_status_idx
on public.fire_hose (status);

create or replace function public.set_fire_hose_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fire_hose_updated_at on public.fire_hose;
create trigger trg_fire_hose_updated_at
before update on public.fire_hose
for each row
execute function public.set_fire_hose_updated_at();

alter table public.fire_hose enable row level security;

drop policy if exists fire_hose_select_by_department on public.fire_hose;
create policy fire_hose_select_by_department
on public.fire_hose
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_hose_insert_by_department on public.fire_hose;
create policy fire_hose_insert_by_department
on public.fire_hose
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_hose_update_by_department on public.fire_hose;
create policy fire_hose_update_by_department
on public.fire_hose
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists fire_hose_delete_by_department on public.fire_hose;
create policy fire_hose_delete_by_department
on public.fire_hose
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);
