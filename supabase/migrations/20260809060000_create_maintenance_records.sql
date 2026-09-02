create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  maintenance_number text not null unique,
  apparatus_id uuid not null references public.apparatus (id) on delete restrict,
  deficiency_id uuid references public.deficiencies (id) on delete set null,
  maintenance_type text not null,
  completed_by uuid references public.members (id) on delete set null,
  service_date timestamptz not null default now(),
  description text not null,
  parts_used text,
  labor_hours numeric(8,2),
  mileage integer,
  engine_hours numeric(10,1),
  cost numeric(12,2),
  notes text,
  photos text[] not null default '{}',
  attachments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_maintenance_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_maintenance_records_updated_at on public.maintenance_records;
create trigger trg_maintenance_records_updated_at
before update on public.maintenance_records
for each row
execute function public.set_maintenance_records_updated_at();

create or replace function public.generate_maintenance_number()
returns trigger
language plpgsql
as $$
declare
  v_year text;
  v_next integer;
begin
  if new.maintenance_number is not null and btrim(new.maintenance_number) <> '' then
    return new;
  end if;

  v_year := to_char(coalesce(new.service_date, now()), 'YYYY');

  select count(*) + 1
  into v_next
  from public.maintenance_records
  where maintenance_number like ('MT-' || v_year || '-%');

  new.maintenance_number := 'MT-' || v_year || '-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_generate_maintenance_number on public.maintenance_records;
create trigger trg_generate_maintenance_number
before insert on public.maintenance_records
for each row
execute function public.generate_maintenance_number();
