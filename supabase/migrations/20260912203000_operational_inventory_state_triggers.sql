create or replace function public.reconcile_scba_pack_from_flow_test()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pack public.scba_packs%rowtype;
  v_has_active_deficiency boolean;
begin
  select * into v_pack
  from public.scba_packs
  where id = new.scba_pack_id
    and department_id = new.department_id
  for update;

  if v_pack.id is null or (v_pack.last_flow_test_date is not null and new.test_date < v_pack.last_flow_test_date) then
    return new;
  end if;

  select exists (
    select 1
    from public.deficiencies d
    join public.deficiency_statuses ds on ds.id = d.status
    where d.department_id = new.department_id
      and d.scba_pack_id = new.scba_pack_id
      and ds.active = true
  ) into v_has_active_deficiency;

  update public.scba_packs
  set
    last_flow_test_date = new.test_date,
    next_flow_test_due_date = new.test_date + interval '1 year',
    status = case
      when v_pack.status = 'Retired' then 'Retired'
      when new.result = 'Fail' or v_has_active_deficiency then 'Out of Service'
      else 'Ready'
    end
  where id = v_pack.id
    and department_id = new.department_id;

  return new;
end;
$$;

drop trigger if exists trg_reconcile_scba_pack_from_flow_test on public.scba_pack_flow_tests;
create trigger trg_reconcile_scba_pack_from_flow_test
after insert on public.scba_pack_flow_tests
for each row execute function public.reconcile_scba_pack_from_flow_test();

create or replace function public.reconcile_gas_monitor_from_calibration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_monitor public.gas_monitors%rowtype;
  v_has_newer_calibration boolean;
  v_has_active_deficiency boolean;
  v_has_open_assignment boolean;
begin
  select * into v_monitor from public.gas_monitors
  where id = new.gas_monitor_id and department_id = new.department_id
  for update;

  if v_monitor.id is null then return new; end if;

  select exists (
    select 1 from public.gas_monitor_calibrations c
    where c.department_id = new.department_id and c.gas_monitor_id = new.gas_monitor_id and c.calibration_date > new.calibration_date
    union all
    select 1 from public.gas_monitor_calibration_session_results r
    where r.department_id = new.department_id and r.gas_monitor_id = new.gas_monitor_id and r.calibration_date > new.calibration_date
  ) into v_has_newer_calibration;

  if v_has_newer_calibration then return new; end if;

  select exists (
    select 1 from public.deficiencies d join public.deficiency_statuses ds on ds.id = d.status
    where d.department_id = new.department_id and d.gas_monitor_id = new.gas_monitor_id and ds.active = true
  ) into v_has_active_deficiency;
  select exists (
    select 1 from public.gas_monitor_assignments a
    where a.department_id = new.department_id and a.gas_monitor_id = new.gas_monitor_id
      and a.ended_at is null and a.assignment_type in ('Member', 'Apparatus')
  ) into v_has_open_assignment;

  update public.gas_monitors set status = case
    when v_monitor.status in ('Retired', 'Lost', 'Stolen') then v_monitor.status
    when new.result = 'Failed' or v_has_active_deficiency then 'Out of Service'
    when v_has_open_assignment then 'In Service'
    else 'Unassigned'
  end where id = v_monitor.id and department_id = new.department_id;
  return new;
end;
$$;

drop trigger if exists trg_reconcile_gas_monitor_from_calibration on public.gas_monitor_calibrations;
create trigger trg_reconcile_gas_monitor_from_calibration
after insert on public.gas_monitor_calibrations
for each row execute function public.reconcile_gas_monitor_from_calibration();

drop trigger if exists trg_reconcile_gas_monitor_from_session_result on public.gas_monitor_calibration_session_results;
create trigger trg_reconcile_gas_monitor_from_session_result
after insert on public.gas_monitor_calibration_session_results
for each row execute function public.reconcile_gas_monitor_from_calibration();

drop policy if exists rope_inspections_write_by_department on public.rope_inspections;
drop policy if exists rope_inspections_delete_by_department on public.rope_inspections;
create policy rope_inspections_insert_by_department
on public.rope_inspections for insert to authenticated
with check (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))));

drop policy if exists rope_inspection_participants_write_by_department on public.rope_inspection_participants;
drop policy if exists rope_inspection_participants_delete_by_department on public.rope_inspection_participants;
create policy rope_inspection_participants_insert_by_department
on public.rope_inspection_participants for insert to authenticated
with check (department_id in (select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))));