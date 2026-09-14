-- Some department city/state combinations are too small/ambiguous for
-- WeatherAPI's free-text geocoder to resolve correctly (it silently
-- resolves them to a same-named place in a different state). Add optional
-- latitude/longitude so any department can pin its exact location; nullable
-- so existing departments without coordinates keep using city/state text
-- search unchanged.

alter table public.departments
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

-- Cedar Bluff, NE coordinates (matches WeatherAPI's own "Cedar Bluffs,
-- Nebraska" location record), so the Command Center weather widget stops
-- resolving to the unrelated Cedar Bluff, Alabama.
update public.departments
set latitude = 41.40, longitude = -96.61
where name = 'Cedar Bluff Fire & Rescue';
