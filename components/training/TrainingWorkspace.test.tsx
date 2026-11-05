import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import test from "node:test";
import * as React from "react";
import ts from "typescript";
import type TrainingWorkspace from "./TrainingWorkspace";
import { trainingRecoveryKey } from "../../lib/training/save-recovery";

type Props = React.ComponentProps<typeof TrainingWorkspace>;
type Element = React.ReactElement<Record<string, unknown>>;
type Attendance = { member_id: string; attendance_status: string; training_event_id: string; department_id: string };
type Failure = "none" | "returned" | "thrown" | "committed-timeout";
type CreationFailure = "none" | "committed-returned" | "committed-thrown" | "not-committed";
const ADAM = "10000000-0000-4000-8000-000000000001";
const BRANDON = "10000000-0000-4000-8000-000000000002";
const ELLIOTT = "20000000-0000-4000-8000-000000000001";
const USER = "30000000-0000-4000-8000-000000000001";
const CATEGORY = "40000000-0000-4000-8000-000000000001";
type Database = { events: Map<string, Record<string, unknown>>; attendance: Attendance[] };
type Options = { storage?: Map<string, string>; database?: Database; userId?: string; departmentId?: string };
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("./TrainingWorkspace.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}

function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement<Record<string, unknown>>(node) ? text(node.props.children as React.ReactNode) : "";
}

function harness(options: Options = {}) {
  const state: unknown[] = [];
  const effects = new Map<number, { deps: React.DependencyList | undefined; cleanup?: () => void }>();
  const queuedEffects: Array<() => void> = [];
  let cursor = 0;
  const storage = options.storage ?? new Map<string, string>();
  const database = options.database ?? { events: new Map<string, Record<string, unknown>>(), attendance: [] };
  const eventId = randomUUID();
  let userId = options.userId ?? USER;
  let authListener: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
  const eventWrites: Array<Record<string, unknown>> = [];
  const attendanceWrites: Attendance[][] = [];
  const savedAttendance = database.attendance;
  const reads: Array<Map<string, unknown>> = [];
  const eventReads: Array<Map<string, string>> = [];
  const recalculated: string[][] = [];
  let refreshes = 0;
  let failure: Failure = "none";
  let creationFailure: CreationFailure = "none";
  let eventReadError = false;
  let invisibleEvent = false;
  let commitBeforeRetryInsert = false;
  let categoryActive = true;
  let invalidMember: string | null = null;
  let storageFailure: "none" | "read" | "write" | "remove" = "none";
  let readFailure: "none" | "returned" | "thrown" = "none";
  let omittedMember: string | null = null;
  let releaseAttendance: (() => void) | undefined;
  let waitForAttendance: Promise<void> | undefined;
  const props: Props = {
    departmentId: options.departmentId ?? ELLIOTT,
    currentMemberId: ADAM,
    currentMemberRole: "administrator",
    canManageTraining: true,
    canAssignHomework: true,
    canReviewTraining: true,
    categories: [{ id: CATEGORY, name: "Miscellaneous", description: null, active: true }],
    events: [], attendanceRows: [], documents: [], pendingReviews: 0, outsideSubmissions: [],
    outsideEvidenceRows: [], assignments: [], assignmentMembers: [], assignmentEvidenceRows: [],
    emsCourseDefinitions: [], departmentTrainingHoursThisYear: 0,
    members: [
      { id: ADAM, first_name: "Adam", last_name: "Smith", role: "Administrator" },
      { id: BRANDON, first_name: "Brandon", last_name: "Adams", role: "Firefighter" },
    ],
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
      onAuthStateChange: (listener: typeof authListener) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe: () => { authListener = undefined; } } } };
      },
    },
    from(table: string) {
      if (table === "training_categories") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { id: CATEGORY, active: categoryActive }, error: null }),
        };
        return query;
      }
      if (table === "training_events") return {
        insert(payload: Record<string, unknown>) {
          eventWrites.push(payload);
          const execute = async () => {
            const persisted = storage.get(trainingRecoveryKey(userId, props.departmentId, props.currentMemberId));
            assert.ok(persisted, "Recovery must be durable before the insert");
            assert.equal(JSON.parse(persisted).eventId, payload.id);
            if (creationFailure === "not-committed") return { data: null, error: { message: "Synthetic request timeout" } };
            const id = String(payload.id);
            if (commitBeforeRetryInsert) {
              database.events.set(id, { ...payload, description: "Original request won the race" });
              commitBeforeRetryInsert = false;
            }
            if (database.events.has(id)) return { data: null, error: { code: "23505", message: "Duplicate primary key" } };
            const row = { ...payload, created_at: "2026-11-05", updated_at: "2026-11-05" };
            database.events.set(id, row);
            if (creationFailure === "committed-returned") return { data: null, error: { message: "Synthetic response lost" } };
            if (creationFailure === "committed-thrown") throw new Error("Synthetic response lost");
            return { data: row, error: null };
          };
          return {
            select: () => ({ single: execute }),
            then: (resolve: (result: Awaited<ReturnType<typeof execute>>) => void, reject: (error: unknown) => void) =>
              execute().then(resolve, reject),
          };
        },
        select(columns: string) {
          assert.equal(columns, "id, department_id, created_by");
          const filters = new Map<string, string>();
          eventReads.push(filters);
          const query = {
            eq: (key: string, value: string) => { filters.set(key, value); return query; },
            maybeSingle: async () => {
              if (eventReadError) return { data: null, error: { message: "Synthetic event lookup failure" } };
              const row = database.events.get(filters.get("id") ?? "");
              return {
                data: invisibleEvent ? null : row ?? null,
                error: null,
              };
            },
          };
          return query;
        },
      };
      if (table === "members") {
        const filters = new Map<string, unknown>();
        const query = {
          select: () => query,
          eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
          in: async (_key: string, ids: string[]) => {
            assert.equal(filters.get("department_id"), props.departmentId);
            assert.equal(filters.get("active"), true);
            return { data: props.members.filter(member => ids.includes(member.id) && member.id !== invalidMember), error: null };
          },
        };
        return query;
      }
      assert.equal(table, "training_event_attendance", "Unexpected database access");
      return {
        async upsert(payload: Attendance[], options: { onConflict: string; ignoreDuplicates: boolean }) {
          assert.equal(options.onConflict, "department_id,training_event_id,member_id");
          assert.equal(options.ignoreDuplicates, true);
          attendanceWrites.push(payload);
          if (waitForAttendance) await waitForAttendance;
          if (failure === "returned") return { error: { message: "Synthetic permission failure" } };
          if (failure === "thrown") throw new Error("Synthetic network failure");
          for (const row of payload) {
            if (!savedAttendance.some(existing => existing.member_id === row.member_id &&
              existing.training_event_id === row.training_event_id && existing.department_id === row.department_id)) {
              savedAttendance.push({ ...row });
            }
          }
          if (failure === "committed-timeout") throw new Error("Response lost after commit");
          return { error: null };
        },
        select(columns: string) {
          assert.equal(columns, "member_id, attendance_status");
          const filters = new Map<string, unknown>();
          reads.push(filters);
          const query = {
            eq: (key: string, value: string) => { filters.set(key, value); return query; },
            in: async (key: string, values: string[]) => {
              filters.set(key, values);
              if (readFailure === "thrown") throw new Error("Synthetic read network failure");
              if (readFailure === "returned") return { data: null, error: { message: "Synthetic read failure" } };
              return {
                data: savedAttendance.filter(row => row.member_id !== omittedMember &&
                  row.department_id === filters.get("department_id") &&
                  row.training_event_id === filters.get("training_event_id") && values.includes(row.member_id)),
                error: null,
              };
            },
          };
          return query;
        },
      };
    },
  };
  const componentModule = { exports: {} as { default: typeof TrainingWorkspace } };
  const sessionStorage = {
    getItem: (key: string) => {
      if (storageFailure === "read") throw new Error("Synthetic storage read failure");
      return storage.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageFailure === "write") throw new Error("Synthetic storage write failure");
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      if (storageFailure === "remove") throw new Error("Synthetic storage remove failure");
      storage.delete(key);
    },
  };
  const load = runInNewContext(`(function(require, module, exports) { ${compiled}\n })`, {
    Error, Set, Map, crypto: { randomUUID: () => eventId },
    document: { body: { style: {} }, documentElement: { style: {} } },
    window: { sessionStorage, addEventListener: () => {}, removeEventListener: () => {} },
  });
  load((name: string) => {
    if (name === "react") return {
      ...React,
      useState: <S,>(initial: S | (() => S)) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? (initial as () => S)() : initial;
        return [state[index] as S, (update: S | ((current: S) => S)) => {
          state[index] = typeof update === "function" ? (update as (current: S) => S)(state[index] as S) : update;
        }];
      },
      useRef: <T,>(initial: T) => {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index] as React.RefObject<T>;
      },
      useEffect: (effect: React.EffectCallback, deps?: React.DependencyList) => {
        const index = cursor++;
        const previous = effects.get(index);
        if (!previous || !deps || !previous.deps || deps.some((value, i) => value !== previous.deps?.[i])) {
          queuedEffects.push(() => {
            previous?.cleanup?.();
            const cleanup = effect();
            effects.set(index, { deps, cleanup: typeof cleanup === "function" ? cleanup : undefined });
          });
        }
      },
      useCallback: <T,>(callback: T) => callback,
      useMemo: <T,>(factory: () => T) => factory(),
    };
    if (name === "react-dom") return { createPortal: (children: React.ReactNode) => children };
    if (name === "next/link") return { default: () => null };
    if (name === "next/navigation") return {
      useRouter: () => ({ refresh: () => { refreshes++; } }),
      useSearchParams: () => new URLSearchParams(),
    };
    if (name === "@/lib/supabase") return { supabase: client };
    if (name === "@/lib/ems/recalculate-client") return {
      triggerEmsAllocationRecalculation: async () => {},
      triggerEmsAllocationRecalculationForMembers: async (ids: string[]) => { recalculated.push(ids); },
    };
    if (name === "@/components/training/SubmitTrainingModal") return { default: () => null };
    return require(name);
  }, componentModule, componentModule.exports);
  function tree() {
    cursor = 0;
    const result = elements(componentModule.exports.default(props));
    for (const effect of queuedEffects.splice(0)) effect();
    return result;
  }
  function find(predicate: (element: Element) => boolean) {
    const node = tree().find(predicate);
    assert.ok(node, "Expected rendered element");
    return node;
  }
  function click(label: string) {
    const button = find(node => node.type === "button" && text(node).trim() === label);
    assert.notEqual(button.props.disabled, true, `${label} must be enabled`);
    (button.props.onClick as () => void)();
  }
  function change(label: string, value: string) {
    const container = find(node => node.type === "label" && text(node).trim().startsWith(label));
    const input = elements(container.props.children as React.ReactNode).find(node =>
      node.type === "input" || node.type === "select" || node.type === "textarea");
    assert.ok(input);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  }
  function submit() {
    const form = find(node => node.type === "form");
    return (form.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} });
  }
  async function mount() {
    tree();
    await new Promise(resolve => setImmediate(resolve));
    tree();
  }
  async function prepare(selectAttendees = true) {
    await mount();
    click("Add Training");
    change("Training Title", "Synthetic Pipeline");
    change("Date", "2026-11-04");
    change("Start Time", "1830");
    change("Training Hours", "1");
    if (selectAttendees) {
      click("Adam SmithAdd");
      click("Brandon AdamsAdd");
    }
  }
  function expectPending(message: RegExp) {
    assert.ok(tree().some(node => node.props.role === "dialog"), "Form must remain open");
    const alert = find(node => node.props.role === "alert");
    assert.match(text(alert), /attendance is not confirmed/i);
    assert.match(text(alert), message);
    assert.ok(tree().some(node => node.type === "button" && text(node) === "Adam SmithSelected"));
    assert.ok(tree().some(node => node.type === "button" && text(node) === "Brandon AdamsSelected"));
    assert.ok(tree().some(node => node.type === "fieldset" && node.props.disabled === true));
    assert.ok(tree().some(node => node.type === "button" && text(node) === "Retry Attendance"));
    assert.ok(!tree().some(node => text(node) === "Training event and attendance saved."));
    assert.equal(refreshes, 0);
  }
  return {
    props, storage, database, eventId, eventWrites, attendanceWrites, savedAttendance, reads, eventReads, recalculated,
    tree, click, change, submit, prepare, mount, expectPending,
    failCreation: (mode: CreationFailure) => { creationFailure = mode; },
    failEventRead: (value: boolean) => { eventReadError = value; },
    hideEvent: () => { invisibleEvent = true; },
    raceEventInsert: () => { commitBeforeRetryInsert = true; },
    deactivateCategory: () => { categoryActive = false; },
    invalidateMember: (id: string) => { invalidMember = id; },
    failStorage: (mode: typeof storageFailure) => { storageFailure = mode; },
    signIn: (id: string) => { userId = id; authListener?.(id ? "SIGNED_IN" : "SIGNED_OUT", id ? { user: { id } } : null); },
    unmount: () => { for (const effect of effects.values()) effect.cleanup?.(); },
    fail: (mode: Failure) => { failure = mode; },
    failRead: (mode: typeof readFailure) => { readFailure = mode; },
    omit: (id: string | null) => { omittedMember = id; },
    pause: () => { waitForAttendance = new Promise(resolve => { releaseAttendance = resolve; }); },
    resume: () => { releaseAttendance?.(); },
    refreshCount: () => refreshes,
  };
}

test("event and all selected attendance are saved, read back and confirmed before closing", async () => {
  const h = harness();
  await h.prepare();
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.attendanceWrites.length, 1);
  assert.deepEqual(Array.from(h.attendanceWrites[0], row => row.member_id), [ADAM, BRANDON]);
  assert.equal(h.reads[0].get("department_id"), ELLIOTT);
  assert.equal(h.reads[0].get("training_event_id"), h.eventId);
  assert.deepEqual(Array.from(h.reads[0].get("member_id") as string[]), [ADAM, BRANDON]);
  assert.ok(!h.tree().some(node => node.props.role === "dialog"));
  assert.ok(h.tree().some(node => text(node) === "Training event and attendance saved."));
  assert.equal(h.refreshCount(), 1);
  assert.deepEqual(h.recalculated.map(ids => Array.from(ids)), [[ADAM, BRANDON]]);
});

for (const mode of ["returned", "thrown", "committed-timeout"] as const) {
  test(`${mode} attendance failure preserves selections and retries the existing event without duplicates`, async () => {
    const h = harness();
    await h.prepare();
    h.fail(mode);
    await h.submit();
    h.expectPending(mode === "returned" ? /permission failure/ : mode === "thrown" ? /network failure/ : /Response lost/);
    h.fail("none");
    await h.submit();
    assert.equal(h.eventWrites.length, 1);
    assert.equal(h.attendanceWrites.length, 2);
    assert.ok(h.attendanceWrites.flat().every(row => row.training_event_id === h.eventId));
    assert.equal(h.savedAttendance.length, 2);
    assert.ok(!h.tree().some(node => node.props.role === "dialog"));
    assert.equal(h.refreshCount(), 1);
  });
}

test("closing and reopening pending attendance retains its event, selections and visible error", async () => {
  const h = harness();
  await h.prepare();
  h.fail("returned");
  await h.submit();
  h.click("Close (attendance pending)");
  h.click("Add Training");
  h.expectPending(/permission failure/);
  h.fail("none");
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
});

test("a selected attendee missing from the loaded roster blocks creation rather than silently filtering", async () => {
  const h = harness();
  await h.prepare();
  h.props.members = h.props.members.filter(member => member.id !== ADAM);
  await h.submit();
  assert.equal(h.eventWrites.length, 0);
  assert.equal(h.attendanceWrites.length, 0);
  assert.ok(h.tree().some(node => node.props.role === "alert" &&
    text(node).includes(`missing from the loaded department roster: ${ADAM}`)));
  assert.ok(h.tree().some(node => text(node) === "2 members selected"));
});

test("missing saved attendance prevents success and retry reconciles without another event", async () => {
  const h = harness();
  await h.prepare();
  h.omit(ADAM);
  await h.submit();
  h.expectPending(/Adam Smith/);
  h.omit(null);
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.refreshCount(), 1);
});

for (const mode of ["returned", "thrown"] as const) {
  test(`${mode} read-back failure cannot report attendance success`, async () => {
    const h = harness();
    await h.prepare();
    h.failRead(mode);
    await h.submit();
    h.expectPending(mode === "returned" ? /Unable to verify saved attendance/ : /read network failure/);
    h.failRead("none");
    await h.submit();
    assert.equal(h.eventWrites.length, 1);
    assert.equal(h.savedAttendance.length, 2);
  });
}

test("an existing non-attending row is not overwritten or falsely confirmed by duplicate-ignore retry", async () => {
  const h = harness();
  await h.prepare();
  h.savedAttendance.push({ member_id: ADAM, training_event_id: h.eventId, department_id: ELLIOTT, attendance_status: "absent" });
  await h.submit();
  h.expectPending(/Adam Smith/);
  assert.equal(h.savedAttendance.find(row => row.member_id === ADAM)?.attendance_status, "absent");
});

test("duplicate submissions while attendance is in flight do not create another event", async () => {
  const h = harness();
  await h.prepare();
  h.pause();
  const first = h.submit();
  await new Promise(resolve => setImmediate(resolve));
  const second = h.submit();
  h.resume();
  await Promise.all([first, second]);
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.attendanceWrites.length, 1);
});

test("creating an event without selected attendees is explicit and does not add its creator", async () => {
  const h = harness();
  await h.prepare(false);
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.attendanceWrites.length, 0);
  assert.ok(h.tree().some(node => text(node) === "Training event saved. No attendees selected."));
});

test("refresh restores event/attendee IDs and draft, verifies the original event, and clears recovery after success", async () => {
  const first = harness();
  await first.prepare();
  first.fail("returned");
  await first.submit();
  const key = trainingRecoveryKey(USER, ELLIOTT, ADAM);
  const persisted = JSON.parse(first.storage.get(key) ?? "{}");
  assert.equal(persisted.eventId, first.eventId);
  assert.deepEqual(persisted.memberIds, [ADAM, BRANDON]);
  assert.equal(persisted.draft.scopeKey, key);
  assert.equal(persisted.draft.event.title, "Synthetic Pipeline");
  assert.equal(persisted.draft.event.starts_at, first.eventWrites[0].starts_at);
  first.unmount();
  const refreshed = harness({ storage: first.storage, database: first.database });
  await refreshed.mount();
  assert.ok(refreshed.tree().some(node => node.props.role === "dialog"));
  assert.ok(refreshed.tree().some(node => text(node).includes("Pending training save recovered.")));
  assert.ok(refreshed.tree().some(node => text(node) === "2 members selected"));
  await refreshed.submit();
  assert.equal(refreshed.eventWrites.length, 0);
  assert.equal(refreshed.attendanceWrites[0][0].training_event_id, first.eventId);
  assert.equal(refreshed.eventReads[0].get("id"), first.eventId);
  assert.equal(refreshed.storage.has(key), false);
  refreshed.unmount();
  const afterSuccess = harness({ storage: first.storage, database: first.database });
  await afterSuccess.mount();
  assert.ok(!afterSuccess.tree().some(node => node.props.role === "dialog"));
  assert.equal(afterSuccess.attendanceWrites.length, 0);
});

for (const otherScope of [
  { userId: "30000000-0000-4000-8000-000000000002" },
  { departmentId: "20000000-0000-4000-8000-000000000002" },
]) {
  test(`refresh cannot restore another ${"userId" in otherScope ? "user" : "department"}'s pending save`, async () => {
    const first = harness();
    await first.prepare();
    first.fail("returned");
    await first.submit();
    first.unmount();
    const other = harness({ ...otherScope, storage: first.storage, database: first.database });
    await other.mount();
    assert.ok(!other.tree().some(node => node.props.role === "dialog"));
    assert.equal(other.eventReads.length, 0);
    assert.equal(other.attendanceWrites.length, 0);
    assert.equal(first.storage.size, 1, "Other scopes cannot clear the original recovery");
  });
}

for (const mode of ["committed-returned", "committed-thrown"] as const) {
  test(`${mode} event creation response is recovered after refresh without a second event insert`, async () => {
    const first = harness();
    await first.prepare();
    first.failCreation(mode);
    await first.submit();
    assert.equal(first.database.events.size, 1);
    assert.equal(first.attendanceWrites.length, 0);
    assert.ok(first.tree().some(node => node.props.role === "alert" && /creation is unconfirmed/.test(text(node))));
    first.unmount();
    const refreshed = harness({ storage: first.storage, database: first.database });
    await refreshed.mount();
    await refreshed.submit();
    assert.equal(first.eventWrites.length, 1);
    assert.equal(refreshed.eventWrites.length, 0);
    assert.equal(refreshed.database.events.size, 1);
    assert.equal(refreshed.savedAttendance.length, 2);
    assert.equal(refreshed.storage.size, 0);
  });
}

test("lost creation response retries the original event lookup without refreshing or reinserting", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("committed-returned");
  await h.submit();
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.storage.size, 0);
});

test("a genuinely failed insert is recovered after refresh from the original draft with the same UUID", async () => {
  const first = harness();
  await first.prepare();
  first.change("Instructor", "Synthetic Instructor");
  first.change("Location", "Synthetic Station");
  first.change("Training Details", "Synthetic draft notes");
  first.failCreation("not-committed");
  await first.submit();
  assert.equal(first.database.events.size, 0);
  const originalPayload = first.eventWrites[0];
  first.unmount();
  const refreshed = harness({ storage: first.storage, database: first.database });
  await refreshed.mount();
  assert.ok(refreshed.tree().some(node => node.type === "input" && node.props.value === "Synthetic Pipeline"));
  assert.ok(refreshed.tree().some(node => node.type === "input" && node.props.value === "Synthetic Instructor"));
  assert.ok(refreshed.tree().some(node => node.type === "textarea" && node.props.value === "Synthetic draft notes"));
  refreshed.fail("returned");
  await refreshed.submit();
  assert.equal(refreshed.eventWrites.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(refreshed.eventWrites[0])), JSON.parse(JSON.stringify(originalPayload)));
  assert.equal(refreshed.database.events.size, 1);
  assert.ok(refreshed.database.events.has(first.eventId));
  assert.notEqual(refreshed.eventId, first.eventId, "A fresh browser mount's UUID must not be used");
  assert.equal(refreshed.storage.size, 1);
  refreshed.fail("none");
  await refreshed.submit();
  assert.equal(refreshed.eventWrites.length, 1, "Attendance retry must not insert the event again");
  assert.equal(refreshed.savedAttendance.length, 2);
  assert.equal(refreshed.storage.size, 0);
});

test("repeated failed creation retries reuse the same UUID until the original draft is saved", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("not-committed");
  await h.submit();
  await h.submit();
  await h.submit();
  assert.equal(h.database.events.size, 0);
  assert.equal(h.storage.size, 1);
  assert.equal(h.eventWrites.length, 3);
  assert.ok(h.eventWrites.every(payload => payload.id === h.eventId));
  h.failCreation("none");
  h.fail("returned");
  await h.submit();
  assert.equal(h.database.events.size, 1);
  h.fail("none");
  await h.submit();
  assert.equal(h.eventWrites.length, 4);
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.storage.size, 0);
});

test("an original request committing between lookup and retry insert is never overwritten", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("not-committed");
  await h.submit();
  h.failCreation("none");
  h.raceEventInsert();
  await h.submit();
  assert.equal(h.eventWrites.length, 2);
  assert.ok(h.eventWrites.every(payload => payload.id === h.eventId));
  assert.equal(h.database.events.size, 1);
  assert.equal(h.database.events.get(h.eventId)?.description, "Original request won the race");
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.storage.size, 0);
});

test("an RLS-invisible original event cannot be duplicated or updated by recovery", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("committed-returned");
  await h.submit();
  const original = JSON.stringify(h.database.events.get(h.eventId));
  h.failCreation("none");
  h.hideEvent();
  await h.submit();
  assert.equal(h.eventWrites.length, 2);
  assert.ok(h.eventWrites.every(payload => payload.id === h.eventId));
  assert.equal(h.database.events.size, 1);
  assert.equal(JSON.stringify(h.database.events.get(h.eventId)), original);
  assert.equal(h.attendanceWrites.length, 0);
  assert.equal(h.storage.size, 1);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /still cannot be verified/.test(text(node))));
});

test("a failed retry insert that commits but loses its response is found by the following lookup", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("not-committed");
  await h.submit();
  h.failCreation("committed-thrown");
  await h.submit();
  assert.equal(h.database.events.size, 1);
  assert.equal(h.storage.size, 1);
  assert.equal(h.attendanceWrites.length, 0);
  await h.submit();
  assert.equal(h.eventWrites.length, 2);
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.storage.size, 0);
});

test("an inactive recovered category prevents retry creation and preserves the draft", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("not-committed");
  await h.submit();
  h.deactivateCategory();
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.database.events.size, 0);
  assert.equal(h.storage.size, 1);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /category is no longer active/.test(text(node))));
});

test("older recovery without a draft cannot insert an absent event", async () => {
  const eventId = randomUUID();
  const storage = new Map([[trainingRecoveryKey(USER, ELLIOTT, ADAM), JSON.stringify({ eventId, memberIds: [ADAM] })]]);
  const h = harness({ storage });
  await h.mount();
  await h.submit();
  assert.equal(h.eventWrites.length, 0);
  assert.equal(h.attendanceWrites.length, 0);
  assert.equal(h.storage.size, 1);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /no saved event draft/.test(text(node))));
});

test("older ID-only recovery still saves attendance for a verified existing event without inserting", async () => {
  const first = harness();
  await first.prepare();
  first.fail("returned");
  await first.submit();
  const key = trainingRecoveryKey(USER, ELLIOTT, ADAM);
  first.storage.set(key, JSON.stringify({ eventId: first.eventId, memberIds: [ADAM, BRANDON] }));
  first.unmount();
  const refreshed = harness({ storage: first.storage, database: first.database });
  await refreshed.mount();
  await refreshed.submit();
  assert.equal(refreshed.eventWrites.length, 0);
  assert.equal(refreshed.savedAttendance.length, 2);
  assert.equal(refreshed.storage.size, 0);
});

for (const { name, mutate } of [
  { name: "event UUID", mutate: (recovery: Record<string, unknown>) => { recovery.eventId = randomUUID(); } },
  { name: "authenticated scope", mutate: (recovery: Record<string, unknown>) => {
    (recovery.draft as { scopeKey: string }).scopeKey = trainingRecoveryKey(randomUUID(), ELLIOTT, ADAM);
  } },
  ...["department_id", "created_by", "category_id", "title", "hours_credit", "starts_at", "id"].map(field => ({
    name: field,
    mutate: (recovery: Record<string, unknown>) => {
      const draft = recovery.draft as { event: Record<string, unknown> };
      draft.event[field] = field === "department_id" || field === "created_by" ? randomUUID() : null;
    },
  })),
]) {
  test(`invalid or mismatched persisted draft cannot trigger event insertion: ${name}`, async () => {
    const first = harness();
    await first.prepare();
    first.failCreation("not-committed");
    await first.submit();
    const key = trainingRecoveryKey(USER, ELLIOTT, ADAM);
    const recovery: Record<string, unknown> = JSON.parse(first.storage.get(key) ?? "{}");
    mutate(recovery);
    first.storage.set(key, JSON.stringify(recovery));
    first.unmount();
    const refreshed = harness({ storage: first.storage, database: first.database });
    await refreshed.mount();
    assert.equal(refreshed.eventWrites.length, 0);
    assert.equal(refreshed.eventReads.length, 0);
    assert.equal(refreshed.attendanceWrites.length, 0);
    assert.equal(refreshed.storage.size, 1);
    assert.ok(refreshed.tree().some(node => node.props.role === "alert" && /recovery is unavailable/.test(text(node))));
  });
}

test("changing a valid draft while mounted blocks retry until recovery is reloaded", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("not-committed");
  await h.submit();
  const key = trainingRecoveryKey(USER, ELLIOTT, ADAM);
  const recovery = JSON.parse(h.storage.get(key) ?? "{}");
  recovery.draft.event.title = "Changed draft";
  h.storage.set(key, JSON.stringify(recovery));
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.attendanceWrites.length, 0);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /recovery changed/.test(text(node))));
});

test("a failed event lookup retains recovery and never writes attendance or creates a replacement", async () => {
  const h = harness();
  await h.prepare();
  h.failCreation("committed-returned");
  await h.submit();
  h.failEventRead(true);
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.attendanceWrites.length, 0);
  assert.equal(h.storage.size, 1);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /event lookup failure/.test(text(node))));
});

for (const field of ["department_id", "created_by"] as const) {
  test(`recovery refuses an event with a different ${field}`, async () => {
    const h = harness();
    await h.prepare();
    h.failCreation("committed-returned");
    await h.submit();
    const event = h.database.events.get(h.eventId);
    assert.ok(event);
    event[field] = randomUUID();
    await h.submit();
    assert.equal(h.attendanceWrites.length, 0);
    assert.equal(h.storage.size, 1);
    assert.equal(h.eventWrites.length, 1);
  });
}

test("attendees are revalidated against active department membership before recovery writes", async () => {
  const h = harness();
  await h.prepare();
  h.fail("returned");
  await h.submit();
  h.invalidateMember(ADAM);
  h.fail("none");
  await h.submit();
  assert.equal(h.attendanceWrites.length, 1, "No new attendance request for invalid members");
  assert.equal(h.storage.size, 1);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /no longer active members/.test(text(node))));
});

for (const invalid of [
  "not JSON",
  JSON.stringify({ eventId: "invalid-id", memberIds: [ADAM] }),
  JSON.stringify({ eventId: randomUUID(), memberIds: ["invalid-member"] }),
  JSON.stringify({ eventId: randomUUID(), memberIds: [ADAM, ADAM] }),
]) {
  test(`malformed recovery fails closed: ${invalid.slice(0, 30)}`, async () => {
    const storage = new Map([[trainingRecoveryKey(USER, ELLIOTT, ADAM), invalid]]);
    const h = harness({ storage });
    await h.mount();
    assert.ok(h.tree().some(node => node.props.role === "alert" && /Training recovery is unavailable/.test(text(node))));
    assert.ok(h.tree().some(node => node.type === "button" && text(node).trim() === "Add Training" && node.props.disabled));
    assert.equal(h.eventWrites.length, 0);
    assert.equal(h.eventReads.length, 0);
    assert.equal(h.storage.size, 1);
  });
}

test("storage write failure prevents event creation", async () => {
  const h = harness();
  await h.prepare();
  h.failStorage("write");
  await h.submit();
  assert.equal(h.eventWrites.length, 0);
  assert.equal(h.attendanceWrites.length, 0);
  assert.ok(h.tree().some(node => node.props.role === "alert" && /storage write failure/.test(text(node))));
});

test("storage read failure prevents creation rather than ignoring an existing recovery", async () => {
  const h = harness();
  h.failStorage("read");
  await h.mount();
  assert.ok(h.tree().some(node => node.props.role === "alert" && /storage read failure/.test(text(node))));
  assert.equal(h.eventWrites.length, 0);
});

test("failed recovery cleanup preserves the pending attempt and retry does not duplicate records", async () => {
  const h = harness();
  await h.prepare();
  h.failStorage("remove");
  await h.submit();
  h.expectPending(/storage remove failure/);
  assert.equal(h.storage.size, 1);
  h.failStorage("none");
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.storage.size, 0);
});

test("changing authenticated users clears the displayed recovery without deleting its owner's entry", async () => {
  const h = harness();
  await h.prepare();
  h.fail("returned");
  await h.submit();
  h.signIn("30000000-0000-4000-8000-000000000002");
  assert.ok(!h.tree().some(node => node.props.role === "dialog"));
  assert.ok(h.tree().some(node => node.type === "button" && text(node).trim() === "Add Training" && node.props.disabled));
  assert.ok(h.tree().some(node => node.props.role === "alert" && /signed-in user changed/.test(text(node))));
  assert.equal(h.storage.size, 1);
  assert.equal(h.attendanceWrites.length, 1);
  h.signIn(USER);
  assert.ok(h.tree().some(node => node.props.role === "dialog"));
  assert.ok(h.tree().some(node => text(node) === "2 members selected"));
});

test("changing department props on the mounted page cannot reuse its previous recovery", async () => {
  const h = harness();
  await h.prepare();
  h.fail("returned");
  await h.submit();
  h.props.departmentId = "20000000-0000-4000-8000-000000000002";
  await h.mount();
  assert.ok(!h.tree().some(node => node.props.role === "dialog"));
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.attendanceWrites.length, 1);
  assert.equal(h.storage.size, 1);
});

test("signing out during an in-flight attendance request cannot clear another session's recovery", async () => {
  const h = harness();
  await h.prepare();
  h.pause();
  const saving = h.submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.attendanceWrites.length, 1);
  h.signIn("");
  h.resume();
  await saving;
  assert.equal(h.storage.size, 1);
  assert.equal(h.refreshCount(), 0);
  assert.ok(!h.tree().some(node => node.props.role === "dialog"));
  h.signIn(USER);
  await h.submit();
  assert.equal(h.eventWrites.length, 1);
  assert.equal(h.savedAttendance.length, 2);
  assert.equal(h.storage.size, 0);
});
