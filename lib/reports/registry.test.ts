import assert from "node:assert/strict";
import test from "node:test";

import { getReportSourceConfig } from "./registry";

test("EMS report is available and exposes real report fields", () => {
  const source = getReportSourceConfig("ems");

  assert.ok(source, "EMS report source should exist");
  assert.equal(source.availability, "available");
  assert.ok(source.columns.length > 0, "EMS report should have columns");
  assert.ok(source.filters.some((filter) => filter.key === "report_type"), "EMS report should include a report type selector");
  assert.ok(source.filters.some((filter) => filter.key === "member_id"), "EMS report should include member filtering");
  assert.ok(source.filters.some((filter) => filter.key === "equipment_status"), "EMS report should include equipment status filter");

  const reportTypeOptions = source.filters.find((filter) => filter.key === "report_type")?.options ?? [];
  assert.deepEqual(
    reportTypeOptions.map((option) => option.value),
    ["certification-status", "training", "equipment", "supplies"],
    "EMS report type options should map exactly to certification status, training, equipment, and supplies",
  );
  assert.ok(reportTypeOptions.some((option) => option.value === "certification-status"), "EMS report should include an EMS Certification Status option");
  assert.ok(reportTypeOptions.some((option) => option.value === "supplies"), "EMS report should include an EMS Supplies option");
  assert.equal(reportTypeOptions.some((option) => option.value === "personnel-certifications"), false, "EMS report should not include Personnel & Certifications as a report type");
  assert.equal(reportTypeOptions.some((option) => option.value === "all-ems"), false, "EMS report should not include an All EMS option");

  assert.equal(
    source.filters.some((filter) => filter.key === "supply_category"),
    false,
    "EMS report should not include a Supply Category filter",
  );

  const equipmentStatusOptions = source.filters.find((filter) => filter.key === "equipment_status")?.options ?? [];
  assert.ok(equipmentStatusOptions.some((option) => option.value === "active"), "EMS equipment status filter should include Active");
  assert.ok(equipmentStatusOptions.some((option) => option.value === "inactive"), "EMS equipment status filter should include Inactive");
  assert.ok(equipmentStatusOptions.some((option) => option.value === "out of service"), "EMS equipment status filter should include Out of Service");

  const supplyStockLevelOptions = source.filters.find((filter) => filter.key === "supply_stock_level")?.options ?? [];
  assert.ok(supplyStockLevelOptions.some((option) => option.value === "low_or_worse"), "EMS supplies should include low stock filtering");

  assert.ok(source.filters.some((filter) => filter.key === "ems_level"), "EMS report should include EMS level filtering");
  assert.ok(source.filters.some((filter) => filter.key === "report_scope"), "EMS report should include report scope filtering");
  assert.ok(source.filters.some((filter) => filter.key === "iowa_status"), "EMS report should include Iowa status filtering");
  assert.ok(source.filters.some((filter) => filter.key === "nremt_maintained"), "EMS report should include NREMT maintained filtering");
  assert.ok(source.filters.some((filter) => filter.key === "readiness_status"), "EMS report should include readiness status filtering");
  assert.ok(source.filters.some((filter) => filter.key === "expiration_window"), "EMS report should include expiration window filtering");

  const reportScopeOptions = source.filters.find((filter) => filter.key === "report_scope")?.options ?? [];
  assert.deepEqual(
    reportScopeOptions.map((option) => option.value),
    ["iowa", "nremt", "iowa-and-nremt"],
    "EMS report scope options should map exactly to Iowa, NREMT, and Iowa + NREMT",
  );
});

test("Inspections report is available with centralized inventory inspection/testing filters and columns", () => {
  const source = getReportSourceConfig("inspections");

  assert.ok(source, "Inspections report source should exist");
  assert.equal(source.availability, "available");

  const filterKeys = new Set(source.filters.map((filter) => filter.key));
  assert.ok(filterKeys.has("report_type"), "Inspections report should include a report type selector");
  assert.ok(filterKeys.has("fire_hose_id"), "Inspections report should include fire hose filtering");
  assert.ok(filterKeys.has("scba_cylinder_id"), "Inspections report should include SCBA cylinder filtering");
  assert.ok(filterKeys.has("scba_pack_id"), "Inspections report should include SCBA pack filtering");
  assert.ok(filterKeys.has("gas_monitor_id"), "Inspections report should include gas monitor filtering");
  assert.ok(filterKeys.has("rope_item_id"), "Inspections report should include rope item filtering");
  assert.ok(filterKeys.has("ground_ladder_id"), "Inspections report should include ground ladder filtering");
  assert.ok(filterKeys.has("inspection_result"), "Inspections report should include result filtering");
  assert.ok(filterKeys.has("due_status"), "Inspections report should include due status filtering");

  const reportTypeOptions = source.filters.find((filter) => filter.key === "report_type")?.options ?? [];
  assert.ok(reportTypeOptions.some((option) => option.value === "all-inspections"), "Inspections report should include all-inspections mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "fire-hose-testing"), "Inspections report should include fire hose testing mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "scba-cylinder-hydrostatic-testing"), "Inspections report should include SCBA cylinder hydro mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "scba-pack-flow-testing"), "Inspections report should include SCBA pack flow mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "gas-monitor-calibration"), "Inspections report should include gas monitor calibration mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "rope-inspections"), "Inspections report should include rope inspections mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "ground-ladder-service-testing"), "Inspections report should include ground ladder service testing mode");

  const columnKeys = new Set(source.columns.map((column) => column.key));
  assert.ok(columnKeys.has("inspection_date"), "Inspections report should include inspection date column");
  assert.ok(columnKeys.has("inspection_type"), "Inspections report should include inspection type column");
  assert.ok(columnKeys.has("item_name"), "Inspections report should include item name column");
  assert.ok(columnKeys.has("item_identifier"), "Inspections report should include item identifier column");
  assert.ok(columnKeys.has("result"), "Inspections report should include result column");
  assert.ok(columnKeys.has("inspected_by"), "Inspections report should include inspector column");
  assert.ok(columnKeys.has("next_due_date"), "Inspections report should include next due date column");
  assert.ok(columnKeys.has("due_status"), "Inspections report should include due status column");
  assert.ok(columnKeys.has("open_deficiencies"), "Inspections report should include open deficiencies column");
});

test("Apparatus report exposes mileage and hours reporting mode", () => {
  const source = getReportSourceConfig("apparatus");

  assert.ok(source, "Apparatus report source should exist");
  assert.equal(source.availability, "available");

  const reportTypeFilter = source.filters.find((filter) => filter.key === "report_type");
  assert.ok(reportTypeFilter, "Apparatus report should include a report type selector");

  const reportTypeOptions = reportTypeFilter?.options ?? [];
  assert.ok(reportTypeOptions.some((option) => option.value === "overview"), "Apparatus report should include overview mode");
  assert.ok(reportTypeOptions.some((option) => option.value === "mileage-hours"), "Apparatus report should include mileage and hours mode");

  const columnKeys = new Set(source.columns.map((column) => column.key));
  assert.ok(columnKeys.has("reading_date"), "Apparatus report should include mileage/history date column");
  assert.ok(columnKeys.has("entry_source"), "Apparatus report should include source column for each reading");
  assert.ok(columnKeys.has("reading_mileage"), "Apparatus report should include mileage history column");
  assert.ok(columnKeys.has("reading_engine_hours"), "Apparatus report should include engine hours history column");
  assert.ok(columnKeys.has("checked_by"), "Apparatus report should include checked by column");
});

test("Activity report is available with centralized timeline filters and columns", () => {
  const source = getReportSourceConfig("activity");

  assert.ok(source, "Activity report source should exist");
  assert.equal(source.availability, "available");

  const filterKeys = new Set(source.filters.map((filter) => filter.key));
  assert.ok(filterKeys.has("member_id"), "Activity report should include member filtering");
  assert.ok(filterKeys.has("module"), "Activity report should include module filtering");
  assert.ok(filterKeys.has("action"), "Activity report should include action filtering");

  const moduleOptions = source.filters.find((filter) => filter.key === "module")?.options ?? [];
  assert.ok(moduleOptions.some((option) => option.value === "training"), "Activity report should include training module option");
  assert.ok(moduleOptions.some((option) => option.value === "deficiencies"), "Activity report should include deficiencies module option");

  const actionOptions = source.filters.find((filter) => filter.key === "action")?.options ?? [];
  assert.ok(actionOptions.some((option) => option.value === "created"), "Activity report should include created action option");
  assert.ok(actionOptions.some((option) => option.value === "completed"), "Activity report should include completed action option");

  const columnKeys = new Set(source.columns.map((column) => column.key));
  assert.ok(columnKeys.has("activity_date"), "Activity report should include activity date column");
  assert.ok(columnKeys.has("member_name"), "Activity report should include member column");
  assert.ok(columnKeys.has("module"), "Activity report should include module column");
  assert.ok(columnKeys.has("action"), "Activity report should include action column");
  assert.ok(columnKeys.has("description"), "Activity report should include description column");
  assert.ok(columnKeys.has("related_item"), "Activity report should include related item column");
});
