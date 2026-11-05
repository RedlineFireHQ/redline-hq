import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createCertificationResolver } from "./canonical-certifications";
import type { CertificationCatalogRow } from "./facade";
import { runReport } from "../reports/server-runner";
import type { ReportRunRequest } from "../reports/types";

export async function verifyCertificationReports(input: {
  departmentId: string;
  catalog: CertificationCatalogRow[];
  records: Array<Record<string, unknown>>;
  members: Array<{ id: string }>;
}) {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    certifications: input.catalog,
    member_certifications: input.records,
    members: input.members.map((row, index) => ({ ...row, first_name: `Synthetic ${index}`, last_name: "Member", department_id: input.departmentId })),
    documents: [],
  };
  const client = createClient("http://local.invalid", "synthetic-validation-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url) => {
      const request = new URL(String(url));
      const table = request.pathname.split("/").at(-1)!;
      const rows = (tables[table] ?? []).filter(row => [...request.searchParams.entries()].every(([key, value]) => {
        if (value.startsWith("eq.")) return row[key] === value.slice(3);
        if (value.startsWith("in.(")) return value.slice(4,-1).split(",").includes(String(row[key]));
        return true;
      }));
      return Response.json(rows);
    } },
  });
  const request: ReportRunRequest = { category: "certifications", searchTerm: "",
    dateRange: { preset: "custom", from: "1900-01-01", to: "2100-01-01" }, filters: {}, pageSize: 0 };
  const context = { supabase: client, departmentId: input.departmentId, departmentName: "Isolated Test", memberRole: "Administrator" };
  const unfiltered = await runReport(request, context);
  assert.ok(unfiltered.ok);
  assert.equal(unfiltered.totalRows, input.records.length);
  assert.equal(unfiltered.rows.length, input.records.length, "Unfiltered report/export must retain every individual row");
  const resolve = createCertificationResolver(input.catalog);
  for (const standard of input.catalog.filter(row => !row.canonical_certification_id)) {
    const result = await runReport({ ...request, filters: { certification_id: standard.id } }, context);
    assert.ok(result.ok);
    assert.equal(result.totalRows, input.records.filter(row => resolve(String(row.certification_id)) === standard.id).length,
      `Standard report filter must include every mapped variant: ${standard.name}`);
  }
  return unfiltered;
}
