import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import type { ReactElement } from "react";
import ts from "typescript";
import { isSelectableCertification } from "@/lib/credentials/canonical-certifications";
import type { CertificationCatalogRow } from "@/lib/credentials/facade";
import { verifyCertificationReports } from "@/lib/credentials/certification-report-test-helper";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("./page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function catalogFor(departmentId: string): CertificationCatalogRow[] {
  return [
    { id: `${departmentId}-active`, name: "Firefighter 1", active: true },
    { id: `${departmentId}-inactive`, name: "Archived Ice Rescue", active: false },
    { id: `${departmentId}-legacy`, name: "Fire Fighter I (2008 Edition)", active: false,
      canonical_certification_id: `${departmentId}-active` },
  ].map(row => ({ ...row, department_id: departmentId, ems_authority: null, ems_certification_level: null }));
}

async function reportOptions(departmentId: string, catalog: CertificationCatalogRow[]) {
  const queries: Array<{ table: string; filters: Map<string, unknown> }> = [];
  function query(table: string) {
    const filters = new Map<string, unknown>();
    queries.push({ table, filters });
    const result = () => ({
      data: table === "certifications"
        ? catalog.filter(row => [...filters].every(([key, value]) => key === "department_id"
          ? row.department_id === value : key === "active" ? row.active === value : false))
        : [],
      error: null,
    });
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters.set(key, value); return chain; },
      order: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return chain;
  }
  const pageModule = { exports: {} as {
    default: () => Promise<ReactElement<{ certifications: Array<{ id: string; name: string }> }>>;
  } };
  const load = runInNewContext(`(function(require, module, exports) { ${compiled}\n })`);
  load((name: string) => {
    if (name === "@/lib/supabase-server") return { createSupabaseServerClient: async () => ({ from: query }) };
    if (name === "@/lib/current-member") return {
      getCurrentMember: async () => ({ id: "actor", departmentId, role: "Administrator" }),
    };
    if (name === "@/lib/member-permissions") return { hasDepartmentPermission: async () => true };
    if (name === "next/navigation") return { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } };
    if (name === "@/components/reports/ReportsWorkspace") return { default: () => null };
    if (name.startsWith("@/")) throw new Error(`Unexpected page dependency: ${name}`);
    return require(name);
  }, pageModule, pageModule.exports);
  const page = await pageModule.exports.default();
  return { options: Array.from(page.props.certifications, row => ({ id: row.id, name: row.name })), queries };
}

for (const departmentId of ["elliott", "cedar-bluff", "red-oak"]) {
  test(`${departmentId} historical report options retain inactive unmapped types and active standards`, async () => {
    const catalog = [...catalogFor(departmentId), ...catalogFor("foreign-department")];
    const before = structuredClone(catalog);
    const { options, queries } = await reportOptions(departmentId, catalog);
    const ownUnmapped = catalog.filter(row => row.department_id === departmentId && !row.canonical_certification_id);
    assert.deepEqual(options, ownUnmapped.map(row => ({ id: row.id, name: row.name })));
    assert.ok(options.some(row => row.id === `${departmentId}-inactive`));
    assert.ok(options.some(row => row.id === `${departmentId}-active`));
    assert.ok(!options.some(row => row.id.startsWith("foreign-department")));
    const catalogQuery = queries.find(row => row.table === "certifications");
    assert.equal(catalogQuery?.filters.get("department_id"), departmentId);
    assert.equal(catalogQuery?.filters.has("active"), false);
    assert.deepEqual(catalog, before, "Loading historical options must not change catalog data");
  });
}

test("inactive mapped variants and inactive unmapped types remain excluded from new certification choices", () => {
  const catalog = catalogFor("elliott");
  assert.deepEqual(catalog.filter(isSelectableCertification).map(row => row.id), ["elliott-active"]);
  assert.equal(isSelectableCertification(catalog[2]), false);
  assert.equal(isSelectableCertification({ ...catalog[2], active: true }), false);
});

test("historical report output retains inactive type records, mapped variants, edition details and expiration status", async () => {
  const departmentId = "elliott";
  const catalog = catalogFor(departmentId);
  const records = catalog.map((row, index) => ({
    id: `record-${index}`, member_id: "member", department_id: departmentId, certification_id: row.id,
    issued_at: "2008-01-01", expires_at: index === 1 ? "2009-01-01" : null,
    certificate_number: null, notes: null, supporting_document_id: null,
    member_certification_details: index === 0
      ? { edition_details: "Reciprocity", source_reference: "synthetic evidence" } : null,
  }));
  const before = structuredClone({ catalog, records });
  const report = await verifyCertificationReports({
    departmentId, catalog, records, members: [{ id: "member" }],
  });
  assert.equal(report.totalRows, 3);
  const archived = report.rows.find(row => row.certification_name === "Archived Ice Rescue");
  assert.ok(archived);
  assert.equal(archived.status, "Expired");
  assert.ok(report.rows.some(row => row.certification_name === "Firefighter 1 (Reciprocity)"));
  assert.ok(report.rows.some(row => row.certification_name === "Fire Fighter I (2008 Edition)"));
  assert.deepEqual({ catalog, records }, before, "Report execution must not modify records or catalog entries");
});
