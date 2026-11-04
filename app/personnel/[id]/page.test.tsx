import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

type Row = Record<string, unknown>;
type Fixture = {
  departmentId?: string;
  assignedRoleId?: string | null;
  legacyRank?: string | null;
  roles?: Row[];
  memberDepartmentId?: string;
  rolesError?: string;
  manager?: boolean;
  self?: boolean;
};

async function renderProfile(fixture: Fixture = {}) {
  const departmentId = fixture.departmentId ?? "red-oak";
  const memberId = fixture.self ? "actor" : "person";
  const member = {
    id: memberId, department_id: fixture.memberDepartmentId ?? departmentId,
    first_name: "Chris", last_name: "Cashatt", rank: fixture.legacyRank ?? null,
    department_role_id: fixture.assignedRoleId ?? null, active: true,
  };
  const queries: Array<{ table: string; filters: Map<string, unknown> }> = [];
  function query(table: string) {
    const filters = new Map<string, unknown>();
    queries.push({ table, filters });
    const result = () => {
      const data = table === "members" ? [member] : table === "department_roles" ? fixture.roles ?? [] : [];
      return {
        data: data.filter(row => [...filters].every(([key, value]) => row[key] === value)),
        error: table === "department_roles" && fixture.rolesError ? { message: fixture.rolesError } : null,
      };
    };
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters.set(key, value); return chain; },
      order: () => chain,
      in: () => chain,
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data[0] ?? null }; },
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return chain;
  }
  const pageModule = { exports: {} as { default: (props: { params: Promise<{ id: string }> }) => Promise<ReactElement> } };
  const load = runInNewContext(`(function(require, module, exports) { ${compiled}\n })`);
  load((name: string) => {
    if (name === "@/lib/supabase-server") return { createSupabaseServerClient: async () => ({ from: query }) };
    if (name === "@/lib/current-member") return {
      getCurrentMember: async () => ({ id: "actor", departmentId, role: "Administrator" }),
    };
    if (name === "@/lib/member-permissions") return {
      canManagePersonnel: async () => fixture.manager !== false,
      hasDepartmentPermission: async () => true,
    };
    if (name === "next/navigation") return {
      redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
      notFound: () => { throw new Error("NOT_FOUND"); },
    };
    if (name === "@/components/layout/PageLayout") return { default: ({ children }: { children: ReactNode }) => children };
    if (name.startsWith("@/components/")) return { default: () => null };
    if (name.startsWith("@/lib/")) return require(`${root}${name.slice(2)}`);
    return require(name);
  }, pageModule, pageModule.exports);
  const html = renderToStaticMarkup(await pageModule.exports.default({ params: Promise.resolve({ id: memberId }) }));
  const subtitle = html.match(/<h1[^>]*>Chris Cashatt<\/h1><p[^>]*>(.*?)<\/p>/)?.[1];
  return { subtitle, queries };
}

for (const role of ["Fire Chief", "Battalion Chief", "Captain", "Firefighter", "Exterior Firefighter"]) {
  test(`profile subtitle uses assigned ${role} instead of legacy rank`, async () => {
    const { subtitle } = await renderProfile({
      assignedRoleId: "assigned", legacyRank: "Driver Operator",
      roles: [{ id: "assigned", name: role, department_id: "red-oak", active: true }],
    });
    assert.equal(subtitle, role);
  });
}

for (const departmentId of ["red-oak", "elliott-fire", "elliott-association", "cedar-bluff"]) {
  test(`profile role lookup is scoped to ${departmentId}`, async () => {
    const { subtitle, queries } = await renderProfile({
      departmentId, assignedRoleId: "assigned",
      roles: [
        { id: "assigned", name: "Captain", department_id: departmentId, active: true },
        { id: "assigned", name: "Foreign role", department_id: "other-department", active: true },
      ],
    });
    assert.equal(subtitle, "Captain");
    assert.equal(queries.find(query => query.table === "department_roles")?.filters.get("department_id"), departmentId);
  });
}

test("genuinely unassigned profile does not fall back to legacy rank", async () => {
  assert.equal((await renderProfile({ legacyRank: "Captain" })).subtitle, "Unassigned");
});

test("unresolvable assignment does not display a foreign department role", async () => {
  assert.equal((await renderProfile({
    assignedRoleId: "foreign",
    roles: [{ id: "foreign", name: "Captain", department_id: "other-department", active: true }],
  })).subtitle, "Unassigned");
});

test("inactive assigned role retains its existing name", async () => {
  assert.equal((await renderProfile({
    assignedRoleId: "assigned",
    roles: [{ id: "assigned", name: "Retired Captain", department_id: "red-oak", active: false }],
  })).subtitle, "Retired Captain");
});

test("self profile displays department role even without personnel-management access", async () => {
  assert.equal((await renderProfile({
    self: true, manager: false, assignedRoleId: "assigned",
    roles: [{ id: "assigned", name: "Firefighter", department_id: "red-oak", active: true }],
  })).subtitle, "Firefighter");
});

test("role-query errors remain explicit rather than displaying Unassigned", async () => {
  await assert.rejects(renderProfile({ rolesError: "Role lookup failed" }), /Role lookup failed/);
});

test("foreign-department member profile remains inaccessible", async () => {
  await assert.rejects(renderProfile({ memberDepartmentId: "other-department" }), /NOT_FOUND/);
});
