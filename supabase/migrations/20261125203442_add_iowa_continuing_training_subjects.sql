-- Iowa continuing-training subjects. Existing ISO-overlap categories are reused.
alter table public.training_categories add column if not exists iowa_subject_code text;
create unique index if not exists training_categories_department_iowa_subject_code_uidx on public.training_categories(department_id,iowa_subject_code) where iowa_subject_code is not null;
drop trigger if exists trg_protect_system_training_categories on public.training_categories;
update public.training_categories set compliance_bucket='fire_annual',description='Iowa continuing-training subject: any other training designed to meet local training needs.' where system_key='other_training';
with x(system_key,name,description,code) as (values
('iowa_ppe_respiratory','PPE / Respiratory Protection','Personal protective equipment and respiratory protection.','01'),
('iowa_structural_firefighting','Structural Firefighting / SOPs & SOGs','Structural firefighting techniques including SOPs and SOGs.','02'),
('iowa_ground_ladders','Ground Ladders','Ground ladders.','03'),
('iowa_hose_appliances','Hose & Hose Appliances','Hose and hose appliances.','04'),
('iowa_ventilation','Ventilation','Ventilation.','05'),
('iowa_forcible_entry','Forcible Entry','Forcible entry.','06'),
('iowa_search_rescue','Search & Rescue','Search and rescue techniques.','07'),
('iowa_additional_sop_sog','Additional SOP / SOG Training','Additional SOP/SOG training.','13'),
('iowa_osha_safety','OSHA-Related / Bloodborne Pathogens','OSHA-related training, including bloodborne pathogens.','14'),
('iowa_specialty_training','Specialty Training','Confined space, extrication, rescue, wildland, or agricultural firefighting.','15'),
('iowa_terrorism_response','Emergency Response to Terrorism','Emergency response to terrorism.','16'))
insert into public.training_categories(department_id,name,description,active,compliance_bucket,system_key,iowa_subject_code)
select d.id,x.name,x.description,true,'fire_annual',x.system_key,x.code from public.departments d cross join x
where not exists(select 1 from public.training_categories c where c.department_id=d.id and c.system_key=x.system_key);
create or replace function public.protect_system_training_categories() returns trigger language plpgsql set search_path=public as $$
declare v_reserved_names text[] := array['ppe / respiratory protection','structural firefighting / sops & sogs','ground ladders','hose & hose appliances','hose and hose appliances','ventilation','forcible entry','search & rescue','search and rescue','additional sop / sog training','osha-related / bloodborne pathogens','specialty training','emergency response to terrorism','fire training','ems continuing education','ems','driver/operator','driver operator','hazmat','hazardous materials','incident command','officer development','officer training','building familiarization','building familiarization / pre-planning','pre-plans / site visits','preplans','pre-plans','recruit training','recruit','safety','safety/ppe','safety & ppe','safety and ppe','other training','other'];
begin
if tg_op='DELETE' then if old.system_key is not null then raise exception 'Redline HQ standard training categories cannot be deleted.'; end if; return old; end if;
if tg_op='UPDATE' and old.system_key is not null then
if new.system_key is distinct from old.system_key or new.department_id is distinct from old.department_id or new.name is distinct from old.name or new.active is distinct from old.active or new.compliance_bucket is distinct from old.compliance_bucket or new.iowa_subject_code is distinct from old.iowa_subject_code then raise exception 'Redline HQ standard training categories cannot be renamed, deactivated, moved, or reclassified.'; end if;
elsif new.system_key is null and (new.compliance_bucket='ems_ce' or lower(btrim(new.name))=any(v_reserved_names)) then raise exception 'This name or classification is reserved for a Redline HQ standard training category.';
end if; return new; end; $$;
create trigger trg_protect_system_training_categories before insert or update or delete on public.training_categories for each row execute function public.protect_system_training_categories();