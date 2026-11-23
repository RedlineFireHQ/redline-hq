import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runInventoryReport } from "./inventory-report";
import { getReportSourceConfig } from "./registry";
import { reportToCsv } from "./csv";
import type { ReportRunRequest } from "./types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintableReportTable } from "../../components/reports/PrintableReportTable";

const dataset: Record<string, Array<Record<string, unknown>>> = {
	members: [
		{ id: "m1", department_id: "a", first_name: "Alex", last_name: "Smith" },
		{ id: "m2", department_id: "a", first_name: "Sam", last_name: "Jones" },
		{ id: "m3", department_id: "b", first_name: "Other", last_name: "Department" },
	],
	ppe_items: [
		{ id: "p1", department_id: "a", item_name: "Helmet", assigned_member_id: "m1", expiration_date: "2020-02-29", updated_at: "2025-01-01", asset_number: "H1" },
		{ id: "p2", department_id: "a", item_name: "Coat", assigned_member_id: "m2", expiration_date: "2030-07-04", updated_at: "2025-01-01", asset_number: "C1" },
		{ id: "p3", department_id: "a", item_name: "Gloves", assigned_member_id: null, expiration_date: null, updated_at: "2025-01-01" },
		{ id: "p4", department_id: "b", item_name: "Other gear", assigned_member_id: "m3", expiration_date: "2027-01-01", updated_at: "2025-01-01" },
	],
};

function client() {
	const from = (table: string) => {
		let department = "";
		const query = {
			select() { return query; },
			eq(key: string, value: string) { if (key === "department_id") department = value; return query; },
			order() { return query; },
			maybeSingle() { return Promise.resolve({ data: null, error: null }); },
			then(resolve: (result: { data: Array<Record<string, unknown>>; error: null }) => unknown) {
				return Promise.resolve({ data: (dataset[table] ?? []).filter((row) => row.department_id === department), error: null }).then(resolve);
			},
		};
		return query;
	};
	return { from } as unknown as SupabaseClient;
}

async function report(category: string) {
	const source = getReportSourceConfig("inventory");
	assert.ok(source);
	const request: ReportRunRequest = {
		category: "inventory", searchTerm: "", dateRange: { preset: "custom", from: "2024-01-01", to: "2031-12-31" },
		filters: { inventory_category: category, inventory_report_type: "inventory" }, page: 1, pageSize: 0,
	};
	const result = await runInventoryReport(request, { supabase: client(), departmentId: "a", departmentName: "A" }, source, "2024-01-01T00:00:00Z", "2032-01-01T00:00:00Z");
	assert.ok(result.ok);
	return result;
}

test("PPE report pairs each stored expiration with its item and assigned member", async () => {
	const result = await report("ppe");
	assert.deepEqual(result.columns.slice(0, 3).map((column) => column.label), ["Item", "Expiration Date", "Assigned To / Location"]);
	assert.equal(result.rows.length, 3);
	const helmet = result.rows.find((row) => row.item_name === "Helmet");
	const coat = result.rows.find((row) => row.item_name === "Coat");
	const gloves = result.rows.find((row) => row.item_name === "Gloves");
	assert.equal(helmet?.expiration_date, "Feb 29, 2020");
	assert.equal(helmet?.location_or_apparatus, "Alex Smith");
	assert.equal(coat?.expiration_date, "Jul 04, 2030");
	assert.equal(coat?.location_or_apparatus, "Sam Jones");
	assert.equal(gloves?.expiration_date, "N/A");
	assert.ok(!result.rows.some((row) => row.item_name === "Other gear"));
	const csv = reportToCsv(result.columns, result.rows);
	assert.match(csv, /"Helmet","Feb 29, 2020","Alex Smith"/);
	assert.match(csv, /"Coat","Jul 04, 2030","Sam Jones"/);
	assert.match(csv, /"Gloves","N\/A"/);
	const printed = renderToStaticMarkup(createElement(PrintableReportTable, { columns: result.columns, rows: result.rows }));
	assert.match(printed, /Expiration Date/);
	assert.match(printed, /Helmet<\/td><td[^>]*>Feb 29, 2020<\/td><td[^>]*>Alex Smith/);
	assert.match(printed, /Coat<\/td><td[^>]*>Jul 04, 2030<\/td><td[^>]*>Sam Jones/);
	assert.match(printed, /Gloves<\/td><td[^>]*>N\/A/);
});

test("other inventory reports retain their existing column shape", async () => {
	const result = await report("all");
	assert.ok(result.columns.some((column) => column.key === "due_date"));
	assert.ok(!result.columns.some((column) => column.key === "expiration_date"));
});

test("CSV escapes quotes and spreadsheet formulas", () => {
	assert.equal(reportToCsv([{ key: "v", label: "Item" }], [{ v: '=1+"x"' }]), '"Item"\r\n"\'=1+""x"""');
});
