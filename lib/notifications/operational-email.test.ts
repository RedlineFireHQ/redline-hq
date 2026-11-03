import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { buildOperationalEmail, isCalendarDate, type OperationalPayload } from "./operational-email";
import { createOperationalEmailQueue, parseOperationalPayload, scanCertificationEmails } from "./operational-email-queue";
import { processEmailDeliveries, processFairEmailQueues, type DeliveryQueue, type QueuedEmail } from "./delivery-processor";

const id = "10000000-0000-0000-0000-000000000001";
const recipient = "holder@example.test";
const sender = "sender@example.test";
const cert: OperationalPayload = {
  eventType: "certification_expiration", departmentName: "Test <Department>",
  certificationName: "Fire certification", expirationDate: "2028-02-29", milestone: 60, memberId: id,
};
const supply: OperationalPayload = {
  eventType: "ems_supply_withdrawal", departmentName: "Test Department", itemName: "Gauze <box>",
  quantityAfter: 10, reorderThreshold: 10, withdrawalQuantity: 2, unit: "each",
  supplyItemId: id, transactionItemId: id,
};
const delivery: QueuedEmail<OperationalPayload> = {
  id, leaseToken: id, recipientEmail: recipient, payload: cert, message: null,
};
afterEach(() => { mock.timers.reset(); mock.restoreAll(); });

for (const milestone of [60, 30, 14, 7] as const) {
  for (const name of ["Firefighter I", "Iowa EMS EMT", "Hazardous Materials"]) {
    test(`renders ${name} milestone ${milestone} to exactly the holder`, () => {
      const message = buildOperationalEmail(recipient, sender, { ...cert, milestone, certificationName: name });
      assert.equal(message.to, recipient);
      assert.deepEqual(Object.keys(message).sort(), ["from", "html", "subject", "text", "to"]);
      assert.ok(message.text.includes(name));
      assert.ok(message.subject.includes(`${milestone} days`));
      assert.ok(message.html.includes("Test &lt;Department&gt;"));
    });
  }
}

test("calendar date validation rejects missing, invalid, non-date and non-leap dates", () => {
  for (const date of ["", "2027-02-29", "2028-02-30", "2028-13-01", "2028-02-29T00:00:00Z", "infinity"]) {
    assert.equal(isCalendarDate(date), false);
    assert.throws(() => buildOperationalEmail(recipient, sender, { ...cert, expirationDate: date }), /payload/);
  }
  assert.equal(isCalendarDate("2028-02-29"), true);
});

test("all qualifying withdrawal snapshots render independently, including already-low stock", () => {
  for (const quantityAfter of [10, 9, 8, 7]) {
    const message = buildOperationalEmail(recipient, sender, { ...supply, quantityAfter });
    assert.ok(message.text.includes(`Quantity after withdrawal: ${quantityAfter}`));
    assert.equal(message.to, recipient);
    assert.ok(message.html.includes("Gauze &lt;box&gt;"));
    assert.deepEqual(Object.keys(message).sort(), ["from", "html", "subject", "text", "to"]);
  }
});

test("rejects multiple/header-injected recipients and malformed payloads", () => {
  for (const email of ["", "chief@example.test,holder@example.test", "holder@example.test\r\nBcc:x@example.test"]) {
    assert.throws(() => buildOperationalEmail(email, sender, cert), /recipient/);
  }
  for (const patch of [{ quantityAfter: 11 }, { withdrawalQuantity: 0 }, { quantityAfter: NaN }, { supplyItemId: "https://evil.test" }]) {
    assert.throws(() => buildOperationalEmail(recipient, sender, { ...supply, ...patch }), /payload/);
  }
  assert.throws(() => parseOperationalPayload("certification_expiration", { ...cert, milestone: 15 }), /milestone/);
  assert.throws(() => parseOperationalPayload("ems_supply_withdrawal", { ...supply, quantityAfter: "10" }), /number/);
});

function queueFor(events: QueuedEmail<OperationalPayload>[]) {
  const finished: unknown[] = [];
  const queue: DeliveryQueue<OperationalPayload> = {
    claim: async () => events.shift() ?? null,
    prepare: async (event, message) => event.message ?? message,
    finish: async (event, result) => { finished.push({ event, result }); },
  };
  return { queue, finished };
}
function process(queue: DeliveryQueue<OperationalPayload>, send: Parameters<typeof processEmailDeliveries<OperationalPayload>>[0]["send"]) {
  return processEmailDeliveries({
    queue, send, keyPrefix: "operational-email",
    build: (event) => buildOperationalEmail(event.recipientEmail, sender, event.payload),
  });
}

test("frozen recipient/message and stable provider key survive retry", async () => {
  const frozen = buildOperationalEmail(recipient, sender, supply);
  const seen: string[] = [];
  for (const leaseToken of ["first-lease", "retry-lease"]) {
    const state = queueFor([{ ...delivery, leaseToken, message: frozen }]);
    await process(state.queue, async (message, key) => {
      assert.deepEqual(message, frozen);
      seen.push(key);
      return { id: "provider-id" };
    });
  }
  assert.deepEqual(seen, [`operational-email/${id}`, `operational-email/${id}`]);
});

test("provider transport timeout aborts and records a retry", async () => {
  mock.method(console, "error", () => undefined);
  mock.timers.enable({ apis: ["setTimeout"] });
  const state = queueFor([{ ...delivery }]);
  let signal: AbortSignal | undefined;
  const pending = process(state.queue, async (_message, _key, abort) => {
    signal = abort;
    return new Promise(() => undefined);
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  mock.timers.tick(10_000);
  assert.equal((await pending).failed, 1);
  assert.equal(signal?.aborted, true);
  assert.ok(JSON.stringify(state.finished).includes('"retryable":true'));
});

test("nonretryable result stays nonretryable and prepare cancellation never sends", async () => {
  mock.method(console, "error", () => undefined);
  const failed = queueFor([{ ...delivery }]);
  await process(failed.queue, async () => ({ error: "resend_invalid_api_key", retryable: false }));
  assert.ok(JSON.stringify(failed.finished).includes('"retryable":false'));
  const skipped = queueFor([{ ...delivery }]);
  skipped.queue.prepare = async () => null;
  const result = await process(skipped.queue, async () => { throw new Error("Must not send"); });
  assert.deepEqual(result, { processed: 1, accepted: 0, failed: 0 });
  assert.deepEqual(skipped.finished, []);
});

test("fair queues interleave deficiency, certification and withdrawals with one total batch bound", async () => {
  const order: string[] = [];
  const result = await processFairEmailQueues(["deficiency", "certification", "withdrawal"].map((name) => ({
    name, processOne: async () => { order.push(name); return { processed: 1, accepted: 1, failed: 0 }; },
  })));
  assert.deepEqual(order.slice(0, 6), ["deficiency", "certification", "withdrawal", "deficiency", "certification", "withdrawal"]);
  assert.equal(order.length, 10);
  assert.equal(result.counts.deficiency.processed, 4);
});

test("queue failures are explicit but cannot starve other queues; wall-clock budget is bounded", async () => {
  mock.method(console, "error", () => undefined);
  const result = await processFairEmailQueues([
    { name: "broken", processOne: async () => { throw new Error("Database unavailable"); } },
    { name: "deficiency", processOne: async () => ({ processed: 1, accepted: 1, failed: 0 }) },
  ]);
  assert.deepEqual(result.errors, ["broken"]);
  assert.equal(result.counts.deficiency.processed, 10);
  let clock = 0;
  let calls = 0;
  await processFairEmailQueues([{ name: "slow", processOne: async () => {
    calls++; clock += 26_000; return { processed: 1, accepted: 0, failed: 0 };
  } }], () => clock);
  assert.equal(calls, 1);
});

test("operational RPC adapter enforces event type, frozen recipient, and scan response", async () => {
  const client = createClient("https://operational-tests.invalid", "local-test-only", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let wrongRecipient = false;
  let wrongEvent = false;
  const calls: string[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(typeof input === "string" || input instanceof URL ? input : input.url).pathname;
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    calls.push(path);
    if (path.endsWith("scan_operational_certification_emails")) return Response.json(0);
    if (path.endsWith("claim_operational_email")) return Response.json([{
      id, lease_token: id, recipient_email: recipient, payload: cert, email_message: null,
      event_type: wrongEvent ? "deficiency_assigned" : body.p_type,
    }]);
    if (path.endsWith("prepare_operational_email")) {
      return Response.json({ ...body.p_message, to: wrongRecipient ? "changed@example.test" : recipient });
    }
    if (path.endsWith("finish_operational_email")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected test network path ${path}`);
  });
  assert.equal(await scanCertificationEmails(client), 0);
  const queue = createOperationalEmailQueue(client, "certification_expiration");
  const event = await queue.claim();
  assert.ok(event);
  const message = buildOperationalEmail(recipient, sender, event.payload);
  assert.deepEqual(await queue.prepare(event, message), message);
  await queue.finish(event, { id: "provider" });
  wrongRecipient = true;
  await assert.rejects(queue.prepare(event, message), /recipient/);
  wrongEvent = true;
  await assert.rejects(queue.claim(), /event mismatch/);
  assert.ok(calls.some((path) => path.endsWith("finish_operational_email")));
});
