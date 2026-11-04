import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import React, { type ReactElement, type ReactNode } from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../", import.meta.url));
const redOak = "82f50d14-216a-4dd1-80f4-58459dc97b97";
const cedar = "44a25960-7d46-45c4-94e9-115833072da8";
const memberId = "20000000-0000-4000-8000-000000000001";
const cookieName = "redline_active_department_id";

function load(file: string, overrides: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const compiled = ts.transpileModule(readFileSync(root + file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const target = { exports: {} as Record<string, unknown> };
  runInNewContext(`(function(require,module,exports){${compiled}\n})`, { console, process, Error, ...globals })(
    (name: string) => name in overrides ? overrides[name] : require(name.startsWith("@/") ? root + name.slice(2) : name),
    target, target.exports,
  );
  return target.exports;
}

function harness() {
  const state = {
    user: { id: "cedar-user", email: "cedar@example.invalid" } as { id: string; email: string } | null,
    cookie: redOak,
    failMembership: false,
    operations: [] as Array<{ name: string; payload: Record<string, unknown> }>,
    memberships: [
      { id: "red-admin", auth_user_id: "red-user", department_id: redOak, first_name: "Red", last_name: "Admin", role: "Administrator" },
      { id: "cedar-admin", auth_user_id: "cedar-user", department_id: cedar, first_name: "Cedar", last_name: "Admin", role: "Administrator" },
    ],
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table: string) {
      const filters = new Map<string, unknown>();
      const result = () => {
        const rows: Record<string, unknown>[] = table === "departments"
          ? [{ id: redOak, name: "Red Oak" }, { id: cedar, name: "Cedar Bluff" }]
          : [...state.memberships, { id: memberId, department_id: cedar, rank: null, department_role_id: null }];
        return {
          data: rows.filter(row => [...filters].every(([key, value]) =>
            Array.isArray(value) ? value.includes(row[key]) : row[key] === value)),
          error: state.failMembership && table === "members" ? { message: "Query failed" } : null,
        };
      };
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.set(key, value); return chain; },
        in: (key: string, value: unknown) => { filters.set(key, value); return chain; },
        order: () => chain,
        maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
    async rpc(name: string, payload: Record<string, unknown>) {
      state.operations.push({ name, payload });
      return { data: name.startsWith("member_has_") ? true : memberId, error: null };
    },
  };
  const overrides = {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => client },
    "next/headers": { cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }) },
  };
  const current = load("lib/current-member.ts", overrides);
  const context = load("app/api/auth/current-member/route.ts", { ...overrides, "@/lib/current-member": current });
  const switcher = load("app/api/auth/set-active-department/route.ts", { ...overrides, "@/lib/current-member": current });
  const create = load("app/api/personnel/members/route.ts", { ...overrides, "@/lib/current-member": current }, { Response });
  const edit = load("app/api/personnel/members/[id]/route.ts", { ...overrides, "@/lib/current-member": current }, { Response });
  async function invoke(exports: Record<string, unknown>, method: string, ...args: unknown[]): Promise<Response> {
    const handler = exports[method];
    assert.equal(typeof handler, "function");
    if (typeof handler !== "function") throw new Error("Missing handler");
    const response: Response = await handler(...args);
    const cookie = response.headers.get("set-cookie");
    if (cookie?.startsWith(cookieName + "=")) state.cookie = cookie.split(";")[0].slice(cookieName.length + 1);
    return response;
  }
  return {
    state, client, current,
    get: () => invoke(context, "GET"),
    clear: () => invoke(context, "DELETE"),
    switch: (departmentId: string) => invoke(switcher, "POST", new Request("https://synthetic.invalid/api/auth/set-active-department", {
      method: "POST", body: JSON.stringify({ departmentId }),
    })),
    add: () => invoke(create, "POST", new Request("https://synthetic.invalid/api/personnel/members", {
      method: "POST", body: JSON.stringify({
        firstName: "Synthetic", lastName: "Member", rank: null, departmentRoleId: null,
        requestId: "80000000-0000-4000-8000-000000000001",
      }),
    })),
    edit: () => invoke(edit, "PATCH", new Request("https://synthetic.invalid/api/personnel/members/" + memberId, {
      method: "PATCH", body: JSON.stringify({ firstName: "Synthetic", lastName: "Member", active: true, departmentRoleId: null }),
    }), { params: Promise.resolve({ id: memberId }) }),
  };
}

test("Cedar sign-in reconciles a Red Oak cookie; strict Add and Edit target Cedar only", async () => {
  const h = harness();
  assert.equal((await h.add()).status, 401);
  assert.equal((await h.edit()).status, 401);
  assert.equal(h.state.operations.length, 0);
  const response = await h.get();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).department.id, cedar);
  assert.equal(h.state.cookie, cedar);
  h.state.operations.length = 0;
  assert.equal((await h.add()).status, 200);
  assert.equal((await h.edit()).status, 200);
  assert.ok(h.state.operations.length > 0);
  assert.ok(h.state.operations.every(operation => operation.payload.p_department_id === cedar));
});

test("sign-out expires the httpOnly cookie; subsequent account selects its sole department", async () => {
  const h = harness();
  const response = await h.clear();
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  assert.equal(h.state.cookie, "");
  h.state.user = { id: "red-user", email: "red@example.invalid" };
  assert.equal((await h.get()).status, 200);
  assert.equal(h.state.cookie, redOak);
});

test("sole membership is selected with no saved cookie", async () => {
  const h = harness();
  h.state.cookie = "";
  assert.equal((await h.get()).status, 200);
  assert.equal(h.state.cookie, cedar);
});

test("multiple memberships preserve a verified saved selection and switching refreshes it", async () => {
  const h = harness();
  h.state.memberships[0].auth_user_id = "cedar-user";
  assert.equal((await h.get()).status, 200);
  assert.equal(h.state.cookie, redOak);
  assert.equal((await h.switch(cedar)).status, 200);
  const response = await h.get();
  assert.equal((await response.json()).department.id, cedar);
  assert.equal(h.state.cookie, cedar);
});

for (const saved of ["foreign-department", ""]) {
  test(`multiple memberships require selection for ${saved || "missing"} cookie; no fallback writes`, async () => {
    const h = harness();
    h.state.memberships[0].auth_user_id = "cedar-user";
    h.state.cookie = saved;
    const response = await h.get();
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.selectionRequired, true);
    assert.deepEqual(body.departments.map((department: { id: string }) => department.id).sort(), [redOak, cedar].sort());
    assert.equal(h.state.cookie, "");
    assert.equal((await h.add()).status, 401);
    assert.equal((await h.edit()).status, 401);
    assert.equal(h.state.operations.length, 0);
    assert.equal((await h.switch(cedar)).status, 200);
    assert.equal((await h.get()).status, 200);
    assert.equal((await h.add()).status, 200);
  });
}

test("foreign department switch is denied without changing the cookie; unauthenticated access is denied", async () => {
  const h = harness();
  h.state.cookie = cedar;
  assert.equal((await h.switch(redOak)).status, 403);
  assert.equal(h.state.cookie, cedar);
  h.state.user = null;
  assert.equal((await h.switch(cedar)).status, 401);
  assert.equal((await h.get()).status, 401);
  assert.equal(h.state.cookie, "");
  assert.equal((await h.add()).status, 401);
  assert.equal((await h.edit()).status, 401);
  assert.equal(h.state.operations.length, 0);
});

test("membership query failure is explicit and never overwrites the selection", async () => {
  const h = harness();
  h.state.failMembership = true;
  const response = await h.get();
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /verify department memberships/);
  assert.equal(h.state.cookie, redOak);
  assert.equal((await h.switch(cedar)).status, 400);
});

type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...descendants(node.props.children as ReactNode)];
}

function providerHarness(h: ReturnType<typeof harness>) {
  const values: unknown[] = [];
  let slot = 0;
  const events: string[] = [];
  const exports = load("components/auth/AuthProvider.tsx", {
    react: {
      ...React,
      useEffect: () => {},
      useMemo: (factory: () => unknown) => factory(),
      useRef: (initial: unknown) => {
        const index = slot++;
        if (!(index in values)) values[index] = { current: initial };
        return values[index];
      },
      useState: (initial: unknown) => {
        const index = slot++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (value: unknown) => { values[index] = value; }];
      },
    },
    "next/navigation": { useRouter: () => ({ refresh: () => { events.push("refresh"); }, replace: () => {} }) },
    "@/lib/supabase": { supabase: { auth: {
      signInWithPassword: async () => ({ data: { session: { user: h.state.user }, user: h.state.user }, error: null }),
      signOut: async () => { events.push("auth-sign-out"); return { error: null }; },
      getUser: h.client.auth.getUser,
      getSession: async () => ({ data: { session: { user: h.state.user } } }),
    } } },
  }, { AbortController, fetch: async (url: string, options?: { method?: string; body?: string }) => {
    events.push(options?.method ?? "GET");
    return url.endsWith("set-active-department")
      ? h.switch(JSON.parse(options?.body ?? "{}").departmentId)
      : options?.method === "DELETE" ? h.clear() : h.get();
  } });
  function render() {
    slot = 0;
    const component = exports.default;
    if (typeof component !== "function") throw new Error("Missing provider");
    return descendants(component({ children: React.createElement("div", { id: "app" }) }));
  }
  function context() {
    const value = render()[0].props.value;
    assert.ok(value && typeof value === "object");
    return value as {
      department: { id: string } | null;
      signInWithPassword: (credentials: { email: string; password: string }) => Promise<{ error: Error | null }>;
      signOut: () => Promise<{ error: Error | null }>;
      refreshSession: () => Promise<void>;
    };
  }
  return { render, context, events };
}

test("actual AuthProvider sign-in reconciles before returning; sign-out clears before Supabase logout", async () => {
  const h = harness();
  const p = providerHarness(h);
  assert.equal((await p.context().signInWithPassword({ email: "synthetic", password: "synthetic" })).error, null);
  assert.equal(h.state.cookie, cedar);
  assert.equal(p.context().department?.id, cedar);
  assert.equal((await p.context().signOut()).error, null);
  assert.equal(h.state.cookie, "");
  assert.ok(p.events.indexOf("DELETE") < p.events.indexOf("auth-sign-out"));
  h.state.user = { id: "red-user", email: "red@example.invalid" };
  await p.context().signInWithPassword({ email: "synthetic", password: "synthetic" });
  assert.equal(h.state.cookie, redOak);
  assert.equal(p.context().department?.id, redOak);
});

test("actual AuthProvider blocks application behind explicit multi-department selection", async () => {
  const h = harness();
  h.state.memberships[0].auth_user_id = "cedar-user";
  h.state.cookie = "foreign";
  const p = providerHarness(h);
  await p.context().signInWithPassword({ email: "synthetic", password: "synthetic" });
  const elements = p.render();
  assert.ok(elements.some(element => element.props.children === "Select Department"));
  assert.ok(!elements.some(element => element.props.id === "app"));
  assert.equal(p.context().department, null);
  const button = elements.find(element => element.type === "button" && element.props.children === "Cedar Bluff");
  assert.ok(button);
  const click = button.props.onClick;
  assert.ok(typeof click === "function");
  click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.cookie, cedar);
  assert.equal(p.context().department?.id, cedar);
  assert.ok(p.render().some(element => element.props.id === "app"));
  assert.ok(p.events.includes("refresh"));
});

test("shared client member hook follows department switches and sign-out instead of caching initial membership", async () => {
  const h = harness();
  const p = providerHarness(h);
  const hook = load("lib/use-active-member.ts", {
    react: { useMemo: (factory: () => unknown) => factory() },
    "@/components/auth/AuthProvider": { useAuth: p.context },
  }).useActiveMember;
  assert.ok(typeof hook === "function");
  await p.context().signInWithPassword({ email: "synthetic", password: "synthetic" });
  assert.equal(hook().member.departmentId, cedar);
  h.state.memberships[0].auth_user_id = "cedar-user";
  await h.switch(redOak);
  await p.context().refreshSession();
  assert.equal(hook().member.departmentId, redOak);
  assert.equal(hook().member.name, "Red Admin");
  assert.equal(hook().member.role, "Administrator");
  await p.context().signOut();
  assert.equal(hook().member, null);
});
