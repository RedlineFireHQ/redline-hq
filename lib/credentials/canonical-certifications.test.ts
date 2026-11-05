import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { certificationDetailText, certificationDisplayName, createCertificationResolver, isSelectableCertification } from "./canonical-certifications";
import { buildMemberCredentials, buildRequiredCredentials, applyCredentialRequirementStatus, type CertificationCatalogRow } from "./facade";
import { getRoleRequirementComparison } from "../role-requirements";
import { computeAuthoritativeMemberReadiness } from "../readiness/authoritative-member-readiness";
import { verifyCertificationReports } from "./certification-report-test-helper";

const dept = "department-one";
const role = "firefighter-role";
const names = ["Firefighter 1","Firefighter 2","Fire Apparatus Driver Operator Pumper",
  "Fire Apparatus Driver Operator Aerial","Fire and Emergency Services Instructor 1","Fire Inspector 1",
  "Fire Officer 1","Fire Officer 2","Hazardous Materials Awareness","Hazardous Materials Operations"];
const roots: CertificationCatalogRow[] = names.map((name, index) => ({
  id: `standard-${index}`, name, department_id: dept, canonical_certification_id: null,
  active: true, ems_authority: null, ems_certification_level: null,
}));
const approvedConfiguration = readFileSync(new URL("../../supabase/migrations/20261104221000_red_oak_standard_certifications.sql", import.meta.url), "utf8");
const aliases: CertificationCatalogRow[] = [...approvedConfiguration.matchAll(/\('([0-9a-f-]{36})','([^']+)','([^']+)'\)/g)]
  .map(([, id, name, standardName]) => {
    const target = roots.find(row => row.name === standardName);
    assert.ok(target, "Approved explicit standard type must exist");
    return { ...target, id, name, canonical_certification_id: target.id };
  });
assert.equal(aliases.length, 39);
const catalog = [...roots, ...aliases];
const resolver = createCertificationResolver(catalog);

function state(records: Array<{ id: string; certification_id: string; expires_at: string | null }>, required = roots[0].id) {
  const requirements = [{ department_role_id: role, certification_id: required }];
  const comparison = getRoleRequirementComparison({
    memberDepartmentRoleId: role, certificationTypes: catalog, qualificationTypes: [],
    memberCertifications: records, memberQualifications: [],
    roleRequiredCertifications: requirements, roleRequiredQualifications: [],
  });
  const readiness = computeAuthoritativeMemberReadiness({
    currentMemberId: "member", memberStartDate: null, memberDepartmentRoleId: role, roleName: "Firefighter",
    canonicalMemberCertifications: records.map(row => ({ ...row, issued_at: "2008-01-01", certificate_number: null })),
    certificationNameById: new Map(catalog.map(row => [row.id, row.name])),
    certificationTypeById: new Map(), emsTrackProfiles: [], roleRequiredCertifications: requirements,
    certificationCatalog: catalog, qualificationCatalog: [], roleRequiredQualifications: [], memberQualifications: [],
    requirements: [{ id: "annual-fire", name: "Annual Fire Training", requirement_kind: "annual_hours",
      period_type: "annual", minimum_hours: 0, category_id: null, due_frequency_rule: null,
      required_topic: null, sort_order: 1, config_json: null, active: true }],
    categoryNameById: new Map(), fireAnnualComplianceRows: [], categoryHours: [], deficiencyItems: [],
  });
  return { comparison, readiness };
}

test("all 39 approved variants resolve explicitly to the correct department-scoped standard", () => {
  for (const alias of aliases) assert.equal(resolver(alias.id), alias.canonical_certification_id);
  assert.equal(catalog.filter(isSelectableCertification).length, 10);
  assert.equal(resolver("new-ice-rescue"), "new-ice-rescue");
  assert.equal(resolver("unknown"), "unknown");
});

test("cross-department mappings, missing department metadata, missing targets, chains and cycles fail explicitly", () => {
  for (const invalid of [
    [{ id: "a", department_id: dept, canonical_certification_id: "b" }, { id: "b", department_id: "another" }],
    [{ id: "a", canonical_certification_id: "b" }, { id: "b" }],
    [{ id: "a", department_id: dept, canonical_certification_id: "absent" }],
    [{ id: "a", department_id: dept, canonical_certification_id: "b" }, { id: "b", department_id: dept, canonical_certification_id: "c" }, { id: "c", department_id: dept }],
    [{ id: "a", department_id: dept, canonical_certification_id: "b" }, { id: "b", department_id: dept, canonical_certification_id: "a" }],
  ]) assert.throws(() => createCertificationResolver(invalid)("a"), /Invalid department certification mapping/);
});

test("every explicitly approved Firefighter 1 edition satisfies the standard requirement on Personnel and authoritative readiness", () => {
  for (const alias of aliases.filter(row => row.canonical_certification_id === roots[0].id)) {
    const result = state([{ id: alias.id, certification_id: alias.id, expires_at: null }]);
    assert.equal(result.comparison.status.kind, "complete", alias.name);
    const factors = result.readiness.readiness.factors.filter(row => row.category === "certification");
    assert.ok(factors.length > 0);
    assert.ok(factors.every(row => row.completionPercent === 100), alias.name);
  }
});

test("expiration is evaluated individually before equivalence; current plus expired equivalents are order-independent", () => {
  const variants = aliases.filter(row => row.canonical_certification_id === roots[0].id);
  const expired = { id: "expired", certification_id: variants[0].id, expires_at: "2000-01-01" };
  const current = { id: "current", certification_id: variants[1].id, expires_at: null };
  assert.equal(state([expired]).comparison.status.kind, "missing");
  const left = state([expired, current]);
  const right = state([current, expired]);
  assert.equal(left.comparison.status.kind, "complete");
  assert.deepEqual(left.readiness.readiness, right.readiness.readiness);
  assert.equal(left.readiness.certificationStatuses.length, 2, "Individual historical records must remain distinct");
  const otherCurrent = { ...expired, expires_at: null };
  assert.deepEqual(state([otherCurrent,current]).readiness.readiness, state([current,otherCurrent]).readiness.readiness,
    "Two current equivalents must use a stable standard requirement label, not whichever historical row appears first");
});

test("Firefighter 2, HazMat levels, Pumper and Aerial remain distinct; required types count once", () => {
  for (const [held, required] of [[1,0],[9,8],[8,9],[2,3],[3,2]]) {
    assert.equal(state([{ id: "record", certification_id: roots[held].id, expires_at: null }], roots[required].id).comparison.status.kind, "missing");
  }
  const requirements = buildRequiredCredentials({
    roleRequiredCertifications: [
      { id: "one", department_role_id: role, certification_id: roots[0].id },
      { id: "two", department_role_id: role, certification_id: aliases.find(row => row.canonical_certification_id === roots[0].id)!.id },
    ], roleRequiredQualifications: [], certificationTypes: catalog, qualificationTypes: [],
  });
  assert.equal(requirements.length, 1);
  const held = aliases.filter(row => row.canonical_certification_id === roots[0].id).slice(0,2);
  const credentials = buildMemberCredentials({
    memberCertifications: held.map((row, index) => ({ id: `record-${index}`, member_id: "member",
      certification_id: row.id, issued_at: "2008-01-01", expires_at: null, supporting_document_id: null })),
    memberQualifications: [], certificationTypes: catalog, qualificationTypes: [],
  });
  const classified = applyCredentialRequirementStatus({ memberCredentials: credentials, requiredCredentials: requirements });
  assert.equal(classified.length, 2);
  assert.ok(classified.every(row => row.requirementStatus === "required"));
  assert.deepEqual(classified.map(row => row.catalogId), held.map(row => row.id), "Classification cannot reassign records");
});

test("edition details retain literal IFSAC and Reciprocity text and support either PostgREST relation shape", () => {
  const details = { edition_details: "Reciprocity", source_reference: "approved evidence" };
  assert.equal(certificationDetailText(details), "Reciprocity");
  assert.equal(certificationDetailText([details]), "Reciprocity");
  assert.equal(certificationDisplayName("Firefighter 1", details), "Firefighter 1 (Reciprocity)");
  assert.equal(certificationDisplayName("Fire Fighter I (IFSAC 1997 Edition)", null), "Fire Fighter I (IFSAC 1997 Edition)");
});

test("standard report filters include mapped variants and retain separate historical rows and edition details", async () => {
  const variants = aliases.filter(row => row.canonical_certification_id === roots[0].id).slice(0,2);
  const report = await verifyCertificationReports({
    departmentId: dept, catalog, members: [{ id: "member" }],
    records: [
      ...variants.map((row, index) => ({ id: `record-${index}`, member_id: "member", department_id: dept,
        certification_id: row.id, issued_at: "2008-01-01", expires_at: null, notes: null })),
      { id: "corrected", member_id: "member", department_id: dept, certification_id: roots[0].id,
        issued_at: "2008-01-01", expires_at: null, notes: null,
        member_certification_details: { edition_details: "Reciprocity", source_reference: "approved snapshot" } },
    ],
  });
  assert.ok(report.rows.some(row => row.certification_name === "Firefighter 1 (Reciprocity)"));
  assert.ok(report.rows.some(row => row.certification_name === variants[0].name));
});

test("all active Personnel, desktop/mobile and department readiness loaders carry the same explicit catalog mapping", () => {
  for (const file of [
    "app/personnel/page.tsx", "app/personnel/[id]/page.tsx", "app/my-readiness/page.tsx",
    "app/mobile/page.tsx", "app/mobile/my-readiness/page.tsx", "components/command-center-v3/MyReadinessPanel.tsx",
    "lib/readiness/department-readiness.ts",
  ]) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(source, /\.select\("[^"]*canonical_certification_id[^"]*department_id"\)/, file);
    assert.match(source, /canonical_certification_id: typeof row\.canonical_certification_id/, file);
  }
});
