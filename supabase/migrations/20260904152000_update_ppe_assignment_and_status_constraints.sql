alter table public.ppe_items
  alter column assigned_member_id drop not null;

alter table public.ppe_items
  drop constraint if exists ppe_items_status_check;

alter table public.ppe_items
  add constraint ppe_items_status_check
  check (status in ('Active', 'Inactive', 'Out of Service'));
