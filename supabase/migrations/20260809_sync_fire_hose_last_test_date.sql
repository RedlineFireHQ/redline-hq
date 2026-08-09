alter table if exists public.fire_hose
  add column if not exists last_test_date date null;
