import assert from "node:assert/strict";
import Module from "node:module";
import test, { before, beforeEach } from "node:test";

type UploadCall = { path: string; token: string; contentType: string | undefined };

const uploadCalls: UploadCall[] = [];
let failUploadFor = new Set<string>();
let throwOnFetch = false;
let finalizeResponse: { status: number; body: unknown } = { status: 200, body: { ok: true, attached: [], failed: [] } };
const fetchedBodies: unknown[] = [];

let uploadAndRegisterAttachments: typeof import("@/lib/pump-tests/client-upload").uploadAndRegisterAttachments;
let addAttachmentsToPumpTest: typeof import("@/lib/pump-tests/client-upload").addAttachmentsToPumpTest;

before(async () => {
  // Stub the browser Supabase client at require time; nothing here reaches a network.
  const moduleInternals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const originalLoad = moduleInternals._load;
  const stubs: Record<string, unknown> = {
    "@/lib/supabase": {
      supabase: {
        storage: {
          from: () => ({
            uploadToSignedUrl: async (path: string, token: string, _file: File, options: { contentType?: string }) => {
              uploadCalls.push({ path, token, contentType: options.contentType });
              return failUploadFor.has(path) ? { error: { message: "denied" } } : { error: null };
            },
          }),
        },
      },
    },
  };
  moduleInternals._load = (request, ...rest) => (request in stubs ? stubs[request] : originalLoad.call(Module, request, ...rest));

  ({ uploadAndRegisterAttachments, addAttachmentsToPumpTest } = await import("@/lib/pump-tests/client-upload"));

  globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
    if (throwOnFetch) throw new Error("offline");
    fetchedBodies.push(init?.body ? JSON.parse(init.body) : null);
    return new Response(JSON.stringify(finalizeResponse.body), { status: finalizeResponse.status });
  }) as typeof fetch;
});

beforeEach(() => {
  uploadCalls.length = 0;
  fetchedBodies.length = 0;
  failUploadFor = new Set();
  throwOnFetch = false;
  finalizeResponse = { status: 200, body: { ok: true, attached: [], failed: [] } };
});

const file = (name: string, type: string) => new File(["x"], name, { type });
const slots = (count: number) => Array.from({ length: count }, (_, index) => ({ index, path: `dept/pump-tests/t/${index}.pdf`, token: `tok-${index}` }));

test("every file uploaded and registered is reported as attached", async () => {
  const result = await uploadAndRegisterAttachments("t", [file("a.pdf", "application/pdf"), file("b.pdf", "application/pdf")], slots(2));

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.attachedIndexes, [0, 1]);
});

test("a storage upload failure is listed, not sent for registration, and the others still attach", async () => {
  failUploadFor.add("dept/pump-tests/t/1.pdf");
  const result = await uploadAndRegisterAttachments("t", [file("a.pdf", "application/pdf"), file("b.pdf", "application/pdf"), file("c.pdf", "application/pdf")], slots(3));

  assert.deepEqual(result.attachedIndexes, [0, 2]);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /b\.pdf/);
  const sent = (fetchedBodies[0] as { files: Array<{ path: string }> }).files.map((item) => item.path);
  assert.deepEqual(sent, ["dept/pump-tests/t/0.pdf", "dept/pump-tests/t/2.pdf"]);
});

test("files the server rejects are reported and excluded from the attached list", async () => {
  finalizeResponse = {
    status: 207,
    body: { ok: false, attached: [{ id: "1", name: "a.pdf" }], failed: [{ name: "b.pdf", path: "dept/pump-tests/t/1.pdf", error: "The file contents do not match an allowed PDF or image type." }] },
  };
  const result = await uploadAndRegisterAttachments("t", [file("a.pdf", "application/pdf"), file("b.pdf", "application/pdf")], slots(2));

  assert.deepEqual(result.attachedIndexes, [0]);
  assert.deepEqual(result.failures, ["b.pdf: The file contents do not match an allowed PDF or image type."]);
});

test("a network failure while confirming never throws and attaches nothing it cannot confirm", async () => {
  throwOnFetch = true;
  const result = await uploadAndRegisterAttachments("t", [file("a.pdf", "application/pdf")], slots(1));

  assert.deepEqual(result.attachedIndexes, []);
  assert.equal(result.failures.length, 1);
});

test("a HEIC photo with an empty browser type is uploaded with a real content type", async () => {
  await uploadAndRegisterAttachments("t", [file("IMG_0001.HEIC", "")], slots(1));

  assert.equal(uploadCalls[0].contentType, "image/heic");
});

test("a refused slot request returns the server's message and uploads nothing", async () => {
  finalizeResponse = { status: 400, body: { ok: false, error: "A pump test can have at most 25 attachments." } };
  const result = await addAttachmentsToPumpTest("t", [file("a.pdf", "application/pdf")]);

  assert.deepEqual(result, { failures: ["A pump test can have at most 25 attachments."], attachedIndexes: [] });
  assert.equal(uploadCalls.length, 0);
});

test("an offline slot request fails cleanly", async () => {
  throwOnFetch = true;
  const result = await addAttachmentsToPumpTest("t", [file("a.pdf", "application/pdf")]);

  assert.equal(result.attachedIndexes.length, 0);
  assert.equal(result.failures.length, 1);
});
