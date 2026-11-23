import test, { before } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

let member: { memberId: string; departmentId: string } | null = { memberId: "member", departmentId: "a" };
let permission: boolean | null = true;
let permissionError = false;
const sessions = [{ id: "session-a", department_id: "a" }, { id: "session-b", department_id: "b" }];
const client = {
  from() {
    const filters: Array<[string, string]> = [];
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: sessions.find((row) => filters.every(([key, value]) => row[key as keyof typeof row] === value)) ?? null, error: null }),
    };
    return query;
  },
  rpc: async (name: string, args: { p_department_id: string; p_permission_key: string }) => {
    assert.equal(name, "member_has_inventory_permission");
    assert.equal(args.p_department_id, "a");
    assert.equal(args.p_permission_key, "scba_cylinder_inspection_testing");
    return { data: permission, error: permissionError ? { message: "permission check failed" } : null };
  },
};
let hydroActor: (sessionId: string) => Promise<unknown>;

before(async () => {
  const internal = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown };
  const original = internal._load;
  const stubs: Record<string, unknown> = {
    "@/lib/pump-tests/access": { getActiveDepartmentMember: async () => member },
    "@/lib/supabase-server": { createSupabaseServerClient: async () => client },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => ({}) },
  };
  internal._load = (name, ...args) => name in stubs ? stubs[name] : original.call(Module, name, ...args);
  ({ hydroActor } = await import("./access"));
  internal._load = original;
});

test("attachment access checks selected department, active membership and testing permission", async () => {
  member = { memberId: "member", departmentId: "a" };
  permission = true;
  assert.ok(await hydroActor("session-a"));
  assert.equal(await hydroActor("session-b"), null);
  permission = false;
  assert.equal(await hydroActor("session-a"), null);
  permission = null;
  assert.equal(await hydroActor("session-a"), null);
  member = null;
  assert.equal(await hydroActor("session-a"), null);
});

test("permission lookup errors are not treated as authorization", async () => {
  member = { memberId: "member", departmentId: "a" };
  permissionError = true;
  await assert.rejects(() => hydroActor("session-a"), /permission check failed/);
  permissionError = false;
});
