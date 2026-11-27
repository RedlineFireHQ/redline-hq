-- Track the contents of each physical EMS bag and drug box without
-- changing existing checklist templates or historical inspection snapshots.
create table if not exists public.ems_supply_container_contents (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  container_type text not null check (container_type in ('pediatric_bag', 'drug_box')),
  container_id uuid not null,
  template_item_key text not null,
  section_name text not null,
  item_label text not null,
  required_quantity numeric(12,2) not null default 1 check (required_quantity >= 0),
  quantity_on_hand numeric(12,2) not null default 0 check (quantity_on_hand >= 0),
  supply_item_id uuid null references public.ems_supply_items(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, container_type, container_id, template_item_key)
);

create index if not exists ems_supply_container_contents_department_idx
  on public.ems_supply_container_contents(department_id, container_type, container_id);
create index if not exists ems_supply_container_contents_supply_idx
  on public.ems_supply_container_contents(department_id, supply_item_id)
  where supply_item_id is not null;

create or replace function public.validate_ems_supply_container_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_department_id uuid;
  supply_department_id uuid;
begin
  if new.container_type = 'pediatric_bag' then
    select department_id into parent_department_id
    from public.pediatric_bags
    where id = new.container_id and is_active = true;
  else
    select department_id into parent_department_id
    from public.drug_boxes
    where id = new.container_id and is_active = true;
  end if;

  if parent_department_id is null or parent_department_id <> new.department_id then
    raise exception 'EMS container does not belong to this department';
  end if;

  if new.supply_item_id is not null then
    select department_id into supply_department_id
    from public.ems_supply_items where id = new.supply_item_id;
    if supply_department_id is null or supply_department_id <> new.department_id then
      raise exception 'EMS supply item does not belong to this department';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_validate_ems_supply_container_content on public.ems_supply_container_contents;
create trigger trg_validate_ems_supply_container_content
before insert or update on public.ems_supply_container_contents
for each row execute function public.validate_ems_supply_container_content();

alter table public.ems_supply_container_contents enable row level security;

drop policy if exists ems_supply_container_contents_select on public.ems_supply_container_contents;
create policy ems_supply_container_contents_select
on public.ems_supply_container_contents for select to authenticated
using (exists (
  select 1 from public.auth_user_department_memberships m
  where m.auth_user_id = auth.uid()
    and m.department_id = ems_supply_container_contents.department_id
));

drop policy if exists ems_supply_container_contents_insert on public.ems_supply_container_contents;
create policy ems_supply_container_contents_insert
on public.ems_supply_container_contents for insert to authenticated
with check (
  exists (
    select 1 from public.auth_user_department_memberships m
    where m.auth_user_id = auth.uid()
      and m.department_id = ems_supply_container_contents.department_id
  )
  and public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists ems_supply_container_contents_update on public.ems_supply_container_contents;
create policy ems_supply_container_contents_update
on public.ems_supply_container_contents for update to authenticated
using (
  exists (
    select 1 from public.auth_user_department_memberships m
    where m.auth_user_id = auth.uid()
      and m.department_id = ems_supply_container_contents.department_id
  )
  and public.member_has_app_permission(department_id, 'inventory_management')
)
with check (
  exists (
    select 1 from public.auth_user_department_memberships m
    where m.auth_user_id = auth.uid()
      and m.department_id = ems_supply_container_contents.department_id
  )
  and public.member_has_app_permission(department_id, 'inventory_management')
);

drop policy if exists ems_supply_container_contents_delete on public.ems_supply_container_contents;
create policy ems_supply_container_contents_delete
on public.ems_supply_container_contents for delete to authenticated
using (
  exists (
    select 1 from public.auth_user_department_memberships m
    join public.members member on member.id = m.member_id
    where m.auth_user_id = auth.uid()
      and m.department_id = ems_supply_container_contents.department_id
      and coalesce(member.active, false) = true
      and lower(coalesce(member.role, '')) = 'administrator'
  )
);

grant select, insert, update, delete on public.ems_supply_container_contents to authenticated;
