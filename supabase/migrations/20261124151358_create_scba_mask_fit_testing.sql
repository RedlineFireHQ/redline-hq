create table public.scba_mask_fit_sessions (
  id uuid primary key,
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  test_date date not null,
  tester_name text not null,
  created_by uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  constraint scba_mask_fit_sessions_id_department_unique unique(id, department_id),
  constraint scba_mask_fit_sessions_name_check check(length(btrim(name)) > 0),
  constraint scba_mask_fit_sessions_tester_check check(length(btrim(tester_name)) > 0),
  constraint scba_mask_fit_sessions_created_by_department_fkey
    foreign key(created_by, department_id) references public.members(id, department_id)
);
create index scba_mask_fit_sessions_department_date_idx
  on public.scba_mask_fit_sessions(department_id, test_date desc, id);

create table public.scba_mask_fit_results (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null,
  session_id uuid not null,
  member_id uuid not null,
  result text not null,
  mask_size text not null,
  created_at timestamptz not null default now(),
  constraint scba_mask_fit_results_member_department_fkey
    foreign key(member_id, department_id) references public.members(id, department_id),
  constraint scba_mask_fit_results_session_department_fkey
    foreign key(session_id, department_id) references public.scba_mask_fit_sessions(id, department_id),
  constraint scba_mask_fit_results_session_member_unique unique(session_id, member_id),
  constraint scba_mask_fit_results_result_check check(result in ('Pass','Fail')),
  constraint scba_mask_fit_results_mask_size_check check(mask_size in ('S','M','L'))
);
create index scba_mask_fit_results_department_member_session_idx
  on public.scba_mask_fit_results(department_id, member_id, session_id);

alter table public.scba_mask_fit_sessions enable row level security;
alter table public.scba_mask_fit_results enable row level security;

create policy scba_mask_fit_sessions_read on public.scba_mask_fit_sessions
for select to authenticated using (
  public.can_manage_personnel(department_id)
  or exists (
    select 1 from public.scba_mask_fit_results r
    where r.session_id = scba_mask_fit_sessions.id
      and r.department_id = scba_mask_fit_sessions.department_id
  )
);
create policy scba_mask_fit_results_read on public.scba_mask_fit_results
for select to authenticated using (
  public.can_manage_personnel(department_id)
  or exists (
    select 1 from public.members m
    where m.id = scba_mask_fit_results.member_id
      and m.department_id = scba_mask_fit_results.department_id
      and m.auth_user_id = auth.uid()
      and coalesce(m.active, false)
  )
);
grant select on public.scba_mask_fit_sessions, public.scba_mask_fit_results to authenticated;
