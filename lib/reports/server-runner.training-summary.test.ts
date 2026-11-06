import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { ReportResultPayload, ReportRunRequest } from "./types";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Query = { table: string; filters: Map<string, unknown> };
const require = createRequire(import.meta.url);
const runnerSource = readFileSync(new URL("./server-runner.ts", import.meta.url), "utf8");

function seed(): Tables {
  return {
    members: [
      { id: "a", department_id: "cedar-bluff", first_name: "Alex", last_name: "Smith" },
      { id: "b", department_id: "cedar-bluff", first_name: "Blair", last_name: "Jones" },
      { id: "c", department_id: "cedar-bluff", first_name: "Alex", last_name: "Smith" },
      { id: "zero", department_id: "cedar-bluff", first_name: "Zero", last_name: "Credit" },
      { id: "none", department_id: "cedar-bluff", first_name: "No", last_name: "Records" },
      { id: "foreign", department_id: "other", first_name: "Other", last_name: "Department" },
    ],
    training_event_attendance: [
      { id: "att-a", department_id: "cedar-bluff", member_id: "a", training_event_id: "event", attendance_status: "attending" },
      { id: "att-b", department_id: "cedar-bluff", member_id: "b", training_event_id: "event", attendance_status: "attending" },
      { id: "absent", department_id: "cedar-bluff", member_id: "a", training_event_id: "event", attendance_status: "not_attending" },
      { id: "foreign-att", department_id: "other", member_id: "foreign", training_event_id: "foreign-event", attendance_status: "attending" },
    ],
    training_events: [
      { id: "event", department_id: "cedar-bluff", title: "Annual department drill", category_id: "fire", starts_at: "2026-01-01T10:00:00Z", hours_credit: 2, instructor_name: "Instructor", training_type: "Drill", location: "Station" },
      { id: "foreign-event", department_id: "other", title: "Foreign drill", starts_at: "2026-06-01T10:00:00Z", hours_credit: 100 },
    ],
    training_outside_submissions: [
      { id: "outside", department_id: "cedar-bluff", member_id: "a", title: "Approved outside class", category_id: "ems", training_date: "2026-12-31", hours: 1.5, status: "approved" },
      { id: "old", department_id: "cedar-bluff", member_id: "a", title: "Previous year", training_date: "2025-12-31", hours: 50, status: "approved" },
      { id: "future", department_id: "cedar-bluff", member_id: "b", title: "Next year", training_date: "2027-01-01", hours: 50, status: "approved" },
      { id: "pending", department_id: "cedar-bluff", member_id: "a", title: "Unapproved class", training_date: "2026-05-01", hours: 100, status: "pending" },
      { id: "same-name", department_id: "cedar-bluff", member_id: "c", title: "Separate member class", category_id: "fire", training_date: "2026-05-01", hours: 0.5, status: "approved" },
      { id: "zero-hours", department_id: "cedar-bluff", member_id: "zero", title: "Zero credit class", category_id: "fire", training_date: "2026-05-01", hours: 0, status: "approved" },
      { id: "foreign-outside", department_id: "other", member_id: "foreign", title: "Foreign class", training_date: "2026-05-01", hours: 100, status: "approved" },
    ],
    training_assignment_members: [
      { id: "assignment-b", department_id: "cedar-bluff", member_id: "b", training_assignment_id: "assignment", completion_status: "approved", hours_earned: 1.25, completed_at: "2026-06-01T12:00:00Z" },
      { id: "assignment-a", department_id: "cedar-bluff", member_id: "a", training_assignment_id: "assignment", completion_status: "approved", hours_earned: 0, completed_at: "2026-06-01T12:00:00Z" },
    ],
    training_assignments: [
      { id: "assignment", department_id: "cedar-bluff", title: "Annual homework", category_id: "fire", hours_credit: 3 },
    ],
    training_categories: [
      { id: "fire", department_id: "cedar-bluff", name: "Fire" },
      { id: "ems", department_id: "cedar-bluff", name: "EMS" },
    ],
  };
}

function request(member = "all"): ReportRunRequest {
  return {
    category: "training", searchTerm: "",
    dateRange: { preset: "custom", from: "2026-01-01", to: "2026-12-31" },
    filters: { member_id: member, category_id: "all" }, pageSize: 0,
  };
}

function setup(tables = seed()) {
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const filters = new Map<string, unknown>();
      const predicates: Array<(row: Row) => boolean> = [];
      queries.push({ table, filters });
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters.set(key, value); predicates.push(row => row[key] === value); return chain;
        },
        in: (key: string, values: unknown[]) => {
          predicates.push(row => values.includes(row[key])); return chain;
        },
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: (tables[table] ?? []).filter(row => predicates.every(p => p(row))), error: null }).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  const compiled = ts.transpileModule(runnerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const runnerModule = { exports: {} as typeof import("./server-runner") };
  const load = runInNewContext(`(function(require,module,exports) { ${compiled}\n })`);
  load((name: string) => name === "@/lib/supabase-admin"
    ? { createSupabaseAdminClient: () => client } : require(name), runnerModule, runnerModule.exports);
  const run = async (input = request()) => {
    const response = await runnerModule.exports.runReport(input, {
      supabase: client, departmentId: "cedar-bluff", departmentName: "Synthetic Cedar Bluff", memberRole: "administrator",
    });
    assert.ok(response.ok);
    return structuredClone(response);
  };
  return { run, queries, tables };
}

test("All Members reuses existing totals: one row per member ID, no details or double counting", async () => {
  const { run, tables, queries } = setup();
  const before = structuredClone(tables);
  const result = await run();
  assert.equal(result.presentation, "training-member-summary");
  assert.equal(result.period.label, "Jan 1, 2026 to Dec 31, 2026");
  assert.deepEqual(result.columns.map(c => c.label), ["Member", "Total Training Hours"]);
  assert.equal(result.totalRows, 4);
  assert.deepEqual(result.rows.map(row => row.hours), ["6.50", "3.25", "0.50", "0.00"]);
  assert.equal(result.rows.filter(row => row.member_name === "Alex Smith").length, 2, "Names do not merge distinct members");
  assert.equal(result.rows.some(row => row.member_name === "No Records"), false, "Preserve existing member inclusion");
  assert.ok(result.rows.some(row => row.member_name === "Zero Credit" && row.hours === "0.00"));
  assert.deepEqual(result.summary, [{ label: "Department Training Hours", value: "10.25 hrs" }]);
  assert.equal(result.rows.reduce((total, row) => total + Number(row.hours), 0), 10.25);
  assert.ok(result.rows.every(row => Object.keys(row).sort().join(",") === "hours,member_name"));
  assert.equal(result.breakdowns?.members?.reduce((total, m) => total + m.totalHours, 0), 10.25);
  assert.ok(queries.every(q => q.filters.get("department_id") === "cedar-bluff"), "Every data/directory query is department scoped");
  assert.deepEqual(tables, before, "Report is read-only");
});

test("selected range, category, search, empty selection and paging cannot leak training details", async () => {
  const { run } = setup();
  const selected = request();
  selected.dateRange = { preset: "custom", from: "2026-12-31", to: "2026-12-31" };
  const lastDay = await run(selected);
  assert.deepEqual(lastDay.rows, [{ member_name: "Alex Smith", hours: "1.50" }]);
  const category = request();
  category.filters.category_id = "ems";
  assert.deepEqual((await run(category)).rows, lastDay.rows);
  const search = request();
  search.searchTerm = "Approved outside class";
  assert.deepEqual((await run(search)).rows, lastDay.rows);
  const omitted = request("");
  omitted.pageSize = 1;
  omitted.page = 2;
  assert.equal((await run(omitted)).rows.length, 4, "Print summary includes every aggregated member, not one page of records");
  selected.dateRange = { preset: "custom", from: "2024-01-01", to: "2024-12-31" };
  const empty = await run(selected);
  assert.equal(empty.totalRows, 0);
  assert.deepEqual(empty.summary, [{ label: "Department Training Hours", value: "0.00 hrs" }]);
});

test("individual member keeps detailed rows, dates, source labels and existing hour calculation", async () => {
  const { run } = setup();
  const result = await run(request("a"));
  assert.equal(result.presentation, undefined);
  assert.equal(result.totalRows, 3);
  assert.deepEqual(result.summary?.[0], { label: "Total Hours", value: "6.50 hrs" });
  assert.deepEqual(new Set(result.rows.map(row => row.training_name)), new Set(["Annual department drill", "Approved outside class", "Annual homework"]));
  assert.deepEqual(new Set(result.rows.map(row => row.source_type)), new Set(["Department Event", "Outside Submission", "Assigned Training"]));
  assert.ok(result.rows.every(row => row.member_name === "Alex Smith" && row.training_date));
  assert.ok(result.columns.some(c => c.key === "training_date"));
  assert.ok(result.columns.some(c => c.key === "training_name"));
});

function renderPrint(result: ReportResultPayload) {
  const source = ts.createSourceFile("ReportsWorkspace.tsx",
    readFileSync(new URL("../../components/reports/ReportsWorkspace.tsx", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let section: ts.JsxElement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(a =>
      ts.isJsxAttribute(a) && a.name.getText(source) === "className" && a.initializer &&
      ts.isStringLiteral(a.initializer) && a.initializer.text === "hidden print:block")) section = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(section);
  const asText = source.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "asText");
  assert.ok(asText);
  const compiled = ts.transpileModule(`${asText.getText(source)}
    export function render(result) { const generatedDateLabel = result.generatedAt; return ${section.getText(source)}; }`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const printModule = { exports: {} as { render: (result: ReportResultPayload) => ReactElement } };
  runInNewContext(`(function(require,module,exports) { ${compiled}\n })`)(require, printModule, printModule.exports);
  return renderToStaticMarkup(printModule.exports.render(result));
}

test("actual print section contains only summary rows for All Members and retains individual details", async () => {
  const { run } = setup();
  const summary = renderPrint(await run());
  assert.match(summary, /Department Training Hours: 10.25 hrs/);
  assert.match(summary, /Members: 4/);
  assert.equal((summary.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr/g) ?? []).length, 4);
  assert.doesNotMatch(summary, /Annual department drill|Approved outside class|Annual homework|<th[^>]*>Training Date/);
  const individual = renderPrint(await run(request("a")));
  assert.match(individual, /Annual department drill/);
  assert.match(individual, /Approved outside class/);
  assert.match(individual, /Total Hours: 6.50 hrs/);
});

test("report endpoint preserves signed-in membership/permission gates and never trusts a requested department", async () => {
  const source = readFileSync(new URL("../../app/api/reports/run/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const mode of ["signed-out", "forbidden", "allowed"] as const) {
    let runs = 0;
    const routeModule = { exports: {} as { POST: (request: Request) => Promise<Response> } };
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "Synthetic Cedar Bluff" } }) }) }) }) };
    runInNewContext(`(function(require,module,exports) { ${compiled}\n })`, { Response })((
      name: string,
    ) => {
      if (name === "@/lib/current-member") return { getCurrentMember: async () =>
        mode === "signed-out" ? null : { departmentId: "cedar-bluff", role: "administrator" } };
      if (name === "@/lib/member-permissions") return { hasDepartmentPermission: async (_client: unknown, dept: string, _role: string, permission: string) => {
        assert.equal(dept, "cedar-bluff"); assert.equal(permission, "reports_management"); return mode === "allowed";
      } };
      if (name === "@/lib/supabase-server") return { createSupabaseServerClient: async () => client };
      if (name === "@/lib/reports/server-runner") return { runReport: async (_input: unknown, context: { departmentId: string }) => {
        runs++; assert.equal(context.departmentId, "cedar-bluff"); return { ok: true };
      } };
      throw Error(`Unexpected dependency ${name}`);
    }, routeModule, routeModule.exports);
    const response = await routeModule.exports.POST(new Request("http://local.invalid/api/reports/run", {
      method: "POST", body: JSON.stringify({ ...request(), departmentId: "other" }),
    }));
    assert.equal(response.status, mode === "signed-out" ? 401 : mode === "forbidden" ? 403 : 200);
    assert.equal(runs, mode === "allowed" ? 1 : 0);
  }
});
