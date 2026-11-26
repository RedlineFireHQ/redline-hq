-- Add an optional manufacturer reference / catalog number to EMS supplies.
-- Existing records remain valid with NULL values.
ALTER TABLE public.ems_supply_items
  ADD COLUMN IF NOT EXISTS reference_number text;

COMMENT ON COLUMN public.ems_supply_items.reference_number
  IS 'Optional manufacturer part number, catalog number, or reorder reference.';
