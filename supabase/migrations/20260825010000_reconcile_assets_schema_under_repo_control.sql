create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  department_id uuid,
  apparatus_id uuid,
  name text not null,
  description text,
  serial_number text,
  quantity integer default 1,
  in_service boolean default true
);

alter table public.assets enable row level security;
