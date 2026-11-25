-- Hide the redundant legacy Fire Suppression category without deleting it or its history.
-- Rename the Iowa-specific additional SOP/SOG subject so it is distinguishable from
-- the broader Structural Firefighting / SOPs & SOGs subject.
update public.training_categories
set active = false
where lower(trim(name)) = 'fire suppression'
  and system_key is null
  and active = true;

update public.training_categories
set name = 'Other Department SOPs / SOGs',
    description = 'Additional department SOP/SOG training beyond the core structural firefighting subject.'
where system_key = 'iowa_additional_sop_sog'
  and name = 'Additional SOP / SOG Training';
