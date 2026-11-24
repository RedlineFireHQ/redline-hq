-- Add the four missing deficiency categories used by the equipment records.
-- Idempotent by normalized name; existing category IDs and assignments are preserved.

insert into public.deficiency_categories (name, description, display_order, active)
select v.name, v.description, v.display_order, true
from (values
  ('Fire Extinguishers', 'Fire extinguisher equipment deficiencies', 13),
  ('Thermal Imaging Cameras', 'Thermal imaging camera deficiencies', 14),
  ('Misc Fire Equipment', 'Miscellaneous firefighting equipment deficiencies', 15),
  ('Gas Monitors', 'Gas monitor and atmospheric monitoring equipment deficiencies', 16)
) as v(name, description, display_order)
where not exists (
  select 1
  from public.deficiency_categories c
  where lower(btrim(c.name)) = lower(v.name)
);
