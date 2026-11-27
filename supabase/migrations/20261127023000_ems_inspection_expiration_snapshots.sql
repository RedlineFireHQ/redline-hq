alter table public.drug_box_checklist_results
  add column if not exists expiration_snapshot jsonb not null default '[]'::jsonb;

alter table public.pediatric_bag_checklist_results
  add column if not exists expiration_snapshot jsonb not null default '[]'::jsonb;

create or replace function public.snapshot_ems_container_expiration()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_container_id uuid;
  v_container_type text;
  v_template_key text;
begin
  if tg_table_name = 'drug_box_checklist_results' then
    v_container_type := 'drug_box';
    v_template_key := 'drug-item-' || new.item_order::text;
    select i.drug_box_id into v_container_id
    from public.drug_box_inspections i
    where i.id = new.inspection_id and i.department_id = new.department_id;
  elsif tg_table_name = 'pediatric_bag_checklist_results' then
    v_container_type := 'pediatric_bag';
    v_template_key := new.checklist_item_id::text;
    v_container_id := new.pediatric_bag_id;
  else
    return new;
  end if;

  if v_container_id is null then
    new.expiration_snapshot := '[]'::jsonb;
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', a.id,
    'batch_id', b.id,
    'supply_item_id', b.supply_item_id,
    'supply_name', si.item_name,
    'lot_number', b.lot_number,
    'expiration_date', b.expiration_date,
    'quantity_in_container', a.quantity_on_hand
  ) order by b.expiration_date nulls last, b.created_at), '[]'::jsonb)
  into new.expiration_snapshot
  from public.ems_container_item_batches a
  join public.ems_supply_batches b
    on b.id = a.batch_id and b.department_id = a.department_id
  left join public.ems_supply_items si
    on si.id = b.supply_item_id and si.department_id = b.department_id
  where a.department_id = new.department_id
    and a.container_type = v_container_type
    and a.container_id = v_container_id
    and a.template_item_key = v_template_key
    and a.quantity_on_hand > 0;

  return new;
end;
$$;

drop trigger if exists drug_box_results_expiration_snapshot on public.drug_box_checklist_results;
create trigger drug_box_results_expiration_snapshot
before insert on public.drug_box_checklist_results
for each row execute function public.snapshot_ems_container_expiration();

drop trigger if exists pediatric_bag_results_expiration_snapshot on public.pediatric_bag_checklist_results;
create trigger pediatric_bag_results_expiration_snapshot
before insert on public.pediatric_bag_checklist_results
for each row execute function public.snapshot_ems_container_expiration();

comment on column public.drug_box_checklist_results.expiration_snapshot is
  'Immutable snapshot of assigned EMS supply lots and expiration dates at inspection completion.';
comment on column public.pediatric_bag_checklist_results.expiration_snapshot is
  'Immutable snapshot of assigned EMS supply lots and expiration dates at inspection completion.';
