begin;

do $$
begin
  if exists (
    select 1
    from public.departments d
    cross join (values ('emr', 9), ('emt', 22), ('aemt', 28), ('paramedic', 34)) as expected(level, hours)
    left join public.ems_requirement_sets s
      on s.department_id = d.id and s.authority = 'iowa'
      and s.certification_level = expected.level and s.version_label = '2026-iowa-nov1'
    where s.id is null or s.total_required_hours is distinct from expected.hours
      or s.publication_status <> 'published' or s.effective_start_date <> date '2026-11-01'
      or s.effective_end_date is not null
  ) then
    raise exception 'Every department must have all four published Iowa versions effective November 1, 2026';
  end if;

  if exists (
    select s.id
    from public.ems_requirement_sets s
    left join public.ems_requirement_components c on c.requirement_set_id = s.id
    left join public.ems_requirement_topics t on t.requirement_component_id = c.id
    where s.version_label = '2026-iowa-nov1'
    group by s.id, s.authority, s.certification_level, s.total_required_hours
    having s.authority <> 'iowa' or s.certification_level not in ('emr', 'emt', 'aemt', 'paramedic')
      or count(distinct c.id) <> 1 or count(t.id) <> 6
      or sum(t.required_hours) is distinct from s.total_required_hours
      or min(c.required_hours) is distinct from s.total_required_hours
      or bool_or(c.component_code <> 'core' or not c.active or not c.pediatric_required or not t.active)
      or min(c.pediatric_min_hours) is distinct from
        case s.certification_level when 'emr' then 1 when 'emt' then 2 when 'aemt' then 3 when 'paramedic' then 4 end
  ) then
    raise exception 'Updated Iowa requirements must have one core component and six active topics with matching totals';
  end if;

  if exists (
    select 1
    from public.ems_requirement_sets s
    cross join (values
      ('airway_respirations_ventilations', 1.5, 4, 5, 6),
      ('cardiology', 2, 5, 6, 7), ('trauma', 1, 3, 4, 5),
      ('medical', 2.5, 6, 7, 8), ('operations', 1, 2, 3, 4), ('pediatric', 1, 2, 3, 4)
    ) as expected(code, emr, emt, aemt, paramedic)
    left join public.ems_requirement_components c on c.requirement_set_id = s.id and c.component_code = 'core'
    left join public.ems_requirement_topics t on t.requirement_component_id = c.id and t.topic_code = expected.code
    where s.authority = 'iowa' and s.version_label = '2026-iowa-nov1'
      and (t.id is null or t.required_hours is distinct from
        case s.certification_level when 'emr' then expected.emr when 'emt' then expected.emt
          when 'aemt' then expected.aemt when 'paramedic' then expected.paramedic end
        or t.pediatric_applicable is distinct from (expected.code = 'pediatric'))
  ) then
    raise exception 'Iowa topic hours or Pediatric applicability differ from the approved November 2026 matrix';
  end if;
end;
$$;

rollback;
