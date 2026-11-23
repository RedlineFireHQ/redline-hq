import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import test, { before, beforeEach } from "node:test";
import { isValidElement, type ReactNode } from "react";
import EmsContinuingEducationSection from "@/components/ems/EmsContinuingEducationSection";

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };

const year = new Date().getUTCFullYear();
const db: Record<string, Row[]> = {};
const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
let currentMember = { id: "member-a", departmentId: "dept-a" };
let failingTable: string | null = null;

function query(table: string) {
  const filters: Array<[string, unknown]> = [];
  function result(): Result {
    queries.push({ table, filters: [...filters] });
    if (table === failingTable) return { data: null, error: { message: `Failed ${table}` } };
    return {
      data: (db[table] ?? []).filter((row) =>
        filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value),
      ),
      error: null,
    };
  }
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
    in: (key: string, value: unknown[]) => { filters.push([key, value]); return builder; },
    order: () => builder,
    limit: () => builder,
    single: async () => {
      const response = result();
      return { data: response.data?.[0] ?? null, error: response.error };
    },
    then: (resolve: (value: Result) => unknown) => Promise.resolve(resolve(result())),
  };
  return builder;
}

const supabase = {
  from: (table: string) => query(table),
  rpc: async (_name: string, args: { p_department_id: string; p_member_id: string }) => ({
    data: (db.outside ?? []).filter((row) => row.department_id === args.p_department_id && row.member_id === args.p_member_id),
    error: null,
  }),
};

let page: typeof import("@/app/mobile/my-readiness/page").default;
let desktopPage: typeof import("@/app/my-readiness/page").default;

before(async () => {
  const internals = Module as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
  const original = internals._load;
  const stubs: Record<string, unknown> = {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => supabase },
    "@/lib/supabase": { supabase, getSupabaseBrowserClient: () => supabase },
    "@/lib/ems/persistent-allocation": { recalculateMemberEmsCreditAccounting: async () => undefined },
    "@/lib/current-member": { getCurrentMember: async () => currentMember },
    "next/navigation": { redirect: () => { throw new Error("redirect"); } },
  };
  internals._load = (request, ...args) => request in stubs ? stubs[request] : original.call(Module, request, ...args);
  try {
    page = (await import("@/app/mobile/my-readiness/page")).default;
    desktopPage = (await import("@/app/my-readiness/page")).default;
  } finally {
    internals._load = original;
  }
});

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  queries.length = 0;
  failingTable = null;
  currentMember = { id: "member-a", departmentId: "dept-a" };
  db.members = [{ id: "member-a", department_id: "dept-a" }, { id: "member-b", department_id: "dept-b" }];
  db.training_categories = [
    { id: "fire-a", department_id: "dept-a", name: "Fire", compliance_bucket: "fire_annual" },
    { id: "other-a", department_id: "dept-a", name: "Other", compliance_bucket: "other" },
    { id: "fire-b", department_id: "dept-b", name: "Fire", compliance_bucket: "fire_annual" },
  ];
  db.training_event_attendance = [{ department_id: "dept-a", member_id: "member-a", training_event_id: "event", attendance_status: "attending" }];
  db.training_events = [{ id: "event", department_id: "dept-a", category_id: "fire-a", starts_at: `${year}-01-01T12:00:00Z`, hours_credit: 0.5 }];
  db.outside = [{ id: "outside", department_id: "dept-a", member_id: "member-a", title: "Training", category_id: "fire-a", training_date: `${year}-06-01`, created_at: `${year}-06-01`, status: "approved", hours: 17.25 }];
  db.training_requirements = [
    { id: "annual", department_id: "dept-a", name: "Annual Fire", requirement_kind: "annual_hours", period_type: "annual", minimum_hours: 24, category_id: null, active: true },
    { id: "other-category", department_id: "dept-a", name: "Other category", requirement_kind: "category_hours", period_type: "annual", minimum_hours: 2, category_id: "other-a", active: true },
  ];
  db.training_assignments = [
    { id: "fire-assignment", department_id: "dept-a", category_id: "fire-a", hours_credit: 1, status: "active" },
    { id: "other-assignment", department_id: "dept-a", category_id: "other-a", hours_credit: 1, status: "active" },
    { id: "foreign-assignment", department_id: "dept-b", category_id: "fire-b", hours_credit: 9, status: "active" },
  ];
  db.training_assignment_members = [
    { id: "fire-credit", department_id: "dept-a", member_id: "member-a", training_assignment_id: "fire-assignment", completion_status: "approved", completed_at: `${year}-11-10T12:00:00Z`, hours_earned: 1 },
    { id: "other-credit", department_id: "dept-a", member_id: "member-a", training_assignment_id: "other-assignment", completion_status: "approved", completed_at: `${year}-11-10T12:00:00Z`, hours_earned: 1 },
    { id: "pending", department_id: "dept-a", member_id: "member-a", training_assignment_id: "fire-assignment", completion_status: "pending_review", completed_at: `${year}-11-10T12:00:00Z`, hours_earned: 8 },
    { id: "prior", department_id: "dept-a", member_id: "member-a", training_assignment_id: "fire-assignment", completion_status: "approved", completed_at: `${year - 1}-11-10T12:00:00Z`, hours_earned: 8 },
    { id: "different-member", department_id: "dept-a", member_id: "another-member", training_assignment_id: "fire-assignment", completion_status: "approved", completed_at: `${year}-11-10T12:00:00Z`, hours_earned: 5 },
    { id: "foreign", department_id: "dept-b", member_id: "member-b", training_assignment_id: "foreign-assignment", completion_status: "approved", completed_at: `${year}-11-10T12:00:00Z`, hours_earned: 9 },
  ];
});

function childrenOf(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) return node;
  if (isValidElement<Parameters<typeof EmsContinuingEducationSection>[0]>(node) && node.type === EmsContinuingEducationSection) {
    return [EmsContinuingEducationSection(node.props)];
  }
  if (isValidElement<{ children?: ReactNode }>(node)) return [node.props.children];
  return [];
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textOf).join("");
}

function desktopCardValue(node: ReactNode, label: string): string | null {
  const children = childrenOf(node);
  if (children.length === 1 && Array.isArray(children[0])) {
    const siblings = children[0];
    if (siblings.length >= 2 && textOf(siblings[0]) === label) return textOf(siblings[1]);
  }
  for (const child of children) {
    const found = desktopCardValue(child, label);
    if (found !== null) return found;
  }
  return null;
}

test("mobile and desktop both count the approved 1-hour Fire assignment", async () => {
  const element = await page();
  const desktop = await desktopPage();
  assert.ok(isValidElement<{ fireTrainingHours: number; otherTrainingHours: number; readiness: { factors: Array<{ id: string; currentValue: string }> } }>(element));
  assert.equal(element.props.fireTrainingHours, 18.75);
  assert.equal(desktopCardValue(desktop, "Fire Training"), "18.75 hrs");
  assert.equal(element.props.otherTrainingHours, 1);
  assert.equal(desktopCardValue(desktop, "Other Training"), "1.00 hrs");
  assert.equal(element.props.readiness.factors.find((factor) => factor.id === "annual")?.currentValue, "18.75 hrs");
  assert.equal(element.props.readiness.factors.find((factor) => factor.id === "other-category")?.currentValue, "1.00 hrs in Other");
  const membersQuery = queries.find((entry) => entry.table === "training_assignment_members");
  assert.ok(membersQuery?.filters.some(([key, value]) => key === "department_id" && value === "dept-a"));
  assert.ok(membersQuery?.filters.some(([key, value]) => key === "member_id" && value === "member-a"));
  const assignmentsQuery = queries.find((entry) => entry.table === "training_assignments");
  assert.ok(assignmentsQuery?.filters.some(([key, value]) => key === "department_id" && value === "dept-a"));
  assert.ok(assignmentsQuery?.filters.some(([key, value]) => key === "id" && Array.isArray(value) && !value.includes("foreign-assignment")));
});

test("both views reset prior-year Fire and Other credits and honor UTC timestamp boundaries", async () => {
  db.training_event_attendance.push(
    { department_id: "dept-a", member_id: "member-a", training_event_id: "prior-fire", attendance_status: "attending" },
    { department_id: "dept-a", member_id: "member-a", training_event_id: "offset-fire", attendance_status: "attending" },
    { department_id: "dept-a", member_id: "member-a", training_event_id: "prior-other", attendance_status: "attending" },
  );
  db.training_events.push(
    { id: "prior-fire", department_id: "dept-a", category_id: "fire-a", starts_at: `${year - 1}-12-31T23:59:59Z`, hours_credit: 8 },
    { id: "offset-fire", department_id: "dept-a", category_id: "fire-a", starts_at: `${year - 1}-12-31T23:30:00-02:00`, hours_credit: 2 },
    { id: "prior-other", department_id: "dept-a", category_id: "other-a", starts_at: `${year - 1}-12-31T12:00:00Z`, hours_credit: 7 },
  );
  db.outside.push(
    { id: "prior-other-outside", department_id: "dept-a", member_id: "member-a", title: "Prior Other", category_id: "other-a", training_date: `${year - 1}-12-31`, created_at: `${year - 1}-12-31`, status: "approved", hours: 6 },
  );
  db.training_assignment_members.push(
    { id: "rejected", department_id: "dept-a", member_id: "member-a", training_assignment_id: "fire-assignment", completion_status: "rejected", completed_at: `${year}-01-01T00:00:00Z`, hours_earned: 10 },
    { id: "previous-other", department_id: "dept-a", member_id: "member-a", training_assignment_id: "other-assignment", completion_status: "approved", completed_at: `${year - 1}-12-31T23:59:59Z`, hours_earned: 5 },
  );
  const mobile = await page();
  const desktop = await desktopPage();
  assert.ok(isValidElement<{ fireTrainingHours: number; otherTrainingHours: number; readiness: { factors: Array<{ id: string; currentValue: string }> } }>(mobile));
  assert.equal(mobile.props.fireTrainingHours, 20.75);
  assert.equal(desktopCardValue(desktop, "Fire Training"), "20.75 hrs");
  assert.equal(desktopCardValue(desktop, "Other Training"), "1.00 hrs");
  assert.equal(mobile.props.otherTrainingHours, 1);
  assert.equal(mobile.props.readiness.factors.find((factor) => factor.id === "other-category")?.currentValue, "1.00 hrs in Other");
});

test("Fire and Other credits reset on January 1 in both views", async (t) => {
  db.training_events = [{ id: "event", department_id: "dept-a", category_id: "fire-a", starts_at: `${year - 1}-12-31T12:00:00Z`, hours_credit: 3 }];
  db.outside = [{ id: "other", department_id: "dept-a", member_id: "member-a", title: "Other", category_id: "other-a", training_date: `${year - 1}-12-31`, created_at: `${year - 1}-12-31`, status: "approved", hours: 2 }];
  db.training_assignment_members = [{ id: "fire-credit", department_id: "dept-a", member_id: "member-a", training_assignment_id: "fire-assignment", completion_status: "approved", completed_at: `${year - 1}-12-31T18:00:00Z`, hours_earned: 1 }];
  t.mock.timers.enable({ apis: ["Date"], now: new Date(`${year - 1}-12-31T23:59:59Z`) });
  const beforeMobile = await page();
  const beforeDesktop = await desktopPage();
  assert.ok(isValidElement<{ fireTrainingHours: number; otherTrainingHours: number }>(beforeMobile));
  assert.equal(beforeMobile.props.fireTrainingHours, 4);
  assert.equal(desktopCardValue(beforeDesktop, "Fire Training"), "4.00 hrs");
  assert.equal(desktopCardValue(beforeDesktop, "Other Training"), "2.00 hrs");
  assert.equal(beforeMobile.props.otherTrainingHours, 2);

  t.mock.timers.setTime(new Date(`${year}-01-01T00:00:00Z`).getTime());
  const afterMobile = await page();
  const afterDesktop = await desktopPage();
  assert.ok(isValidElement<{ fireTrainingHours: number; otherTrainingHours: number; readiness: { factors: Array<{ id: string; currentValue: string }> } }>(afterMobile));
  assert.equal(afterMobile.props.fireTrainingHours, 0);
  assert.equal(afterMobile.props.readiness.factors.find((factor) => factor.id === "other-category")?.currentValue, "0.00 hrs in Other");
  assert.equal(desktopCardValue(afterDesktop, "Fire Training"), "0.00 hrs");
  assert.equal(desktopCardValue(afterDesktop, "Other Training"), "0.00 hrs");
  assert.equal(afterMobile.props.otherTrainingHours, 0);
});

test("assignment hours stay scoped to the signed-in department and member", async () => {
  currentMember = { id: "member-b", departmentId: "dept-b" };
  const element = await page();
  assert.ok(isValidElement<{ fireTrainingHours: number }>(element));
  assert.equal(element.props.fireTrainingHours, 9);
});

test("both views reject inaccessible assignment details and count duplicate credits once", async () => {
  db.training_assignment_members.push({ ...db.training_assignment_members[0], id: "duplicate" });
  const mobile = await page();
  const desktop = await desktopPage();
  assert.ok(isValidElement<{ fireTrainingHours: number }>(mobile));
  assert.equal(mobile.props.fireTrainingHours, 18.75);
  assert.equal(desktopCardValue(desktop, "Fire Training"), "18.75 hrs");
  db.training_assignments = db.training_assignments.filter((row) => row.id !== "fire-assignment");
  await assert.rejects(page(), /Unable to load details for an approved training assignment/);
  await assert.rejects(desktopPage(), /Unable to load details for an approved training assignment/);
});

test("assignment and category query errors are not displayed as zero hours", async () => {
  for (const table of ["training_event_attendance", "training_events", "training_assignment_members", "training_assignments", "training_categories"]) {
    failingTable = table;
    await assert.rejects(page(), new RegExp(`Failed ${table}`));
  }
});

test("desktop and mobile use the same assignment credit helper", () => {
  const desktop = readFileSync("app/my-readiness/page.tsx", "utf8");
  const mobile = readFileSync("app/mobile/my-readiness/page.tsx", "utf8");
  assert.match(desktop, /getAnnualAssignmentCredits\(assignmentMembers, assignments, currentCalendarYear\)/);
  assert.match(mobile, /getAnnualAssignmentCredits\(assignmentMembers, assignments,/);
});
