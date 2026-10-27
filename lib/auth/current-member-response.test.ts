import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildCurrentMemberResponse } from "./current-member-response";
import type { CurrentMember } from "@/lib/current-member";

/**
 * Multi-department isolation tests for the /api/auth/current-member route
 * logic (extracted as buildCurrentMemberResponse).
 *
 * Scenario: one founder auth user holds memberships in two departments —
 * Elliott (firefighter, no management permissions) and Red Oak (administrator,
 * both management permissions). The route must return only the membership and
 * permissions of the ACTIVE department resolved server-side, never a guess
 * among multiple member rows.
 */

const ELLIOTT = "dep-elliott";
const RED_OAK = "dep-red-oak";

type Row = Record<string, unknown>;

type MockConfig = {
  members?: Row[];
  departments?: Row[];
  memberError?: { message: string } | null;
  /** permission result per department id */
  permissionsByDepartment?: Record<string, boolean>;
};

function createSupabaseMock(config: MockConfig = {}) {
  const memberEqCalls: Array<{ column: string; value: unknown }> = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let memberQueries = 0;

  class MaybeSingleBuilder {
    private readonly rows: Row[];
    private readonly error: { message: string } | null;
    private readonly appliedFilters: Array<{ column: string; value: unknown }> = [];

    constructor(tableName: string, rows: Row[], error: { message: string } | null) {
      if (tableName === "members") {
        memberQueries += 1;
      }
      this.rows = rows;
      this.error = error;
    }

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      this.appliedFilters.push({ column, value });
      if (this.rows === config.members) {
        memberEqCalls.push({ column, value });
      }
      return this;
    }

    async maybeSingle() {
      if (this.error) {
        return { data: null, error: this.error };
      }

      const match = this.rows.find((row) =>
        this.appliedFilters.every((filter) => row[filter.column] === filter.value),
      );
      return { data: match ?? null, error: null };
    }
  }

  return {
    client: {
      from(tableName: string) {
        if (tableName === "members") {
          return new MaybeSingleBuilder(tableName, config.members ?? [], config.memberError ?? null);
        }
        if (tableName === "departments") {
          return new MaybeSingleBuilder(tableName, config.departments ?? [], null);
        }
        return new MaybeSingleBuilder(tableName, [], null);
      },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        const departmentId = typeof args.p_department_id === "string" ? args.p_department_id : "";
        const allowed = config.permissionsByDepartment?.[departmentId] ?? false;
        return { data: allowed, error: null };
      },
    } as unknown as SupabaseClient,
    getMemberEqCalls: () => memberEqCalls,
    getRpcCalls: () => rpcCalls,
    getMemberQueries: () => memberQueries,
  };
}

const elliottMemberRow: Row = {
  id: "member-elliott",
  department_id: ELLIOTT,
  first_name: "Adam",
  last_name: "Smith",
  email: "adam@example.com",
  rank: "Firefighter",
  role: "firefighter",
  department_role_id: "role-elliott-ff",
};

const redOakMemberRow: Row = {
  id: "member-redoak",
  department_id: RED_OAK,
  first_name: "Adam",
  last_name: "Smith",
  email: "adam@example.com",
  rank: null,
  role: "administrator",
  department_role_id: "role-redoak-admin",
};

function twoDepartmentConfig(overrides: Partial<MockConfig> = {}): MockConfig {
  return {
    members: [elliottMemberRow, redOakMemberRow],
    departments: [
      { id: ELLIOTT, name: "Elliott Volunteer Fire Department" },
      { id: RED_OAK, name: "Red Oak Fire Department" },
    ],
    permissionsByDepartment: {
      [ELLIOTT]: false,
      [RED_OAK]: true,
    },
    ...overrides,
  };
}

function currentMemberFor(memberId: string, departmentId: string, role: CurrentMember["role"]): CurrentMember {
  return { id: memberId, departmentId, name: "Adam Smith", role };
}

test("CMISO1. unauthenticated request returns 401 without querying", async () => {
  const mock = createSupabaseMock(twoDepartmentConfig());

  const result = await buildCurrentMemberResponse(mock.client, null);

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Not authenticated." });
  assert.equal(mock.getMemberQueries(), 0);
  assert.equal(mock.getRpcCalls().length, 0);
});

test("CMISO2. active department Red Oak returns only the Red Oak membership and permissions", async () => {
  const mock = createSupabaseMock(twoDepartmentConfig());

  const result = await buildCurrentMemberResponse(
    mock.client,
    currentMemberFor("member-redoak", RED_OAK, "administrator"),
  );

  assert.equal(result.status, 200);
  assert.ok(result.body.ok);
  if (!result.body.ok) {
    return;
  }

  assert.equal(result.body.member.id, "member-redoak");
  assert.equal(result.body.member.department_id, RED_OAK);
  assert.equal(result.body.member.role, "administrator");
  assert.equal(result.body.member.department_role_id, "role-redoak-admin");
  assert.deepEqual(result.body.department, { id: RED_OAK, name: "Red Oak Fire Department" });
  assert.deepEqual(result.body.permissions, { personnel_management: true, reports_management: true });

  // Permission checks must be scoped to the active department only.
  assert.ok(mock.getRpcCalls().every((call) => call.args.p_department_id === RED_OAK));

  // The member row must be resolved by exact member id, never by auth_user_id
  // (ambiguous for multi-department users — the original role bug).
  assert.ok(mock.getMemberEqCalls().some((call) => call.column === "id" && call.value === "member-redoak"));
  assert.ok(!mock.getMemberEqCalls().some((call) => call.column === "auth_user_id"));
});

test("CMISO3. active department Elliott returns only the Elliott membership and permissions", async () => {
  const mock = createSupabaseMock(twoDepartmentConfig());

  const result = await buildCurrentMemberResponse(
    mock.client,
    currentMemberFor("member-elliott", ELLIOTT, "firefighter"),
  );

  assert.equal(result.status, 200);
  assert.ok(result.body.ok);
  if (!result.body.ok) {
    return;
  }

  assert.equal(result.body.member.id, "member-elliott");
  assert.equal(result.body.member.department_id, ELLIOTT);
  assert.equal(result.body.member.role, "firefighter");
  assert.deepEqual(result.body.department, { id: ELLIOTT, name: "Elliott Volunteer Fire Department" });
  assert.deepEqual(result.body.permissions, { personnel_management: false, reports_management: false });

  assert.ok(mock.getRpcCalls().every((call) => call.args.p_department_id === ELLIOTT));
  assert.ok(mock.getMemberEqCalls().some((call) => call.column === "id" && call.value === "member-elliott"));
});

test("CMISO4. member lookup failure returns 400", async () => {
  const mock = createSupabaseMock(twoDepartmentConfig({ memberError: { message: "db error" } }));

  const result = await buildCurrentMemberResponse(
    mock.client,
    currentMemberFor("member-redoak", RED_OAK, "administrator"),
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { ok: false, error: "Unable to load member profile." });
});

test("CMISO5. missing member row falls back to the resolved current-member identity", async () => {
  const mock = createSupabaseMock(twoDepartmentConfig({ members: [] }));

  const result = await buildCurrentMemberResponse(
    mock.client,
    currentMemberFor("member-redoak", RED_OAK, "administrator"),
  );

  assert.equal(result.status, 200);
  assert.ok(result.body.ok);
  if (!result.body.ok) {
    return;
  }

  assert.equal(result.body.member.id, "member-redoak");
  assert.equal(result.body.member.department_id, RED_OAK);
  assert.equal(result.body.member.role, "administrator");
  assert.equal(result.body.member.name, "Adam Smith");
});

test("CMISO6. resolved member without a department returns no permissions and skips permission checks", async () => {
  const mock = createSupabaseMock(twoDepartmentConfig());

  const currentMember: CurrentMember = { id: "member-redoak", departmentId: null, name: "Adam Smith", role: "administrator" };
  const result = await buildCurrentMemberResponse(mock.client, currentMember);

  assert.equal(result.status, 200);
  assert.ok(result.body.ok);
  if (!result.body.ok) {
    return;
  }

  assert.deepEqual(result.body.permissions, { personnel_management: false, reports_management: false });
  assert.equal(result.body.department, null);
  assert.equal(mock.getRpcCalls().length, 0);
});
