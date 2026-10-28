import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

type Row = Record<string, unknown>;
type RouteContext<T> = { params: Promise<T> };

const DEPT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const DEPT_B = "bbbbbbbb-0000-4000-8000-0000000000b2";
const TEST_A = "11111111-0000-4000-8000-0000000000a1";
const TEST_B = "22222222-0000-4000-8000-0000000000b1";
const ATTACHMENT_A = "33333333-0000-4000-8000-0000000000a3";
const ATTACHMENT_B = "44444444-0000-4000-8000-0000000000b4";

const db: Record<string, Row[]> = {};
const log = {
  pumpTestInserts: [] as Row[],
  attachmentInserts: [] as Row[],
  removed: [] as string[],
  signedUploads: [] as string[],
  signedUrls: [] as Array<{ path: string; options: unknown }>,
};
const objects = new Map<string, Uint8Array>();
let currentMember: { id: string; departmentId: string | null; name: string; role: string } | null = null;

function query(table: string) {
  const filters: Array<[string, unknown]> = [];
  const matches = () => (db[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value));
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    },
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    then: (resolve: (value: { count: number; data: Row[]; error: null }) => unknown) =>
      resolve({ count: matches().length, data: matches(), error: null }),
  };
  return builder;
}

function userClient() {
  return { from: (table: string) => query(table) };
}

function adminClient() {
  return {
    from(table: string) {
      if (table === "apparatus_pump_tests") {
        return {
          insert: async (row: Row) => {
            log.pumpTestInserts.push(row);
            return { error: null };
          },
        };
      }
      const builder = query(table);
      return {
        ...builder,
        insert: (row: Row) => {
          log.attachmentInserts.push(row);
          return { select: () => ({ single: async () => ({ data: { id: "new-attachment-id" }, error: null }) }) };
        },
      };
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          log.signedUploads.push(path);
          return { data: { token: `token-for-${path}` }, error: null };
        },
        download: async (path: string) => {
          const bytes = objects.get(path);
          return bytes ? { data: new Blob([bytes.slice().buffer as ArrayBuffer]), error: null } : { data: null, error: { message: "missing" } };
        },
        list: async (folder: string) => ({
          data: [...objects.keys()].filter((key) => key.startsWith(`${folder}/`)).map((key) => ({ name: key })),
          error: null,
        }),
        remove: async (paths: string[]) => {
          log.removed.push(...paths);
          return { error: null };
        },
        createSignedUrl: async (path: string, _seconds: number, options?: unknown) => {
          log.signedUrls.push({ path, options });
          return { data: { signedUrl: `https://storage.example/signed/${path}?token=abc` }, error: null };
        },
      }),
    },
  };
}

let createPumpTest: (request: Request) => Promise<Response>;
let requestUploads: (request: Request, context: RouteContext<{ id: string }>) => Promise<Response>;
let finalizeAttachments: (request: Request, context: RouteContext<{ id: string }>) => Promise<Response>;
let openAttachment: (request: Request, context: RouteContext<{ id: string; attachmentId: string }>) => Promise<Response>;

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";

  // Stub the auth and Supabase modules at require time; no real client is ever created.
  const moduleInternals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const originalLoad = moduleInternals._load;
  const stubs: Record<string, unknown> = {
    "@/lib/supabase-server": { createSupabaseServerClient: async () => userClient() },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => adminClient() },
    "@/lib/current-member": { getCurrentMember: async () => currentMember },
  };
  moduleInternals._load = (request, ...rest) => (request in stubs ? stubs[request] : originalLoad.call(Module, request, ...rest));

  ({ POST: createPumpTest } = await import("@/app/api/apparatus/pump-tests/route"));
  ({ POST: requestUploads } = await import("@/app/api/apparatus/pump-tests/[id]/attachments/uploads/route"));
  ({ POST: finalizeAttachments } = await import("@/app/api/apparatus/pump-tests/[id]/attachments/route"));
  ({ GET: openAttachment } = await import("@/app/api/apparatus/pump-tests/[id]/attachments/[attachmentId]/route"));
});

beforeEach(() => {
  db.members = [
    { id: "m-ff", department_id: DEPT_A, active: true },
    { id: "m-peer", department_id: DEPT_A, active: true },
    { id: "m-inactive", department_id: DEPT_A, active: false },
    { id: "m-other", department_id: DEPT_B, active: true },
  ];
  db.apparatus = [
    { id: "app-a", department_id: DEPT_A },
    { id: "app-b", department_id: DEPT_B },
  ];
  db.apparatus_pump_tests = [
    { id: TEST_A, department_id: DEPT_A, apparatus_id: "app-a" },
    { id: TEST_B, department_id: DEPT_B, apparatus_id: "app-b" },
  ];
  db.apparatus_pump_test_attachments = [
    { id: ATTACHMENT_A, pump_test_id: TEST_A, department_id: DEPT_A, storage_path: `${DEPT_A}/pump-tests/${TEST_A}/file-a.pdf`, original_filename: "cert.pdf" },
    { id: ATTACHMENT_B, pump_test_id: TEST_B, department_id: DEPT_B, storage_path: `${DEPT_B}/pump-tests/${TEST_B}/file-b.pdf`, original_filename: "other.pdf" },
  ];
  log.pumpTestInserts = [];
  log.attachmentInserts = [];
  log.removed = [];
  log.signedUploads = [];
  log.signedUrls = [];
  objects.clear();
  currentMember = { id: "m-ff", departmentId: DEPT_A, name: "Test", role: "firefighter" };
});

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function validTest(overrides: Row = {}): Row {
  return {
    apparatus_id: "app-a",
    test_date: "2026-10-28",
    tester_type: "department_member",
    tester_member_id: "m-peer",
    result: "Pass",
    notes: "ok",
    ...overrides,
  };
}

const ctx = <T>(params: T): RouteContext<T> => ({ params: Promise.resolve(params) });
const pdfBytes = () => new TextEncoder().encode("%PDF-1.7 test");
const pngBytes = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

test("creating a pump test without files still works for an ordinary active member", async () => {
  const response = await createPumpTest(jsonRequest(validTest()));
  const body = (await response.json()) as { ok: boolean; pumpTest: { id: string }; uploads: unknown[] };

  assert.equal(response.status, 200);
  assert.equal(log.pumpTestInserts.length, 1);
  assert.equal(log.pumpTestInserts[0].department_id, DEPT_A);
  assert.equal(log.pumpTestInserts[0].id, body.pumpTest.id);
  assert.deepEqual(body.uploads, []);
});

test("unauthenticated, no-department and inactive members are rejected", async () => {
  currentMember = null;
  assert.equal((await createPumpTest(jsonRequest(validTest()))).status, 401);
  currentMember = { id: "m-ff", departmentId: null, name: "x", role: "firefighter" };
  assert.equal((await createPumpTest(jsonRequest(validTest()))).status, 401);
  currentMember = { id: "m-inactive", departmentId: DEPT_A, name: "x", role: "firefighter" };
  assert.equal((await createPumpTest(jsonRequest(validTest()))).status, 401);
  assert.equal(log.pumpTestInserts.length, 0);
});

test("apparatus or tester from another department is rejected", async () => {
  assert.equal((await createPumpTest(jsonRequest(validTest({ apparatus_id: "app-b" })))).status, 400);
  assert.equal((await createPumpTest(jsonRequest(validTest({ tester_member_id: "m-other" })))).status, 400);
  assert.equal(log.pumpTestInserts.length, 0);
});

test("client-supplied department_id and id cannot override server values", async () => {
  const response = await createPumpTest(jsonRequest(validTest({ department_id: DEPT_B, id: "forged", created_at: "2000-01-01" })));
  const body = (await response.json()) as { pumpTest: { id: string } };

  assert.equal(response.status, 200);
  assert.equal(log.pumpTestInserts[0].department_id, DEPT_A);
  assert.notEqual(log.pumpTestInserts[0].id, "forged");
  assert.equal(log.pumpTestInserts[0].id, body.pumpTest.id);
  assert.equal("created_at" in log.pumpTestInserts[0], false);
});

test("files are validated before anything is saved, and upload paths are server-generated", async () => {
  const bad = await createPumpTest(jsonRequest(validTest({ files: [{ name: "run.exe", type: "application/x-msdownload", size: 10 }] })));
  assert.equal(bad.status, 400);
  assert.equal(log.pumpTestInserts.length, 0);

  const tooBig = await createPumpTest(jsonRequest(validTest({ files: [{ name: "big.pdf", type: "application/pdf", size: 16 * 1024 * 1024 }] })));
  assert.equal(tooBig.status, 400);

  const good = await createPumpTest(
    jsonRequest(validTest({ files: [{ name: "../../evil name.pdf", type: "application/pdf", size: 100 }, { name: "scan.jpg", type: "image/jpeg", size: 100 }] })),
  );
  const body = (await good.json()) as { pumpTest: { id: string }; uploads: Array<{ path: string; token: string }> };

  assert.equal(good.status, 200);
  assert.equal(body.uploads.length, 2);
  for (const upload of body.uploads) {
    assert.ok(upload.path.startsWith(`${DEPT_A}/pump-tests/${body.pumpTest.id}/`));
    assert.ok(!upload.path.includes("evil"));
  }
});

test("upload slots are refused for another department's pump test", async () => {
  const response = await requestUploads(jsonRequest({ files: [{ name: "a.pdf", type: "application/pdf", size: 10 }] }), ctx({ id: TEST_B }));

  assert.equal(response.status, 404);
  assert.equal(log.signedUploads.length, 0);
});

test("finalizing registers a verified file with the correct department, test and member", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_A}/55555555-0000-4000-8000-000000000001.pdf`;
  objects.set(path, pdfBytes());

  const response = await finalizeAttachments(jsonRequest({ files: [{ path, name: "cert.pdf", type: "application/pdf" }] }), ctx({ id: TEST_A }));

  assert.equal(response.status, 200);
  assert.equal(log.attachmentInserts.length, 1);
  assert.deepEqual(
    { ...log.attachmentInserts[0], file_size_bytes: undefined },
    {
      department_id: DEPT_A,
      pump_test_id: TEST_A,
      storage_path: path,
      original_filename: "cert.pdf",
      content_type: "application/pdf",
      file_size_bytes: undefined,
      kind: "document",
      uploaded_by_member_id: "m-ff",
    },
  );
});

test("a file whose contents do not match its claimed type is deleted and not registered", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_A}/55555555-0000-4000-8000-000000000002.pdf`;
  objects.set(path, new TextEncoder().encode("<script>alert(1)</script>"));

  const response = await finalizeAttachments(jsonRequest({ files: [{ path, name: "cert.pdf", type: "application/pdf" }] }), ctx({ id: TEST_A }));

  assert.equal(response.status, 207);
  assert.equal(log.attachmentInserts.length, 0);
  assert.deepEqual(log.removed, [path]);
});

test("a PNG claiming to be a PDF is rejected", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_A}/55555555-0000-4000-8000-000000000003.pdf`;
  objects.set(path, pngBytes());

  const response = await finalizeAttachments(jsonRequest({ files: [{ path, name: "cert.pdf", type: "application/pdf" }] }), ctx({ id: TEST_A }));

  assert.equal(response.status, 207);
  assert.equal(log.attachmentInserts.length, 0);
});

test("finalizing refuses paths outside the test's own folder and never deletes them", async () => {
  const otherDeptPath = `${DEPT_B}/pump-tests/${TEST_B}/55555555-0000-4000-8000-000000000004.pdf`;
  const otherTestPath = `${DEPT_A}/pump-tests/${TEST_B}/55555555-0000-4000-8000-000000000005.pdf`;
  objects.set(otherDeptPath, pdfBytes());
  objects.set(otherTestPath, pdfBytes());

  const response = await finalizeAttachments(
    jsonRequest({ files: [{ path: otherDeptPath, name: "a.pdf", type: "application/pdf" }, { path: otherTestPath, name: "b.pdf", type: "application/pdf" }] }),
    ctx({ id: TEST_A }),
  );

  assert.equal(response.status, 207);
  assert.equal(log.attachmentInserts.length, 0);
  assert.deepEqual(log.removed, []);
});

test("retrying a finalize for an already-registered file keeps the file and adds nothing", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_A}/55555555-0000-4000-8000-000000000008.pdf`;
  db.apparatus_pump_test_attachments.push({ id: "registered-id", pump_test_id: TEST_A, department_id: DEPT_A, storage_path: path, original_filename: "cert.pdf" });
  objects.set(path, pdfBytes());

  const response = await finalizeAttachments(jsonRequest({ files: [{ path, name: "cert.pdf", type: "application/pdf" }] }), ctx({ id: TEST_A }));
  const body = (await response.json()) as { ok: boolean; attached: Array<{ id: string }> };

  assert.equal(response.status, 200);
  assert.equal(body.attached[0].id, "registered-id");
  assert.equal(log.attachmentInserts.length, 0);
  assert.deepEqual(log.removed, []);
});

test("finalizing with no files or too many files is refused", async () => {
  assert.equal((await finalizeAttachments(jsonRequest({ files: [] }), ctx({ id: TEST_A }))).status, 400);
  const many = Array.from({ length: 11 }, (_, index) => ({ path: `p${index}`, name: "a.pdf", type: "application/pdf" }));
  assert.equal((await finalizeAttachments(jsonRequest({ files: many }), ctx({ id: TEST_A }))).status, 400);
});

test("a file that was never uploaded is reported as failed without deleting anything", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_A}/55555555-0000-4000-8000-000000000007.pdf`;
  const response = await finalizeAttachments(jsonRequest({ files: [{ path, name: "missing.pdf", type: "application/pdf" }] }), ctx({ id: TEST_A }));

  assert.equal(response.status, 207);
  assert.equal(log.attachmentInserts.length, 0);
  assert.deepEqual(log.removed, []);
});

test("finalizing another department's pump test is refused", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_B}/55555555-0000-4000-8000-000000000006.pdf`;
  objects.set(path, pdfBytes());

  const response = await finalizeAttachments(jsonRequest({ files: [{ path, name: "a.pdf", type: "application/pdf" }] }), ctx({ id: TEST_B }));

  assert.equal(response.status, 404);
  assert.equal(log.attachmentInserts.length, 0);
});

test("an active member of the same department gets a short-lived signed link", async () => {
  const response = await openAttachment(new Request("http://localhost/x"), ctx({ id: TEST_A, attachmentId: ATTACHMENT_A }));

  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.startsWith("https://storage.example/signed/"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(log.signedUrls[0].options, undefined);
});

test("download links carry the original filename", async () => {
  const response = await openAttachment(new Request("http://localhost/x?download=1"), ctx({ id: TEST_A, attachmentId: ATTACHMENT_A }));

  assert.equal(response.status, 302);
  assert.deepEqual(log.signedUrls[0].options, { download: "cert.pdf" });
});

test("another department's attachment cannot be opened, even by guessing its id", async () => {
  const crossTest = await openAttachment(new Request("http://localhost/x"), ctx({ id: TEST_B, attachmentId: ATTACHMENT_B }));
  assert.equal(crossTest.status, 404);

  const mismatched = await openAttachment(new Request("http://localhost/x"), ctx({ id: TEST_A, attachmentId: ATTACHMENT_B }));
  assert.equal(mismatched.status, 404);
  assert.equal(log.signedUrls.length, 0);
});

test("unauthenticated and inactive members cannot open attachments", async () => {
  currentMember = null;
  assert.equal((await openAttachment(new Request("http://localhost/x"), ctx({ id: TEST_A, attachmentId: ATTACHMENT_A }))).status, 401);
  currentMember = { id: "m-inactive", departmentId: DEPT_A, name: "x", role: "firefighter" };
  assert.equal((await openAttachment(new Request("http://localhost/x"), ctx({ id: TEST_A, attachmentId: ATTACHMENT_A }))).status, 401);
  assert.equal(log.signedUrls.length, 0);
});

const filesOf = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `f${index}.pdf`, type: "application/pdf", size: 100 }));

test("a single request for more than 10 files is refused when issuing slots", async () => {
  const response = await requestUploads(jsonRequest({ files: filesOf(11) }), ctx({ id: TEST_A }));

  assert.equal(response.status, 400);
  assert.equal(log.signedUploads.length, 0);
});

test("a slot request with no files is refused", async () => {
  assert.equal((await requestUploads(jsonRequest({ files: [] }), ctx({ id: TEST_A }))).status, 400);
  assert.equal((await requestUploads(jsonRequest({}), ctx({ id: TEST_A }))).status, 400);
});

test("creating a pump test with more than 10 files saves nothing", async () => {
  const response = await createPumpTest(jsonRequest(validTest({ files: filesOf(11) })));

  assert.equal(response.status, 400);
  assert.equal(log.pumpTestInserts.length, 0);
  assert.equal(log.signedUploads.length, 0);
});

test("slots stop at 25 attachments per test, counting what is already registered", async () => {
  for (let index = 0; index < 24; index += 1) {
    db.apparatus_pump_test_attachments.push({ id: `extra-${index}`, pump_test_id: TEST_A, department_id: DEPT_A, storage_path: `x${index}` });
  }
  // The seeded attachment makes 25 registered for TEST_A in total.
  const tooMany = await requestUploads(jsonRequest({ files: filesOf(1) }), ctx({ id: TEST_A }));
  assert.equal(tooMany.status, 400);
  assert.equal(log.signedUploads.length, 0);
});

test("repeated slot requests cannot pile up unregistered uploads", async () => {
  db.apparatus_pump_test_attachments = [];
  for (let index = 0; index < 25; index += 1) {
    objects.set(`${DEPT_A}/pump-tests/${TEST_A}/66666666-0000-4000-8000-${String(index).padStart(12, "0")}.pdf`, pdfBytes());
  }

  const response = await requestUploads(jsonRequest({ files: filesOf(1) }), ctx({ id: TEST_A }));

  assert.equal(response.status, 400);
  assert.equal(log.signedUploads.length, 0);
});

test("slots are still issued while under the limit", async () => {
  const response = await requestUploads(jsonRequest({ files: filesOf(3) }), ctx({ id: TEST_A }));
  const body = (await response.json()) as { uploads: unknown[] };

  assert.equal(response.status, 200);
  assert.equal(body.uploads.length, 3);
});

test("inactive and signed-out members cannot create slots, register files or create tests", async () => {
  const path = `${DEPT_A}/pump-tests/${TEST_A}/55555555-0000-4000-8000-000000000009.pdf`;
  objects.set(path, pdfBytes());

  for (const member of [null, { id: "m-inactive", departmentId: DEPT_A, name: "x", role: "firefighter" }]) {
    currentMember = member;
    assert.equal((await requestUploads(jsonRequest({ files: filesOf(1) }), ctx({ id: TEST_A }))).status, 401);
    assert.equal((await finalizeAttachments(jsonRequest({ files: [{ path, name: "a.pdf", type: "application/pdf" }] }), ctx({ id: TEST_A }))).status, 401);
    assert.equal((await createPumpTest(jsonRequest(validTest()))).status, 401);
  }

  assert.equal(log.signedUploads.length, 0);
  assert.equal(log.attachmentInserts.length, 0);
  assert.equal(log.pumpTestInserts.length, 0);
  assert.deepEqual(log.removed, []);
});

test("a mixed batch reports exactly which file failed and only removes the bad one", async () => {
  const good = `${DEPT_A}/pump-tests/${TEST_A}/77777777-0000-4000-8000-000000000001.pdf`;
  const bad = `${DEPT_A}/pump-tests/${TEST_A}/77777777-0000-4000-8000-000000000002.png`;
  const missing = `${DEPT_A}/pump-tests/${TEST_A}/77777777-0000-4000-8000-000000000003.jpg`;
  objects.set(good, pdfBytes());
  objects.set(bad, new TextEncoder().encode("not an image"));

  const response = await finalizeAttachments(
    jsonRequest({
      files: [
        { path: good, name: "good.pdf", type: "application/pdf" },
        { path: bad, name: "bad.png", type: "image/png" },
        { path: missing, name: "missing.jpg", type: "image/jpeg" },
      ],
    }),
    ctx({ id: TEST_A }),
  );
  const body = (await response.json()) as {
    ok: boolean;
    attached: Array<{ name: string }>;
    failed: Array<{ name: string; path: string }>;
  };

  assert.equal(response.status, 207);
  assert.equal(body.ok, false);
  assert.deepEqual(body.attached.map((item) => item.name), ["good.pdf"]);
  assert.deepEqual(body.failed.map((item) => item.path).sort(), [bad, missing].sort());
  assert.deepEqual(log.removed, [bad]);
  assert.equal(log.attachmentInserts.length, 1);
  assert.equal(log.attachmentInserts[0].storage_path, good);
});

test("pump-test pages and routes share the same active-member rule", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
  for (const page of [
    "app/apparatus/pump-test/page.tsx",
    "app/apparatus/pump-test-history/page.tsx",
    "app/apparatus/pump-test-history/[id]/page.tsx",
  ]) {
    const source = read(page);
    assert.match(source, /getActiveDepartmentMember/, `${page} must use the shared active-member check`);
    assert.doesNotMatch(source, /getCurrentMember/, `${page} must not use the looser member lookup`);
  }

  const access = read("lib/pump-tests/access.ts");
  assert.match(access, /\.eq\("active", true\)/);
});
