alter table if exists public.deficiencies
add column if not exists photo_path text;
