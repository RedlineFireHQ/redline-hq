begin;

do $$
begin
  if exists (
    select 1
    from public.departments d
    cross join (values
      ('iowa', 'ccp', '2026-ccp-phase1', 46),
      ('nremt', 'paramedic', '2026-paramedic-30', 30)
    ) as expected(authority, level, version_label, hours)
    left join public.ems_requirement_sets s
      on s.department_id = d.id and s.authority = expected.authority
      and s.certification_level = expected.level and s.version_label = expected.version_label
    where s.id is null or s.total_required_hours is distinct from expected.hours
      or s.publication_status <> 'published'
  ) then
    raise exception 'Each department must have published Iowa CCP 46-hour and NREMT Paramedic 30-hour requirements';
  end if;

  if exists (
    select 1
    from public.ems_requirement_sets s
    left join public.ems_requirement_components c on c.requirement_set_id = s.id
      and c.component_code in ('core', 'national_component')
    left join public.ems_requirement_topics t on t.requirement_component_id = c.id
    where (s.authority = 'iowa' and s.certification_level = 'ccp' and s.version_label = '2026-ccp-phase1')
      or (s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30')
    group by s.id, s.authority, s.total_required_hours
    having count(distinct c.id) <> 1
      or count(t.id) <> case when s.authority = 'iowa' then 7 else 5 end
      or sum(t.required_hours) <> s.total_required_hours
      or min(c.required_hours) <> s.total_required_hours
      or bool_or(not c.active or not t.active)
      or bool_or(s.authority = 'nremt' and c.pediatric_required)
      or bool_or(c.component_code <> case when s.authority = 'iowa' then 'core' else 'national_component' end)
  ) then
    raise exception 'Iowa CCP and NREMT Paramedic category totals must match their requirements';
  end if;

  if exists (
    select s.id, expected.code, expected.hours
    from public.ems_requirement_sets s
    cross join (values
      ('airway_respirations_ventilations', 6), ('cardiology', 7), ('trauma', 5),
      ('medical', 8), ('operations', 4), ('pediatric', 4), ('critical_care_paramedic', 12)
    ) as expected(code, hours)
    where (
        (s.authority = 'iowa' and s.certification_level = 'ccp' and s.version_label = '2026-ccp-phase1')
        or (s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30')
      )
      and (s.authority = 'iowa' or expected.code not in ('pediatric', 'critical_care_paramedic'))
    except
    select s.id, t.topic_code, t.required_hours
    from public.ems_requirement_sets s
    join public.ems_requirement_components c on c.requirement_set_id = s.id
    join public.ems_requirement_topics t on t.requirement_component_id = c.id
    where (s.authority = 'iowa' and s.certification_level = 'ccp' and s.version_label = '2026-ccp-phase1')
      or (s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30')
  ) then
    raise exception 'Iowa CCP or NREMT Paramedic topic hours differ from the exact Phase 1 configuration';
  end if;

  if exists (
    select 1 from public.ems_requirement_sets
    where authority = 'nremt' and certification_level = 'ccp'
  ) then
    raise exception 'National Registry CCP is not supported';
  end if;

  if exists (
    select 1
    from public.ems_requirement_sets s
    cross join (values ('local_state_component'), ('individual_component')) as expected(code)
    left join public.ems_requirement_components c
      on c.requirement_set_id = s.id and c.component_code = expected.code
    where s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30'
      and (c.id is null or c.required_hours is distinct from 0 or c.pediatric_required or not c.active)
  ) then
    raise exception 'Simplified NREMT Paramedic must require zero Local/State and Individual hours';
  end if;

  if exists (
    select 1
    from public.ems_requirement_sets s
    left join public.ems_requirement_components c on c.requirement_set_id = s.id
    where s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30'
    group by s.id
    having count(c.id) <> 3 or sum(c.required_hours) is distinct from 30
  ) or exists (
    select 1
    from public.ems_requirement_sets s
    join public.ems_requirement_components c on c.requirement_set_id = s.id
    join public.ems_requirement_topics t on t.requirement_component_id = c.id
    where s.authority = 'nremt' and s.certification_level = 'paramedic' and s.version_label = '2026-paramedic-30'
      and c.component_code <> 'national_component'
  ) then
    raise exception 'NREMT Paramedic must have exactly three components totaling 30, with topics only in the national component';
  end if;

  if exists (
    select 1
    from public.ems_requirement_sets s
    join public.ems_requirement_components c on c.requirement_set_id = s.id
    left join public.ems_requirement_topics t on t.requirement_component_id = c.id and t.topic_code = 'pediatric'
    where s.authority = 'iowa' and s.certification_level in ('emr', 'emt', 'aemt', 'paramedic')
      and c.component_code = 'core'
      and (t.id is null or t.required_hours <> 0 or not t.active)
  ) then
    raise exception 'Legacy Iowa levels must expose Pediatric without Phase 2 required hours';
  end if;
end;
$$;

rollback;
