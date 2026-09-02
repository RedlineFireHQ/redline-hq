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
set search_path = public, extensions, auth, pg_temp
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

  v_password_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  )
  values (
    v_new_auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_normalized_email,
    v_password_hash,
    v_now,
    '',
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
    v_now,
    v_now
  );

  update public.members
  set auth_user_id = v_new_auth_user_id
  where public.members.id = v_candidate.member_id
    and public.members.auth_user_id is null;

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
