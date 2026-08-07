alter table public.members
  add column if not exists role text;

update public.members
set role = 'Firefighter'
where role is null
   or btrim(role) = ''
   or role not in ('Firefighter', 'Officer', 'Administrator');

alter table public.members
  alter column role set default 'Firefighter';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_role_check'
  ) then
    alter table public.members
      add constraint members_role_check
      check (role in ('Firefighter', 'Officer', 'Administrator'));
  end if;
end $$;

alter table public.members
  alter column role set not null;
