create extension if not exists pgcrypto;

alter table public.members
  drop constraint if exists members_auth_user_id_fkey;

drop index if exists public.members_auth_user_id_unique_idx;

create unique index if not exists members_department_auth_user_id_unique_idx
  on public.members (department_id, auth_user_id)
  where auth_user_id is not null;

create unique index if not exists members_department_email_unique_idx
  on public.members (department_id, lower(email))
  where email is not null and btrim(email) <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_auth_user_id_fkey'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users (id)
      on delete set null;
  end if;
end $$;

create table if not exists public.department_registration_codes (
  department_id uuid primary key references public.departments (id) on delete cascade,
  code_hash text not null,
  code_version integer not null default 1,
  code_last4 text not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint department_registration_codes_hash_not_blank check (btrim(code_hash) <> ''),
  constraint department_registration_codes_last4_check check (char_length(code_last4) = 4)
);

create or replace function public.set_department_registration_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_department_registration_codes_updated_at on public.department_registration_codes;
create trigger trg_department_registration_codes_updated_at
before update on public.department_registration_codes
for each row
execute function public.set_department_registration_codes_updated_at();

alter table public.department_registration_codes enable row level security;

drop policy if exists department_registration_codes_no_public_access on public.department_registration_codes;
create policy department_registration_codes_no_public_access
on public.department_registration_codes
for select
using (false);

create or replace function public.build_department_registration_code(p_department_name text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select
    upper(
      regexp_replace(
        coalesce(nullif(btrim(p_department_name), ''), 'DEPARTMENT'),
        '[^A-Za-z0-9]+',
        '-',
        'g'
      )
      ) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
$$;

create or replace function public.resolve_department_registration_code(
  p_registration_code text
)
returns table (
  department_id uuid,
  department_name text,
  code_version integer
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  if btrim(coalesce(p_registration_code, '')) = '' then
    return;
  end if;

  v_hash := encode(digest(lower(btrim(p_registration_code)), 'sha256'), 'hex');

  return query
    select
      drc.department_id,
      d.name as department_name,
      drc.code_version
    from public.department_registration_codes drc
    join public.departments d on d.id = drc.department_id
    where drc.code_hash = v_hash
    limit 1;
end;
$$;

revoke all on function public.resolve_department_registration_code(text) from public;
revoke all on function public.resolve_department_registration_code(text) from anon;
grant execute on function public.resolve_department_registration_code(text) to authenticated;

create or replace function public.regenerate_department_registration_code(
  p_department_id uuid
)
returns table (
  registration_code text,
  code_version integer
)
language plpgsql
security definer
volatile
set search_path = public, pg_temp
as $$
declare
  v_requester_member_id uuid;
  v_department_name text;
  v_next_version integer;
  v_code text;
begin
  select ctx.member_id
  into v_requester_member_id
  from public.resolve_requesting_member_access_context() ctx
  where ctx.department_id = p_department_id
  limit 1;

  if v_requester_member_id is null then
    raise exception 'Unauthorized: requester membership not found.';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = v_requester_member_id
      and m.department_id = p_department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  ) then
    raise exception 'Forbidden: administrator access is required to regenerate the department registration code.';
  end if;

  select d.name
  into v_department_name
  from public.departments d
  where d.id = p_department_id;

  if v_department_name is null then
    raise exception 'Validation error: department not found.';
  end if;

  select coalesce(drc.code_version, 0) + 1
  into v_next_version
  from public.department_registration_codes drc
  where drc.department_id = p_department_id;

  v_code := public.build_department_registration_code(v_department_name);

  insert into public.department_registration_codes (
    department_id,
    code_hash,
    code_version,
    code_last4,
    generated_at,
    generated_by
  )
  values (
    p_department_id,
    encode(digest(lower(v_code), 'sha256'), 'hex'),
    coalesce(v_next_version, 1),
    right(v_code, 4),
    now(),
    v_requester_member_id
  )
  on conflict (department_id) do update
  set code_hash = excluded.code_hash,
      code_version = excluded.code_version,
      code_last4 = excluded.code_last4,
      generated_at = excluded.generated_at,
      generated_by = excluded.generated_by;

  return query
    select v_code::text as registration_code, coalesce(v_next_version, 1) as code_version;
end;
$$;

revoke all on function public.regenerate_department_registration_code(uuid) from public;
revoke all on function public.regenerate_department_registration_code(uuid) from anon;
grant execute on function public.regenerate_department_registration_code(uuid) to authenticated;

create or replace function public.validate_department_registration_candidate(
  p_email text,
  p_registration_code text
)
returns table (
  member_id uuid,
  department_id uuid,
  department_name text,
  active boolean,
  auth_user_id uuid,
  already_linked boolean
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_department record;
  v_email text;
begin
  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email = '' then
    return;
  end if;

  select *
  into v_department
  from public.resolve_department_registration_code(p_registration_code)
  limit 1;

  if v_department.department_id is null then
    return;
  end if;

  return query
    select
      m.id as member_id,
      m.department_id,
      v_department.department_name,
      coalesce(m.active, false) as active,
      m.auth_user_id,
      m.auth_user_id is not null as already_linked
    from public.members m
    where m.department_id = v_department.department_id
      and lower(coalesce(m.email, '')) = v_email
      and coalesce(m.active, false) = true
    limit 1;
end;
$$;

revoke all on function public.validate_department_registration_candidate(text, text) from public;
revoke all on function public.validate_department_registration_candidate(text, text) from anon;
grant execute on function public.validate_department_registration_candidate(text, text) to authenticated;
grant execute on function public.validate_department_registration_candidate(text, text) to anon;

create or replace function public.claim_department_membership_by_code(
  p_registration_code text
)
returns table (
  member_id uuid,
  department_id uuid,
  linked_auth_user_id uuid
)
language plpgsql
security definer
volatile
set search_path = public, pg_temp
as $$
declare
  v_department record;
  v_member record;
  v_auth_user_id uuid;
  v_auth_email text;
begin
  v_auth_user_id := auth.uid();
  v_auth_email := lower(btrim(coalesce(auth.email(), '')));

  if v_auth_user_id is null then
    raise exception 'Unauthorized: authentication is required.';
  end if;

  select *
  into v_department
  from public.resolve_department_registration_code(p_registration_code)
  limit 1;

  if v_department.department_id is null then
    raise exception 'Validation error: invalid department registration code.';
  end if;

  select *
  into v_member
  from public.members m
  where m.department_id = v_department.department_id
    and lower(coalesce(m.email, '')) = v_auth_email
    and coalesce(m.active, false) = true
  limit 1;

  if v_member.id is null then
    raise exception 'Validation error: no active roster member matches the authenticated account email.';
  end if;

  if v_member.auth_user_id is not null and v_member.auth_user_id <> v_auth_user_id then
    raise exception 'Conflict: this roster member is already linked to a different authentication account.';
  end if;

  update public.members
  set auth_user_id = v_auth_user_id
  where id = v_member.id;

  return query
    select v_member.id, v_member.department_id, v_auth_user_id;
end;
$$;

revoke all on function public.claim_department_membership_by_code(text) from public;
revoke all on function public.claim_department_membership_by_code(text) from anon;
grant execute on function public.claim_department_membership_by_code(text) to authenticated;

create or replace function public.register_department_member_account(
  p_email text,
  p_registration_code text,
  p_password text
)
returns table (
  member_id uuid,
  department_id uuid,
  auth_user_id uuid
)
language plpgsql
security definer
volatile
set search_path = public, auth, pg_temp
as $$
declare
  v_candidate record;
  v_existing_auth_user_id uuid;
  v_new_auth_user_id uuid := gen_random_uuid();
  v_normalized_email text;
  v_password_hash text;
  v_now timestamptz := now();
begin
  v_normalized_email := lower(btrim(coalesce(p_email, '')));

  if v_normalized_email = '' then
    raise exception 'Validation error: email is required.';
  end if;

  if btrim(coalesce(p_password, '')) = '' then
    raise exception 'Validation error: password is required.';
  end if;

  select *
  into v_candidate
  from public.validate_department_registration_candidate(v_normalized_email, p_registration_code)
  limit 1;

  if v_candidate.member_id is null then
    raise exception 'Validation error: email and department code do not match an active roster member.';
  end if;

  if v_candidate.already_linked then
    raise exception 'Conflict: this roster member already has a Redline account. Log in instead.';
  end if;

  select u.id
  into v_existing_auth_user_id
  from auth.users u
  where lower(coalesce(u.email, '')) = v_normalized_email
    and u.deleted_at is null
  limit 1;

  if v_existing_auth_user_id is not null then
    raise exception 'Conflict: this email already has a Redline account. Log in, then join the department with your code.';
  end if;

  v_password_hash := crypt(p_password, gen_salt('bf'));

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  )
  values (
    v_new_auth_user_id,
    'authenticated',
    'authenticated',
    v_normalized_email,
    v_password_hash,
    v_now,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('email_verified', true),
    false,
    false,
    v_now,
    v_now
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    email,
    created_at,
    updated_at
  )
  values (
    v_new_auth_user_id::text,
    v_new_auth_user_id,
    jsonb_build_object(
      'sub', v_new_auth_user_id::text,
      'email', v_normalized_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_normalized_email,
    v_now,
    v_now
  );

  update public.members
  set auth_user_id = v_new_auth_user_id
  where id = v_candidate.member_id
    and auth_user_id is null;

  if not found then
    raise exception 'Conflict: the roster member was linked by another request.';
  end if;

  return query
    select v_candidate.member_id, v_candidate.department_id, v_new_auth_user_id;
end;
$$;

revoke all on function public.register_department_member_account(text, text, text) from public;
revoke all on function public.register_department_member_account(text, text, text) from anon;
grant execute on function public.register_department_member_account(text, text, text) to anon;
grant execute on function public.register_department_member_account(text, text, text) to authenticated;
