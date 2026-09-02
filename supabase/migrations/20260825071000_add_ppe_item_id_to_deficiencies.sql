alter table public.deficiencies
  add column if not exists ppe_item_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deficiencies_ppe_item_id_fkey'
      and conrelid = 'public.deficiencies'::regclass
  ) then
    alter table public.deficiencies
      add constraint deficiencies_ppe_item_id_fkey
      foreign key (ppe_item_id)
      references public.ppe_items (id)
      on delete set null;
  end if;
end
$$;

create index if not exists deficiencies_ppe_item_id_idx
on public.deficiencies (ppe_item_id);
