alter table public.pie_equipment
  add column if not exists equipment_category text;

create index if not exists pie_equipment_equipment_category_idx
  on public.pie_equipment (equipment_category);

alter table public.pie_equipment_assignments
  add column if not exists member_id uuid;

create index if not exists pie_equipment_assignments_member_id_idx
  on public.pie_equipment_assignments (member_id)
  where member_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pie_equipment_assignments_member_id_fkey'
      and conrelid = 'public.pie_equipment_assignments'::regclass
  ) then
    alter table public.pie_equipment_assignments
      add constraint pie_equipment_assignments_member_id_fkey
      foreign key (member_id)
      references public.members (id);
  end if;
end
$$;