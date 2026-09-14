alter table public.rope_items
  drop constraint if exists rope_items_status_check;

alter table public.rope_items
  add constraint rope_items_status_check
  check (status in ('Active', 'Inactive', 'Out of Service'));
