-- Add explicit MISSING status to EMS bag and drug-box inspection snapshots.
-- Existing inspection records are retained. Historical unchecked drug-box rows
-- are classified as MISSING because the previous workflow recorded them as absent.

alter table public.pediatric_bag_checklist_progress
  drop constraint if exists pediatric_bag_checklist_progress_status_check;
alter table public.pediatric_bag_checklist_progress
  add constraint pediatric_bag_checklist_progress_status_check
  check (status in ('checked','expired','missing','deficiency','not_applicable','needs_review'));

alter table public.pediatric_bag_checklist_results
  drop constraint if exists pediatric_bag_checklist_results_result_status_check;
alter table public.pediatric_bag_checklist_results
  add constraint pediatric_bag_checklist_results_result_status_check
  check (result_status in ('checked','expired','missing','deficiency','not_applicable','needs_review'));

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.complete_pediatric_bag_check(uuid,text,text)'::regprocedure)
    into v_definition;
  if position('p.status in (''checked'', ''expired'')' in v_definition) = 0 then
    raise exception 'Expected pediatric completion status condition was not found.';
  end if;
  v_definition := replace(
    v_definition,
    'p.status in (''checked'', ''expired'')',
    'p.status in (''checked'', ''expired'', ''missing'')'
  );
  execute v_definition;
end;
$$;

alter table public.drug_box_checklist_results
  add column if not exists result_status text;

update public.drug_box_checklist_results
set result_status = case when is_checked then 'checked' else 'missing' end
where result_status is null;

alter table public.drug_box_checklist_results
  alter column result_status set default 'checked';
alter table public.drug_box_checklist_results
  alter column result_status set not null;
alter table public.drug_box_checklist_results
  add constraint drug_box_checklist_results_result_status_check
  check (result_status in ('checked','expired','missing'));
