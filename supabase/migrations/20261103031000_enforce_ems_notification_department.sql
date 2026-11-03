begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (
    select 1 from public.department_notification_recipients r
    join public.members m on m.id = r.member_id
    where m.department_id is distinct from r.department_id
  ) then
    raise exception 'EMS recipient department mismatch: migration stopped without changing configurations';
  end if;
end;
$$;

-- A composite FK also protects against moving a designated member to another department.
create unique index members_id_department_notification_unique
  on public.members(id, department_id);
alter table public.department_notification_recipients
  add constraint notification_recipient_member_department_fk
  foreign key (member_id, department_id) references public.members(id, department_id);

create or replace function public.notify_ems_supply_low_stock()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_member_id uuid;
begin
  if new.status <> 'Active' or not (
    old.quantity_on_hand > old.reorder_threshold
    and new.quantity_on_hand <= new.reorder_threshold
  ) then
    return new;
  end if;
  select r.member_id into v_member_id
  from public.department_notification_recipients r
  join public.members m on m.id = r.member_id and m.department_id = r.department_id
  where r.department_id = new.department_id and r.notification_type = 'ems_supply_low_stock'
    and r.active = true and m.active = true;
  if v_member_id is not null then
    insert into public.notifications(department_id, member_id, type, title, body, href)
    values(new.department_id, v_member_id, 'ems_supply_low_stock', 'EMS Supply Low',
      new.item_name || ' is at ' || trim_scale(new.quantity_on_hand)::text
        || ' (reorder threshold ' || trim_scale(new.reorder_threshold)::text || ').',
      '/inventory/ems-supplies');
  end if;
  return new;
end;
$$;
commit;
