alter table public.members
  add column if not exists auth_user_id uuid;

with member_email_candidates as (
  select
    m.id as member_id,
    lower(btrim(m.email)) as normalized_email
  from public.members m
  where m.auth_user_id is null
    and m.email is not null
    and btrim(m.email) <> ''
),
auth_email_candidates as (
  select
    u.id as auth_user_id,
    lower(btrim(u.email)) as normalized_email
  from auth.users u
  where u.email is not null
    and btrim(u.email) <> ''
),
member_unique_email as (
  select normalized_email
  from member_email_candidates
  group by normalized_email
  having count(*) = 1
),
auth_unique_email as (
  select normalized_email
  from auth_email_candidates
  group by normalized_email
  having count(*) = 1
),
one_to_one_matches as (
  select
    mec.member_id,
    aec.auth_user_id
  from member_email_candidates mec
  join auth_email_candidates aec
    on aec.normalized_email = mec.normalized_email
  join member_unique_email mue
    on mue.normalized_email = mec.normalized_email
  join auth_unique_email aue
    on aue.normalized_email = mec.normalized_email
)
update public.members m
set auth_user_id = o2o.auth_user_id
from one_to_one_matches o2o
where m.id = o2o.member_id
  and m.auth_user_id is null;

create unique index if not exists members_auth_user_id_unique_idx
  on public.members (auth_user_id)
  where auth_user_id is not null;

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
