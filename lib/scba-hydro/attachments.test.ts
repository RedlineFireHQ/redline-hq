import test, { before } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

const department = "aaaaaaaa-0000-4000-8000-000000000001";
const session = "11111111-0000-4000-8000-000000000001";
const attachment = "22222222-0000-4000-8000-000000000001";
const otherSession = "11111111-0000-4000-8000-000000000002";
const otherDepartment = "aaaaaaaa-0000-4000-8000-000000000002";
const path = `${department}/sessions/${session}/33333333-0000-4000-8000-000000000001.pdf`;
let allowed = true;
let found = true;
let content = new Blob(["%PDF-1.7"]);
let inserted = 0;
let signedUploads = 0;
let signedDownloads = 0;
let removed = 0;
const actor = {
  departmentId: department,
  admin: {
    from: () => {
      const filters: Record<string, string> = {};
      const builder = {
        select: () => builder,
        eq: (key: string, value: string) => { filters[key] = value; return builder; },
        maybeSingle: async () => ({ data: found &&
          (!filters.id || filters.id === attachment) &&
          (!filters.session_id || filters.session_id === session) &&
          (!filters.department_id || filters.department_id === department) &&
          (!filters.storage_path || filters.storage_path === path)
          ? { id: attachment, storage_path: path, original_filename: "test.pdf" } : null, error: null }),
        insert: () => { inserted++; return { select: () => ({ single: async () => ({ data: { id: attachment }, error: null }) }) }; },
        delete: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }),
      };
      return builder;
    },
    storage: { from: () => ({
      download: async () => ({ data: content, error: null }),
      createSignedUploadUrl: async () => { signedUploads++; return { data: { token: "token" }, error: null }; },
      createSignedUrl: async () => { signedDownloads++; return { data: { signedUrl: "https://example.test/signed" }, error: null }; },
      remove: async () => { removed++; return { error: null }; },
    }) },
  },
};

let uploadSlot: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let finalize: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
let view: (request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) => Promise<Response>;
let remove: (request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) => Promise<Response>;
const body = (value: unknown) => new Request("http://local", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
const ctx = { params: Promise.resolve({ id: session }) };

before(async () => {
  const internal = Module as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
  const original = internal._load;
  internal._load = (name, ...args) => name === "@/lib/scba-hydro/access"
    ? { hydroActor: async (id: string) => allowed && id === session ? actor : null, hydroJson: (data: unknown, status = 200) => Response.json(data, { status }) }
    : original.call(Module, name, ...args);
  ({ POST: uploadSlot } = await import("@/app/api/scba-hydro/[id]/attachments/uploads/route"));
  ({ POST: finalize } = await import("@/app/api/scba-hydro/[id]/attachments/route"));
  ({ GET: view, DELETE: remove } = await import("@/app/api/scba-hydro/[id]/attachments/[attachmentId]/route"));
  internal._load = original;
});

test("upload slots deny unauthorized callers and invalid files", async () => {
  allowed = false;
  assert.equal((await uploadSlot(body({ name: "test.pdf", type: "application/pdf", size: 20 }), ctx)).status, 403);
  allowed = true;
  assert.equal((await uploadSlot(body({ name: "test.exe", type: "application/octet-stream", size: 20 }), ctx)).status, 400);
  assert.equal((await uploadSlot(body({ name: "test.pdf", type: "application/pdf", size: 20 }), ctx)).status, 200);
});

test("finalization validates scoped path and bytes", async () => {
  found = false;
  inserted = 0;
  assert.equal((await finalize(body({ path: "other/test.pdf", name: "test.pdf", type: "application/pdf" }), ctx)).status, 400);
  content = new Blob(["not a PDF"]);
  assert.equal((await finalize(body({ path, name: "test.pdf", type: "application/pdf" }), ctx)).status, 400);
  assert.equal(inserted, 0);
  content = new Blob(["%PDF-1.7"]);
  assert.equal((await finalize(body({ path, name: "test.pdf", type: "application/pdf" }), ctx)).status, 200);
  assert.equal(inserted, 1);
});

test("attachment retrieval fails closed for unauthorized and missing records", async () => {
  const context = { params: Promise.resolve({ id: session, attachmentId: attachment }) };
  allowed = false;
  assert.equal((await view(new Request("http://local"), context)).status, 404);
  allowed = true; found = false;
  assert.equal((await view(new Request("http://local"), context)).status, 404);
  found = true;
  assert.equal((await view(new Request("http://local"), context)).status, 302);
});

test("attachment operations reject unauthorized and cross-department sessions before storage access", async () => {
  const valid = { params: Promise.resolve({ id: session, attachmentId: attachment }) };
  const cross = { params: Promise.resolve({ id: otherSession, attachmentId: attachment }) };
  const crossSession = { params: Promise.resolve({ id: otherSession }) };
  const file = body({ name: "test.pdf", type: "application/pdf", size: 20 });
  signedUploads = 0; signedDownloads = 0; removed = 0; inserted = 0;
  allowed = false;
  assert.equal((await uploadSlot(file, ctx)).status, 403);
  assert.equal((await finalize(body({ path, name: "test.pdf", type: "application/pdf" }), ctx)).status, 403);
  assert.equal((await view(new Request("http://local"), valid)).status, 404);
  assert.equal((await remove(new Request("http://local", { method: "DELETE" }), valid)).status, 404);
  allowed = true;
  assert.equal((await uploadSlot(file, crossSession)).status, 403);
  assert.equal((await finalize(body({ path, name: "test.pdf", type: "application/pdf" }), crossSession)).status, 403);
  assert.equal((await view(new Request("http://local"), cross)).status, 404);
  assert.equal((await remove(new Request("http://local", { method: "DELETE" }), cross)).status, 404);
  assert.equal((await finalize(body({ path: `${otherDepartment}/sessions/${session}/33333333-0000-4000-8000-000000000001.pdf`, name: "test.pdf", type: "application/pdf" }), ctx)).status, 400);
  assert.equal(signedUploads, 0);
  assert.equal(signedDownloads, 0);
  assert.equal(removed, 0);
  assert.equal(inserted, 0);
  found = true;
  assert.equal((await uploadSlot(body({ name: "test.pdf", type: "application/pdf", size: 20 }), ctx)).status, 200);
  assert.equal((await view(new Request("http://local"), valid)).status, 302);
  assert.equal((await remove(new Request("http://local", { method: "DELETE" }), valid)).status, 200);
  assert.equal(signedUploads, 1);
  assert.equal(signedDownloads, 1);
  assert.equal(removed, 1);
});
