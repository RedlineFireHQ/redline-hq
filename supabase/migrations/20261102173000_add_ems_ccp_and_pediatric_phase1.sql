begin;

alter table public.ems_requirement_sets
  drop constraint ems_requirement_sets_certification_level_check,
  add constraint ems_requirement_sets_certification_level_check
    check (certification_level in ('emr', 'emt', 'aemt', 'paramedic')
      or (authority = 'iowa' and certification_level = 'ccp'));

alter table public.ems_member_track_profiles
  drop constraint ems_member_track_profiles_certification_level_check,
  add constraint ems_member_track_profiles_certification_level_check
    check (certification_level in ('emr', 'emt', 'aemt', 'paramedic')
      or (track = 'iowa' and certification_level = 'ccp'));

alter table public.certifications
  drop constraint certifications_ems_certification_level_valid,
  add constraint certifications_ems_certification_level_valid
    check (ems_certification_level is null
      or ems_certification_level in ('emr', 'emt', 'aemt', 'paramedic')
      or (ems_authority is not null and ems_authority = 'iowa' and ems_certification_level = 'ccp'));

alter table public.training_events
  drop constraint training_events_ems_core_topic_check,
  add constraint training_events_ems_core_topic_check
    check (ems_core_topic is null or ems_core_topic in (
      'airway_respirations_ventilations', 'cardiology', 'trauma', 'medical',
      'operations', 'pediatric', 'critical_care_paramedic', 'other'
    ));

alter table public.training_outside_submissions
  drop constraint training_outside_submissions_ems_core_topic_check,
  add constraint training_outside_submissions_ems_core_topic_check
    check (ems_core_topic is null or ems_core_topic in (
      'airway_respirations_ventilations', 'cardiology', 'trauma', 'medical',
      'operations', 'pediatric', 'critical_care_paramedic', 'other'
    ));

insert into public.ems_requirement_sets (
  department_id, authority, certification_level, version_label,
  publication_status, source_citation, effective_start_date, total_required_hours, notes
)
select d.id, v.authority, v.level, v.version_label, 'published',
  'Redline HQ Phase 1 requirements supplied by department administrator',
  current_date, v.total_hours,
  'Phase 1: Iowa CCP 46 hours; simplified NREMT Paramedic 30 hours. Other levels and historical versions are unchanged.'
from public.departments d
cross join (values
  ('iowa', 'ccp', '2026-ccp-phase1', 46),
  ('nremt', 'paramedic', '2026-paramedic-30', 30)
) as v(authority, level, version_label, total_hours)
on conflict (department_id, authority, certification_level, version_label) do nothing;

insert into public.ems_requirement_components (
  department_id, requirement_set_id, component_code, component_name,
  sort_order, required_hours, pediatric_required, active
)
select s.department_id, s.id,
  case when s.authority = 'iowa' then 'core' else 'national_component' end,
  case when s.authority = 'iowa' then 'Iowa Core' else 'National Component' end,
  0, s.total_required_hours, s.authority = 'iowa', true
from public.ems_requirement_sets s
where (s.authority = 'iowa' and s.certification_level = 'ccp' and s.version_label = '2026-ccp-phase1')
  or (s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30')
on conflict (requirement_set_id, component_code) do nothing;

insert into public.ems_requirement_components (
  department_id, requirement_set_id, component_code, component_name,
  sort_order, required_hours, pediatric_required, active
)
select s.department_id, s.id, c.code, c.name, c.sort_order, 0, false, true
from public.ems_requirement_sets s
cross join (values
  ('local_state_component', 'Local/State Component', 1),
  ('individual_component', 'Individual Component', 2)
) as c(code, name, sort_order)
where s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30'
on conflict (requirement_set_id, component_code) do nothing;

insert into public.ems_requirement_topics (
  department_id, requirement_component_id, topic_code, topic_name,
  sort_order, required_hours, pediatric_applicable, active
)
select c.department_id, c.id, t.code, t.name, t.sort_order, t.hours,
  t.code = 'pediatric', true
from public.ems_requirement_components c
join public.ems_requirement_sets s on s.id = c.requirement_set_id
cross join (values
  ('airway_respirations_ventilations', 'Airway, Respirations, Ventilations', 1, 6),
  ('cardiology', 'Cardiology', 2, 7),
  ('trauma', 'Trauma', 3, 5),
  ('medical', 'Medical', 4, 8),
  ('operations', 'Operations', 5, 4),
  ('pediatric', 'Pediatric', 6, 4),
  ('critical_care_paramedic', 'Critical Care Paramedic', 7, 12)
) as t(code, name, sort_order, hours)
where (
    (s.authority = 'iowa' and s.certification_level = 'ccp' and s.version_label = '2026-ccp-phase1')
    or (s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30')
  )
  and c.component_code in ('core', 'national_component')
  and (s.authority = 'iowa' or t.code not in ('pediatric', 'critical_care_paramedic'))
on conflict (requirement_component_id, topic_code) do nothing;

-- Pediatric is available for legacy Iowa levels, but Phase 2 assigns any new minimum.
insert into public.ems_requirement_topics (
  department_id, requirement_component_id, topic_code, topic_name,
  sort_order, required_hours, pediatric_applicable, active
)
select c.department_id, c.id, 'pediatric', 'Pediatric', 6, 0, true, true
from public.ems_requirement_components c
join public.ems_requirement_sets s on s.id = c.requirement_set_id
where s.authority = 'iowa' and s.certification_level in ('emr', 'emt', 'aemt', 'paramedic')
  and c.component_code = 'core'
on conflict (requirement_component_id, topic_code) do nothing;

commit;
