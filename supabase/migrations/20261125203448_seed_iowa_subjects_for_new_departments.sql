-- Seed Iowa training subjects for departments created after this migration.
create or replace function public.seed_department_system_training_categories() returns trigger language plpgsql set search_path=public as $$
begin
insert into public.training_categories(department_id,name,description,active,compliance_bucket,system_key,iowa_subject_code) values
(new.id,'Fire Training','General fire-service training and skills development.',true,'fire_annual','fire_training',null),
(new.id,'EMS Continuing Education','Standard EMS CE category; select an EMS topic for CE documentation.',true,'ems_ce','ems_continuing_education',null),
(new.id,'Driver/Operator','Apparatus driving and operator training.',true,'fire_annual','driver_operator',null),
(new.id,'HazMat','Hazardous materials training.',true,'fire_annual','hazmat',null),
(new.id,'Incident Command','Incident management and command.',true,'fire_annual','incident_command',null),
(new.id,'Officer Development','Officer development.',true,'fire_annual','officer_development',null),
(new.id,'Building Familiarization / Pre-Planning','Building visits and pre-incident planning.',true,'fire_annual','building_familiarization',null),
(new.id,'Recruit Training','Recruit training.',true,'fire_annual','recruit_training',null),
(new.id,'Safety','Iowa subjects: firefighter safety, PPE, and respiratory protection.',true,'fire_annual','safety','01,08'),
(new.id,'Other Training','Iowa local-needs training subject.',true,'fire_annual','other_training',null),

(new.id,'Structural Firefighting / SOPs & SOGs','Structural firefighting techniques including SOPs and SOGs.',true,'fire_annual','iowa_structural_firefighting','02'),
(new.id,'Ground Ladders','Ground ladders.',true,'fire_annual','iowa_ground_ladders','03'),
(new.id,'Hose & Hose Appliances','Hose and hose appliances.',true,'fire_annual','iowa_hose_appliances','04'),
(new.id,'Ventilation','Ventilation.',true,'fire_annual','iowa_ventilation','05'),
(new.id,'Forcible Entry','Forcible entry.',true,'fire_annual','iowa_forcible_entry','06'),
(new.id,'Search & Rescue','Search and rescue techniques.',true,'fire_annual','iowa_search_rescue','07'),
(new.id,'Additional SOP / SOG Training','Additional SOP/SOG training.',true,'fire_annual','iowa_additional_sop_sog','13'),
(new.id,'OSHA-Related / Bloodborne Pathogens','OSHA-related training, including bloodborne pathogens.',true,'fire_annual','iowa_osha_safety','14'),
(new.id,'Specialty Training','Confined space, extrication, rescue, wildland, or agricultural firefighting.',true,'fire_annual','iowa_specialty_training','15'),
(new.id,'Emergency Response to Terrorism','Emergency response to terrorism.',true,'fire_annual','iowa_terrorism_response','16')
on conflict(department_id,system_key) where system_key is not null do nothing;
return new; end; $$;