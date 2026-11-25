-- Reuse the existing Safety category for Iowa subjects 1 and 8.
-- Keep the previously provisioned PPE row inactive for historical safety.
drop trigger if exists trg_protect_system_training_categories on public.training_categories;
update public.training_categories set iowa_subject_code='01,08' where system_key='safety';
update public.training_categories set active=false,name='Legacy duplicate - PPE / Respiratory Protection' where system_key='iowa_ppe_respiratory';
create or replace function public.protect_system_training_categories() returns trigger language plpgsql set search_path=public as $$
declare v_reserved_names text[] := array['ppe / respiratory protection','structural firefighting / sops & sogs','ground ladders','hose & hose appliances','hose and hose appliances','ventilation','forcible entry','search & rescue','search and rescue','additional sop / sog training','osha-related / bloodborne pathogens','specialty training','emergency response to terrorism','fire training','ems continuing education','ems','driver/operator','driver operator','hazmat','hazardous materials','incident command','officer development','officer training','building familiarization','building familiarization / pre-planning','pre-plans / site visits','preplans','pre-plans','recruit training','recruit','safety','safety/ppe','safety & ppe','safety and ppe','other training','other'];
begin
if tg_op='DELETE' then if old.system_key is not null then raise exception 'Redline HQ standard training categories cannot be deleted.'; end if; return old; end if;
if tg_op='UPDATE' and old.system_key is not null then
if new.system_key is distinct from old.system_key or new.department_id is distinct from old.department_id or new.name is distinct from old.name or new.active is distinct from old.active or new.compliance_bucket is distinct from old.compliance_bucket or new.iowa_subject_code is distinct from old.iowa_subject_code then raise exception 'Redline HQ standard training categories cannot be renamed, deactivated, moved, or reclassified.'; end if;
elsif new.system_key is null and (new.compliance_bucket='ems_ce' or lower(btrim(new.name))=any(v_reserved_names)) then raise exception 'This name or classification is reserved for a Redline HQ standard training category.';
end if; return new; end; $$;
create trigger trg_protect_system_training_categories before insert or update or delete on public.training_categories for each row execute function public.protect_system_training_categories();
do $$
declare v text;
begin
select pg_get_functiondef('public.seed_department_system_training_categories()'::regprocedure) into v;
v := replace(v, '(new.id,''Safety'',''Firefighter safety and risk management.'',true,''fire_annual'',''safety'',null)', '(new.id,''Safety'',''Iowa subjects: firefighter safety, PPE, and respiratory protection.'',true,''fire_annual'',''safety'',''01,08'')');
v := replace(v, '(new.id,''PPE / Respiratory Protection'',''Personal protective equipment and respiratory protection.'',true,''fire_annual'',''iowa_ppe_respiratory'',''01''),', '');
execute v;
end $$;