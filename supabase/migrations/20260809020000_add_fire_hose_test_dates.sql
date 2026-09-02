alter table if exists public.fire_hose
  add column if not exists last_test_date date,
  add column if not exists next_test_date date;

create index if not exists fire_hose_next_test_date_idx
  on public.fire_hose (next_test_date);
