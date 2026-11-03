import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach, mock } from "node:test";
import { readFileSync } from "node:fs";
import {
  buildAssignmentEmail, isAuthorizedCron, processNotificationEmails,
  type DeliveryResult, type EmailDelivery, type EmailMessage, type EmailQueue,
} from "./assignment-email";

const deficiencyId = "aaaaaaaa-0000-0000-0000-000000000001";
const payload = {
  departmentName: "Test Department", description: "Broken <hose>\nNeeds repair & inspection.",
  category: "Hose", priority: "High", href: `/operations/deficiencies/${deficiencyId}`,
};
const sender = "Redline HQ <existing-sender@example.test>";
const delivery: EmailDelivery = {
  id: "bbbbbbbb-0000-0000-0000-000000000001", leaseToken: "lease-1",
  recipientEmail: "assigned@example.test", payload, message: null,
};

test("assignment template includes department, description, category, priority and trusted direct link", () => {
  const message = buildAssignmentEmail(delivery.recipientEmail, sender, payload);
  assert.equal(message.from, sender);
  assert.equal(message.to, "assigned@example.test");
  assert.deepEqual(Object.keys(message).sort(), ["from", "html", "subject", "text", "to"]);
  for (const value of ["Test Department", payload.description, "Hose", "High", `https://redlinefirehq.com${payload.href}`]) {
    assert.ok(message.text.includes(value), value);
  }
  assert.ok(message.html.includes("Broken &lt;hose&gt;<br>Needs repair &amp; inspection."));
  assert.ok(!message.html.includes("<hose>"));
});

test("template rejects missing, multiple, malformed and header-injected recipient addresses", () => {
  for (const email of ["", "invalid", "a@example.test,b@example.test", "a@example.test; b@example.test", "a@example.test\r\nBcc: other@example.test"]) {
    assert.throws(() => buildAssignmentEmail(email, sender, payload), /recipient/);
  }
});

test("template rejects arbitrary destinations and HTML-escapes all deficiency fields", () => {
  for (const href of ["https://attacker.test", "//attacker.test", "/operations/deficiencies/not-an-id", `${payload.href}?recipient=x`]) {
    assert.throws(() => buildAssignmentEmail(delivery.recipientEmail, sender, { ...payload, href }), /link/);
  }
  const message = buildAssignmentEmail(delivery.recipientEmail, sender, {
    ...payload, departmentName: "<script>", category: '"category"', priority: "'urgent'",
  });
  assert.ok(message.html.includes("&lt;script&gt;"));
  assert.ok(message.html.includes("&quot;category&quot;"));
  assert.ok(message.html.includes("&#39;urgent&#39;"));
});

test("cron authorization requires an exact Bearer secret", () => {
  const secret = "local-test-secret-only";
  assert.ok(isAuthorizedCron(`Bearer ${secret}`, secret));
  for (const auth of [null, "", secret, `Bearer ${secret} `, "Bearer wrong", `bearer ${secret}`]) {
    assert.equal(isAuthorizedCron(auth, secret), false);
  }
});

function queueFor(deliveries: EmailDelivery[]) {
  const completed: Array<{ delivery: EmailDelivery; result: DeliveryResult }> = [];
  const prepared: EmailMessage[] = [];
  const queue: EmailQueue = {
    claim: async () => deliveries.shift() ?? null,
    prepare: async (event, message) => {
      prepared.push(message);
      return event.message ?? message;
    },
    finish: async (event, result) => { completed.push({ delivery: event, result }); },
  };
  return { queue, completed, prepared };
}

test("worker sends only the claimed assignee and records provider acceptance", async () => {
  const state = queueFor([{ ...delivery }]);
  const sent: Array<{ message: EmailMessage; key: string }> = [];
  const result = await processNotificationEmails({
    queue: state.queue, sender,
    send: async (message, key) => { sent.push({ message, key }); return { id: "resend-1" }; },
  });
  assert.deepEqual(result, { processed: 1, accepted: 1, failed: 0 });
  assert.equal(sent[0].message.to, delivery.recipientEmail);
  assert.equal(sent[0].key, `notification-email/${delivery.id}`);
  assert.deepEqual(state.completed[0].result, { id: "resend-1" });
});

test("retry uses identical persisted content, sender, recipient and idempotency key", async () => {
  const frozen = buildAssignmentEmail(delivery.recipientEmail, sender, payload);
  const state = queueFor([{ ...delivery, message: frozen, payload: { ...payload, description: "Edited later" } }]);
  await processNotificationEmails({
    queue: state.queue, sender: "changed-configuration@example.test",
    send: async (message, key) => {
      assert.deepEqual(message, frozen);
      assert.equal(key, `notification-email/${delivery.id}`);
      return { id: "same-provider-id" };
    },
  });
  assert.deepEqual(state.prepared, [frozen]);
});

test("provider failures and transport exceptions persist retry outcomes", async () => {
  mock.method(console, "error", () => undefined);
  for (const throws of [false, true]) {
    const state = queueFor([{ ...delivery }]);
    const result = await processNotificationEmails({
      queue: state.queue, sender,
      send: async () => {
        if (throws) throw new Error("network unavailable");
        return { error: "resend_rate_limit_exceeded", retryable: true };
      },
    });
    assert.deepEqual(result, { processed: 1, accepted: 0, failed: 1 });
    assert.equal(state.completed[0].result.retryable, true);
    assert.equal(state.completed[0].result.error, throws ? "provider_transport_error_or_timeout" : "resend_rate_limit_exceeded");
  }
});

test("provider timeout records a retry without waiting for an unresolved send", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const state = queueFor([{ ...delivery }]);
  let requestSignal: AbortSignal | undefined;
  const pending = processNotificationEmails({
    queue: state.queue, sender,
    send: (_message, _key, signal) => {
      requestSignal = signal;
      return new Promise<DeliveryResult>(() => undefined);
    },
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  mock.timers.tick(10_000);
  assert.deepEqual(await pending, { processed: 1, accepted: 0, failed: 1 });
  assert.equal(state.completed[0].result.error, "provider_transport_error_or_timeout");
  assert.equal(requestSignal?.aborted, true);
});

test("queue preparation failure prevents sending; completion failure is surfaced", async () => {
  const state = queueFor([{ ...delivery }]);
  state.queue.prepare = async () => { throw new Error("database failure"); };
  let sends = 0;
  await assert.rejects(processNotificationEmails({
    queue: state.queue, sender, send: async () => { sends++; return { id: "id" }; },
  }), /database failure/);
  assert.equal(sends, 0);
  const second = queueFor([{ ...delivery }]);
  second.queue.finish = async () => { throw new Error("completion unavailable"); };
  await assert.rejects(processNotificationEmails({
    queue: second.queue, sender, send: async () => ({ id: "accepted-before-db-failure" }),
  }), /completion unavailable/);
});

test("dispatch rejection after claim skips sending and completion without fallback", async () => {
  const state = queueFor([{ ...delivery }]);
  state.queue.prepare = async () => null;
  let sends = 0;
  const result = await processNotificationEmails({
    queue: state.queue, sender, send: async () => { sends++; return { id: "should-not-send" }; },
  });
  assert.equal(sends, 0);
  assert.equal(state.completed.length, 0);
  assert.deepEqual(result, { processed: 1, accepted: 0, failed: 0 });
});

test("provider acceptance followed by a database failure retries the exact event without a new provider send", async () => {
  const frozen = buildAssignmentEmail(delivery.recipientEmail, sender, payload);
  const providerIds = new Map<string, string>();
  const bodies: EmailMessage[] = [];
  let actualSends = 0;
  const send = async (message: EmailMessage, key: string): Promise<DeliveryResult> => {
    bodies.push(message);
    if (!providerIds.has(key)) {
      actualSends++;
      providerIds.set(key, "accepted-id");
    }
    return { id: providerIds.get(key)! };
  };
  const first = queueFor([{ ...delivery, message: frozen }]);
  first.queue.finish = async () => { throw new Error("connection lost after acceptance"); };
  await assert.rejects(processNotificationEmails({ queue: first.queue, sender, send }), /connection lost/);
  const retry = queueFor([{ ...delivery, leaseToken: "replacement-lease", message: frozen }]);
  const result = await processNotificationEmails({ queue: retry.queue, sender, send });
  assert.equal(actualSends, 1);
  assert.deepEqual(bodies, [frozen, frozen]);
  assert.equal(retry.completed[0].result.id, "accepted-id");
  assert.equal(result.accepted, 1);
});

test("worker bounds batch size and processing time", async () => {
  const state = queueFor(Array.from({ length: 15 }, () => ({ ...delivery })));
  const result = await processNotificationEmails({
    queue: state.queue, sender, send: async () => ({ id: "id" }),
  });
  assert.equal(result.processed, 10);
  let clock = 0;
  const timed = queueFor(Array.from({ length: 15 }, () => ({ ...delivery })));
  const budget = await processNotificationEmails({
    queue: timed.queue, sender, now: () => clock,
    send: async () => { clock += 41_000; return { id: "id" }; },
  });
  assert.equal(budget.processed, 1);
});

test("cron schedule and middleware bypass are limited to the protected worker path", () => {
  const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/cron/notification-emails", schedule: "*/5 * * * *" }]);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.ok(middleware.includes('request.nextUrl.pathname === "/api/cron/notification-emails"'));
});

let GET: typeof import("@/app/api/cron/notification-emails/route").GET;
const originalEnv = { ...process.env };
const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
let claimed = false;
let providerError = false;
let providerMissingId = false;
let dbCompletionError = false;
let forgedMessage = false;
let dispatchRejected = false;
let operationalEvents = false;
let operationalClaimError = false;
let certificationScanError = false;
const operationalClaimed = new Set<string>();

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://local-notification-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-service-role-test-only";
  ({ GET } = await import("@/app/api/cron/notification-emails/route"));
});

beforeEach(() => {
  process.env.CRON_SECRET = "local-cron-test-secret-only";
  process.env.DEMO_REQUEST_SENDER = sender;
  process.env.RESEND_API_KEY = "local-resend-test-only";
  claimed = false;
  providerError = false;
  providerMissingId = false;
  dbCompletionError = false;
  forgedMessage = false;
  dispatchRejected = false;
  operationalEvents = false;
  operationalClaimError = false;
  certificationScanError = false;
  operationalClaimed.clear();
  requests.length = 0;
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(typeof input === "string" || input instanceof URL ? input : input.url).pathname;
    const body = JSON.parse(String(init?.body ?? "{}"));
    requests.push({ path, body });
    if (path === "/rest/v1/rpc/scan_operational_certification_emails") {
      return certificationScanError
        ? Response.json({ message: "Synthetic scan failure" }, { status: 500 }) : Response.json(0);
    }
    if (path === "/rest/v1/rpc/claim_operational_email") {
      if (operationalClaimError) return Response.json({ message: "Synthetic queue failure" }, { status: 500 });
      const eventType = String(body.p_type);
      if (!operationalEvents || operationalClaimed.has(eventType)) return Response.json([]);
      operationalClaimed.add(eventType);
      return Response.json([{
        id: eventType === "certification_expiration"
          ? "cccccccc-0000-0000-0000-000000000001" : "cccccccc-0000-0000-0000-000000000002",
        lease_token: delivery.leaseToken, recipient_email: delivery.recipientEmail,
        event_type: eventType, email_message: null,
        payload: eventType === "certification_expiration" ? {
          departmentName: "Test Department", certificationName: "Fire certification",
          expirationDate: "2028-02-29", milestone: 60, memberId: deficiencyId,
        } : {
          departmentName: "Test Department", itemName: "Gauze", quantityAfter: 9,
          reorderThreshold: 10, withdrawalQuantity: 1, unit: "each",
          supplyItemId: deficiencyId, transactionItemId: deficiencyId,
        },
      }]);
    }
    if (path === "/rest/v1/rpc/prepare_operational_email") return Response.json(body.p_message);
    if (path === "/rest/v1/rpc/finish_operational_email") return new Response(null, { status: 204 });
    if (path === "/rest/v1/rpc/claim_notification_email") {
      if (claimed) return Response.json([]);
      claimed = true;
      return Response.json([{
        id: delivery.id, lease_token: delivery.leaseToken, recipient_email: delivery.recipientEmail,
        event_type: "deficiency_assigned", payload, email_message: null,
      }]);
    }
    if (path === "/rest/v1/rpc/prepare_notification_email") {
      if (dispatchRejected) return Response.json(null);
      return Response.json(forgedMessage ? { ...body.p_message, to: "other@example.test" } : body.p_message);
    }
    if (path === "/rest/v1/rpc/finish_notification_email") {
      if (dbCompletionError) return Response.json({ message: "completion failure" }, { status: 500 });
      return new Response(null, { status: 204 });
    }
    if (path === "/emails") {
      assert.ok(init?.signal instanceof AbortSignal, "Resend SDK must forward cancellation to fetch");
      assert.equal(body.to, delivery.recipientEmail);
      assert.equal(body.from, sender);
      assert.deepEqual(Object.keys(body).sort(), ["from", "html", "subject", "text", "to"]);
      const expectedKey = String(body.subject).includes("Certification") ? "operational-email/cccccccc-0000-0000-0000-000000000001"
        : String(body.subject).includes("reorder") ? "operational-email/cccccccc-0000-0000-0000-000000000002"
          : `notification-email/${delivery.id}`;
      assert.equal(new Headers(init?.headers).get("idempotency-key"), expectedKey);
      if (providerError) return Response.json({ name: "rate_limit_exceeded", message: "test failure" }, { status: 429 });
      return Response.json(providerMissingId ? {} : { id: "provider-test-id" });
    }
    throw new Error(`Unexpected network access in notification test: ${path}`);
  });
  mock.method(console, "error", () => undefined);
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
  for (const key of ["CRON_SECRET", "DEMO_REQUEST_SENDER", "RESEND_API_KEY"]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function cronRequest(authorization = `Bearer ${process.env.CRON_SECRET}`) {
  return new Request("https://redlinefirehq.com/api/cron/notification-emails?to=chief@example.test", {
    headers: { authorization },
  });
}

test("worker route rejects missing/invalid authorization before database or provider access", async () => {
  for (const value of ["", "Bearer arbitrary", "Bearer local-cron-test-secret-only-extra"]) {
    assert.equal((await GET(cronRequest(value))).status, 401);
  }
  assert.equal(requests.length, 0);
});

test("worker route fails closed on missing secret or sender configuration", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await GET(cronRequest())).status, 503);
  process.env.CRON_SECRET = "too-short";
  assert.equal((await GET(cronRequest())).status, 503);
  process.env.CRON_SECRET = "local-cron-test-secret-only";
  delete process.env.DEMO_REQUEST_SENDER;
  assert.equal((await GET(cronRequest())).status, 503);
  assert.equal(requests.length, 0);
});

test("authorized route uses only database recipient and existing sender, ignoring client query input", async () => {
  const result = await GET(cronRequest());
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), { processed: 1, accepted: 1, failed: 0 });
  const finish = requests.find((entry) => entry.path.endsWith("finish_notification_email"));
  assert.equal(finish?.body.p_provider_id, "provider-test-id");
});

test("route sends one event from each enabled queue through the same Resend integration", async () => {
  operationalEvents = true;
  const result = await GET(cronRequest());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { processed: 3, accepted: 3, failed: 0 });
  assert.equal(requests.filter((entry) => entry.path === "/emails").length, 3);
  assert.equal(requests.filter((entry) => entry.path.endsWith("finish_operational_email")).length, 2);
});

test("operational queue failures remain explicit while deficiency emails still process", async () => {
  operationalClaimError = true;
  const result = await GET(cronRequest());
  assert.equal(result.status, 500);
  assert.equal((await result.json()).accepted, 1);
  assert.equal(requests.filter((entry) => entry.path === "/emails").length, 1);
});

test("certification scan failure does not starve existing deficiency emails", async () => {
  certificationScanError = true;
  const result = await GET(cronRequest());
  assert.equal(result.status, 500);
  assert.equal((await result.json()).accepted, 1);
});

test("Resend failure and missing provider ID return failure and persist retryable result", async () => {
  providerError = true;
  assert.equal((await GET(cronRequest())).status, 502);
  assert.equal(requests.find((entry) => entry.path.endsWith("finish_notification_email"))?.body.p_error, "resend_rate_limit_exceeded");
  requests.length = 0;
  claimed = false;
  providerError = false;
  providerMissingId = true;
  assert.equal((await GET(cronRequest())).status, 502);
  assert.equal(requests.find((entry) => entry.path.endsWith("finish_notification_email"))?.body.p_error, "resend_missing_message_id");
});

test("recipient mismatch prevents send and database completion failures surface as errors", async () => {
  forgedMessage = true;
  assert.equal((await GET(cronRequest())).status, 500);
  assert.equal(requests.filter((entry) => entry.path === "/emails").length, 0);
  forgedMessage = false;
  claimed = false;
  dbCompletionError = true;
  assert.equal((await GET(cronRequest())).status, 500);
});

test("route does not contact Resend when database cancels dispatch eligibility", async () => {
  dispatchRejected = true;
  assert.equal((await GET(cronRequest())).status, 200);
  assert.equal(requests.filter((entry) => entry.path === "/emails").length, 0);
  assert.equal(requests.filter((entry) => entry.path.endsWith("finish_notification_email")).length, 0);
});

test("route timeout aborts the actual Resend SDK HTTP request and retains a retry", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const normalFetch = globalThis.fetch;
  let providerSignal: AbortSignal | undefined;
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    if (new URL(typeof input === "string" || input instanceof URL ? input : input.url).pathname !== "/emails") {
      return normalFetch(input, init);
    }
    assert.ok(init?.signal);
    providerSignal = init.signal;
    return new Promise<Response>((_resolve, reject) => {
      providerSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  });
  const pending = GET(cronRequest());
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(providerSignal?.aborted, false);
  mock.timers.tick(10_000);
  assert.equal((await pending).status, 502);
  assert.equal(providerSignal?.aborted, true);
  assert.equal(requests.find((entry) => entry.path.endsWith("finish_notification_email"))?.body.p_retryable, true);
});

test("queue RPC timeout fails explicitly before any provider request", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, 5_000);
    setTimeout(() => controller.abort(), milliseconds);
    return controller.signal;
  });
  mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.signal, controller.signal);
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
    return new Promise<Response>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  });
  const pending = GET(cronRequest());
  await new Promise<void>((resolve) => setImmediate(resolve));
  mock.timers.tick(5_000);
  assert.equal((await pending).status, 500);
  assert.equal(controller.signal.aborted, true);
  assert.equal(requests.length, 0);
});
