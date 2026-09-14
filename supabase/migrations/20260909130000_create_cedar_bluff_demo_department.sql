-- Cedar Bluff Fire & Rescue — fictional Redline HQ Demo Department.
-- This script ONLY creates new rows scoped to a brand-new department_id.
-- It never reads, updates, or deletes any existing (Elliott) row, and never
-- references any Elliott id. Global reference tables (app_permissions,
-- deficiency_categories, deficiency_statuses, deficiency_priorities) are
-- read-only referenced here, never duplicated.
--
-- Design: a small key/value staging table (cb_ids) holds the generated
-- UUIDs for every row this script needs to reference again later, so every
-- insert below uses `(select id from cb_ids where key = '...')` instead of
-- hardcoding or re-querying by name.

create temporary table cb_ids (
  key text primary key,
  id uuid not null
) on commit drop;

-- 1. DEPARTMENT ------------------------------------------------------------
insert into cb_ids (key, id) values ('dept', gen_random_uuid());

insert into public.departments (id, name, city, state)
values (
  (select id from cb_ids where key = 'dept'),
  'Cedar Bluff Fire & Rescue',
  'Cedar Bluff',
  'NE'
);

-- 3. DEPARTMENT ROLES -------------------------------------------------------
insert into cb_ids (key, id)
values
  ('role_ff', gen_random_uuid()),
  ('role_drvop', gen_random_uuid()),
  ('role_lt', gen_random_uuid()),
  ('role_cpt', gen_random_uuid()),
  ('role_asstchief', gen_random_uuid()),
  ('role_chief', gen_random_uuid()),
  ('role_emscoord', gen_random_uuid());

insert into public.department_roles (id, department_id, name, code, description, sort_order)
values
  ((select id from cb_ids where key='role_ff'), (select id from cb_ids where key='dept'), 'Firefighter', 'FF', 'Line firefighter', 10),
  ((select id from cb_ids where key='role_drvop'), (select id from cb_ids where key='dept'), 'Driver/Operator', 'DRV_OP', 'Apparatus driver/operator', 20),
  ((select id from cb_ids where key='role_emscoord'), (select id from cb_ids where key='dept'), 'EMS Coordinator', 'EMS_COORD', 'Firefighter with EMS program responsibilities', 25),
  ((select id from cb_ids where key='role_lt'), (select id from cb_ids where key='dept'), 'Lieutenant', 'LT', 'Company officer', 30),
  ((select id from cb_ids where key='role_cpt'), (select id from cb_ids where key='dept'), 'Captain', 'CPT', 'Shift commander', 40),
  ((select id from cb_ids where key='role_asstchief'), (select id from cb_ids where key='dept'), 'Assistant Chief', 'ASST_CHIEF', 'Assistant chief', 50),
  ((select id from cb_ids where key='role_chief'), (select id from cb_ids where key='dept'), 'Chief', 'CHIEF', 'Department chief / administrator', 60);

-- 4. CERTIFICATIONS ----------------------------------------------------------
insert into cb_ids (key, id)
values
  ('cert_ff1', gen_random_uuid()),
  ('cert_ff2', gen_random_uuid()),
  ('cert_drvop', gen_random_uuid()),
  ('cert_off1', gen_random_uuid()),
  ('cert_off2', gen_random_uuid()),
  ('cert_aerial', gen_random_uuid()),
  ('cert_instructor', gen_random_uuid()),
  ('cert_hazawa', gen_random_uuid()),
  ('cert_hazops', gen_random_uuid()),
  ('cert_inspector', gen_random_uuid()),
  ('cert_investigator', gen_random_uuid()),
  ('cert_emt', gen_random_uuid()),
  ('cert_neemt', gen_random_uuid()),
  ('cert_nremtemt', gen_random_uuid());

insert into public.certifications (id, department_id, name, ems_authority, ems_certification_level)
values
  ((select id from cb_ids where key='cert_ff1'), (select id from cb_ids where key='dept'), 'Firefighter I', null, null),
  ((select id from cb_ids where key='cert_ff2'), (select id from cb_ids where key='dept'), 'Firefighter II', null, null),
  ((select id from cb_ids where key='cert_drvop'), (select id from cb_ids where key='dept'), 'Driver/Operator', null, null),
  ((select id from cb_ids where key='cert_off1'), (select id from cb_ids where key='dept'), 'Officer I', null, null),
  ((select id from cb_ids where key='cert_off2'), (select id from cb_ids where key='dept'), 'Officer II', null, null),
  ((select id from cb_ids where key='cert_aerial'), (select id from cb_ids where key='dept'), 'Aerial/Operator', null, null),
  ((select id from cb_ids where key='cert_instructor'), (select id from cb_ids where key='dept'), 'Instructor I', null, null),
  ((select id from cb_ids where key='cert_hazawa'), (select id from cb_ids where key='dept'), 'HazMat Awareness', null, null),
  ((select id from cb_ids where key='cert_hazops'), (select id from cb_ids where key='dept'), 'HazMat Operations', null, null),
  ((select id from cb_ids where key='cert_inspector'), (select id from cb_ids where key='dept'), 'Fire Inspector', null, null),
  ((select id from cb_ids where key='cert_investigator'), (select id from cb_ids where key='dept'), 'Fire Investigator', null, null),
  ((select id from cb_ids where key='cert_emt'), (select id from cb_ids where key='dept'), 'EMT', null, null),
  ((select id from cb_ids where key='cert_neemt'), (select id from cb_ids where key='dept'), 'Nebraska EMT', null, null),
  ((select id from cb_ids where key='cert_nremtemt'), (select id from cb_ids where key='dept'), 'NREMT EMT', 'nremt', 'emt');

-- Qualifications --------------------------------------------------------------
insert into cb_ids (key, id)
values
  ('qual_ff1', gen_random_uuid()),
  ('qual_hazawa', gen_random_uuid()),
  ('qual_hazops', gen_random_uuid()),
  ('qual_interior', gen_random_uuid());

insert into public.qualifications (id, department_id, name)
values
  ((select id from cb_ids where key='qual_ff1'), (select id from cb_ids where key='dept'), 'Firefighter I'),
  ((select id from cb_ids where key='qual_hazawa'), (select id from cb_ids where key='dept'), 'HazMat Awareness'),
  ((select id from cb_ids where key='qual_hazops'), (select id from cb_ids where key='dept'), 'HazMat Operations'),
  ((select id from cb_ids where key='qual_interior'), (select id from cb_ids where key='dept'), 'Interior Qualified');

-- 5. REQUIRED CERTIFICATIONS ---------------------------------------------------
insert into public.role_required_certifications (department_id, department_role_id, certification_id)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_ff'), (select id from cb_ids where key='cert_ff1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_drvop'), (select id from cb_ids where key='cert_ff1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_drvop'), (select id from cb_ids where key='cert_drvop')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_emscoord'), (select id from cb_ids where key='cert_ff1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_lt'), (select id from cb_ids where key='cert_ff1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_lt'), (select id from cb_ids where key='cert_off1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_cpt'), (select id from cb_ids where key='cert_off1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_cpt'), (select id from cb_ids where key='cert_off2')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_asstchief'), (select id from cb_ids where key='cert_off2')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_chief'), (select id from cb_ids where key='cert_off2'));

insert into public.role_required_qualifications (department_id, department_role_id, qualification_id)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_ff'), (select id from cb_ids where key='qual_ff1')),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='role_drvop'), (select id from cb_ids where key='qual_ff1'));

-- 6. TRAINING CATEGORIES + REQUIREMENTS ---------------------------------------
insert into cb_ids (key, id)
values
  ('tc_suppression', gen_random_uuid()),
  ('tc_drvop', gen_random_uuid()),
  ('tc_hazmat', gen_random_uuid()),
  ('tc_techrescue', gen_random_uuid()),
  ('tc_wildland', gen_random_uuid()),
  ('tc_ems', gen_random_uuid()),
  ('tc_safety', gen_random_uuid()),
  ('tc_command', gen_random_uuid()),
  ('tc_preplans', gen_random_uuid()),
  ('tc_comm', gen_random_uuid()),
  ('tc_other', gen_random_uuid());

insert into public.training_categories (id, department_id, name)
values
  ((select id from cb_ids where key='tc_suppression'), (select id from cb_ids where key='dept'), 'Fire Suppression'),
  ((select id from cb_ids where key='tc_drvop'), (select id from cb_ids where key='dept'), 'Driver/Operator'),
  ((select id from cb_ids where key='tc_hazmat'), (select id from cb_ids where key='dept'), 'Hazmat'),
  ((select id from cb_ids where key='tc_techrescue'), (select id from cb_ids where key='dept'), 'Technical Rescue'),
  ((select id from cb_ids where key='tc_wildland'), (select id from cb_ids where key='dept'), 'Wildland'),
  ((select id from cb_ids where key='tc_ems'), (select id from cb_ids where key='dept'), 'EMS'),
  ((select id from cb_ids where key='tc_safety'), (select id from cb_ids where key='dept'), 'Safety/PPE'),
  ((select id from cb_ids where key='tc_command'), (select id from cb_ids where key='dept'), 'Incident Command/Leadership'),
  ((select id from cb_ids where key='tc_preplans'), (select id from cb_ids where key='dept'), 'Pre-Plans / Site Visits'),
  ((select id from cb_ids where key='tc_comm'), (select id from cb_ids where key='dept'), 'Communications'),
  ((select id from cb_ids where key='tc_other'), (select id from cb_ids where key='dept'), 'Other');

insert into public.training_requirements (department_id, name, category_id, requirement_kind, period_type, minimum_hours, required_topic)
values
  ((select id from cb_ids where key='dept'), 'Annual Fire Training Hours', null, 'annual_hours', 'annual', 24, null),
  ((select id from cb_ids where key='dept'), 'Annual EMS CE Hours', (select id from cb_ids where key='tc_ems'), 'category_hours', 'annual', 24, null),
  ((select id from cb_ids where key='dept'), 'Wildland Refresher', (select id from cb_ids where key='tc_wildland'), 'topic', 'annual', null, 'Wildland Refresher (S-130/190 annual)'),
  ((select id from cb_ids where key='dept'), 'HazMat Ops Recurrency', (select id from cb_ids where key='tc_hazmat'), 'recurring', 'rolling_365_days', 8, null);

-- 8. EMS / EMS CE --------------------------------------------------------------
-- The EMS track architecture is hardcoded to authority in ('iowa','nremt').
-- Nebraska is not a supported track value, so Cedar Bluff members use the
-- national NREMT track (the correct existing option for a non-Iowa state)
-- rather than inventing a new enum value.
insert into public.ems_course_definitions (department_id, course_name)
values
  ((select id from cb_ids where key='dept'), 'ACLS'),
  ((select id from cb_ids where key='dept'), 'PALS'),
  ((select id from cb_ids where key='dept'), 'PHTLS'),
  ((select id from cb_ids where key='dept'), 'ITLS'),
  ((select id from cb_ids where key='dept'), 'CPR-HCP'),
  ((select id from cb_ids where key='dept'), 'EVOC/EVOS'),
  ((select id from cb_ids where key='dept'), 'TECC'),
  ((select id from cb_ids where key='dept'), 'TIMS'),
  ((select id from cb_ids where key='dept'), 'HAZMAT'),
  ((select id from cb_ids where key='dept'), 'Other');

insert into public.ems_requirement_sets (department_id, authority, certification_level, version_label, source_citation, effective_start_date)
values
  ((select id from cb_ids where key='dept'), 'nremt', 'emr', '2026-initial', 'National Registry of EMTs – EMR', '2026-01-01'),
  ((select id from cb_ids where key='dept'), 'nremt', 'emt', '2026-initial', 'National Registry of EMTs – EMT', '2026-01-01'),
  ((select id from cb_ids where key='dept'), 'nremt', 'aemt', '2026-initial', 'National Registry of EMTs – AEMT', '2026-01-01'),
  ((select id from cb_ids where key='dept'), 'nremt', 'paramedic', '2026-initial', 'National Registry of EMTs – Paramedic', '2026-01-01');

-- 2. PERSONNEL ------------------------------------------------------------------
-- Completely fictional names and emails on a non-deliverable ".invalid" domain
-- (RFC 2606 reserved) so nothing here can collide with a real inbox.
insert into cb_ids (key, id)
values
  ('member_chief', gen_random_uuid()),
  ('member_asstchief', gen_random_uuid()),
  ('member_cpt1', gen_random_uuid()),
  ('member_cpt2', gen_random_uuid()),
  ('member_lt1', gen_random_uuid()),
  ('member_lt2', gen_random_uuid()),
  ('member_ff1', gen_random_uuid()),
  ('member_ff2', gen_random_uuid()),
  ('member_ff3', gen_random_uuid()),
  ('member_ff4', gen_random_uuid()),
  ('member_ff5', gen_random_uuid()),
  ('member_ff6', gen_random_uuid()),
  ('member_ff7', gen_random_uuid()),
  ('member_ff8', gen_random_uuid()),
  ('member_ff9', gen_random_uuid()),
  ('member_ff10', gen_random_uuid()),
  ('member_ff11', gen_random_uuid()),
  ('member_ff12', gen_random_uuid());

insert into public.members (
  id, department_id, first_name, last_name, rank, email, phone, active, role,
  department_role_id, hire_start_date, inactive_date
)
values
  ((select id from cb_ids where key='member_chief'), (select id from cb_ids where key='dept'), 'Marcus', 'Whitfield', 'Chief', 'm.whitfield@cedarbluff-fire.invalid', '402-555-0101', true, 'Administrator', (select id from cb_ids where key='role_chief'), '2011-03-01', null),
  ((select id from cb_ids where key='member_asstchief'), (select id from cb_ids where key='dept'), 'Denise', 'Okafor', 'Assistant Chief', 'd.okafor@cedarbluff-fire.invalid', '402-555-0102', true, 'Officer', (select id from cb_ids where key='role_asstchief'), '2013-06-15', null),
  ((select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='dept'), 'Ryan', 'Delgado', 'Captain', 'r.delgado@cedarbluff-fire.invalid', '402-555-0103', true, 'Officer', (select id from cb_ids where key='role_cpt'), '2014-02-10', null),
  ((select id from cb_ids where key='member_cpt2'), (select id from cb_ids where key='dept'), 'Sarah', 'Kowalski', 'Captain', 's.kowalski@cedarbluff-fire.invalid', '402-555-0104', true, 'Officer', (select id from cb_ids where key='role_cpt'), '2015-09-20', null),
  ((select id from cb_ids where key='member_lt1'), (select id from cb_ids where key='dept'), 'Trevor', 'Nash', 'Lieutenant', 't.nash@cedarbluff-fire.invalid', '402-555-0105', true, 'Officer', (select id from cb_ids where key='role_lt'), '2016-04-05', null),
  ((select id from cb_ids where key='member_lt2'), (select id from cb_ids where key='dept'), 'Amanda', 'Reyes', 'Lieutenant', 'a.reyes@cedarbluff-fire.invalid', '402-555-0106', true, 'Officer', (select id from cb_ids where key='role_lt'), '2017-01-12', null),
  ((select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='dept'), 'Coleman', 'Vance', 'Driver Operator', 'c.vance@cedarbluff-fire.invalid', '402-555-0107', true, 'Firefighter', (select id from cb_ids where key='role_drvop'), '2017-05-01', null),
  ((select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='dept'), 'Priya', 'Anand', 'Firefighter', 'p.anand@cedarbluff-fire.invalid', '402-555-0108', true, 'Firefighter', (select id from cb_ids where key='role_emscoord'), '2018-03-18', null),
  ((select id from cb_ids where key='member_ff3'), (select id from cb_ids where key='dept'), 'Jordan', 'Pruitt', 'Driver Operator', 'j.pruitt@cedarbluff-fire.invalid', '402-555-0109', true, 'Firefighter', (select id from cb_ids where key='role_drvop'), '2018-07-22', null),
  ((select id from cb_ids where key='member_ff4'), (select id from cb_ids where key='dept'), 'Megan', 'Calloway', 'Firefighter', 'm.calloway@cedarbluff-fire.invalid', '402-555-0110', true, 'Firefighter', (select id from cb_ids where key='role_ff'), '2019-01-14', null),
  ((select id from cb_ids where key='member_ff5'), (select id from cb_ids where key='dept'), 'Dominic', 'Cruz', 'Firefighter', 'd.cruz@cedarbluff-fire.invalid', '402-555-0111', true, 'Firefighter', (select id from cb_ids where key='role_emscoord'), '2019-06-09', null),
  ((select id from cb_ids where key='member_ff6'), (select id from cb_ids where key='dept'), 'Hannah', 'Ostrowski', 'Firefighter', 'h.ostrowski@cedarbluff-fire.invalid', '402-555-0112', true, 'Firefighter', (select id from cb_ids where key='role_ff'), '2024-11-04', null),
  ((select id from cb_ids where key='member_ff7'), (select id from cb_ids where key='dept'), 'Elijah', 'Trumbull', 'Firefighter', 'e.trumbull@cedarbluff-fire.invalid', '402-555-0113', true, 'Firefighter', (select id from cb_ids where key='role_ff'), '2020-02-17', null),
  ((select id from cb_ids where key='member_ff8'), (select id from cb_ids where key='dept'), 'Natalie', 'Fenwick', 'Firefighter', 'n.fenwick@cedarbluff-fire.invalid', '402-555-0114', true, 'Firefighter', (select id from cb_ids where key='role_ff'), '2020-08-30', null),
  ((select id from cb_ids where key='member_ff9'), (select id from cb_ids where key='dept'), 'Caleb', 'Marsh', 'Firefighter', 'c.marsh@cedarbluff-fire.invalid', '402-555-0115', false, 'Firefighter', (select id from cb_ids where key='role_ff'), '2015-05-01', '2026-06-30'),
  ((select id from cb_ids where key='member_ff10'), (select id from cb_ids where key='dept'), 'Brianna', 'Solis', 'Firefighter', 'b.solis@cedarbluff-fire.invalid', '402-555-0116', true, 'Firefighter', (select id from cb_ids where key='role_ff'), '2021-04-11', null),
  ((select id from cb_ids where key='member_ff11'), (select id from cb_ids where key='dept'), 'Tyler', 'Brannigan', 'Firefighter', 't.brannigan@cedarbluff-fire.invalid', '402-555-0117', false, 'Firefighter', (select id from cb_ids where key='role_ff'), '2016-09-19', '2026-03-15'),
  ((select id from cb_ids where key='member_ff12'), (select id from cb_ids where key='dept'), 'Olivia', 'Chastain', 'Firefighter', 'o.chastain@cedarbluff-fire.invalid', '402-555-0118', false, 'Firefighter', (select id from cb_ids where key='role_ff'), '2019-10-02', '2026-01-31');

-- Member certifications: deliberately mixed (current / expiring / expired / missing).
insert into public.member_certifications (department_id, member_id, certification_id, issued_at, expires_at)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_chief'), (select id from cb_ids where key='cert_off2'), '2018-01-10', null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_asstchief'), (select id from cb_ids where key='cert_off2'), '2019-03-05', null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='cert_off1'), '2020-02-01', '2028-02-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='cert_off2'), '2022-05-01', '2030-05-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_cpt2'), (select id from cb_ids where key='cert_off1'), '2021-04-01', '2029-04-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_cpt2'), (select id from cb_ids where key='cert_off2'), '2023-06-01', '2031-06-01'),
  -- Lieutenant Nash: Officer I EXPIRING within 30 days of "today" (readiness warning demo).
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_lt1'), (select id from cb_ids where key='cert_off1'), '2020-09-15', current_date + interval '20 days'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_lt2'), (select id from cb_ids where key='cert_ff1'), '2017-01-20', '2032-01-20'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_lt2'), (select id from cb_ids where key='cert_off1'), '2018-11-01', '2028-11-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='cert_ff1'), '2017-06-01', '2032-06-01'),
  -- Driver/Operator Vance: Driver/Operator cert already EXPIRED (readiness gap demo).
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='cert_drvop'), '2017-08-01', current_date - interval '45 days'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='cert_ff1'), '2018-04-01', '2033-04-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='cert_emt'), '2019-01-15', '2027-01-15'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff3'), (select id from cb_ids where key='cert_ff1'), '2018-08-01', '2033-08-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff3'), (select id from cb_ids where key='cert_drvop'), '2019-02-01', '2029-02-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff4'), (select id from cb_ids where key='cert_ff1'), '2019-02-01', '2034-02-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff5'), (select id from cb_ids where key='cert_ff1'), '2019-07-01', '2034-07-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff5'), (select id from cb_ids where key='cert_nremtemt'), '2020-01-10', current_date + interval '10 days'),
  -- Ostrowski (new hire) intentionally has NO certifications yet (missing-requirement demo).
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff7'), (select id from cb_ids where key='cert_ff1'), '2020-03-01', '2035-03-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff8'), (select id from cb_ids where key='cert_ff1'), '2020-09-01', '2035-09-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff10'), (select id from cb_ids where key='cert_ff1'), '2021-05-01', '2036-05-01');

insert into public.member_qualifications (department_id, member_id, qualification_id, earned_at)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='qual_ff1'), '2017-06-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='qual_ff1'), '2018-04-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff3'), (select id from cb_ids where key='qual_ff1'), '2018-08-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff3'), (select id from cb_ids where key='qual_interior'), '2019-03-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff4'), (select id from cb_ids where key='qual_ff1'), '2019-02-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff5'), (select id from cb_ids where key='qual_ff1'), '2019-07-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff8'), (select id from cb_ids where key='qual_hazawa'), '2021-01-01'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff10'), (select id from cb_ids where key='qual_ff1'), '2021-05-01');

-- EMS member track profiles (NREMT track only — see note above).
insert into public.ems_member_track_profiles (
  department_id, member_id, track, certification_level, track_status, maintain_track,
  certification_number, expiration_date, effective_start_date
)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff2'), 'nremt', 'emt', 'active', true, 'NE-EMT-48213', '2027-01-15', '2019-01-15'),
  -- Cruz: EMS track needs_review (certification expiring in 10 days) — demonstrates a gap.
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='member_ff5'), 'nremt', 'emt', 'needs_review', true, 'NE-EMT-51907', current_date + interval '10 days', '2020-01-10');

-- 9. APPARATUS -----------------------------------------------------------------
insert into cb_ids (key, id)
values
  ('app_e1', gen_random_uuid()),
  ('app_e2', gen_random_uuid()),
  ('app_t1', gen_random_uuid()),
  ('app_r1', gen_random_uuid()),
  ('app_b1', gen_random_uuid()),
  ('app_m1', gen_random_uuid());

insert into public.apparatus (
  id, department_id, name, type, year, make, model, vin, status, lifecycle_status,
  pump_capacity, water_tank_capacity, mileage, engine_hours, check_frequency,
  include_in_department_readiness, out_of_service_source, notes
)
values
  ((select id from cb_ids where key='app_e1'), (select id from cb_ids where key='dept'), 'Engine 1', 'Engine', 2019, 'Pierce', 'Enforcer', 'CB-DEMO-VIN-ENG1-0001', 'ready', 'active', 1500, 750, 28450, 2140, 'Daily', true, null, null),
  ((select id from cb_ids where key='app_e2'), (select id from cb_ids where key='dept'), 'Engine 2', 'Engine', 2015, 'Rosenbauer', 'Commander', 'CB-DEMO-VIN-ENG2-0002', 'ready', 'active', 1250, 750, 61200, 4310, 'Daily', true, null, null),
  ((select id from cb_ids where key='app_t1'), (select id from cb_ids where key='dept'), 'Tanker 1', 'Tanker', 2012, 'Freightliner', 'M2 106', 'CB-DEMO-VIN-TNK1-0003', 'needs_attention', 'active', 500, 2000, 45870, 3025, 'Monthly', true, null, 'Overdue for periodic apparatus check.'),
  ((select id from cb_ids where key='app_r1'), (select id from cb_ids where key='dept'), 'Rescue 1', 'Rescue', 2017, 'Spartan', 'Metro Star', 'CB-DEMO-VIN-RES1-0004', 'out_of_service', 'active', null, null, 33980, 2670, 'Monthly', true, 'manual', 'Out of service: hydraulic PTO leak on rescue tool pump, awaiting replacement parts.'),
  ((select id from cb_ids where key='app_b1'), (select id from cb_ids where key='dept'), 'Brush 1', 'Brush', 2016, 'Ford', 'F-550 Skid Unit', 'CB-DEMO-VIN-BRU1-0005', 'ready', 'active', 250, 300, 18760, 1120, null, true, null, 'Check frequency not yet configured.'),
  ((select id from cb_ids where key='app_m1'), (select id from cb_ids where key='dept'), 'Medic 1', 'Ambulance', 2020, 'Ford', 'F-450 Type I', 'CB-DEMO-VIN-MED1-0006', 'ready', 'active', null, null, 39510, 3860, 'Daily', true, null, null);

-- Check requirements: Brush 1 intentionally left unconfigured ("Configuration Required" demo).
insert into public.apparatus_check_requirements (department_id, apparatus_id, score_profile, interval_days, is_active)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), 'daily', 1, true),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), 'daily', 1, true),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_t1'), 'monthly', 30, true),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_r1'), 'monthly', 30, true),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_m1'), 'daily', 1, true);

insert into public.apparatus_inspection_checklist_items (department_id, apparatus_id, section_name, item_label, is_required, display_order)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), 'Engine Compartment', 'Oil level', true, 1),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), 'Engine Compartment', 'Coolant level', true, 2),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), 'Cab', 'Lights and sirens', true, 3),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), 'Pump Panel', 'Pump engagement test', true, 4),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), 'Engine Compartment', 'Oil level', true, 1),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), 'Cab', 'Lights and sirens', true, 2),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), 'Pump Panel', 'Pump engagement test', true, 3);

-- Apparatus check (inspection) history — includes one clearly overdue apparatus.
insert into public.apparatus_inspections (department_id, apparatus_id, member_id, status, notes, mileage, engine_hours, created_at)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), (select id from cb_ids where key='member_ff1'), 'ready', 'Daily check complete.', 28450, 2140, now() - interval '1 day'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), (select id from cb_ids where key='member_ff3'), 'ready', 'Daily check complete.', 28410, 2138, now() - interval '2 days'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), (select id from cb_ids where key='member_ff3'), 'ready', 'Daily check complete.', 61200, 4310, now() - interval '1 day'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), (select id from cb_ids where key='member_ff1'), 'needs_attention', 'Low washer fluid, topped off.', 61150, 4305, now() - interval '3 days'),
  -- Tanker 1's last check was 45 days ago against a 30-day (monthly) cadence — currently overdue.
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_t1'), (select id from cb_ids where key='member_cpt1'), 'ready', 'Monthly check complete.', 45700, 3010, now() - interval '45 days'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_r1'), (select id from cb_ids where key='member_lt1'), 'out_of_service', 'Hydraulic PTO leak identified, taken out of service.', 33980, 2670, now() - interval '10 days'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_m1'), (select id from cb_ids where key='member_ff2'), 'ready', 'Daily check complete.', 39510, 3860, now() - interval '1 day'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_m1'), (select id from cb_ids where key='member_ff5'), 'ready', 'Daily check complete.', 39470, 3856, now() - interval '2 days');

-- 11. PUMP TESTING ---------------------------------------------------------------
insert into public.apparatus_pump_tests (department_id, apparatus_id, test_date, tester_type, tester_member_id, external_tester_name, external_tester_company, result, notes)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), current_date - interval '75 days', 'department_member', (select id from cb_ids where key='member_ff1'), null, null, 'Pass', 'Annual pump service test — passed all pressure stages.'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), current_date - interval '80 days', 'department_member', (select id from cb_ids where key='member_ff3'), null, null, 'Pass', 'Annual pump service test — passed all pressure stages.'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_t1'), current_date - interval '60 days', 'external_tester', null, 'Midwest Fire Apparatus Testing Co.', 'Midwest Fire Apparatus Testing Co.', 'Fail', 'Failed 150 psi overload test; scheduled for repair and retest.');

-- 12. MAINTENANCE / SERVICE RECORDS -----------------------------------------------
insert into public.maintenance_records (department_id, apparatus_id, maintenance_type, completed_by, service_date, description, labor_hours, mileage, engine_hours, cost, notes)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e1'), 'Preventive Maintenance', (select id from cb_ids where key='member_ff1'), now() - interval '30 days', 'Scheduled oil and filter change.', 2.0, 28100, 2100, 210.00, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_e2'), 'Repair', (select id from cb_ids where key='member_ff3'), now() - interval '20 days', 'Replaced worn wiper blades and washer pump.', 1.0, 61000, 4290, 85.00, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_t1'), 'Inspection Follow-up', (select id from cb_ids where key='member_cpt1'), now() - interval '55 days', 'Addressed items noted on annual apparatus inspection.', 3.5, 45500, 2990, 460.00, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_r1'), 'Repair', null, now() - interval '9 days', 'Hydraulic PTO pump removed for rebuild; parts on order.', 4.0, 33980, 2670, 1250.00, 'Apparatus remains out of service pending parts.'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_m1'), 'Preventive Maintenance', (select id from cb_ids where key='member_ff2'), now() - interval '40 days', 'Scheduled oil change and chassis lubrication.', 1.5, 39000, 3800, 175.00, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_b1'), 'Service', (select id from cb_ids where key='member_ff8'), now() - interval '15 days', 'Skid unit pump primed and tested; replaced discharge hose gasket.', 1.0, 18700, 1110, 60.00, null);

-- 13. INVENTORY -------------------------------------------------------------------
-- Fire hose (20 sections spread across apparatus).
insert into public.fire_hose (department_id, inventory_number, hose_size, hose_length, in_service_date, apparatus, status)
select
  (select id from cb_ids where key='dept'),
  'CB-HOSE-' || lpad(g::text, 3, '0'),
  case when g % 3 = 0 then 5.0 when g % 3 = 1 then 1.75 else 2.5 end,
  case when g % 3 = 0 then 100 else 50 end,
  (current_date - ((g * 30) || ' days')::interval)::date,
  case when g <= 8 then 'Engine 1' when g <= 16 then 'Engine 2' else 'Tanker 1' end,
  case when g = 20 then 'Testing Due' else 'Ready' end
from generate_series(1, 20) as g;

-- SCBA cylinders (10) and packs (6).
insert into public.scba_cylinders (department_id, cylinder_number, cylinder_type, in_service_date, next_hydrostatic_test_due_date, status)
select
  (select id from cb_ids where key='dept'),
  'CB-CYL-' || lpad(g::text, 3, '0'),
  case when g % 2 = 0 then 'Composite' else 'Steel' end,
  (current_date - (g * 60 || ' days')::interval)::date,
  (current_date + ((5 - (g % 5)) * 90 || ' days')::interval)::date,
  case when g = 9 then 'Testing Due' else 'Ready' end
from generate_series(1, 10) as g;

insert into public.scba_packs (department_id, pack_number, manufacturer, model, in_service_date, status)
select
  (select id from cb_ids where key='dept'),
  'CB-PACK-' || lpad(g::text, 2, '0'),
  'MSA',
  'G1',
  (current_date - (g * 90 || ' days')::interval)::date,
  case when g = 6 then 'Flow Test Due' else 'Ready' end
from generate_series(1, 6) as g;

-- PPE: one active-duty set per active member.
insert into public.ppe_items (department_id, item_name, assigned_member_id, size, placed_in_service_date, status)
select
  (select id from cb_ids where key='dept'),
  'Structural Turnout Set',
  m.id,
  case (row_number() over (order by m.id)) % 4 when 0 then 'Large' when 1 then 'Medium' when 2 then 'X-Large' else 'Small' end,
  current_date - interval '2 years',
  'Active'
from public.members m
where m.department_id = (select id from cb_ids where key='dept') and m.active = true;

-- Portable radios (10).
insert into public.portable_radios (department_id, radio_number, serial_number, manufacturer, model, status)
select
  (select id from cb_ids where key='dept'),
  'CB-RADIO-' || lpad(g::text, 2, '0'),
  'SN-CBRADIO-' || lpad(g::text, 4, '0'),
  'Motorola',
  'APX 6000',
  'In Service'
from generate_series(1, 10) as g;

-- Gas monitors (4).
insert into public.gas_monitors (department_id, monitor_number, serial_number, manufacturer, model, status)
values
  ((select id from cb_ids where key='dept'), 'CB-GAS-01', 'SN-GAS-1001', 'Industrial Scientific', 'MX6 iBrid', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-GAS-02', 'SN-GAS-1002', 'Industrial Scientific', 'MX6 iBrid', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-GAS-03', 'SN-GAS-1003', 'RKI Instruments', 'GX-6000', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-GAS-04', 'SN-GAS-1004', 'RKI Instruments', 'GX-6000', 'Out of Service');

-- Ground ladders (5).
insert into public.ground_ladders (department_id, ladder_number, ladder_type, ladder_length_ft, manufacturer, status)
values
  ((select id from cb_ids where key='dept'), 'CB-LADDER-01', 'Extension', 24, 'Duo-Safety', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-LADDER-02', 'Extension', 35, 'Duo-Safety', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-LADDER-03', 'Roof', 14, 'Alco-Lite', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-LADDER-04', 'Attic', 10, 'Alco-Lite', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-LADDER-05', 'Extension', 28, 'Duo-Safety', 'Unassigned');

-- EMS equipment (3) + EMS supplies (13, with two crossing the low-stock threshold).
insert into public.ems_equipment (department_id, equipment_name, equipment_number, status)
values
  ((select id from cb_ids where key='dept'), 'Cardiac Monitor/Defibrillator', 'CB-EMSEQ-01', 'Active'),
  ((select id from cb_ids where key='dept'), 'Powered Stretcher', 'CB-EMSEQ-02', 'Active'),
  ((select id from cb_ids where key='dept'), 'Suction Unit', 'CB-EMSEQ-03', 'Active');

insert into public.ems_supply_items (department_id, item_name, unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, qr_identifier, status)
values
  ((select id from cb_ids where key='dept'), '4x4 Gauze Pads', 'box', 40, 10, 5, 60, 'CB-EMS-SUP-0001', 'Active'),
  ((select id from cb_ids where key='dept'), 'IV Start Kits', 'kit', 25, 8, 4, 40, 'CB-EMS-SUP-0002', 'Active'),
  ((select id from cb_ids where key='dept'), 'Nasal Cannulas (Adult)', 'each', 30, 10, 5, 50, 'CB-EMS-SUP-0003', 'Active'),
  ((select id from cb_ids where key='dept'), 'Non-Rebreather Masks', 'each', 22, 10, 5, 40, 'CB-EMS-SUP-0004', 'Active'),
  ((select id from cb_ids where key='dept'), 'Epinephrine 1:1000 Vials', 'vial', 12, 6, 3, 20, 'CB-EMS-SUP-0005', 'Active'),
  ((select id from cb_ids where key='dept'), 'Naloxone Nasal Spray', 'each', 8, 6, 3, 15, 'CB-EMS-SUP-0006', 'Active'),
  ((select id from cb_ids where key='dept'), 'Normal Saline 1L Bags', 'bag', 18, 8, 4, 30, 'CB-EMS-SUP-0007', 'Active'),
  ((select id from cb_ids where key='dept'), 'Trauma Dressings', 'case', 14, 5, 2, 20, 'CB-EMS-SUP-0008', 'Active'),
  ((select id from cb_ids where key='dept'), 'Pediatric BVMs', 'each', 6, 4, 2, 10, 'CB-EMS-SUP-0009', 'Active'),
  ((select id from cb_ids where key='dept'), 'C-Collars (Adult)', 'each', 10, 4, 2, 16, 'CB-EMS-SUP-0010', 'Active'),
  ((select id from cb_ids where key='dept'), 'Glucose Test Strips', 'box', 9, 5, 2, 15, 'CB-EMS-SUP-0011', 'Active'),
  ((select id from cb_ids where key='dept'), 'Exam Gloves (Box, M)', 'box', 20, 10, 5, 40, 'CB-EMS-SUP-0012', 'Active'),
  ((select id from cb_ids where key='dept'), '12-Lead ECG Electrodes', 'box', 7, 5, 2, 15, 'CB-EMS-SUP-0013', 'Active');

-- Configure the low-stock recipient BEFORE crossing the threshold so the
-- real AFTER UPDATE trigger fires and creates a genuine notification.
insert into public.department_notification_recipients (department_id, notification_type, member_id)
values
  ((select id from cb_ids where key='dept'), 'ems_supply_low_stock', (select id from cb_ids where key='member_asstchief'));

update public.ems_supply_items
set quantity_on_hand = 5
where department_id = (select id from cb_ids where key='dept') and item_name = 'Naloxone Nasal Spray';

update public.ems_supply_items
set quantity_on_hand = 4
where department_id = (select id from cb_ids where key='dept') and item_name = 'Glucose Test Strips';

-- Fire extinguishers (10).
insert into public.fire_extinguishers (department_id, extinguisher_number, extinguisher_type, location_type, status)
select
  (select id from cb_ids where key='dept'),
  'CB-EXT-' || lpad(g::text, 2, '0'),
  case when g % 3 = 0 then 'Carbon Dioxide' when g % 3 = 1 then 'Dry Chemical' else 'Water' end,
  'Station Storage',
  'Active'
from generate_series(1, 10) as g;

-- Miscellaneous fire equipment (5).
insert into public.misc_fire_equipment (department_id, equipment_name, location_type, status)
values
  ((select id from cb_ids where key='dept'), 'Positive Pressure Ventilation Fan', 'Station Storage', 'Active'),
  ((select id from cb_ids where key='dept'), 'Salvage Covers (Set of 4)', 'Station Storage', 'Active'),
  ((select id from cb_ids where key='dept'), 'Thermal Imaging Camera Charger Bank', 'Station Storage', 'Active'),
  ((select id from cb_ids where key='dept'), 'Wildland Hand Tools (Set)', 'Station Storage', 'Active'),
  ((select id from cb_ids where key='dept'), 'Traffic Cones / Scene Lighting Kit', 'Station Storage', 'Active');

-- Power & Industrial equipment, rope, batteries, thermal imaging cameras
-- (present in the schema; populated modestly for completeness).
insert into public.pie_equipment (department_id, equipment_number, equipment_type, status)
values
  ((select id from cb_ids where key='dept'), 'CB-PIE-01', 'Rotary Saw', 'Unassigned'),
  ((select id from cb_ids where key='dept'), 'CB-PIE-02', 'Generator', 'Unassigned'),
  ((select id from cb_ids where key='dept'), 'CB-PIE-03', 'Hydraulic Rescue Tool', 'Unassigned');

insert into public.rope_items (department_id, rope_name, rope_identifier, rope_type, length_ft, location_type, status)
values
  ((select id from cb_ids where key='dept'), 'Life Safety Rope 1', 'CB-ROPE-01', 'Life Safety', 200, 'Station Storage', 'Active'),
  ((select id from cb_ids where key='dept'), 'Life Safety Rope 2', 'CB-ROPE-02', 'Life Safety', 200, 'Station Storage', 'Active'),
  ((select id from cb_ids where key='dept'), 'Utility Rope 1', 'CB-ROPE-03', 'Utility', 150, 'Station Storage', 'Active');

insert into public.batteries (department_id, battery_number, battery_type, status)
values
  ((select id from cb_ids where key='dept'), 'CB-BATT-01', 'SCBA Pack Battery', 'Unassigned'),
  ((select id from cb_ids where key='dept'), 'CB-BATT-02', 'TIC Battery', 'Unassigned'),
  ((select id from cb_ids where key='dept'), 'CB-BATT-03', 'Radio Battery', 'Unassigned');

insert into public.thermal_imaging_cameras (department_id, camera_number, serial_number, manufacturer, model, status)
values
  ((select id from cb_ids where key='dept'), 'CB-TIC-01', 'SN-TIC-2001', 'MSA', 'Evolution 6000', 'In Service'),
  ((select id from cb_ids where key='dept'), 'CB-TIC-02', 'SN-TIC-2002', 'MSA', 'Evolution 6000', 'In Service');

-- 14. DEFICIENCIES ----------------------------------------------------------------
-- Category-to-responsible-member rules configured BEFORE the deficiencies are
-- inserted, so the real BEFORE INSERT auto-assign trigger (and the real AFTER
-- INSERT notification trigger) fire naturally instead of being faked.
insert into public.deficiency_notification_settings (department_id, category_id, member_id)
values
  ((select id from cb_ids where key='dept'), 'af8292df-3da7-4814-a2c2-6451689bd364', (select id from cb_ids where key='member_cpt1')), -- Apparatus -> Captain Delgado
  ((select id from cb_ids where key='dept'), '288908aa-da67-4f9a-8bf8-8a445cd43487', (select id from cb_ids where key='member_lt1')),   -- SCBA -> Lieutenant Nash
  ((select id from cb_ids where key='dept'), '0c2ce3c4-a71a-4a5a-8938-d92230f29b13', (select id from cb_ids where key='member_lt2'));   -- PPE -> Lieutenant Reyes

-- Deficiencies with a configured category rule: leave assigned_to NULL so the
-- trigger performs the real auto-assignment + notification.
insert into public.deficiencies (department_id, apparatus_id, category_id, priority, status, description, reported_by, reported_at)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_r1'), 'af8292df-3da7-4814-a2c2-6451689bd364', 'e957fb97-5d0a-407a-a756-868a8ac5ff18', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'Hydraulic PTO pump leaking on rescue tool system.', (select id from cb_ids where key='member_lt1'), now() - interval '10 days'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_t1'), 'af8292df-3da7-4814-a2c2-6451689bd364', '856a161f-cd09-4574-a563-6d6738d3603a', '84ee94b9-0803-4d68-9372-faf4ecf6d406', 'Tanker 1 failed 150 psi pump overload test.', (select id from cb_ids where key='member_cpt1'), now() - interval '55 days'),
  ((select id from cb_ids where key='dept'), null, '288908aa-da67-4f9a-8bf8-8a445cd43487', 'baabfad9-4006-430e-95eb-20e09a9e45d1', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'SCBA cylinder CB-CYL-009 flagged for hydrostatic testing.', (select id from cb_ids where key='member_ff2'), now() - interval '3 days'),
  ((select id from cb_ids where key='dept'), null, '0c2ce3c4-a71a-4a5a-8938-d92230f29b13', '283b8d5f-5c8a-41b7-872a-d5241f9dbe95', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'Turnout gear liner showing wear, needs inspection.', (select id from cb_ids where key='member_ff8'), now() - interval '1 day');

-- Remaining deficiencies span other categories/priorities/statuses (no rule
-- configured for these categories, so assigned_to is set explicitly or left
-- unassigned as a realistic mixed backlog).
insert into public.deficiencies (department_id, apparatus_id, category_id, priority, status, description, reported_by, assigned_to, reported_at, resolved_by, resolved_at)
values
  ((select id from cb_ids where key='dept'), null, 'b123c408-484b-4ce4-a4f0-2e4720b6b387', 'baabfad9-4006-430e-95eb-20e09a9e45d1', '204935c1-27a7-4500-99f6-70ed7d9d62a2', 'Fire hose CB-HOSE-020 failed annual service test.', (select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='member_cpt1'), now() - interval '90 days', (select id from cb_ids where key='member_cpt1'), now() - interval '80 days'),
  ((select id from cb_ids where key='dept'), null, '86b6cab2-c431-47f8-a722-12952374a35f', '283b8d5f-5c8a-41b7-872a-d5241f9dbe95', '204935c1-27a7-4500-99f6-70ed7d9d62a2', 'Ground ladder CB-LADDER-05 halyard replaced after annual test.', (select id from cb_ids where key='member_ff4'), (select id from cb_ids where key='member_cpt2'), now() - interval '70 days', (select id from cb_ids where key='member_cpt2'), now() - interval '65 days'),
  ((select id from cb_ids where key='dept'), null, '3355b0c4-a8a7-47a0-8be2-a37410a0233d', 'baabfad9-4006-430e-95eb-20e09a9e45d1', '84ee94b9-0803-4d68-9372-faf4ecf6d406', 'Portable radio CB-RADIO-07 intermittent static on Channel 2.', (select id from cb_ids where key='member_ff6'), (select id from cb_ids where key='member_lt2'), now() - interval '6 days', null, null),
  ((select id from cb_ids where key='dept'), null, '1eddc35b-208e-4705-acf7-a4d3405eb816', '283b8d5f-5c8a-41b7-872a-d5241f9dbe95', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'Bay door #2 opener remote needs new battery.', (select id from cb_ids where key='member_ff7'), null, now() - interval '2 days', null, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='app_b1'), 'af8292df-3da7-4814-a2c2-6451689bd364', 'baabfad9-4006-430e-95eb-20e09a9e45d1', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'Brush 1 skid unit discharge hose gasket weeping slightly after repair.', (select id from cb_ids where key='member_ff8'), null, now() - interval '4 days', null, null),
  ((select id from cb_ids where key='dept'), null, 'cc08dcda-6b1b-455d-b6ec-2667041e90e7', '283b8d5f-5c8a-41b7-872a-d5241f9dbe95', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'Generator CB-PIE-02 needs annual load-bank test scheduled.', (select id from cb_ids where key='member_ff10'), null, now() - interval '5 days', null, null),
  ((select id from cb_ids where key='dept'), null, '6831911b-5d66-4fe9-9260-bd7fa3b1e5e6', 'baabfad9-4006-430e-95eb-20e09a9e45d1', '84ee94b9-0803-4d68-9372-faf4ecf6d406', 'Station generator transfer switch making unusual noise during test.', (select id from cb_ids where key='member_lt1'), (select id from cb_ids where key='member_asstchief'), now() - interval '12 days', null, null),
  ((select id from cb_ids where key='dept'), null, '2f060335-c8b8-4e74-9e98-757daced1be4', '283b8d5f-5c8a-41b7-872a-d5241f9dbe95', '204935c1-27a7-4500-99f6-70ed7d9d62a2', 'Station inventory of exam gloves restocked.', (select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='member_asstchief'), now() - interval '100 days', (select id from cb_ids where key='member_asstchief'), now() - interval '95 days'),
  ((select id from cb_ids where key='dept'), null, '75975dc9-5d9d-418a-b93b-25594ad3dedb', '856a161f-cd09-4574-a563-6d6738d3603a', '9c4c33a1-5d53-4650-bf24-68105468dca6', 'Cardiac monitor battery not holding charge overnight.', (select id from cb_ids where key='member_ff5'), (select id from cb_ids where key='member_asstchief'), now() - interval '7 days', null, null),
  ((select id from cb_ids where key='dept'), null, '1eddc35b-208e-4705-acf7-a4d3405eb816', 'baabfad9-4006-430e-95eb-20e09a9e45d1', '204935c1-27a7-4500-99f6-70ed7d9d62a2', 'Kitchen faucet leak repaired.', (select id from cb_ids where key='member_ff4'), (select id from cb_ids where key='member_asstchief'), now() - interval '110 days', (select id from cb_ids where key='member_asstchief'), now() - interval '108 days');

-- 6 (cont'd). TRAINING HISTORY -----------------------------------------------------
insert into cb_ids (key, id)
values
  ('te1', gen_random_uuid()), ('te2', gen_random_uuid()), ('te3', gen_random_uuid()),
  ('te4', gen_random_uuid()), ('te5', gen_random_uuid()), ('te6', gen_random_uuid()),
  ('te7', gen_random_uuid()), ('te8', gen_random_uuid()), ('te9', gen_random_uuid()),
  ('te10', gen_random_uuid());

insert into public.training_events (id, department_id, title, category_id, training_type, starts_at, hours_credit, status, is_ems_training)
values
  ((select id from cb_ids where key='te1'), (select id from cb_ids where key='dept'), 'Live Fire Suppression Drill', (select id from cb_ids where key='tc_suppression'), 'Hands-On', now() - interval '210 days', 4, 'completed', false),
  ((select id from cb_ids where key='te2'), (select id from cb_ids where key='dept'), 'Pump Operations Refresher', (select id from cb_ids where key='tc_drvop'), 'Hands-On', now() - interval '180 days', 3, 'completed', false),
  ((select id from cb_ids where key='te3'), (select id from cb_ids where key='dept'), 'HazMat Operations Refresher', (select id from cb_ids where key='tc_hazmat'), 'Classroom', now() - interval '150 days', 4, 'completed', false),
  ((select id from cb_ids where key='te4'), (select id from cb_ids where key='dept'), 'Confined Space Awareness', (select id from cb_ids where key='tc_techrescue'), 'Classroom', now() - interval '120 days', 3, 'completed', false),
  ((select id from cb_ids where key='te5'), (select id from cb_ids where key='dept'), 'Wildland Refresher S-130/190', (select id from cb_ids where key='tc_wildland'), 'Classroom', now() - interval '95 days', 8, 'completed', false),
  ((select id from cb_ids where key='te6'), (select id from cb_ids where key='dept'), 'EMS Continuing Education: Cardiac Emergencies', (select id from cb_ids where key='tc_ems'), 'Classroom', now() - interval '80 days', 3, 'completed', true),
  ((select id from cb_ids where key='te7'), (select id from cb_ids where key='dept'), 'PPE Donning and Doffing Safety Review', (select id from cb_ids where key='tc_safety'), 'Hands-On', now() - interval '60 days', 2, 'completed', false),
  ((select id from cb_ids where key='te8'), (select id from cb_ids where key='dept'), 'Incident Command System Refresher', (select id from cb_ids where key='tc_command'), 'Classroom', now() - interval '45 days', 4, 'completed', false),
  ((select id from cb_ids where key='te9'), (select id from cb_ids where key='dept'), 'Target Hazard Pre-Plan Site Visit: Cedar Bluff Grain Co-op', (select id from cb_ids where key='tc_preplans'), 'Field', now() - interval '30 days', 2, 'completed', false),
  ((select id from cb_ids where key='te10'), (select id from cb_ids where key='dept'), 'Fireground Radio Communications', (select id from cb_ids where key='tc_comm'), 'Classroom', now() - interval '15 days', 2, 'completed', false);

-- Attendance: officers + drivers attend nearly everything (good completion);
-- a couple of firefighters intentionally attend only a few (behind on hours).
insert into public.training_event_attendance (department_id, training_event_id, member_id, attendance_status, completion_status, completed_at, hours_earned)
select
  (select id from cb_ids where key='dept'),
  te.id,
  m.id,
  'attending',
  'approved',
  te.starts_at,
  te.hours_credit
from public.training_events te
cross join public.members m
where te.department_id = (select id from cb_ids where key='dept')
  and m.department_id = (select id from cb_ids where key='dept')
  and m.active = true
  and m.id not in (
    (select id from cb_ids where key='member_ff6'),  -- Ostrowski: new hire, minimal history
    (select id from cb_ids where key='member_ff11')   -- inactive, excluded by active filter already
  )
  and (
    -- Everyone attends the first 4 events; only a subset attends the rest,
    -- so overall-hours completion is realistically uneven, not perfect.
    te.id in (
      (select id from cb_ids where key='te1'), (select id from cb_ids where key='te2'),
      (select id from cb_ids where key='te3'), (select id from cb_ids where key='te4')
    )
    or (m.id in (
      (select id from cb_ids where key='member_chief'), (select id from cb_ids where key='member_asstchief'),
      (select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='member_cpt2'),
      (select id from cb_ids where key='member_lt1'), (select id from cb_ids where key='member_lt2'),
      (select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='member_ff3')
    ))
  );

-- 7. ASSIGNED TRAINING --------------------------------------------------------------
insert into cb_ids (key, id) values
  ('ta1', gen_random_uuid()), ('ta2', gen_random_uuid()), ('ta3', gen_random_uuid()), ('ta4', gen_random_uuid());

insert into public.training_assignments (id, department_id, title, category_id, description, due_at, hours_credit, review_required, is_required, status)
values
  ((select id from cb_ids where key='ta1'), (select id from cb_ids where key='dept'), 'Annual HazMat Awareness Refresher Video', (select id from cb_ids where key='tc_hazmat'), 'Watch the annual HazMat awareness refresher and confirm completion.', now() + interval '30 days', 1, false, true, 'active'),
  ((select id from cb_ids where key='ta2'), (select id from cb_ids where key='dept'), 'New SCBA Donning Procedure Bulletin', (select id from cb_ids where key='tc_safety'), 'Review updated SCBA donning procedure bulletin.', now() + interval '14 days', 0.5, true, true, 'active'),
  ((select id from cb_ids where key='ta3'), (select id from cb_ids where key='dept'), 'Water Rescue Awareness Overview', (select id from cb_ids where key='tc_techrescue'), 'Complete the water rescue awareness overview module.', now() + interval '45 days', 1, false, false, 'active'),
  ((select id from cb_ids where key='ta4'), (select id from cb_ids where key='dept'), 'Active Threat Response Awareness', (select id from cb_ids where key='tc_command'), 'Complete the active threat response awareness training.', now() - interval '5 days', 1, true, true, 'active');

-- Members demonstrating: completed, pending review, and assigned/not-completed.
insert into public.training_assignment_members (department_id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta1'), (select id from cb_ids where key='member_ff1'), now() + interval '30 days', 'approved', now() - interval '5 days', 1),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta1'), (select id from cb_ids where key='member_ff2'), now() + interval '30 days', 'approved', now() - interval '4 days', 1),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta1'), (select id from cb_ids where key='member_ff4'), now() + interval '30 days', 'assigned', null, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta2'), (select id from cb_ids where key='member_ff3'), now() + interval '14 days', 'pending_review', now() - interval '1 days', 0.5),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta2'), (select id from cb_ids where key='member_ff5'), now() + interval '14 days', 'assigned', null, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta3'), (select id from cb_ids where key='member_ff7'), now() + interval '45 days', 'in_progress', null, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta4'), (select id from cb_ids where key='member_ff8'), now() - interval '5 days', 'assigned', null, null),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='ta4'), (select id from cb_ids where key='member_ff10'), now() - interval '5 days', 'assigned', null, null);

-- 16. PRE-PLANS ---------------------------------------------------------------------
insert into cb_ids (key, id) values ('pp1', gen_random_uuid()), ('pp2', gen_random_uuid()), ('pp3', gen_random_uuid());

insert into public.pre_plans (id, department_id, business_name, address, city, state, zip, business_phone, occupancy_id_number, normal_occupant_load, primary_apparatus_access, knox_box_details, knox_box_location)
values
  ((select id from cb_ids where key='pp1'), (select id from cb_ids where key='dept'), 'Cedar Bluff Grain Co-op', '410 Elevator Rd', 'Cedar Bluff', 'NE', '68610', '402-555-0201', 'CB-OCC-0001', 12, 'Main entrance off Elevator Rd; secondary access from rail spur side.', 'Knox box present', 'Front office door, north side'),
  ((select id from cb_ids where key='pp2'), (select id from cb_ids where key='dept'), 'Cedar Bluff Care Center', '212 Maple St', 'Cedar Bluff', 'NE', '68610', '402-555-0202', 'CB-OCC-0002', 85, 'Front entrance off Maple St; ambulance bay on east side.', 'Knox box present', 'Main entrance, east of doors'),
  ((select id from cb_ids where key='pp3'), (select id from cb_ids where key='dept'), 'Cedar Bluff Elementary School', '901 School Ave', 'Cedar Bluff', 'NE', '68610', '402-555-0203', 'CB-OCC-0003', 340, 'Main entrance off School Ave; bus loop on north side.', 'Knox box present', 'Main office entrance');

insert into public.pre_plan_hydrants (department_id, pre_plan_id, hydrant_identifier, location_description)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='pp1'), 'H-14', 'Corner of Elevator Rd and 4th St'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='pp2'), 'H-22', 'Maple St in front of building'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='pp3'), 'H-08', 'School Ave near bus loop entrance');

insert into public.pre_plan_hazards (department_id, pre_plan_id, hazard_type, location_description, description)
values
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='pp1'), 'Grain Dust / Combustible Dust', 'Main elevator leg and headhouse', 'Combustible grain dust accumulation risk; explosion venting present on headhouse.'),
  ((select id from cb_ids where key='dept'), (select id from cb_ids where key='pp2'), 'Oxygen Storage', 'Nursing station supply closet', 'Bulk medical oxygen cylinders stored in supply closet near nursing station.');

-- 17. DOCUMENTS ------------------------------------------------------------------
insert into cb_ids (key, id) values
  ('drc_misc', gen_random_uuid()), ('drc_sog', gen_random_uuid());

insert into public.document_reference_categories (id, department_id, name, slug, is_default)
values
  ((select id from cb_ids where key='drc_misc'), (select id from cb_ids where key='dept'), 'Miscellaneous Documents', 'miscellaneous-documents', true),
  ((select id from cb_ids where key='drc_sog'), (select id from cb_ids where key='dept'), 'Standard Operating Guidelines', 'standard-operating-guidelines', false);

insert into public.documents (department_id, category, title, description, document_number, effective_date, status, uploaded_by, reference_category_id)
values
  ((select id from cb_ids where key='dept'), 'SOPs', 'SOG 100: Apparatus Response and Riding Assignments', 'Department standard operating guideline for apparatus response.', 'SOG-100', current_date - interval '400 days', 'Active', (select id from cb_ids where key='member_chief'), (select id from cb_ids where key='drc_sog')),
  ((select id from cb_ids where key='dept'), 'SOPs', 'SOG 210: Structure Fire Operations', 'Standard operating guideline for structure fire response.', 'SOG-210', current_date - interval '400 days', 'Active', (select id from cb_ids where key='member_chief'), (select id from cb_ids where key='drc_sog')),
  ((select id from cb_ids where key='dept'), 'Mutual Aid Agreements', 'SOG 305: Mutual Aid Response', 'Standard operating guideline for mutual aid requests.', 'SOG-305', current_date - interval '300 days', 'Active', (select id from cb_ids where key='member_asstchief'), (select id from cb_ids where key='drc_sog')),
  ((select id from cb_ids where key='dept'), 'City / Department Policies', 'Personnel Policy: PPE Care and Maintenance', 'Department policy on turnout gear inspection and care.', 'POL-014', current_date - interval '250 days', 'Active', (select id from cb_ids where key='member_asstchief'), (select id from cb_ids where key='drc_misc')),
  ((select id from cb_ids where key='dept'), 'EMS Protocols', 'EMS Protocol Reference Summary', 'Reference summary of regional EMS protocols.', 'POL-022', current_date - interval '200 days', 'Active', (select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='drc_misc')),
  ((select id from cb_ids where key='dept'), 'Department Documents', 'Engine 1 Operator Manual Reference', 'Pierce Enforcer operator reference summary.', null, current_date - interval '600 days', 'Active', (select id from cb_ids where key='member_ff1'), (select id from cb_ids where key='drc_misc')),
  ((select id from cb_ids where key='dept'), 'Department Documents', 'Medic 1 Equipment Inventory Checklist', 'Standard equipment checklist for Medic 1.', null, current_date - interval '180 days', 'Active', (select id from cb_ids where key='member_ff2'), (select id from cb_ids where key='drc_misc')),
  ((select id from cb_ids where key='dept'), 'Department Documents', 'Q2 Department Training Committee Minutes', 'Quarterly training committee meeting minutes.', null, current_date - interval '90 days', 'Active', (select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='drc_misc'));

-- 18. CALENDAR --------------------------------------------------------------------
insert into public.department_calendar_activities (department_id, title, activity_type, description, start_at, end_at, assigned_member_id, created_by, status)
values
  ((select id from cb_ids where key='dept'), 'Live Fire Suppression Drill', 'Training', 'Annual live burn training at the county training facility.', now() - interval '210 days', now() - interval '210 days' + interval '4 hours', null, (select id from cb_ids where key='member_asstchief'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Wildland Refresher S-130/190', 'Training', 'Annual wildland refresher course.', now() - interval '95 days', now() - interval '95 days' + interval '8 hours', null, (select id from cb_ids where key='member_asstchief'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Monthly Department Meeting', 'Meeting', 'Regular monthly department business meeting.', now() - interval '25 days', now() - interval '25 days' + interval '2 hours', null, (select id from cb_ids where key='member_chief'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Annual Apparatus Inspection', 'Apparatus / Operations', 'Annual comprehensive inspection of all apparatus.', now() - interval '55 days', now() - interval '55 days' + interval '6 hours', (select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='member_chief'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Grain Co-op Pre-Plan Site Visit', 'Other', 'Site visit to update the Cedar Bluff Grain Co-op pre-plan.', now() - interval '30 days', now() - interval '30 days' + interval '2 hours', (select id from cb_ids where key='member_lt1'), (select id from cb_ids where key='member_lt1'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Fireground Radio Communications', 'Training', 'Department-wide radio communications training.', now() - interval '15 days', now() - interval '15 days' + interval '2 hours', null, (select id from cb_ids where key='member_asstchief'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Station 1 Apparatus Bay Drill', 'Drill', 'Ladder throw and pump operations proficiency drill.', now() - interval '10 days', now() - interval '10 days' + interval '3 hours', null, (select id from cb_ids where key='member_cpt2'), 'Completed'),
  ((select id from cb_ids where key='dept'), 'Monthly Department Meeting', 'Meeting', 'Regular monthly department business meeting.', now() + interval '5 days', now() + interval '5 days' + interval '2 hours', null, (select id from cb_ids where key='member_chief'), 'Scheduled'),
  ((select id from cb_ids where key='dept'), 'EMS Continuing Education Session', 'Training', 'Quarterly EMS CE session covering cardiac emergencies.', now() + interval '10 days', now() + interval '10 days' + interval '3 hours', null, (select id from cb_ids where key='member_asstchief'), 'Scheduled'),
  ((select id from cb_ids where key='dept'), 'Cedar Bluff Care Center Pre-Plan Review', 'Other', 'Annual pre-plan review walk-through.', now() + interval '18 days', now() + interval '18 days' + interval '2 hours', (select id from cb_ids where key='member_lt2'), (select id from cb_ids where key='member_lt2'), 'Scheduled'),
  ((select id from cb_ids where key='dept'), 'Tanker 1 Pump Test Retest', 'Apparatus / Operations', 'Retest following pump repair.', now() + interval '20 days', now() + interval '20 days' + interval '2 hours', (select id from cb_ids where key='member_cpt1'), (select id from cb_ids where key='member_cpt1'), 'Scheduled'),
  ((select id from cb_ids where key='dept'), 'Technical Rescue Team Drill', 'Drill', 'Confined space and rope rescue proficiency drill.', now() + interval '25 days', now() + interval '25 days' + interval '4 hours', null, (select id from cb_ids where key='member_asstchief'), 'Scheduled'),
  ((select id from cb_ids where key='dept'), 'New Member Orientation', 'Meeting', 'Orientation session for newly hired firefighter.', now() + interval '3 days', now() + interval '3 days' + interval '2 hours', (select id from cb_ids where key='member_ff6'), (select id from cb_ids where key='member_asstchief'), 'Scheduled');
