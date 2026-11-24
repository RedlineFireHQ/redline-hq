create table if not exists public.scba_inspection_sessions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  inspection_type text not null check (inspection_type in ('Daily Inspection', 'Post-Fire Inspection', 'Post-Training Inspection', 'Miscellaneous Use Inspection')),
  inspected_by uuid not null references public.members(id),
  inspected_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.scba_inspection_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.scba_inspection_sessions(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  scba_pack_id uuid not null references public.scba_packs(id) on delete restrict,
  result text not null check (result in ('Completed')),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (session_id, scba_pack_id)
);
create index if not exists scba_inspection_sessions_department_date_idx on public.scba_inspection_sessions(department_id, inspected_at desc);
create index if not exists scba_inspection_results_pack_date_idx on public.scba_inspection_results(scba_pack_id, created_at desc);
alter table public.scba_inspection_sessions enable row level security;
alter table public.scba_inspection_results enable row level security;
create policy scba_inspection_sessions_select_department on public.scba_inspection_sessions for select using (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))));
create policy scba_inspection_sessions_insert_department on public.scba_inspection_sessions for insert with check (
 department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), '')))
 and inspected_by in (select m.id from public.members m where m.department_id = scba_inspection_sessions.department_id and lower(m.email) = lower(coalesce(auth.email(), '')))
);
create policy scba_inspection_sessions_delete_own on public.scba_inspection_sessions for delete using (
 department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), '')))
 and inspected_by in (select m.id from public.members m where m.department_id = scba_inspection_sessions.department_id and lower(m.email) = lower(coalesce(auth.email(), '')))
);
create policy scba_inspection_results_select_department on public.scba_inspection_results for select using (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))));
create policy scba_inspection_results_insert_department on public.scba_inspection_results for insert with check (
 department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), '')))
 and exists (select 1 from public.scba_inspection_sessions s where s.id = scba_inspection_results.session_id and s.department_id = scba_inspection_results.department_id)
 and exists (select 1 from public.scba_packs p where p.id = scba_inspection_results.scba_pack_id and p.department_id = scba_inspection_results.department_id)
);
grant select, insert, delete on public.scba_inspection_sessions to authenticated;
grant select, insert on public.scba_inspection_results to authenticated;
