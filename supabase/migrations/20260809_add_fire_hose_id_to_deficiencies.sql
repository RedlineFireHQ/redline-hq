alter table if exists public.deficiencies
add column if not exists fire_hose_id uuid references public.fire_hose (id) on delete set null;

create index if not exists deficiencies_fire_hose_id_idx
on public.deficiencies (fire_hose_id);