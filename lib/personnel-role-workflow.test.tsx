import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import DepartmentRoleSelector from "../components/personnel/DepartmentRoleSelector";
import PersonnelMembersTable from "../components/personnel/PersonnelMembersTable";
import { getReportSourceConfig } from "./reports/registry";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const roleId = "10000000-0000-4000-8000-000000000001";
const memberId = "20000000-0000-4000-8000-000000000001";
const roles = ["Fire Chief", "Battalion Chief", "Captain", "Firefighter", "Exterior Firefighter"]
  .map((name, index) => ({ id: index ? roleId.slice(0, -1) + (index + 1) : roleId, name, active: true, department_id: "department" }));

function load(file: string, overrides: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(root + file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const target = { exports: {} as Record<string, unknown> };
  runInNewContext(`(function(require, module, exports) { ${compiled}\n })`, globals)(
    (name: string) => {
      if (name in overrides) return overrides[name];
      if (name === "@/components/personnel/DepartmentRoleSelector") return { default: DepartmentRoleSelector };
      if (name.startsWith("@/components/")) return { default: () => null };
      return require(name.startsWith("@/") ? root + name.slice(2) : name);
    }, target, target.exports,
  );
  return target.exports;
}

function database() {
  const member: { id: string; rank: string | null; department_role_id: string | null } = {
    id: memberId, rank: "Captain", department_role_id: roleId,
  };
  const state = {
    member,
    actor: { id: "actor", departmentId: "department", role: "Administrator" },
    manager: true,
    availableRoles: roles.map(role => ({ ...role })),
    missingMember: false,
    rolesError: "",
    roleSaveError: "",
    rpcMismatch: "",
    createError: "",
    createErrorCode: "",
    transportFailure: false,
    operations: [] as Array<{ name: string; payload: Record<string, unknown> }>,
    queries: [] as Array<{ table: string; filters: Map<string, unknown> }>,
  };
  const client = {
    from(table: string) {
      const filters = new Map<string, unknown>();
      state.queries.push({ table, filters });
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.set(key, value); return chain; },
        order: () => chain,
        maybeSingle: async () => ({
          data: table === "members" ? state.missingMember ? null : state.member : state.availableRoles.find(role => role.id === filters.get("id")) ?? null,
          error: table === "department_roles" && state.rolesError ? { message: state.rolesError } : null,
        }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({
          data: table === "department_roles" ? state.availableRoles : [],
          error: state.rolesError && table === "department_roles" ? { message: state.rolesError } : null,
        }).then(resolve),
      };
      return chain;
    },
    async rpc(name: string, payload: Record<string, unknown>) {
      state.operations.push({ name, payload: { ...payload } });
      return {
        data: state.rpcMismatch === name ? "wrong-member" : memberId,
        error: name === "create_department_member_with_role" && state.createError
          ? { message: state.createError, code: state.createErrorCode }
          : name === "update_department_member_role" && state.roleSaveError ? { message: state.roleSaveError } : null,
      };
    },
  };
  return { state, client };
}

function updateHarness() {
  const db = database();
  const api = load("app/api/personnel/members/[id]/route.ts", {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => db.client },
    "@/lib/current-member": { getCurrentMember: async () => db.state.actor },
    "@/lib/member-permissions": { canManagePersonnel: async () => db.state.manager },
  }, { Response });
  return {
    ...db,
    async update(payload: Record<string, unknown>) {
      const handler = api.PATCH;
      assert.ok(typeof handler === "function");
      const response: Response = await handler(new Request("https://synthetic.invalid/api/personnel/members/" + memberId, {
        method: "PATCH", body: JSON.stringify({ firstName: "Chris", lastName: "Cashatt", active: true, ...payload }),
      }), { params: Promise.resolve({ id: memberId }) });
      return { status: response.status, body: await response.json() };
    },
  };
}

function createHarness() {
  const db = database();
  const api = load("app/api/personnel/members/route.ts", {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => db.client },
    "@/lib/current-member": { getCurrentMember: async () => db.state.actor },
    "@/lib/member-permissions": { canManagePersonnel: async () => db.state.manager },
  }, { Response });
  return {
    ...db,
    async create(payload: Record<string, unknown> = {}) {
      const handler = api.POST;
      assert.ok(typeof handler === "function");
      const response: Response = await handler(new Request("https://synthetic.invalid/api/personnel/members", {
        method: "POST", body: JSON.stringify({
          firstName: "Chris", lastName: "Cashatt", rank: null, departmentRoleId: roleId,
          requestId: "80000000-0000-4000-8000-000000000001", ...payload,
        }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

test("Add API calls only the transactional wrapper with the chosen role", async () => {
  const h = createHarness();
  const result = await h.create({ departmentRoleId: roles[1].id });
  assert.equal(result.status, 200);
  assert.equal(result.body.memberId, memberId);
  assert.equal(h.state.operations.length, 1);
  assert.equal(h.state.operations[0].name, "create_department_member_with_role");
  assert.equal(h.state.operations[0].payload.p_department_role_id, roles[1].id);
  assert.equal(h.state.operations[0].payload.p_rank, null);
  assert.equal(h.state.operations[0].payload.p_department_id, h.state.actor.departmentId);
  assert.equal(h.state.operations[0].payload.p_request_id, "80000000-0000-4000-8000-000000000001");
});

for (const selectedRole of [roles[1].id, null]) {
  test(`Add uses real active-department cookie resolution with role ${selectedRole ?? "Unassigned"}`, async () => {
    const db = database();
    const memberships = ["first-department", "active-department"].map((departmentId, index) => ({
      id: `actor-${index}`, department_id: departmentId, first_name: "Admin", last_name: "Actor",
      role: "Administrator", auth_user_id: "authenticated-user",
    }));
    const originalFrom = db.client.from;
    const client = {
      ...db.client,
      auth: { getUser: async () => ({ data: { user: { id: "authenticated-user", email: "actor@example.invalid" } } }) },
      from(table: string) {
        if (table !== "members") return originalFrom(table);
        const filters = new Map<string, unknown>();
        const chain = {
          select: () => chain,
          eq: (key: string, value: unknown) => { filters.set(key, value); return chain; },
          order: async () => ({ data: memberships.filter(row => row.auth_user_id === filters.get("auth_user_id")), error: null }),
        };
        return chain;
      },
    };
    const currentMember = load("lib/current-member.ts", {
      "@/lib/supabase-server": { createSupabaseServerClient: async () => client },
      "next/headers": { cookies: async () => ({ get: () => ({ value: "active-department" }) }) },
    });
    const api = load("app/api/personnel/members/route.ts", {
      "@/lib/supabase-server": { createSupabaseServerClient: async () => client },
      "@/lib/current-member": currentMember,
      "@/lib/member-permissions": {
        canManagePersonnel: async (_client: unknown, departmentId: string) => {
          assert.equal(departmentId, "active-department");
          return true;
        },
      },
    }, { Response });
    const handler = api.POST;
    assert.ok(typeof handler === "function");
    const response: Response = await handler(new Request("https://synthetic.invalid/api/personnel/members", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Member", lastName: "Target", rank: null,
        requestId: "80000000-0000-4000-8000-000000000001",
        departmentRoleId: selectedRole, departmentId: "forged-department",
      }),
    }));
    assert.equal(response.status, 200);
    assert.equal(db.state.operations.length, 1);
    assert.equal(db.state.operations[0].payload.p_department_id, "active-department");
    assert.equal(db.state.operations[0].payload.p_department_role_id, selectedRole);

    const invalidContext = load("lib/current-member.ts", {
      "@/lib/supabase-server": { createSupabaseServerClient: async () => client },
      "next/headers": { cookies: async () => ({ get: () => ({ value: "stale-or-forged-department" }) }) },
    });
    const invalidApi = load("app/api/personnel/members/route.ts", {
      "@/lib/supabase-server": { createSupabaseServerClient: async () => client },
      "@/lib/current-member": invalidContext,
      "@/lib/member-permissions": { canManagePersonnel: async () => true },
    }, { Response });
    const invalidHandler = invalidApi.POST;
    assert.ok(typeof invalidHandler === "function");
    const rejected: Response = await invalidHandler(new Request("https://synthetic.invalid/api/personnel/members", {
      method: "POST", body: JSON.stringify({ firstName: "Member", lastName: "Target", rank: null, departmentRoleId: selectedRole }),
    }));
    assert.equal(rejected.status, 401);
    assert.equal(db.state.operations.length, 1, "Invalid active cookie must not fall back and create elsewhere");
  });
}

test("Add API exposes atomic failures and duplicate conflicts without a second save", async () => {
  const h = createHarness();
  h.state.createError = "Role assignment failed";
  h.state.createErrorCode = "P0001";
  assert.equal((await h.create()).body.error, "Role assignment failed");
  h.state.createErrorCode = "23505";
  assert.equal((await h.create()).status, 409);
  assert.ok(h.state.operations.every(op => op.name === "create_department_member_with_role"));
});

test("Add API treats transport errors as uncertain, not as a confirmed rollback", async () => {
  const h = createHarness();
  h.state.createError = "Failed to fetch";
  const result = await h.create();
  assert.equal(result.status, 502);
  assert.match(result.body.error, /outcome could not be confirmed/);
});

test("Add API rejects missing or invalid role and unauthorized managers before writing", async () => {
  const h = createHarness();
  for (const value of [undefined, 42, "malformed"]) {
    assert.equal((await h.create({ departmentRoleId: value })).status, 400);
  }
  h.state.manager = false;
  assert.equal((await h.create()).status, 403);
  assert.equal(h.state.operations.length, 0);
});

test("Add API reports uncertain results rather than success for an invalid RPC return", async () => {
  const h = createHarness();
  h.state.rpcMismatch = "create_department_member_with_role";
  const result = await h.create();
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
  assert.match(result.body.error, /Review Personnel before retrying/);
});

test("Edit preserves omitted legacy rank and saves Department Role through secured RPC", async () => {
  const h = updateHarness();
  const result = await h.update({ departmentRoleId: roles[1].id });
  assert.equal(result.status, 200);
  assert.equal(h.state.operations[0].payload.p_rank, "Captain");
  assert.equal(h.state.operations[0].payload.p_department_id, h.state.actor.departmentId);
  assert.deepEqual(h.state.operations[1], {
    name: "update_department_member_role",
    payload: { p_member_id: memberId, p_department_role_id: roles[1].id, p_department_id: h.state.actor.departmentId },
  });
  assert.ok(h.state.queries.every(q => q.filters.get("department_id") === "department"));
});

test("Edit without a Department Role payload leaves the assignment unchanged", async () => {
  const h = updateHarness();
  h.state.member.rank = null;
  assert.equal((await h.update({})).status, 200);
  assert.equal(h.state.operations.length, 1);
  assert.equal(h.state.operations[0].payload.p_rank, null);
});

test("Edit can explicitly clear Department Role without changing legacy rank", async () => {
  const h = updateHarness();
  assert.equal((await h.update({ departmentRoleId: "" })).status, 200);
  assert.equal(h.state.operations[1].payload.p_department_role_id, null);
  assert.equal(h.state.operations[0].payload.p_rank, "Captain");
});

test("Edit preserves an existing inactive Department Role without assigning a different inactive role", async () => {
  const h = updateHarness();
  h.state.availableRoles.forEach(role => { role.active = false; });
  assert.equal((await h.update({ departmentRoleId: roleId })).status, 200);
  assert.equal(h.state.operations.length, 1);
  h.state.operations.length = 0;
  assert.equal((await h.update({ departmentRoleId: roles[1].id })).status, 400);
  assert.equal(h.state.operations.length, 0);
});

for (const value of [123, "malformed", "99999999-0000-4000-8000-000000000001"]) {
  test(`Edit rejects invalid or foreign Department Role ${value} before any write`, async () => {
    const h = updateHarness();
    assert.equal((await h.update({ departmentRoleId: value })).status, 400);
    assert.equal(h.state.operations.length, 0);
  });
}

test("Edit stops before mutations when role configuration cannot be loaded", async () => {
  const h = updateHarness();
  h.state.rolesError = "Role query failed";
  assert.match((await h.update({ departmentRoleId: roles[1].id })).body.error, /Role query failed/);
  assert.equal(h.state.operations.length, 0);
});

test("Edit denies inaccessible member and unauthorized personnel manager", async () => {
  const h = updateHarness();
  h.state.missingMember = true;
  assert.equal((await h.update({ departmentRoleId: roleId })).status, 404);
  h.state.manager = false;
  assert.equal((await h.update({ departmentRoleId: roleId })).status, 403);
  assert.equal(h.state.operations.length, 0);
});

test("Edit role failure explicitly reports the saved member-details partial result", async () => {
  const h = updateHarness();
  h.state.roleSaveError = "Forbidden: role save denied";
  const result = await h.update({ departmentRoleId: roles[1].id });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Member details were saved.*Forbidden: role save denied/);
  assert.equal(result.body.ok, false);
});

test("Edit does not report success for a mismatched member RPC result", async () => {
  const h = updateHarness();
  h.state.rpcMismatch = "update_department_member";
  assert.equal((await h.update({ departmentRoleId: roles[1].id })).status, 400);
  assert.equal(h.state.operations.length, 1);
});

test("Shared Department Role selector supports all five configured types and unassigned", () => {
  for (const role of roles) {
    const html = renderToStaticMarkup(<DepartmentRoleSelector selectedRoleId={role.id} departmentRoles={roles} onChange={() => {}} />);
    assert.ok(html.includes(`value="${role.id}" selected=""`));
    assert.ok(html.includes(role.name));
    assert.ok(html.includes("Unassigned"));
    assert.ok(!html.includes("Legacy"));
  }
});

test("Shared selector preserves assigned inactive roles but disables other inactive options", () => {
  const inactiveRoles = roles.map(role => ({ ...role, active: false }));
  const html = renderToStaticMarkup(<DepartmentRoleSelector assignedRoleId={roleId} selectedRoleId={roleId} departmentRoles={inactiveRoles} onChange={() => {}} />);
  assert.match(html, new RegExp(`value="${roleId}" selected=""`));
  assert.match(html, new RegExp(`value="${roles[1].id}" disabled=""`));
});

test("Personnel list and roster report have no legacy rank column", () => {
  const html = renderToStaticMarkup(<PersonnelMembersTable members={[{
    id: memberId, first_name: "Chris", last_name: "Cashatt", active: true,
    department_role_name: "Battalion Chief", role_requirement_label: "Complete",
  }]} />);
  assert.ok(html.includes("Department Role") && html.includes("Battalion Chief"));
  assert.ok(!html.includes(">Rank<") && !html.includes("Unassigned"));
  const definition = getReportSourceConfig("personnel");
  assert.ok(definition);
  assert.ok(!definition.columns.some(column => column.key === "rank"));
});

test("Personnel roster renders and searches inactive assigned roles without changing assignments", async () => {
  const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
    members: [
      { id: "assigned", department_id: "department", first_name: "Assigned", last_name: "Member", active: true, department_role_id: "inactive-role" },
      { id: "unassigned", department_id: "department", first_name: "Unassigned", last_name: "Member", active: true, department_role_id: null },
      { id: "foreign", department_id: "other", first_name: "Foreign", last_name: "Member", active: true, department_role_id: "foreign-role" },
    ],
    department_roles: [
      { id: "inactive-role", department_id: "department", name: "Retired Captain", active: false },
      { id: "foreign-role", department_id: "other", name: "Foreign Chief", active: false },
    ],
  };
  const before = JSON.stringify(rowsByTable);
  const queries: Array<{ table: string; filters: Map<string, unknown> }> = [];
  const supabase = {
    from(table: string) {
      const filters = new Map<string, unknown>();
      queries.push({ table, filters });
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.set(key, value); return chain; },
        order: () => chain,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({
          data: rowsByTable[table].filter(row => [...filters].every(([key, value]) => row[key] === value)),
          error: null,
        }).then(resolve),
      };
      return chain;
    },
  };
  const report = load("lib/reports/server-runner.ts", {
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => { throw new Error("Personnel report must not use admin client"); } },
  });
  const run = report.runReport;
  assert.ok(typeof run === "function");
  const request = {
    category: "personnel", dateRange: { preset: "custom", from: "2026-01-01", to: "2026-12-31" },
    filters: {}, searchTerm: "", page: 1, pageSize: 50,
  };
  const context = { supabase, departmentId: "department", departmentName: "Synthetic Department", memberRole: "administrator" };
  const result = await run(request, context);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].role_name, "Retired Captain");
  assert.equal(result.rows[1].role_name, "Unassigned");
  const search = await run({ ...request, searchTerm: "Retired Captain" }, context);
  assert.equal(search.rows.length, 1);
  assert.equal(search.rows[0].member_name, "Assigned Member");
  assert.ok(queries.every(query => query.filters.get("department_id") === "department"));
  assert.ok(queries.filter(query => query.table === "department_roles").every(query => !query.filters.has("active")));
  assert.equal(JSON.stringify(rowsByTable), before);
});

type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...descendants(node.props.children as ReactNode)];
}

function componentHarness(file: string, props: Record<string, unknown>, stored = new Map<string, string>(), serverRequests = new Set<string>()) {
  const db = database();
  const values: unknown[] = [];
  let index = 0;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const exports = load(file, {
    react: {
      ...React,
      useMemo: (factory: () => unknown) => factory(),
      useState: <T,>(initial: T) => {
        const slot = index++;
        if (!(slot in values)) values[slot] = initial;
        return [values[slot], (next: T | ((previous: T) => T)) => {
          values[slot] = typeof next === "function" ? (next as (previous: T) => T)(values[slot] as T) : next;
        }];
      },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => {}, push: () => {} }) },
    "@/lib/supabase": { supabase: db.client },
  }, {
    crypto: globalThis.crypto,
    sessionStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
      removeItem: (key: string) => { stored.delete(key); },
    },
    fetch: async (url: string, options: { body: string }) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url === "/api/personnel/members" && !db.state.createError) {
        serverRequests.add(String(requests.at(-1)?.body.requestId));
      }
      if (db.state.transportFailure) throw new Error("Network timeout");
      return db.state.createError
        ? { ok: false, json: async () => ({ ok: false, error: db.state.createError }) }
        : { ok: true, json: async () => ({ ok: true, memberId }) };
    },
  });
  function render() {
    index = 0;
    const component = exports.default;
    assert.ok(typeof component === "function");
    return descendants(component(props));
  }
  function find(predicate: (el: Element) => boolean) {
    const element = render().find(predicate);
    assert.ok(element, "Expected rendered element");
    return element;
  }
  async function call(element: Element, key: string, event: unknown = { preventDefault() {} }) {
    const handler = element.props[key];
    assert.ok(typeof handler === "function");
    await handler(event);
    await new Promise(resolve => setImmediate(resolve));
  }
  return { ...db, requests, render, find, call, stored, serverRequests };
}

test("Add asks once for Department Role and saves it on the newly created member", async () => {
  const h = componentHarness("components/personnel/AddMemberButton.tsx", { permissionOptions: [], departmentId: "department", currentMemberId: "actor" });
  await h.call(h.find(el => el.type === "button"), "onClick");
  const selector = h.find(el => el.type === DepartmentRoleSelector);
  await h.call(selector, "onChange", roles[1].id);
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.rank, null);
  assert.equal(h.requests[0].body.departmentRoleId, roles[1].id);
  assert.equal(h.state.operations.length, 0, "Add must not call a separate role RPC");
  assert.ok(!h.render().some(el => el.type === DepartmentRoleSelector));
});

test("Add atomic failure remains on the basic form and retries the complete operation", async () => {
  const h = componentHarness("components/personnel/AddMemberButton.tsx", { permissionOptions: [], departmentId: "department", currentMemberId: "actor" });
  await h.call(h.find(el => el.type === "button"), "onClick");
  h.state.createError = "Role assignment failed; transaction rolled back";
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests.length, 1);
  assert.ok(h.render().some(el => typeof el.props.children === "string" && el.props.children.includes("transaction rolled back")));
  h.state.createError = "";
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[0].body.requestId, h.requests[1].body.requestId);
  assert.match(String(h.requests[0].body.requestId), /^[0-9a-f-]{36}$/);
  assert.equal(h.state.operations.length, 0);
  assert.ok(!h.render().some(el => el.type === DepartmentRoleSelector));
});

test("Add retains hidden request UUID after timeout; a separate draft receives a new UUID", async () => {
  const h = componentHarness("components/personnel/AddMemberButton.tsx", {
    permissionOptions: [], departmentId: "department", currentMemberId: "actor",
  });
  await h.call(h.find(el => el.type === "button"), "onClick");
  h.state.transportFailure = true;
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  const requestId = h.requests[0].body.requestId;
  assert.match(String(requestId), /^[0-9a-f-]{36}$/);
  assert.ok(!h.render().some(el => String(el.props.children).includes(String(requestId))));
  h.state.transportFailure = false;
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests[1].body.requestId, requestId);
  await h.call(h.find(el => el.type === "button" && el.props.children === "Finish Later"), "onClick");
  await h.call(h.find(el => el.type === "button"), "onClick");
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.notEqual(h.requests[2].body.requestId, requestId);
});

test("Add API rejects absent or invalid internal request IDs before mutation", async () => {
  const h = createHarness();
  for (const requestId of [null, undefined, "invalid", 123]) {
    assert.equal((await h.create({ requestId })).status, 400);
  }
  assert.equal(h.state.operations.length, 0);
});

test("Pending submission survives timeout/reload and close/reopen, then clears only on success", async () => {
  const props = { permissionOptions: [], departmentId: "department", currentMemberId: "actor" };
  const first = componentHarness("components/personnel/AddMemberButton.tsx", props);
  await first.call(first.find(el => el.type === "button"), "onClick");
  await first.call(first.find(el => el.type === DepartmentRoleSelector), "onChange", roles[1].id);
  first.state.transportFailure = true;
  await first.call(first.find(el => el.type === "form"), "onSubmit");
  assert.equal(first.stored.size, 1);
  const request = first.requests[0].body;

  assert.equal(first.serverRequests.size, 1, "Simulated server created member before response timeout");
  const reloaded = componentHarness("components/personnel/AddMemberButton.tsx", props, first.stored, first.serverRequests);
  await reloaded.call(reloaded.find(el => el.type === "button"), "onClick");
  assert.equal(reloaded.find(el => el.type === DepartmentRoleSelector).props.selectedRoleId, roles[1].id);
  reloaded.state.transportFailure = true;
  await reloaded.call(reloaded.find(el => el.type === "form"), "onSubmit");
  assert.deepEqual(reloaded.requests[0].body, request);
  await reloaded.call(reloaded.find(el => el.type === "button" && el.props.children === "Cancel"), "onClick");
  assert.equal(first.stored.size, 1);
  await reloaded.call(reloaded.find(el => el.type === "button"), "onClick");
  await reloaded.call(reloaded.find(el => el.type === DepartmentRoleSelector), "onChange", roles[2].id);
  await reloaded.call(reloaded.find(el => el.type === "form"), "onSubmit");
  assert.equal(reloaded.requests.length, 1, "Changed pending form must not send a request");
  assert.equal(first.stored.size, 1);
  await reloaded.call(reloaded.find(el => el.type === "button" && el.props.children === "Cancel"), "onClick");
  await reloaded.call(reloaded.find(el => el.type === "button"), "onClick");
  reloaded.state.transportFailure = false;
  await reloaded.call(reloaded.find(el => el.type === "form"), "onSubmit");
  assert.deepEqual(reloaded.requests[1].body, request);
  assert.equal(first.stored.size, 0, "Server-confirmed success must clear pending storage");
  assert.equal(first.serverRequests.size, 1, "Reload and retries reuse only the original server submission");
  await reloaded.call(reloaded.find(el => el.type === "button" && el.props.children === "Finish Later"), "onClick");
  await reloaded.call(reloaded.find(el => el.type === "button"), "onClick");
  await reloaded.call(reloaded.find(el => el.type === "form"), "onSubmit");
  assert.notEqual(reloaded.requests[2].body.requestId, request.requestId);
});

test("Pending browser submission is isolated by department and administrator", async () => {
  const first = componentHarness("components/personnel/AddMemberButton.tsx", {
    permissionOptions: [], departmentId: "department", currentMemberId: "actor",
  });
  await first.call(first.find(el => el.type === "button"), "onClick");
  first.state.transportFailure = true;
  await first.call(first.find(el => el.type === "form"), "onSubmit");
  for (const props of [
    { departmentId: "other-department", currentMemberId: "actor" },
    { departmentId: "department", currentMemberId: "other-actor" },
  ]) {
    const other = componentHarness("components/personnel/AddMemberButton.tsx", { permissionOptions: [], ...props }, first.stored);
    await other.call(other.find(el => el.type === "button"), "onClick");
    await other.call(other.find(el => el.type === "form"), "onSubmit");
    assert.notEqual(other.requests[0].body.requestId, first.requests[0].body.requestId);
    assert.equal(first.stored.size, 1, "Other contexts must not clear original pending submission");
  }
});

test("Invalid pending browser storage blocks creation and preserves recovery information", async () => {
  const stored = new Map([["redline:add-member:department:actor", '{"requestId":"invalid"}']]);
  const h = componentHarness("components/personnel/AddMemberButton.tsx", {
    permissionOptions: [], departmentId: "department", currentMemberId: "actor",
  }, stored);
  await h.call(h.find(el => el.type === "button"), "onClick");
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests.length, 0);
  assert.equal(stored.size, 1);
});

test("Add never creates a member when department-role configuration fails", async () => {
  const h = componentHarness("components/personnel/AddMemberButton.tsx", { permissionOptions: [], departmentId: "department", currentMemberId: "actor" });
  h.state.rolesError = "Role configuration unavailable";
  await h.call(h.find(el => el.type === "button"), "onClick");
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests.length, 0);
  assert.equal(h.state.operations.length, 0);
});

test("Add permits an explicitly unassigned member without inventing a Department Role", async () => {
  const h = componentHarness("components/personnel/AddMemberButton.tsx", { permissionOptions: [], departmentId: "department", currentMemberId: "actor" });
  await h.call(h.find(el => el.type === "button"), "onClick");
  await h.call(h.find(el => el.type === DepartmentRoleSelector), "onChange", "");
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.departmentRoleId, null);
  assert.equal(h.state.operations.length, 0);
});

test("Personnel search uses Department Role, never hidden legacy rank", async () => {
  const h = componentHarness("components/personnel/PersonnelMembersTable.tsx", {
    members: [{
      id: memberId, first_name: "Chris", last_name: "Cashatt", active: true,
      rank: "Driver Operator", department_role_name: "Battalion Chief", role_requirement_label: "Complete",
    }],
  });
  await h.call(h.find(el => el.type === "input"), "onChange", { target: { value: "Driver Operator" } });
  assert.ok(h.render().some(el => el.type === "td" && el.props.colSpan === 4));
  await h.call(h.find(el => el.type === "input"), "onChange", { target: { value: "Battalion Chief" } });
  assert.ok(!h.render().some(el => el.type === "td" && el.props.colSpan === 4));
});

test("Edit opens with the assigned Department Role and sends no legacy-rank input", async () => {
  const h = componentHarness("components/personnel/EditMemberButton.tsx", {
    memberId, initialFirstName: "Chris", initialLastName: "Cashatt", initialEmail: "", initialPhone: "",
    initialDepartmentRoleId: roleId, departmentRoles: roles, initialActive: true,
    initialHireStartDate: "", initialInactiveDate: "", initialSpecialPermissionsEnabled: false,
    initialPermissionKeys: [], permissionOptions: [],
  });
  await h.call(h.find(el => el.type === "button"), "onClick");
  assert.equal(h.find(el => el.type === DepartmentRoleSelector).props.selectedRoleId, roleId);
  await h.call(h.find(el => el.type === DepartmentRoleSelector), "onChange", roles[4].id);
  await h.call(h.find(el => el.type === "form"), "onSubmit");
  assert.equal(h.requests[0].body.departmentRoleId, roles[4].id);
  assert.equal("rank" in h.requests[0].body, false);
});
