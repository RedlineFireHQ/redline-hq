alter table public.training_assignments
add column if not exists is_required boolean not null default true;
