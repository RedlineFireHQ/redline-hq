import { strict as assert } from "node:assert";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintableReportTable } from "../../components/reports/PrintableReportTable";
import { reportToCsv } from "../reports/csv";
import { getReportSourceConfig } from "../reports/registry";
import { buildFitReport, type ReportTest } from "./report";

const failed: ReportTest = {
  result_id: "r1", member_id: "a", member_name: "Alice", session_id: "s1",
  session_name: "Annual", test_date: "2024-01-01", tester_name: "Chief",
  result: "Fail", mask_size: "S",
};
const passed: ReportTest = { ...failed, result_id: "r2", session_id: "s2", test_date: "2025-01-01", result: "Pass", mask_size: "L" };
const members = [{ id: "a", name: "Alice" }, { id: "b", name: "Bob" }];
const options = { mode: "latest" as const, memberId: "all", search: "", from: "2020-01-01", to: "2030-01-01", today: "2026-01-02" };

test("latest report includes overdue and untested personnel", () => {
  const rows = buildFitReport(members, [passed, failed], options);
  assert.equal(rows[0].status, "Overdue");
  assert.equal(rows[0].due_date, "2026-01-01");
  assert.equal(rows[1].status, "No recorded test");
});

test("historical report retains failures and filters by date and personnel", () => {
  const rows = buildFitReport(members, [passed, failed], { ...options, mode: "history", to: "2024-12-31", memberId: "a" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, "Fail");
  assert.equal(rows[0].status, "Failed");
});

test("a latest test outside the filter is not labeled untested", () => {
  const rows = buildFitReport(members, [passed], { ...options, to: "2024-12-31" });
  assert.deepEqual(rows.map((row) => row.member_name), ["Bob"]);
});

test("all-time reports do not silently exclude older tests", () => {
  const old = { ...passed, test_date: "1998-01-01" };
  const rows = buildFitReport(members, [old], { ...options, allTime: true });
  assert.equal(rows[0].test_date, "1998-01-01");
});

test("print and CSV retain result, tester, date and due date", () => {
  const source = getReportSourceConfig("scba-mask-fit");
  assert.ok(source);
  const rows = buildFitReport(members, [passed], options);
  const csv = reportToCsv(source.columns, rows);
  const html = renderToStaticMarkup(React.createElement(PrintableReportTable, { columns: source.columns, rows }));
  for (const value of ["Alice", "2025-01-01", "Pass", "Chief", "2026-01-01"]) {
    assert.ok(csv.includes(value));
    assert.ok(html.includes(value));
  }
});
