-- Add an optional manufacturer name to EMS supply records.
-- Existing records remain valid with NULL manufacturer values.
ALTER TABLE public.ems_supply_items
  ADD COLUMN IF NOT EXISTS manufacturer text;

COMMENT ON COLUMN public.ems_supply_items.manufacturer
  IS 'Optional manufacturer or brand name displayed on EMS supply QR labels.';
