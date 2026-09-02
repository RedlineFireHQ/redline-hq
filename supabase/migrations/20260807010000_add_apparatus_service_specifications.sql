alter table public.apparatus
  add column if not exists oil_type text,
  add column if not exists oil_capacity text,
  add column if not exists oil_filter_part_number text,
  add column if not exists fuel_filter_part_number text,
  add column if not exists air_filter_part_number text,
  add column if not exists hydraulic_fluid text,
  add column if not exists transmission_fluid text,
  add column if not exists coolant_type text,
  add column if not exists belt_numbers text,
  add column if not exists battery_type text,
  add column if not exists tire_size text,
  add column if not exists other_common_parts text;
