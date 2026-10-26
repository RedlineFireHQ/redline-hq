-- ===========================================================================
-- Seed deficiency lookup tables with production reference values AND
-- production UUIDs.
--
-- SOURCE: read-only SELECTs against production (dkyjtocanutceafywdcd) on
-- 2026-10-25, including each row's id. Configuration lists, not customer data.
--
-- WHY FIXED UUIDs: migration 20260909130000 (Cedar Bluff demo department)
-- references these rows by their production UUIDs (e.g. status 'Open' =
-- 9c4c33a1-..., category 'Apparatus' = af8292df-...). On any database lacking
-- those exact IDs the demo seed fails with FK violations. Seeding with
-- production's IDs keeps every environment consistent and makes both this
-- seed and the demo seed safe to run in either order.
--
-- Idempotent: guards on id (not name) — if production already has the row,
-- this is a no-op. "Pagers" is intentionally NOT here: 20260918130000 seeds it
-- with a generated UUID and nothing references its id.
-- ===========================================================================

-- Statuses (order matters — the app resolves the first active row as "Open")
insert into public.deficiency_statuses (id, name, description, display_order, active)
select v.id, v.name, v.description, v.display_order, true
from (values
  ('9c4c33a1-5d53-4650-bf24-68105468dca6'::uuid, 'Open',        'Newly reported deficiency.',       1),
  ('84ee94b9-0803-4d68-9372-faf4ecf6d406'::uuid, 'In Progress', 'Repair is underway.',              2),
  ('204935c1-27a7-4500-99f6-70ed7d9d62a2'::uuid, 'Resolved',    'Repair completed and documented.', 3)
) as v(id, name, description, display_order)
where not exists (
  select 1 from public.deficiency_statuses s where s.id = v.id
);

-- Priorities
insert into public.deficiency_priorities (id, name, description, display_order, active)
select v.id, v.name, null, v.display_order, true
from (values
  ('e957fb97-5d0a-407a-a756-868a8ac5ff18'::uuid, 'Critical', 1),
  ('856a161f-cd09-4574-a563-6d6738d3603a'::uuid, 'High',     2),
  ('baabfad9-4006-430e-95eb-20e09a9e45d1'::uuid, 'Medium',   3),
  ('283b8d5f-5c8a-41b7-872a-d5241f9dbe95'::uuid, 'Low',      4)
) as v(id, name, display_order)
where not exists (
  select 1 from public.deficiency_priorities p where p.id = v.id
);

-- Categories (Pagers excluded — 20260918130000 owns it)
insert into public.deficiency_categories (id, name, description, display_order, active)
select v.id, v.name, v.description, v.display_order, true
from (values
  ('af8292df-3da7-4814-a2c2-6451689bd364'::uuid, 'Apparatus',                    null,                                    1),
  ('2f060335-c8b8-4e74-9e98-757daced1be4'::uuid, 'Inventory',                    'Tools and equipment inventory',         2),
  ('288908aa-da67-4f9a-8bf8-8a445cd43487'::uuid, 'SCBA',                         'Self-contained breathing apparatus',    3),
  ('75975dc9-5d9d-418a-b93b-25594ad3dedb'::uuid, 'EMS Equipment',                'Medical equipment and supplies',        4),
  ('b123c408-484b-4ce4-a4f0-2e4720b6b387'::uuid, 'Hose',                         'Fire hose and related equipment',       5),
  ('86b6cab2-c431-47f8-a722-12952374a35f'::uuid, 'Ladders',                      'Ground ladders',                        6),
  ('3355b0c4-a8a7-47a0-8be2-a37410a0233d'::uuid, 'Radios',                       'Portable and mobile radios',            7),
  ('0c2ce3c4-a71a-4a5a-8938-d92230f29b13'::uuid, 'PPE',                          'Personal protective equipment',         8),
  ('1eddc35b-208e-4705-acf7-a4d3405eb816'::uuid, 'Station / Facilities',         'Buildings and station maintenance',     9),
  ('6831911b-5d66-4fe9-9260-bd7fa3b1e5e6'::uuid, 'Other',                        'Miscellaneous deficiencies',           10),
  ('cc08dcda-6b1b-455d-b6ec-2667041e90e7'::uuid, 'Power & Industrial Equipment', 'Power and industrial equipment deficiencies', 11)
) as v(id, name, description, display_order)
where not exists (
  select 1 from public.deficiency_categories c where c.id = v.id
);
