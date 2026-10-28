import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

type Row = Record<string, unknown>;

const DEPT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const DEPT_B = "bbbbbbbb-0000-0000-0000-000000000002";

const db: { members: Row[]; apparatus: Row[]; deficiencies: Row[] } = { members: [], apparatus: [], deficiencies: [] };
const adminLog: { maintenanceInserts: Row[]; historyInserts: Row[]; deletes: string[]; uploads: string[] } = {
  maintenanceInserts: [],
  historyInserts: [],
  deletes: [],
  uploads: [],
};
let currentMember: { id: string; departmentId: string | null; name: string; role: string } | null = null;
let permissionGrants: string[] = [];
const rpcCalls: string[] = [];

function userClient() {
  return {
    from(table: keyof typeof db) {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({
          data: db[table].find((row) => filters.every(([column, value]) => row[column] === value)) ?? null,
          error: null,
        }),
      };
      return builder;
    },
    rpc: async (_name: string, args: { p_permission_key: string; p_department_id: string }) => {
      rpcCalls.push(args.p_permission_key);
      return { data: permissionGrants.includes(args.p_permission_key) && args.p_department_id === DEPT_A, error: null };
    },
  };
}

function adminClient() {
  return {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          adminLog.uploads.push(path);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
    from(table: string) {
      if (table === "maintenance_records") {
        return {
          insert: async (row: Row) => {
            adminLog.maintenanceInserts.push(row);
            return { error: null };
          },
          update: () => {
            const chain = {
              eq: () => chain,
              select: () => chain,
              single: async () => {
                const inserted = adminLog.maintenanceInserts[adminLog.maintenanceInserts.length - 1];
                return {
                  data: {
                    id: inserted.id,
                    maintenance_number: "MT-2026-0001",
                    deficiency_id: inserted.deficiency_id,
                  },
                  error: null,
                };
              },
            };
            return chain;
          },
          delete: () => ({
            eq: async (_column: string, id: string) => {
              adminLog.deletes.push(id);
              return { error: null };
            },
          }),
        };
      }
      if (table === "deficiency_history") {
        return {
          insert: async (row: Row) => {
            adminLog.historyInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected admin table ${table}`);
    },
  };
}

let POST: (request: Request) => Promise<Response>;

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

  // Stub the route's auth and Supabase dependencies at require time; no real client is ever created.
  const moduleInternals = Module as unknown as {
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const originalLoad = moduleInternals._load;
  const stubs: Record<string, unknown> = {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => userClient() },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => adminClient() },
    "@/lib/current-member": { getCurrentMember: async () => currentMember },
  };
  moduleInternals._load = (request, ...rest) =>
    request in stubs ? stubs[request] : originalLoad.call(Module, request, ...rest);

  ({ POST } = await import("@/app/api/maintenance/records/route"));
});

beforeEach(() => {
  db.members = [
    { id: "m-firefighter", department_id: DEPT_A, active: true },
    { id: "m-peer", department_id: DEPT_A, active: true },
    { id: "m-inactive", department_id: DEPT_A, active: false },
    { id: "m-other-dept", department_id: DEPT_B, active: true },
  ];
  db.apparatus = [
    { id: "app-a", department_id: DEPT_A },
    { id: "app-b", department_id: DEPT_B },
  ];
  db.deficiencies = [
    { id: "def-a", department_id: DEPT_A },
    { id: "def-b", department_id: DEPT_B },
  ];
  adminLog.maintenanceInserts = [];
  adminLog.historyInserts = [];
  adminLog.deletes = [];
  adminLog.uploads = [];
  rpcCalls.length = 0;
  permissionGrants = [];
  currentMember = { id: "m-firefighter", departmentId: DEPT_A, name: "Test", role: "firefighter" };
});

function validPayload(overrides: Row = {}): Row {
  return {
    apparatus_id: "app-a",
    deficiency_id: null,
    maintenance_type: "Oil Change",
    completed_by: null,
    service_date: "2026-10-28T12:00:00.000Z",
    description: "Changed oil",
    parts_used: null,
    labor_hours: 1.5,
    mileage: 1000,
    engine_hours: null,
    cost: 25,
    notes: null,
    ...overrides,
  };
}

function post(payload: Row, files: Array<{ field: string; file: File }> = []) {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  for (const { field, file } of files) formData.append(field, file);
  return POST(new Request("http://localhost/api/maintenance/records", { method: "POST", body: formData }));
}

test("ordinary active member can create a record with no special permission", async () => {
  const response = await post(validPayload());
  const body = (await response.json()) as { ok: boolean; record: { id: string } };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(adminLog.maintenanceInserts.length, 1);
  assert.equal(adminLog.maintenanceInserts[0].department_id, DEPT_A);
  assert.equal(adminLog.maintenanceInserts[0].id, body.record.id);
});

test("unauthenticated request is rejected without writing", async () => {
  currentMember = null;
  const response = await post(validPayload());

  assert.equal(response.status, 401);
  assert.equal(adminLog.maintenanceInserts.length, 0);
});

test("member with no department is rejected", async () => {
  currentMember = { id: "m-firefighter", departmentId: null, name: "x", role: "firefighter" };
  const response = await post(validPayload());

  assert.equal(response.status, 401);
  assert.equal(adminLog.maintenanceInserts.length, 0);
});

test("inactive member is rejected without writing", async () => {
  currentMember = { id: "m-inactive", departmentId: DEPT_A, name: "x", role: "firefighter" };
  const response = await post(validPayload());

  assert.equal(response.status, 401);
  assert.equal(adminLog.maintenanceInserts.length, 0);
});

test("apparatus from another department is rejected", async () => {
  const response = await post(validPayload({ apparatus_id: "app-b" }));

  assert.equal(response.status, 400);
  assert.equal(adminLog.maintenanceInserts.length, 0);
});

test("deficiency from another department is rejected", async () => {
  const response = await post(validPayload({ deficiency_id: "def-b" }));

  assert.equal(response.status, 400);
  assert.equal(adminLog.maintenanceInserts.length, 0);
  assert.equal(adminLog.historyInserts.length, 0);
});

test("completed_by from another department is rejected for a manager", async () => {
  permissionGrants = ["maintenance_management"];
  const response = await post(validPayload({ completed_by: "m-other-dept" }));

  assert.equal(response.status, 400);
  assert.equal(adminLog.maintenanceInserts.length, 0);
});

test("protected client fields cannot override server-controlled values", async () => {
  const response = await post(
    validPayload({
      id: "forged-id",
      department_id: DEPT_B,
      maintenance_number: "MT-FORGED-0001",
      created_at: "2000-01-01T00:00:00.000Z",
      updated_at: "2000-01-01T00:00:00.000Z",
      photos: ["forged/photo.png"],
      attachments: ["forged/file.pdf"],
    }),
  );
  const body = (await response.json()) as { record: { id: string } };

  assert.equal(response.status, 200);
  const inserted = adminLog.maintenanceInserts[0];
  assert.equal(inserted.department_id, DEPT_A);
  assert.notEqual(inserted.id, "forged-id");
  assert.equal(inserted.id, body.record.id);
  assert.deepEqual(inserted.photos, []);
  assert.deepEqual(inserted.attachments, []);
  for (const key of ["maintenance_number", "created_at", "updated_at"]) {
    assert.equal(key in inserted, false, `${key} must not be sent to the database`);
  }
});

test("non-management member cannot record another member as the completer", async () => {
  const response = await post(validPayload({ completed_by: "m-peer" }));

  assert.equal(response.status, 200);
  assert.equal(adminLog.maintenanceInserts[0].completed_by, "m-firefighter");
});

test("management member may record another member from the same department", async () => {
  permissionGrants = ["maintenance_management"];
  const response = await post(validPayload({ completed_by: "m-peer" }));

  assert.equal(response.status, 200);
  assert.equal(adminLog.maintenanceInserts[0].completed_by, "m-peer");
});

test("linked deficiency writes one history entry for the correct deficiency and member", async () => {
  const response = await post(validPayload({ deficiency_id: "def-a", completed_by: "m-peer" }));

  assert.equal(response.status, 200);
  assert.equal(adminLog.historyInserts.length, 1);
  assert.deepEqual(adminLog.historyInserts[0], {
    deficiency_id: "def-a",
    event_type: "Maintenance",
    event_description: "Linked Maintenance Record created (MT-2026-0001).",
    member_id: "m-firefighter",
  });
});

test("no history entry is written when no deficiency is linked", async () => {
  const response = await post(validPayload());

  assert.equal(response.status, 200);
  assert.equal(adminLog.historyInserts.length, 0);
});

test("uploads are stored under the server-derived department", async () => {
  const response = await post(validPayload({ department_id: DEPT_B }), [
    { field: "photos", file: new File(["x"], "p.png", { type: "image/png" }) },
  ]);

  assert.equal(response.status, 200);
  assert.equal(adminLog.uploads.length, 1);
  assert.ok(adminLog.uploads[0].startsWith(`${DEPT_A}/maintenance/`));
});

test("neither maintenance_management nor maintenance_field_entry is required to create", async () => {
  const response = await post(validPayload());

  assert.equal(response.status, 200);
  assert.ok(!rpcCalls.includes("maintenance_field_entry"));
});

test("maintenance management stays limited to administrators or an explicit grant", async () => {
  const { hasDepartmentPermission } = await import("@/lib/member-permissions");
  const client = userClient() as unknown as Parameters<typeof hasDepartmentPermission>[0];

  assert.equal(await hasDepartmentPermission(client, DEPT_A, "firefighter", "maintenance_management"), false);
  assert.equal(await hasDepartmentPermission(client, DEPT_B, "firefighter", "maintenance_management"), false);
  assert.equal(await hasDepartmentPermission(client, DEPT_A, "administrator", "maintenance_management"), true);

  permissionGrants = ["maintenance_management"];
  assert.equal(await hasDepartmentPermission(client, DEPT_A, "firefighter", "maintenance_management"), true);
  assert.equal(await hasDepartmentPermission(client, DEPT_B, "firefighter", "maintenance_management"), false);
});
