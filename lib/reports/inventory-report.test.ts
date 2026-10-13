import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getReportSourceConfig } from "./registry";
import {
  getInventoryReportTypeOptions,
  resolveInventoryReportMode,
} from "./inventory-report";

test("fire hose exposes only real report types", () => {
  assert.deepEqual(getInventoryReportTypeOptions("fire-hose"), [
    { value: "inventory", label: "Inventory" },
    { value: "fire-hose-testing", label: "Hose Testing" },
    { value: "deficiencies", label: "Deficiencies" },
  ]);
});

test("gas monitor exposes calibration and deficiencies only", () => {
  assert.deepEqual(getInventoryReportTypeOptions("gas-monitors"), [
    { value: "inventory", label: "Inventory" },
    { value: "gas-monitor-calibration", label: "Calibration" },
    { value: "deficiencies", label: "Deficiencies" },
  ]);
});

test("all inventory keeps a simple inventory-only drill-down", () => {
  assert.deepEqual(getInventoryReportTypeOptions("all"), [
    { value: "inventory", label: "Inventory" },
  ]);
});

test("pagers exposes inventory and deficiencies report types", () => {
  assert.deepEqual(getInventoryReportTypeOptions("pagers"), [
    { value: "inventory", label: "Inventory" },
    { value: "deficiencies", label: "Deficiencies" },
  ]);
});

test("pagers is a selectable inventory category in the reports registry", () => {
  const source = getReportSourceConfig("inventory");

  assert.ok(source);
  const categoryFilter = source.filters.find((filter) => filter.key === "inventory_category");
  assert.ok(categoryFilter);
  assert.ok(categoryFilter.options?.some((option) => option.value === "pagers" && option.label === "Pagers"));
});

test("pagers report mode resolves to the expected inventory workflow", () => {
  assert.equal(resolveInventoryReportMode("pagers", "inventory").categoryKey, "pagers");
  assert.equal(resolveInventoryReportMode("pagers", "deficiencies").reportTypeKey, "deficiencies");
});

test("pagers migration creates member assignment with same-department enforcement", () => {
  const migration = readFileSync(
    join(__dirname, "../../supabase/migrations/20260918120000_create_pagers_inventory_category.sql"),
    "utf8",
  );

  assert.match(migration, /assigned_member_id uuid references public\.members \(id\)/);
  assert.match(migration, /validate_pager_assigned_member_department/);
  assert.match(migration, /m\.department_id = new\.department_id/);
  assert.match(migration, /create index if not exists pagers_assigned_member_idx/);
});

test("pagers deficiency category migration adds a Pagers category idempotently", () => {
  const migration = readFileSync(
    join(__dirname, "../../supabase/migrations/20260918130000_add_pagers_deficiency_category.sql"),
    "utf8",
  );

  assert.match(migration, /insert into public\.deficiency_categories \(name, description, display_order, active\)/);
  assert.match(migration, /select 'Pagers'/);
  assert.match(migration, /where not exists/);
});

test("deficiency report form auto-selects the Pagers category for pager launches", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  // The category resolver matches a pager-labeled category option (e.g. "Pagers").
  assert.match(reportPage, /normalizedInventoryCategory === "pagers"/);
  assert.match(reportPage, /normalizedLabel\.includes\("pager"\)/);
  // And the resolved category is applied to form state.
  assert.match(reportPage, /categoryId: current\.categoryId \|\| resolvedInventoryCategory\?\.id \|\| ""/);
});

test("pagers workspace renders Assigned To dropdown and omits Pager Type field", () => {
  const workspace = readFileSync(
    join(__dirname, "../../components/inventory/PagersWorkspace.tsx"),
    "utf8",
  );

  // Assigned To dropdown present with an Unassigned option and member options.
  assert.match(workspace, />Assigned To/);
  assert.match(workspace, /<option value="">Unassigned<\/option>/);
  assert.match(workspace, /memberOptions\.map/);
  // Pager Type input removed from the form.
  assert.doesNotMatch(workspace, />Pager Type</);
  assert.doesNotMatch(workspace, /formValues\.pagerType/);
});

test("pagers workspace removes Location field and routes deficiency reporting to pagers", () => {
  const workspace = readFileSync(
    join(__dirname, "../../components/inventory/PagersWorkspace.tsx"),
    "utf8",
  );

  // Location removed from the form, table, and search payload.
  assert.doesNotMatch(workspace, />Location</);
  assert.doesNotMatch(workspace, /formValues\.location/);
  assert.doesNotMatch(workspace, /location: normalizeOptionalText/);
  // Deficiency reporting routes into the shared workflow scoped to pagers.
  assert.match(workspace, /reportDeficiency/);
  assert.match(workspace, /params\.set\("inventoryCategory", "pagers"\)/);
  assert.match(workspace, /params\.set\("inventoryItemId", pager\.id\)/);
  assert.match(workspace, />Report Deficiency</);
});

test("deficiency report page links pagers through deficiencies.pager_id", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  assert.match(reportPage, /normalizedInventoryCategory === "pagers"/);
  assert.match(reportPage, /pager_id: isPagerDeficiency && formState\.pagerId \? formState\.pagerId : null/);
  assert.match(reportPage, /inventoryTable = "pagers"/);
});

test("deficiency report page does not force Station Supply onto pager deficiencies", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  // Pagers default to no apparatus (member-assigned), not the Station Supply sentinel.
  assert.match(reportPage, /normalizedInventoryCategory === "pagers"\s*\?\s*""/);
  // canSubmit treats a linked pager as satisfying the apparatus requirement.
  assert.match(reportPage, /Boolean\(effectiveApparatusId \|\| \(isPagerDeficiencyLaunch && formState\.pagerId\)\)/);
  // apparatus_id is forced null for pager deficiencies.
  assert.match(reportPage, /apparatus_id: isPagerDeficiencyLaunch \|\| effectiveApparatusId === STATION_SUPPLY_OPTION\.id \? null : effectiveApparatusId/);
});

test("selecting Pager presents only actual pagers, not generic apparatus or Station Supply", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  // Pager launch renders a pager selector fed by pagerOptions, not the apparatus selector.
  assert.match(reportPage, /\{isPagerDeficiencyLaunch \? \(/);
  assert.match(reportPage, /<span[^>]*>Pager<\/span>/);
  assert.match(reportPage, /\{pagerOptions\.map/);
  assert.match(reportPage, /setPagerOptions/);
  // Pager options are loaded from the pagers table by pager_number.
  assert.match(reportPage, /\.from\("pagers"\)\s*\n\s*\.select\("id, pager_number"\)/);
});

test("pager deficiency requires a pager selection before submit", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  assert.match(reportPage, /if \(isPagerDeficiencyLaunch && !formState\.pagerId\)/);
  assert.match(reportPage, /Select the affected pager before submitting\./);
});

test("reporting a pager deficiency does not change pager status", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  // The auto "Out of Service" status update block must not include pagers.
  const statusUpdateBlock = reportPage.match(/if \(\(([^)]*Deficiency[^)]*)\) && inventoryItemId\) \{/);
  assert.ok(statusUpdateBlock);
  assert.doesNotMatch(statusUpdateBlock[1], /isPagerDeficiency/);
});

test("existing apparatus and station-supply deficiency behavior remains unchanged", () => {
  const reportPage = readFileSync(
    join(__dirname, "../../app/deficiencies/report/page.tsx"),
    "utf8",
  );

  // Non-pager inventory launches still default to Station Supply.
  assert.match(reportPage, /: STATION_SUPPLY_OPTION\.id;/);
  // Apparatus selector still rendered for non-pager launches.
  assert.match(reportPage, /<span[^>]*>Apparatus<\/span>/);
  assert.match(reportPage, /\{\[STATION_SUPPLY_OPTION, \.\.\.apparatusOptions\]\.map/);
});

test("deficiencies page and reports display pager identity", () => {
  const deficienciesPage = readFileSync(
    join(__dirname, "../../app/deficiencies/page.tsx"),
    "utf8",
  );
  const detailPage = readFileSync(
    join(__dirname, "../../app/operations/deficiencies/[id]/page.tsx"),
    "utf8",
  );
  const serverRunner = readFileSync(
    join(__dirname, "./server-runner.ts"),
    "utf8",
  );

  // Deficiencies list: pager relation selected, labeled, rendered, and searchable.
  assert.match(deficienciesPage, /pager:pager_id\(pager_number\)/);
  assert.match(deficienciesPage, /if \(deficiency\.pager_id\) \{\s*return "Pager";/);
  assert.match(deficienciesPage, /Pager - \{deficiency\.pager\?\.pager_number/);
  assert.match(deficienciesPage, /deficiency\.pager\?\.pager_number \?\? ""/);

  // Deficiency detail: category Pager and equipment "Pager — <number>", never Unknown Apparatus for linked pagers.
  assert.match(detailPage, /deficiency\.pager_id\s*\?\s*"Pager"/);
  assert.match(detailPage, /`Pager — \$\{deficiency\.pager_number \?\? "Unknown"\}`/);

  // Deficiency report: pager resolved as the related item label.
  assert.match(serverRunner, /pager:pager_id\(pager_number\)/);
  assert.match(serverRunner, /if \(row\.pager_id\)/);
  assert.match(serverRunner, /`Pager \$\{pager\}`/);
});

test("report mode resolves to the expected inventory workflow", () => {
  assert.equal(resolveInventoryReportMode("fire-hose", "fire-hose-testing").categoryKey, "fire-hose");
  assert.equal(resolveInventoryReportMode("gas-monitors", "gas-monitor-calibration").reportTypeKey, "gas-monitor-calibration");
  assert.equal(resolveInventoryReportMode("all", "inventory").reportTypeKey, "inventory");
});

test("pre-plans exposes an available updated-date report without a date-basis UI", () => {
  const source = getReportSourceConfig("pre-plans");

  assert.ok(source);
  assert.equal(source.availability, "available");
  assert.deepEqual(source.filters, []);
  assert.deepEqual(source.columns.map((column) => column.key), [
    "business_name",
    "address",
    "city",
    "state",
    "zip",
    "occupancy_id_number",
    "last_verified_at",
    "updated_at",
    "primary_contact_name",
    "primary_contact_phone",
    "normal_occupant_load",
    "hydrant_count",
    "hazard_count",
    "critical_information",
  ]);
});
