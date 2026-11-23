-- Synthetic-only fixture for a disposable PostgreSQL container.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table public.departments(id uuid primary key);
create table public.scba_cylinders(
  id uuid primary key, department_id uuid not null references public.departments,
  last_hydrostatic_test_date date, next_hydrostatic_test_due_date date, status text not null
);
create table public.members(id uuid primary key, department_id uuid, active boolean);
create table public.auth_user_department_memberships(auth_user_id uuid, department_id uuid, allowed boolean, member_id uuid);
grant usage on schema auth to authenticated;
grant select on public.auth_user_department_memberships, public.members to authenticated;
create function public.member_has_inventory_permission(p_department_id uuid, p_permission_key text)
returns boolean language sql stable security definer as $$
  select case when auth.uid() = '30000000-0000-0000-0000-000000000004'::uuid then null
    else exists (select 1 from public.auth_user_department_memberships
    where auth_user_id = auth.uid() and department_id = p_department_id and allowed
      and p_permission_key = 'scba_cylinder_inspection_testing') end
$$;
