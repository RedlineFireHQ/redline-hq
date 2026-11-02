begin;

insert into public.ems_requirement_sets (
  department_id, authority, certification_level, version_label,
  publication_status, source_citation, effective_start_date, total_required_hours, notes
)
select d.id, 'iowa', v.level, '2026-iowa-nov1', 'published',
  'Iowa EMS requirements effective November 1, 2026, supplied by department administrator',
  date '2026-11-01', v.total_hours,
  'Iowa EMR, EMT, AEMT and Paramedic update only. Historical versions, Iowa CCP and National Registry remain unchanged.'
from public.departments d
cross join (values
  ('emr', 9), ('emt', 22), ('aemt', 28), ('paramedic', 34)
) as v(level, total_hours)
on conflict (department_id, authority, certification_level, version_label) do nothing;

insert into public.ems_requirement_components (
  department_id, requirement_set_id, component_code, component_name,
  sort_order, required_hours, pediatric_required, pediatric_min_hours, active
)
select s.department_id, s.id, 'core', 'Iowa Core', 0, s.total_required_hours,
  true, v.pediatric_hours, true
from public.ems_requirement_sets s
join (values
  ('emr', 1), ('emt', 2), ('aemt', 3), ('paramedic', 4)
) as v(level, pediatric_hours) on v.level = s.certification_level
where s.authority = 'iowa' and s.version_label = '2026-iowa-nov1'
on conflict (requirement_set_id, component_code) do nothing;

insert into public.ems_requirement_topics (
  department_id, requirement_component_id, topic_code, topic_name,
  sort_order, required_hours, pediatric_applicable, active
)
select c.department_id, c.id, t.code, t.name, t.sort_order,
  case s.certification_level
    when 'emr' then t.emr
    when 'emt' then t.emt
    when 'aemt' then t.aemt
    when 'paramedic' then t.paramedic
  end,
  t.code = 'pediatric', true
from public.ems_requirement_components c
join public.ems_requirement_sets s on s.id = c.requirement_set_id
cross join (values
  ('airway_respirations_ventilations', 'Airway, Respirations, Ventilations', 1, 1.5, 4, 5, 6),
  ('cardiology', 'Cardiology', 2, 2, 5, 6, 7),
  ('trauma', 'Trauma', 3, 1, 3, 4, 5),
  ('medical', 'Medical', 4, 2.5, 6, 7, 8),
  ('operations', 'Operations', 5, 1, 2, 3, 4),
  ('pediatric', 'Pediatric', 6, 1, 2, 3, 4)
) as t(code, name, sort_order, emr, emt, aemt, paramedic)
where s.authority = 'iowa' and s.version_label = '2026-iowa-nov1'
  and s.certification_level in ('emr', 'emt', 'aemt', 'paramedic')
  and c.component_code = 'core'
on conflict (requirement_component_id, topic_code) do nothing;

commit;
