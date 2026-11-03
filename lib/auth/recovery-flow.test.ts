import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyRecovery } from "./recovery-flow";

function createClient(options: {
  error?: { code: string; status: number };
  missingUser?: boolean;
  missingSession?: boolean;
  sessionUserId?: string;
  redirectType?: string | null;
} = {}) {
  const calls: unknown[] = [];
  function result() {
    return {
      data: {
        user: options.missingUser ? null : { id: "recovering-user" },
        session: options.missingSession ? null : { user: { id: options.sessionUserId ?? "recovering-user" } },
        redirectType: options.redirectType === undefined ? "recovery" : options.redirectType,
      },
      error: options.error ?? null,
    };
  }
  return {
    calls,
    client: {
      auth: {
        async verifyOtp(params: { token_hash: string; type: "recovery" }) {
          calls.push(params);
          return result();
        },
        async exchangeCodeForSession(code: string, options?: { flowId: string }) {
          calls.push({ code, options });
          return result();
        },
      },
    },
  };
}

test("verifies recovery token hashes with the recovery type only", async () => {
  const { client, calls } = createClient();
  assert.deepEqual(await verifyRecovery(new URL("https://example.com/auth/recovery?token_hash=single-use&type=recovery"), client), { ok: true });
  assert.deepEqual(calls, [{ token_hash: "single-use", type: "recovery" }]);
});

for (const flowId of [undefined, "valid_flow-id_123"]) {
  test(`exchanges a PKCE recovery code with its verifier selector: ${flowId}`, async () => {
    const { client, calls } = createClient();
    const url = new URL("https://example.com/auth/recovery?code=authorization-code");
    if (flowId) url.searchParams.set("sb_flow_id", flowId);
    assert.deepEqual(await verifyRecovery(url, client), { ok: true });
    assert.deepEqual(calls, [{ code: "authorization-code", options: flowId ? { flowId } : undefined }]);
  });
}

for (const query of [
  "", "?type=recovery", "?token_hash=&type=recovery", "?token_hash=%20&type=recovery",
  "?token_hash=token", "?token_hash=token&type=invite", "?token_hash=token&type=signup",
  "?token_hash=one&token_hash=two&type=recovery", "?token_hash=token&type=recovery&type=invite",
  "?code=", "?code=%20", "?code=one&code=two", "?code=code&type=invite",
  "?code=code&token_hash=token&type=recovery", "?code=code&token_hash=",
  "?code=code&sb_flow_id=", "?code=code&sb_flow_id=../unsafe", "?code=code&sb_flow_id=short",
  "?code=code&sb_flow_id=valid_flow1&sb_flow_id=valid_flow2",
  "?token_hash=token&type=recovery&sb_flow_id=valid_flow1",
  "?access_token=secret&refresh_token=secret&type=recovery",
  "?code=code&error=access_denied", "?code=code&error_code=otp_expired",
]) {
  test(`rejects invalid recovery input without contacting Auth: ${query}`, async () => {
    const { client, calls } = createClient();
    assert.deepEqual(await verifyRecovery(new URL(`https://example.com/auth/recovery${query}`), client), { ok: false, status: 400 });
    assert.equal(calls.length, 0);
  });
}

for (const options of [
  { error: { code: "otp_expired", status: 403 } },
  { error: { code: "otp_disabled", status: 400 } },
  { error: { code: "flow_state_not_found", status: 404 } },
  { error: { code: "pkce_code_verifier_not_found", status: 400 } },
  { missingUser: true }, { missingSession: true }, { sessionUserId: "another-user" },
]) {
  test(`fails closed without logging tokens: ${JSON.stringify(options)}`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    const { client } = createClient(options);
    assert.deepEqual(await verifyRecovery(new URL("https://example.com/auth/recovery?token_hash=private-token&type=recovery"), client), { ok: false, status: 400 });
    assert(!JSON.stringify(log.mock.calls).includes("private-token"));
  });
}

for (const redirectType of [null, "signup", "invite"]) {
  test(`does not accept a non-recovery PKCE result: ${redirectType}`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { client } = createClient({ redirectType });
    assert.deepEqual(await verifyRecovery(new URL("https://example.com/auth/recovery?code=code"), client), { ok: false, status: 400 });
  });
}

for (const status of [0, 429, 500, 503]) {
  test(`distinguishes temporary Auth failures: ${status}`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { client } = createClient({ error: { code: "temporary_failure", status } });
    assert.deepEqual(await verifyRecovery(new URL("https://example.com/auth/recovery?code=private-code"), client), { ok: false, status: 503 });
  });
}

test("arbitrary redirect and department inputs cannot change verified identity or destination", async () => {
  const { client, calls } = createClient();
  assert.deepEqual(await verifyRecovery(new URL("https://example.com/auth/recovery?token_hash=token&type=recovery&next=https://attacker.invalid&department_id=other-department"), client), { ok: true });
  assert.deepEqual(calls, [{ token_hash: "token", type: "recovery" }]);
  const route = readFileSync(new URL("../../app/auth/recovery/route.ts", import.meta.url), "utf8");
  assert(route.includes('new URL("/change-password?recovery=1", request.url)'));
  assert(!route.includes('searchParams.get("next")'));
  assert(route.includes('"Cache-Control": "private, no-store"'));
  assert(route.includes('"Referrer-Policy": "no-referrer"'));
});

test("proposed Production template bypasses localhost and the requesting-browser PKCE dependency", () => {
  const template = readFileSync(new URL("../../supabase/templates/recovery.html", import.meta.url), "utf8");
  assert(template.includes("https://redlinefirehq.com/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery"));
  assert(!template.includes(".SiteURL"));
  assert(!template.includes(".ConfirmationURL"));
});

test("password changes reuse the existing protected screen and retain validation", () => {
  const form = readFileSync(new URL("../../app/change-password/page.tsx", import.meta.url), "utf8");
  assert(form.includes('router.replace("/login")'));
  assert(form.includes("newPassword.length < 8"));
  assert(form.includes("newPassword !== confirmPassword"));
  assert(form.includes("supabase.auth.updateUser"));
  assert(form.includes("data: { must_change_password: false }"));
  const login = readFileSync(new URL("../../app/login/page.tsx", import.meta.url), "utf8");
  assert(login.includes("`${window.location.origin}/auth/recovery`"));
  assert(!login.includes("handleRecoverySubmit"));
  const provider = readFileSync(new URL("../../components/auth/AuthProvider.tsx", import.meta.url), "utf8");
  assert(!provider.includes("console.log"));
});
