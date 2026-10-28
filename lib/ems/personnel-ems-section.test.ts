import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type Row = Record<string, unknown>;

const DEPT_A = "dept-a";
const DEPT_B = "dept-b";

const db: Record<string, Row[]> = {};
const queryLog: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
const writeLog: string[] = [];
const rpcLog: string[] = [];
let currentMember: { id: string; departmentId: string | null; name: string; role: string } | null = null;

function matches(row: Row, key: string, value: unknown) {
  if (key.includes(".")) {
    const [relation, column] = key.split(".");
    const related = row[relation];
    return Array.isArray(related) && related.some((item) => (item as Row)[column] === value);
  }
  return row[key] === value;
}

function query(table: string) {
  const filters: Array<[string, unknown]> = [];
  const rows = () => (db[table] ?? []).filter((row) => filters.every(([key, value]) => matches(row, key, value)));
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return builder;
    },
    in: (key: string, values: unknown[]) => {
      filters.push([key, values]);
      return builder;
    },
    order: () => builder,
    not: () => builder,
    insert: () => {
      writeLog.push(`insert:${table}`);
      return builder;
    },
    update: () => {
      writeLog.push(`update:${table}`);
      return builder;
    },
    upsert: () => {
      writeLog.push(`upsert:${table}`);
      return builder;
    },
    delete: () => {
      writeLog.push(`delete:${table}`);
      return builder;
    },
    maybeSingle: async () => {
      queryLog.push({ table, filters });
      return { data: rows()[0] ?? null, error: null };
    },
    single: async () => {
      queryLog.push({ table, filters });
      return { data: rows()[0] ?? null, error: null };
    },
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) => {
      queryLog.push({ table, filters });
      // An "in" filter is an array of allowed values.
      const result = (db[table] ?? []).filter((row) =>
        filters.every(([key, value]) => (Array.isArray(value) ? value.includes(row[key]) : matches(row, key, value))),
      );
      return Promise.resolve(resolve({ data: result, error: null }));
    },
  };
  return builder;
}

const fakeClient = {
  from: (table: string) => query(table),
  rpc: async (name: string) => {
    rpcLog.push(name);
    return { data: false, error: null };
  },
};

let PersonnelProfilePage: (props: { params: Promise<{ id: string }> }) => Promise<ReactNode>;
let EmsContinuingEducationSection: unknown;
let buildMemberEmsProgress: typeof import("@/lib/ems/member-ems-progress").buildMemberEmsProgress;

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

  // Stub auth, Supabase and navigation at require time; no real client or network is used.
  const moduleInternals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const originalLoad = moduleInternals._load;
  const stubs: Record<string, unknown> = {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => fakeClient },
    "@/lib/current-member": { getCurrentMember: async () => currentMember },
    "next/navigation": {
      redirect: (url: string) => {
        throw new Error(`REDIRECT:${url}`);
      },
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
    },
  };
  moduleInternals._load = (request, ...rest) => (request in stubs ? stubs[request] : originalLoad.call(Module, request, ...rest));

  PersonnelProfilePage = (await import("@/app/personnel/[id]/page")).default as typeof PersonnelProfilePage;
  EmsContinuingEducationSection = (await import("@/components/ems/EmsContinuingEducationSection")).default;
  ({ buildMemberEmsProgress } = await import("@/lib/ems/member-ems-progress"));
});

beforeEach(() => {
  queryLog.length = 0;
  writeLog.length = 0;
  rpcLog.length = 0;
  currentMember = { id: "m-admin", departmentId: DEPT_A, name: "Admin", role: "administrator" };

  db.members = [
    { id: "m-admin", department_id: DEPT_A, first_name: "Ada", last_name: "Admin", role: "administrator", active: true },
    { id: "m-ff", department_id: DEPT_A, first_name: "Test", last_name: "Firefighter", role: "firefighter", active: true },
    { id: "m-none", department_id: DEPT_A, first_name: "No", last_name: "Tracks", role: "firefighter", active: true },
    { id: "m-ff", department_id: DEPT_B, first_name: "Other", last_name: "Department", role: "firefighter", active: true },
  ];
  db.certifications = [
    { id: "cert-iowa", department_id: DEPT_A, name: "Iowa EMT-B", active: true, ems_authority: "iowa", ems_certification_level: "emt" },
  ];
  db.ems_member_track_profiles = [
    { id: "p-iowa", department_id: DEPT_A, member_id: "m-ff", track: "iowa", certification_level: "emt", track_status: "active", maintain_track: true, certification_number: "IA-1", expiration_date: "2099-01-01", effective_start_date: "2026-01-01", effective_end_date: null, notes: null },
    { id: "p-nremt", department_id: DEPT_A, member_id: "m-ff", track: "nremt", certification_level: "emt", track_status: "active", maintain_track: true, certification_number: "NR-1", expiration_date: "2099-01-01", effective_start_date: "2026-01-01", effective_end_date: null, notes: null },
    { id: "p-iowa-b", department_id: DEPT_B, member_id: "m-ff", track: "iowa", certification_level: "paramedic", track_status: "active", maintain_track: true, certification_number: "OTHER", expiration_date: "2099-01-01", effective_start_date: "2026-01-01", effective_end_date: null, notes: null },
  ];
  db.training_event_attendance = [
    { department_id: DEPT_A, member_id: "m-ff", training_event_id: "e-ems", attendance_status: "attending" },
    { department_id: DEPT_A, member_id: "m-ff", training_event_id: "e-plain", attendance_status: "attending" },
    { department_id: DEPT_B, member_id: "m-ff", training_event_id: "e-other-dept", attendance_status: "attending" },
  ];
  db.training_events = [
    { id: "e-ems", department_id: DEPT_A, title: "Cardiac Update", category_id: null, starts_at: "2026-09-01T12:00:00Z", hours_credit: 2, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
    { id: "e-plain", department_id: DEPT_A, title: "Hose Drill", category_id: null, starts_at: "2026-09-02T12:00:00Z", hours_credit: 3, is_ems_training: false, ems_core_topic: null, ems_needs_review: false },
    { id: "e-other-dept", department_id: DEPT_B, title: "Other Dept EMS", category_id: null, starts_at: "2026-09-03T12:00:00Z", hours_credit: 10, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
  ];
  db.training_outside_submissions = [
    { id: "o-own", department_id: DEPT_A, member_id: "m-ff", status: "approved", title: "Trauma Class", category_id: null, training_date: "2026-08-01", hours: 1, description: null, notes: null, is_ems_training: true, ems_core_topic: "trauma", ems_needs_review: false, training_outside_submission_members: [] },
    { id: "o-participant", department_id: DEPT_A, member_id: "m-admin", status: "approved", title: "Medical Class", category_id: null, training_date: "2026-08-02", hours: 1.5, description: null, notes: null, is_ems_training: true, ems_core_topic: "medical", ems_needs_review: false, training_outside_submission_members: [{ member_id: "m-ff" }] },
    { id: "o-pending", department_id: DEPT_A, member_id: "m-ff", status: "pending", title: "Pending", category_id: null, training_date: "2026-08-03", hours: 5, description: null, notes: null, is_ems_training: true, ems_core_topic: "operations", ems_needs_review: false, training_outside_submission_members: [] },
    { id: "o-other-dept", department_id: DEPT_B, member_id: "m-ff", status: "approved", title: "Other", category_id: null, training_date: "2026-08-04", hours: 9, description: null, notes: null, is_ems_training: true, ems_core_topic: "airway_respirations_ventilations", ems_needs_review: false, training_outside_submission_members: [] },
  ];
});

type EmsSectionProps = {
  emsRecordsCounted: number;
  iowaProfile: { certification_level: string; expiration_date: string | null } | null;
  nremtProfile: { certification_level: string } | null;
  emsReadiness: ReturnType<typeof buildMemberEmsProgress>["emsReadiness"];
  warnings: string[];
  unclassifiedCount: number;
  emptyMessage: string;
};

function findSection(node: ReactNode): EmsSectionProps | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findSection(child as ReactNode);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === EmsContinuingEducationSection) return node.props as EmsSectionProps;
  return findSection((node.props as { children?: ReactNode }).children);
}

async function openProfile(memberId: string) {
  const tree = await PersonnelProfilePage({ params: Promise.resolve({ id: memberId }) });
  return findSection(tree);
}

test("an administrator sees the member's EMS section with the right Iowa and National Registry numbers", async () => {
  const section = await openProfile("m-ff");

  assert.ok(section, "the EMS Continuing Education section should render");
  // Own event (2h cardiology) + own outside (1h trauma) + participant outside (1.5h medical); nothing else counts.
  assert.equal(section.emsRecordsCounted, 3);
  const iowaTopics = Object.fromEntries(section.emsReadiness.iowa.topics.map((topic) => [topic.topic, topic.completed]));
  assert.equal(iowaTopics.cardiology, 2);
  assert.equal(iowaTopics.trauma, 1);
  assert.equal(iowaTopics.medical, 1.5);
  assert.equal(section.emsReadiness.iowa.totalCompleted, 4.5);
  assert.equal(section.iowaProfile?.certification_level, "emt");
  assert.equal(section.nremtProfile?.certification_level, "emt");
  assert.notEqual(section.emsReadiness.nremt.status, "not_maintained");
});

test("the Personnel numbers equal what My Readiness computes from the same records and profiles", async () => {
  const section = await openProfile("m-ff");
  assert.ok(section);

  const sameRecords = buildMemberEmsProgress({
    iowaProfile: { certification_level: "emt", track_status: "active", expiration_date: "2099-01-01", maintain_track: true },
    nremtProfile: { certification_level: "emt", track_status: "active", expiration_date: "2099-01-01", maintain_track: true },
    events: [{ id: "e-ems", starts_at: "2026-09-01T12:00:00Z", hours_credit: 2, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false }],
    outsideSubmissions: [
      { id: "o-own", training_date: "2026-08-01", hours: 1, is_ems_training: true, ems_core_topic: "trauma", ems_needs_review: false },
      { id: "o-participant", training_date: "2026-08-02", hours: 1.5, is_ems_training: true, ems_core_topic: "medical", ems_needs_review: false },
    ],
  });

  assert.deepEqual(section.emsReadiness, sameRecords.emsReadiness);
  assert.equal(section.emsRecordsCounted, sameRecords.emsTrainingRecords.length);
});

test("Iowa and National Registry are independent: an Iowa-only member shows Not Maintained for National Registry", async () => {
  db.ems_member_track_profiles = db.ems_member_track_profiles.filter((row) => row.track !== "nremt");
  const section = await openProfile("m-ff");

  assert.ok(section);
  assert.equal(section.nremtProfile, null);
  assert.equal(section.emsReadiness.nremt.status, "not_maintained");
  assert.equal(section.emsReadiness.iowa.totalCompleted, 4.5);
});

test("a member with no EMS tracks gets the message and no progress cards", async () => {
  const section = await openProfile("m-none");

  assert.ok(section);
  assert.equal(section.iowaProfile, null);
  assert.equal(section.nremtProfile, null);

  const markup = renderToStaticMarkup(
    (await import("react")).createElement(EmsContinuingEducationSection as never, section as never),
  );
  assert.match(markup, /No EMS continuing education tracks are configured for this member\./);
  assert.doesNotMatch(markup, /Iowa EMS<\/p>/);
  assert.doesNotMatch(markup, /National Registry<\/p>/);
});

test("a configured member renders both track cards with topics, remaining hours and level", async () => {
  const section = await openProfile("m-ff");
  assert.ok(section);

  const markup = renderToStaticMarkup(
    (await import("react")).createElement(EmsContinuingEducationSection as never, section as never),
  );
  for (const text of ["EMS Continuing Education", "Iowa EMS", "National Registry", "Cardiology", "Trauma", "Remaining:", "Level: EMT"]) {
    assert.ok(markup.includes(text), `expected "${text}" in the rendered section`);
  }
});

test("another department's training, certifications and tracks never reach the section", async () => {
  const section = await openProfile("m-ff");
  assert.ok(section);

  // Department B has 10h cardiology, 9h airway and a paramedic Iowa profile for the same member id.
  const iowaTopics = Object.fromEntries(section.emsReadiness.iowa.topics.map((topic) => [topic.topic, topic.completed]));
  assert.equal(iowaTopics.cardiology, 2);
  assert.equal(iowaTopics.airway_respirations_ventilations, 0);
  assert.equal(section.iowaProfile?.certification_level, "emt");

  const scopedTables = ["training_events", "training_outside_submissions", "training_event_attendance", "ems_member_track_profiles", "member_certifications"];
  const unscoped = queryLog.filter(
    (entry) => scopedTables.includes(entry.table) && !entry.filters.some(([key, value]) => key === "department_id" && value === DEPT_A),
  );
  assert.deepEqual(unscoped, []);
});

test("viewing a profile writes nothing and triggers no EMS recalculation", async () => {
  await openProfile("m-ff");

  assert.deepEqual(writeLog, []);
  assert.ok(!rpcLog.some((name) => /ems|recalc|replace/i.test(name)), `unexpected RPC calls: ${rpcLog.join(", ")}`);
});

test("a member without personnel access is redirected before any member EMS or training data is read", async () => {
  currentMember = { id: "m-none", departmentId: DEPT_A, name: "No Tracks", role: "firefighter" };

  await assert.rejects(() => openProfile("m-ff"), /REDIRECT:\//);

  const touched = queryLog.map((entry) => entry.table);
  for (const table of ["ems_member_track_profiles", "training_events", "training_outside_submissions", "training_event_attendance", "member_certifications"]) {
    assert.ok(!touched.includes(table), `${table} must not be read for an unauthorized viewer`);
  }
  assert.deepEqual(writeLog, []);
});

test("a signed-out or department-less viewer cannot reach the section", async () => {
  currentMember = null;
  await assert.rejects(() => openProfile("m-ff"), /REDIRECT:\/login/);
  assert.equal(queryLog.length, 0);
});

test("the section sits directly below EMS Certification Tracks and before Training History", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = readFileSync(resolve(process.cwd(), "app/personnel/[id]/page.tsx"), "utf8");

  const tracks = source.indexOf("<PersonnelEmsTracksSection");
  const ceSection = source.indexOf("<EmsContinuingEducationSection");
  const history = source.indexOf(">Training History<");
  assert.ok(tracks > 0 && ceSection > tracks && history > ceSection);
  assert.doesNotMatch(source, /recalculateMemberEmsCreditAccounting|\/api\/ems\/allocations\/recalculate|triggerEmsAllocationRecalculation/);
});
