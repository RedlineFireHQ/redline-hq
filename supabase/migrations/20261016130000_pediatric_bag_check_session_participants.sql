-- Pediatric Bags: participating-personnel tracking for checklist sessions.
--
-- Mirrors the apparatus_check_session_members pattern. Lets a pediatric bag
-- check record additional personnel who participated alongside the inspector.
-- Scoped to the department and the session owner; never grants access to
-- another department's data.

create table if not exists public.pediatric_bag_check_session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pediatric_bag_checklist_sessions (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  added_by_member_id uuid not null references public.members (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create index if not exists pediatric_bag_check_session_members_session_idx
on public.pediatric_bag_check_session_members (session_id, created_at);

create index if not exists pediatric_bag_check_session_members_department_idx
on public.pediatric_bag_check_session_members (department_id, session_id);

alter table public.pediatric_bag_check_session_members enable row level security;

-- Read: the session owner or any active member of the same department.
drop policy if exists pediatric_bag_check_session_members_select on public.pediatric_bag_check_session_members;
create policy pediatric_bag_check_session_members_select
on public.pediatric_bag_check_session_members
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_check_session_members.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- Insert: an active member of the same department adding a participant to a
-- session in that department. The RPC/session owner performs this in practice.
drop policy if exists pediatric_bag_check_session_members_insert on public.pediatric_bag_check_session_members;
create policy pediatric_bag_check_session_members_insert
on public.pediatric_bag_check_session_members
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_check_session_members.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- Delete: an active member of the same department.
drop policy if exists pediatric_bag_check_session_members_delete on public.pediatric_bag_check_session_members;
create policy pediatric_bag_check_session_members_delete
on public.pediatric_bag_check_session_members
for delete
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pediatric_bag_check_session_members.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);
