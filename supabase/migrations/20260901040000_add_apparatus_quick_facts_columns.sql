alter table public.apparatus
  add column if not exists vin text,
  add column if not exists pump_capacity numeric(8,1),
  add column if not exists water_tank_capacity numeric(8,1);
