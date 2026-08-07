alter table public.apparatus
  add column if not exists pump_oil text,
  add column if not exists generator_oil text;
