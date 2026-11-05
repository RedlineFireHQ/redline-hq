import assert from "node:assert/strict";
import Module from "node:module";
import test, { after, before, beforeEach } from "node:test";
import * as React from "react";
import { createClient } from "@supabase/supabase-js";

import { certificationMetadata, resolveCertificationCatalogEntry } from "@/lib/ems/certification-selection";
import { buildCertificationTypeMetaById, resolveAuthoritativeEmsCertificationsForMember, applyAuthoritativeCertificationToTrackProfile } from "@/lib/ems/authoritative-certifications";
import { buildMemberEmsProgress } from "@/lib/ems/member-ems-progress";
import type { CertificationCatalogRow } from "@/lib/credentials/facade";
import { isEmsCertificationLevel } from "@/lib/ems/requirements";

type Row = Record<string, unknown>;
type Element = React.ReactElement<Row>;
const dept = "synthetic-department";
const member = "synthetic-member";
const editor = "synthetic-editor";
const db: Record<string, Row[]> = {};
const writes: Array<{ table: string; method: string; payload: Row; filters: Array<[string, string]> }> = [];
const state: unknown[] = [];
let cursor = 0;
let sequence = 0;
let failCatalogWrite = false;
let render: () => React.ReactNode;

// Real Supabase query serialization, with all requests handled in memory.
const memoryFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), "http://local.invalid");
  if (url.pathname === "/api/personnel/members") {
    return Response.json({ ok: true, memberId: member });
  }
  if (url.pathname === "/rest/v1/rpc/update_department_member_role") return Response.json(member);
  const table = url.pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";
  const payload: Row = init?.body ? JSON.parse(String(init.body)) : {};
  if (table === "save_member_certification_with_details") {
    const credential: Row = {
      member_id: payload.p_member_id,
      certification_id: payload.p_certification_id,
      department_id: payload.p_department_id,
      certificate_number: payload.p_certificate_number,
      issued_at: payload.p_issued_at,
      expires_at: payload.p_expires_at,
      supporting_document_id: payload.p_supporting_document_id,
      notes: payload.p_notes,
      updated_by: payload.p_editor_member_id,
      updated_at: "2026-11-02",
      member_certification_details: payload.p_edition_details
        ? [{ edition_details: payload.p_edition_details, source_reference: null }] : [],
    };
    const existing = (db.member_certifications ?? []).find(row => row.id === payload.p_record_id);
    if (payload.p_record_id && !existing) return Response.json({ message: "Record not found" }, { status: 404 });
    writes.push({ table: "member_certifications", method: existing ? "PATCH" : "POST",
      payload: credential, filters: existing ? [["id", `eq.${existing.id}`], ["department_id", `eq.${payload.p_department_id}`]] : [] });
    if (existing) {
      Object.assign(existing, credential);
      return Response.json(existing);
    }
    const row = { id: `synthetic-${++sequence}`, created_at: "2026-11-02", created_by: payload.p_editor_member_id, ...credential };
    db.member_certifications = [...(db.member_certifications ?? []), row];
    return Response.json(row);
  }
  const filters = [...url.searchParams.entries()].filter(([, value]) => value.startsWith("eq."));
  const matches = (row: Row) => filters.every(([key, value]) => String(row[key]) === value.slice(3));
  if (method === "POST" || method === "PATCH") {
    writes.push({ table, method, payload, filters });
    if (table === "certifications" && failCatalogWrite) {
      return Response.json({ message: "Synthetic catalog write failed", code: "23514" }, { status: 400 });
    }
    if (method === "POST") {
      const row = { id: `synthetic-${++sequence}`, created_at: "2026-11-02", updated_at: "2026-11-02", ...payload };
      db[table] = [...(db[table] ?? []), row];
      return Response.json(row);
    }
    for (const row of db[table] ?? []) if (matches(row)) Object.assign(row, payload);
    return new Response(null, { status: 204 });
  }
  return Response.json((db[table] ?? []).filter(matches));
};
const client = createClient("http://local.invalid", "synthetic-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: memoryFetch },
});
let Settings: typeof import("@/components/settings/CertificationTypesSection").default;
let Personnel: typeof import("@/components/personnel/PersonnelCertificationsSection").default;
let Wizard: typeof import("@/components/personnel/AddMemberButton").default;
let Fields: typeof import("@/components/ems/EmsCertificationFields").default;
let Tracks: typeof import("@/components/personnel/PersonnelEmsTracksSection").default;
let originalLoad: (request: string, ...args: unknown[]) => unknown;
const modules = Module as unknown as { _load: typeof originalLoad };
const originalFetch = globalThis.fetch;
const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const pendingStorage = new Map<string, string>();

before(async () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => pendingStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { pendingStorage.set(key, value); },
    removeItem: (key: string) => { pendingStorage.delete(key); },
  } });
  originalLoad = modules._load;
  const stubs: Record<string, unknown> = {
    react: {
      ...React,
      useState: <S,>(initial: S | (() => S)) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? (initial as () => S)() : initial;
        return [state[index] as S, (update: S | ((current: S) => S)) => {
          state[index] = typeof update === "function" ? (update as (current: S) => S)(state[index] as S) : update;
        }];
      },
      useMemo: <T,>(factory: () => T) => factory(),
    },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/lib/supabase": { supabase: client },
    "@/lib/ems/recalculate-client": { triggerEmsAllocationRecalculation: async () => ({}) },
  };
  modules._load = (request, ...args) => request in stubs ? stubs[request] : originalLoad.call(Module, request, ...args);
  Settings = (await import("@/components/settings/CertificationTypesSection")).default;
  Personnel = (await import("@/components/personnel/PersonnelCertificationsSection")).default;
  Wizard = (await import("@/components/personnel/AddMemberButton")).default;
  Fields = (await import("@/components/ems/EmsCertificationFields")).default;
  Tracks = (await import("@/components/personnel/PersonnelEmsTracksSection")).default;
  globalThis.fetch = memoryFetch;
});
after(() => {
  if (originalSessionStorage) Object.defineProperty(globalThis, "sessionStorage", originalSessionStorage);
  else Reflect.deleteProperty(globalThis, "sessionStorage");
  modules._load = originalLoad;
  globalThis.fetch = originalFetch;
});
beforeEach(() => {
  pendingStorage.clear();
  for (const key of Object.keys(db)) delete db[key];
  state.length = 0;
  writes.length = 0;
  sequence = 0;
  failCatalogWrite = false;
});

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Row>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}
function tree() {
  cursor = 0;
  return elements(render());
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Row>(node) ? text(node.props.children as React.ReactNode) : "";
}
function find(predicate: (element: Element) => boolean) {
  const found = tree().find(predicate);
  assert.ok(found, "Expected form element must be rendered");
  return found;
}
async function click(label: string) {
  const button = find((element) => element.type === "button" && text(element) === label);
  assert.equal(typeof button.props.onClick, "function");
  await (button.props.onClick as () => unknown)();
  await new Promise((resolve) => setImmediate(resolve));
}
function changeLabel(label: string, value: string) {
  const container = find((element) => element.type === "label" && text(element).trim().startsWith(label));
  const input = elements(container.props.children as React.ReactNode).find((element) => element.type === "input" || element.type === "select");
  assert.ok(input);
  (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function selectEms(authority: "iowa" | "nremt", level = authority === "iowa" ? "ccp" : "paramedic") {
  const select = (label: string, value: string) => {
    const fields = find((element) => element.type === Fields);
    const expanded = elements(Fields(fields.props as React.ComponentProps<typeof Fields>));
    const input = expanded.find((element) => element.type === "select" && element.props["aria-label"] === label);
    assert.ok(input);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  select("Authority", authority);
  select("Certification Level", level);
}
async function submit() {
  const form = find((element) => element.type === "form");
  await (form.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} });
}
function catalog(): CertificationCatalogRow[] {
  return (db.certifications ?? []).map((row) => ({
    department_id: dept,
    canonical_certification_id: typeof row.canonical_certification_id === "string" ? row.canonical_certification_id : null,
    id: String(row.id), name: String(row.name), active: row.active !== false,
    ...certificationMetadata({
      emsAuthority: row.ems_authority === "iowa" || row.ems_authority === "nremt" ? row.ems_authority : "",
      emsLevel: isEmsCertificationLevel(row.ems_certification_level) ? row.ems_certification_level : "",
    }),
  }));
}
function settings() {
  const certificationTypes = catalog().map((row) => ({ ...row, active: true, created_at: "2026-01-01", updated_at: "2026-01-01" }));
  render = () => Settings({ departmentId: dept, currentMemberId: editor, certificationTypes });
}
function personnel() {
  const certificationTypes = catalog().map((row) => ({ ...row, description: null }));
  const memberCertifications = (db.member_certifications ?? []) as React.ComponentProps<typeof Personnel>["memberCertifications"];
  render = () => Personnel({
    departmentId: dept, editorMemberId: editor, memberId: member, warningDays: 60,
    certificationTypes, memberCertifications, departmentDocuments: [],
  });
}
function verifyReadiness(expectedIowa: number, expectedNremt: number) {
  const metadata = buildCertificationTypeMetaById(catalog());
  const credentials = (db.member_certifications ?? []).map((row) => ({
    member_id: member, certification_id: String(row.certification_id), certificate_number: String(row.certificate_number ?? ""),
    issued_at: String(row.issued_at), expires_at: String(row.expires_at),
  }));
  const authoritative = resolveAuthoritativeEmsCertificationsForMember({
    certificationTypeById: metadata, memberCertifications: credentials,
  });
  const profiles = (["iowa", "nremt"] as const).map((track) =>
    applyAuthoritativeCertificationToTrackProfile({ track, profile: null, authoritativeCertification: authoritative[track] }));
  const result = buildMemberEmsProgress({
    iowaProfile: profiles[0], nremtProfile: profiles[1], events: [], outsideSubmissions: [],
  });
  assert.equal(result.emsReadiness.iowa.totalRequired, expectedIowa);
  assert.equal(result.emsReadiness.nremt.totalRequired, expectedNremt);
  if (expectedIowa === 46) {
    assert.deepEqual(result.emsReadiness.iowa.topics.map((row) => row.required), [6, 7, 5, 8, 4, 4, 12]);
  }
  return { authoritative, result };
}

test("the actual level field lists CCP beside EMR, EMT, AEMT and Paramedic, with only two EMS authorities", () => {
  const fields = elements(Fields({ value: { emsAuthority: "iowa", emsLevel: "ccp" }, onChange() {} }));
  const selects = fields.filter((row) => row.type === "select");
  assert.deepEqual(elements(selects[0].props.children as React.ReactNode).map((row) => row.props.value), ["", "iowa", "nremt"]);
  assert.deepEqual(elements(selects[1].props.children as React.ReactNode).map((row) => row.props.value), ["", "emr", "emt", "aemt", "paramedic", "ccp"]);
  const nremt = elements(Fields({ value: { emsAuthority: "nremt", emsLevel: "paramedic" }, onChange() {} }));
  const levels = nremt.find((row) => row.type === "select" && row.props["aria-label"] === "Certification Level");
  assert.ok(levels);
  assert.deepEqual(elements(levels.props.children as React.ReactNode).map((row) => row.props.value), ["", "emr", "emt", "aemt", "paramedic"]);
});

test("switching a CCP credential to National Registry requires an explicit supported level selection", () => {
  let selection: React.ComponentProps<typeof Fields>["value"] = { emsAuthority: "iowa", emsLevel: "ccp" };
  const fields = elements(Fields({ value: selection, onChange(value) { selection = value; } }));
  const authority = fields.find((row) => row.type === "select" && row.props["aria-label"] === "Authority");
  assert.ok(authority);
  (authority.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "nremt" } });
  assert.deepEqual(selection, { emsAuthority: "nremt", emsLevel: "" });
  assert.throws(() => certificationMetadata(selection), /both an EMS authority and certification level/);
});

test("one member can independently create and edit Iowa CCP and National Registry Paramedic credentials", async () => {
  personnel();
  await click("+ Add Certification");
  selectEms("iowa");
  changeLabel("Expiration Date", "2099-01-01");
  await submit();
  personnel();
  await click("+ Add Certification");
  selectEms("nremt");
  changeLabel("Expiration Date", "2099-01-01");
  await submit();
  assert.equal(db.member_certifications.length, 2);
  let resolved = verifyReadiness(46, 30);
  assert.equal(resolved.authoritative.iowa?.level, "ccp");
  assert.equal(resolved.authoritative.nremt?.level, "paramedic");
  personnel();
  await click("Edit");
  changeLabel("Expiration Date", "2098-01-01");
  await submit();
  resolved = verifyReadiness(46, 30);
  assert.equal(resolved.authoritative.iowa?.level, "ccp");
  assert.equal(resolved.authoritative.nremt?.level, "paramedic");
  assert.equal(db.member_certifications.length, 2);
});

test("Settings creates and edits explicitly identified CCP catalog entries without an additional authority or track", async () => {
  settings();
  await click("+ Add Certification");
  selectEms("iowa");
  await submit();
  assert.equal(db.certifications[0].ems_authority, "iowa");
  assert.equal(db.certifications[0].ems_certification_level, "ccp");
  assert.equal(db.certifications[0].name, "Iowa EMS Critical Care Paramedic (CCP)");
  await click("Edit");
  const fields = find((element) => element.type === Fields);
  assert.equal((fields.props.value as Row).emsAuthority, "iowa");
  assert.equal((fields.props.value as Row).emsLevel, "ccp");
  selectEms("nremt");
  changeLabel("Name", "National Registry Paramedic");
  await submit();
  assert.equal(db.certifications[0].ems_authority, "nremt");
  assert.equal(db.certifications[0].ems_certification_level, "paramedic");
  assert.deepEqual(writes[1].filters, [["id", "eq.synthetic-1"], ["department_id", `eq.${dept}`]]);
});

for (const authority of ["iowa", "nremt"] as const) {
  test(`Personnel directly assigns ${authority} ${authority === "iowa" ? "CCP" : "Paramedic"} and applies its requirements`, async () => {
    personnel();
    await click("+ Add Certification");
    selectEms(authority);
    changeLabel("Expiration Date", "2099-01-01");
    await submit();
    assert.equal(db.certifications[0].ems_authority, authority);
    assert.equal(db.certifications[0].ems_certification_level, authority === "iowa" ? "ccp" : "paramedic");
    assert.equal(db.member_certifications[0].certification_id, db.certifications[0].id);
    verifyReadiness(authority === "iowa" ? 46 : 0, authority === "nremt" ? 30 : 0);
    assert.equal(writes.length, 2);
    assert.ok(writes.every((write) => write.payload.department_id === dept));
  });
}

test("editing one member from Paramedic to Iowa CCP changes its credential FK, not the shared Paramedic catalog", async () => {
  db.certifications = [{
    id: "original-paramedic", department_id: dept, name: "Iowa EMS Paramedic", active: true,
    ems_authority: "iowa", ems_certification_level: "paramedic",
  }];
  db.member_certifications = [{
    id: "assigned-credential", member_id: member, department_id: dept, certification_id: "original-paramedic",
    issued_at: "2026-01-01", expires_at: "2099-01-01", certificate_number: "IA-123",
    supporting_document_id: null, notes: null,
  }];
  const before = structuredClone(db.certifications[0]);
  personnel();
  await click("Edit");
  selectEms("iowa");
  await submit();
  assert.deepEqual(db.certifications[0], before);
  assert.equal(db.certifications[1].ems_certification_level, "ccp");
  assert.equal(db.member_certifications.length, 1);
  assert.equal(db.member_certifications[0].certification_id, db.certifications[1].id);
  assert.deepEqual(writes[1].filters, [["id", "eq.assigned-credential"], ["department_id", `eq.${dept}`]]);
  const { authoritative } = verifyReadiness(46, 0);
  assert.equal(authoritative.iowa?.level, "ccp");
});

test("historical variants remain visible and editable without replacing their original catalog assignment", async () => {
  db.certifications = [
    { id: "standard", department_id: dept, name: "Firefighter 1", active: true },
    { id: "historical", department_id: dept, name: "Fire Fighter I (IFSAC 1997 Edition)", active: true, canonical_certification_id: "standard" },
  ];
  db.member_certifications = [{ id: "historical-record", member_id: member, department_id: dept,
    certification_id: "historical", issued_at: "1997-01-01", expires_at: null, notes: null,
    certificate_number: null, supporting_document_id: null }];
  personnel();
  assert.ok(tree().some(element => text(element).includes("Fire Fighter I (IFSAC 1997 Edition)")));
  await click("Edit");
  assert.ok(tree().some(element => element.type === "option" && element.props.value === "historical"));
  await submit();
  assert.equal(db.member_certifications[0].certification_id, "historical");
  assert.equal(db.member_certifications[0].expires_at, null);
  assert.equal(db.certifications.length, 2);
});

test("Add Certification hides mapped variants, supports new Ice Rescue, and saves separate edition details", async () => {
  db.certifications = [
    { id: "standard", department_id: dept, name: "Firefighter 1", active: true },
    { id: "historical", department_id: dept, name: "Fire Fighter I (2008 Edition)", active: true, canonical_certification_id: "standard" },
    { id: "ice-rescue", department_id: dept, name: "Ice Rescue", active: true },
  ];
  personnel();
  await click("+ Add Certification");
  assert.ok(!tree().some(element => element.type === "button" && text(element) === "Fire Fighter I (2008 Edition)"));
  assert.ok(tree().some(element => element.type === "button" && text(element) === "Ice Rescue"));
  await click("Firefighter 1");
  const noExpiration = find(element => element.type === "input" && element.props.value === "no-expiration");
  (noExpiration.props.onChange as () => void)();
  changeLabel("Edition / Standard Details", "IFSAC 2008 Edition");
  await submit();
  assert.equal(db.member_certifications[0].certification_id, "standard");
  assert.deepEqual(db.member_certifications[0].member_certification_details,
    [{ edition_details: "IFSAC 2008 Edition", source_reference: null }]);
});

test("a new department-specific Ice Rescue type is created normally without an equivalence mapping", async () => {
  const created = await resolveCertificationCatalogEntry({
    supabase: client, departmentId: dept, editorMemberId: editor, catalog: [], selectedId: null,
    name: "Ice Rescue", selection: { emsAuthority: "", emsLevel: "" },
  });
  assert.equal(created.name, "Ice Rescue");
  assert.equal(created.ems_authority, null);
  assert.equal(created.canonical_certification_id ?? null, null);
  assert.equal(db.certifications.length, 1);
  assert.equal(db.certifications[0].department_id, dept);
});

test("a corrected standard Firefighter 1 record restores its literal recovered Reciprocity details during editing", async () => {
  db.certifications = [{ id: "standard", department_id: dept, name: "Firefighter 1", active: true }];
  db.member_certifications = [{ id: "corrected-record", member_id: member, department_id: dept,
    certification_id: "standard", issued_at: "1997-01-01", expires_at: null, notes: null,
    certificate_number: null, supporting_document_id: null,
    member_certification_details: { edition_details: "Reciprocity", source_reference: "approved evidence" } }];
  personnel();
  assert.ok(tree().some(element => text(element).includes("Edition / Standard Details: Reciprocity")));
  await click("Edit");
  const details = find(element => element.type === "input" && element.props.value === "Reciprocity");
  assert.equal(details.props.value, "Reciprocity");
  await submit();
  assert.equal(db.member_certifications[0].certification_id, "standard");
});

test("a newly assigned CCP credential supersedes older Paramedic credentials through unchanged authoritative rules", async () => {
  db.certifications = [{
    id: "old-paramedic", name: "Iowa EMS Paramedic", active: true, ems_authority: "iowa", ems_certification_level: "paramedic",
  }];
  db.member_certifications = [{
    id: "old-assignment", member_id: member, department_id: dept, certification_id: "old-paramedic",
    issued_at: "2020-01-01", expires_at: "2099-01-01", certificate_number: "OLD",
  }];
  personnel();
  await click("+ Add Certification");
  selectEms("iowa");
  changeLabel("Expiration Date", "2099-01-01");
  await submit();
  assert.equal(db.member_certifications.length, 2);
  const { authoritative } = verifyReadiness(46, 0);
  assert.equal(authoritative.iowa?.level, "ccp");
});

test("catalog write failures are shown and cannot produce a member assignment", async () => {
  personnel();
  await click("+ Add Certification");
  selectEms("iowa");
  changeLabel("Expiration Date", "2099-01-01");
  failCatalogWrite = true;
  await submit();
  assert.equal(db.member_certifications, undefined);
  assert.ok(tree().some((element) => text(element).includes("Synthetic catalog write failed")));
});

test("generic Settings entries remain unclassified, while every existing EMS level round-trips explicitly", async () => {
  settings();
  await click("+ Add Certification");
  changeLabel("Name", "Firefighter I");
  await submit();
  assert.equal(db.certifications[0].ems_authority, null);
  assert.equal(db.certifications[0].ems_certification_level, null);
  for (const level of ["emr", "emt", "aemt", "paramedic"] as const) {
    await click("+ Add Certification");
    selectEms("iowa", level);
    await submit();
    assert.equal(db.certifications.at(-1)?.ems_authority, "iowa");
    assert.equal(db.certifications.at(-1)?.ems_certification_level, level);
  }
});

test("an explicitly identified CCP credential uses metadata, not its free-text name, for CE requirements", async () => {
  settings();
  await click("+ Add Certification");
  selectEms("iowa");
  changeLabel("Name", "Regional EMS License");
  await submit();
  db.member_certifications = [{
    certification_id: db.certifications[0].id, member_id: member, issued_at: "2026-11-02", expires_at: "2099-01-01",
  }];
  const { authoritative } = verifyReadiness(46, 0);
  assert.equal(authoritative.iowa?.level, "ccp");
});

test("incomplete or invalid authority/level pairs are rejected instead of defaulting to EMT", () => {
  assert.throws(() => certificationMetadata({ emsAuthority: "iowa", emsLevel: "" }), /both an EMS authority and certification level/);
  assert.throws(() => certificationMetadata({ emsAuthority: "", emsLevel: "ccp" }), /both an EMS authority and certification level/);
  assert.throws(() => certificationMetadata({ emsAuthority: "nremt", emsLevel: "ccp" }), /Iowa EMS level only/);
});

test("existing metadata is reused exactly, while an ambiguous same-name generic catalog entry is rejected", async () => {
  const entry: CertificationCatalogRow = {
    id: "existing", name: "Iowa EMS Critical Care Paramedic (CCP)", active: true,
    ems_authority: "iowa", ems_certification_level: "ccp",
  };
  const input = {
    supabase: client, departmentId: dept, editorMemberId: editor, selectedId: null, name: "",
    selection: { emsAuthority: "iowa" as const, emsLevel: "ccp" as const },
  };
  assert.equal((await resolveCertificationCatalogEntry({ ...input, catalog: [entry] })).id, "existing");
  assert.equal(writes.length, 0);
  await assert.rejects(resolveCertificationCatalogEntry({
    ...input, catalog: [{ ...entry, ems_authority: null, ems_certification_level: null }],
  }), /different EMS authority\/level metadata/);
  assert.equal(writes.length, 0);
});

test("the new-member wizard saves Iowa CCP metadata and the same CCP level in the existing Iowa track", async () => {
  render = () => Wizard({ departmentId: dept, currentMemberId: editor, permissionOptions: [] });
  await click("+ Add Member");
  // Configuration loads asynchronously after the modal opens.
  await new Promise((resolve) => setImmediate(resolve));
  await submit();
  selectEms("iowa");
  changeLabel("Expiration Date", "2099-01-01");
  await submit();
  assert.equal(db.certifications[0].ems_authority, "iowa");
  assert.equal(db.certifications[0].ems_certification_level, "ccp");
  await click("Continue");
  const levelSelects = tree().filter((element) => element.type === "label" && text(element).trim().startsWith("Level"));
  assert.equal(levelSelects.length, 2);
  assert.ok(elements(levelSelects[0]).some((element) => element.type === "option" && element.props.value === "ccp"));
  assert.ok(!elements(levelSelects[1]).some((element) => element.type === "option" && element.props.value === "ccp"));
  await click("Save EMS & Continue");
  const iowa = db.ems_member_track_profiles.find((row) => row.track === "iowa");
  assert.equal(iowa?.certification_level, "ccp");
  assert.equal(db.ems_member_track_profiles.length, 2);
  assert.ok(db.ems_member_track_profiles.every((row) => row.track === "iowa" || row.track === "nremt"));
  verifyReadiness(46, 0);
});

test("the track editor does not offer or save National Registry CCP", async () => {
  render = () => Tracks({
    departmentId: dept, memberId: member, editorMemberId: editor, trackRows: [],
    certificationTypes: [], memberCertifications: [],
  });
  const levels = tree().filter((element) => element.type === "label" && text(element).trim().startsWith("Level"));
  assert.equal(levels.length, 2);
  assert.ok(!elements(levels[1]).some((element) => element.type === "option" && element.props.value === "ccp"));
  const select = elements(levels[1]).find((element) => element.type === "select");
  assert.ok(select);
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "ccp" } });
  await click("Save NREMT");
  assert.equal(writes.length, 0);
  assert.ok(tree().some((element) => text(element).includes("Iowa EMS level only")));
});

test("the track editor rejects a level that would be overridden by an assigned authoritative credential", async () => {
  render = () => Tracks({
    departmentId: dept, memberId: member, editorMemberId: editor, trackRows: [],
    certificationTypes: [{ id: "paramedic", ems_authority: "iowa", ems_certification_level: "paramedic" }],
    memberCertifications: [{
      member_id: member, certification_id: "paramedic", certificate_number: "IA-123",
      issued_at: "2026-01-01", expires_at: "2099-01-01",
    }],
  });
  changeLabel("Level", "ccp");
  await click("Save Iowa");
  assert.equal(writes.length, 0);
  assert.ok(tree().some((element) => text(element).includes("Change the authority and level in Personnel Certifications first")));
});

test("without an assigned credential the existing Iowa track can store CCP directly and calculate 46 hours", async () => {
  render = () => Tracks({
    departmentId: dept, memberId: member, editorMemberId: editor, trackRows: [],
    certificationTypes: [], memberCertifications: [],
  });
  changeLabel("Level", "ccp");
  await click("Save Iowa");
  assert.equal(db.ems_member_track_profiles[0].certification_level, "ccp");
  assert.equal(db.ems_member_track_profiles[0].track, "iowa");
  const result = buildMemberEmsProgress({
    iowaProfile: {
      certification_level: String(db.ems_member_track_profiles[0].certification_level),
      track_status: "active", maintain_track: true, expiration_date: null,
    },
    nremtProfile: null, events: [], outsideSubmissions: [],
  });
  assert.equal(result.emsReadiness.iowa.totalRequired, 46);
});
