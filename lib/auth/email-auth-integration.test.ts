import assert from "node:assert/strict";
import test from "node:test";
import { createServerClient } from "@supabase/ssr";
import { verifyInvitation } from "./invitation-flow";
import { verifyRecovery } from "./recovery-flow";
import { buildCurrentMemberResponse } from "./current-member-response";

// All Auth traffic is replaced in memory. No accounts or emails are created.
function fixture() {
  const origin = "https://auth-fixture.invalid";
  const jar = new Map<string, string>();
  const calls: Array<{ path: string; method: string }> = [];
  const consumed = new Set<string>();
  let password = "Original-local-fixture-1";
  let recoveryRedirect: URL | null = null;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "member@cedar.invalid",
    aud: "authenticated",
    role: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { must_change_password: true },
  };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
  const session = () => ({
    access_token: token, refresh_token: "local-fixture-refresh",
    token_type: "bearer", expires_in: 3600, user,
  });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, origin);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), "local-fixture-anon");
    const method = init?.method ?? "GET";
    calls.push({ path: `${url.pathname}${url.search}`, method });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (url.pathname === "/auth/v1/recover") {
      recoveryRedirect = new URL(url.searchParams.get("redirect_to")!);
      assert.equal(body.code_challenge_method, "s256");
      assert(body.code_challenge);
      return json({});
    }
    if (url.pathname === "/auth/v1/verify") {
      const expected = body.type === "invite" ? "invite-token" : "recovery-token";
      if (body.token_hash !== expected || consumed.has(expected)) {
        return json({ code: "otp_expired", msg: "Token has expired or is invalid" }, 403);
      }
      consumed.add(expected);
      return json(session());
    }
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "pkce") {
        assert(body.code_verifier);
        assert.equal(body.auth_code, "local-authorization-code");
        return json(session());
      }
      assert.equal(url.searchParams.get("grant_type"), "password");
      return body.email === user.email && body.password === password
        ? json(session())
        : json({ code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
    }
    if (url.pathname === "/auth/v1/user") {
      if (headers.get("Authorization") !== `Bearer ${token}`) {
        return json({ code: "bad_jwt", msg: "Not authenticated" }, 401);
      }
      if (method === "PUT") {
        password = body.password;
        Object.assign(user.user_metadata, body.data);
      }
      return json(user);
    }
    if (url.pathname === "/auth/v1/logout") return json({});
    if (url.pathname.startsWith("/rest/v1/")) {
      assert.equal(headers.get("Authorization"), `Bearer ${token}`);
      if (url.pathname === "/rest/v1/members") {
        assert.equal(url.searchParams.get("id"), "eq.cedar-member");
        return json({ id: "cedar-member", department_id: "cedar", role: "firefighter" });
      }
      if (url.pathname === "/rest/v1/departments") {
        assert.equal(url.searchParams.get("id"), "eq.cedar");
        return json({ id: "cedar", name: "Cedar fixture" });
      }
      if (url.pathname === "/rest/v1/rpc/member_has_app_permission") {
        assert.equal(body.p_department_id, "cedar");
        return json(false);
      }
    }
    throw new Error(`Unexpected local fixture request: ${url.pathname}`);
  };
  const client = () => createServerClient(origin, "local-fixture-anon", {
    global: { fetch: transport },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          if (options.maxAge === 0) jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  });
  return { client, calls, jar, user, recoveryRedirect: () => recoveryRedirect };
}

for (const kind of ["invite", "recovery"] as const) {
  test(`real SSR SDK: ${kind} verification, session cookies, password save, and subsequent login`, async () => {
    const f = fixture();
    const client = f.client();
    const url = new URL(`https://app.invalid/auth/${kind}?token_hash=${kind}-token&type=${kind}&department_id=unauthorized&next=https://attacker.invalid`);
    const verify = kind === "invite" ? verifyInvitation : verifyRecovery;
    assert.deepEqual(await verify(url, client), { ok: true });
    assert(f.jar.size > 0, "SSR session cookies must be written");
    const restored = f.client();
    const current = await restored.auth.getUser();
    assert.equal(current.error, null);
    assert.equal(current.data.user?.id, f.user.id);
    const changed = await restored.auth.updateUser({
      password: "Changed-local-fixture-2",
      data: { must_change_password: false },
    });
    assert.equal(changed.error, null);
    assert.equal(changed.data.user?.user_metadata.must_change_password, false);
    assert.equal((await restored.auth.signOut({ scope: "local" })).error, null);
    const next = f.client();
    assert((await next.auth.signInWithPassword({ email: f.user.email, password: "Original-local-fixture-1" })).error);
    const signedIn = await next.auth.signInWithPassword({ email: f.user.email, password: "Changed-local-fixture-2" });
    assert.equal(signedIn.error, null);
    assert.equal(signedIn.data.user?.id, f.user.id);
    assert(!f.calls.some(({ path }) => /admin|memberships|claim_department/.test(path)));
  });

  test(`real SSR SDK: ${kind} single-use link rejects replay and expired/invalid links`, async (t) => {
    t.mock.method(console, "error", () => {});
    const f = fixture();
    const verify = kind === "invite" ? verifyInvitation : verifyRecovery;
    const url = new URL(`https://app.invalid/auth/${kind}?token_hash=${kind}-token&type=${kind}`);
    assert.deepEqual(await verify(url, f.client()), { ok: true });
    assert.deepEqual(await verify(url, f.client()), { ok: false, status: 400 });
    url.searchParams.set("token_hash", "expired-or-invalid");
    assert.deepEqual(await verify(url, f.client()), { ok: false, status: 400 });
  });
}

test("real SSR SDK: PKCE recovery exchanges a code using the original browser's verifier cookies", async () => {
  const f = fixture();
  const requester = f.client();
  assert.equal((await requester.auth.resetPasswordForEmail(f.user.email, {
    redirectTo: "https://app.invalid/auth/recovery",
  })).error, null);
  const callback = f.recoveryRedirect();
  assert(callback);
  callback.searchParams.set("code", "local-authorization-code");
  assert.deepEqual(await verifyRecovery(callback, f.client()), { ok: true });
  assert(f.calls.some(({ path }) => path.includes("grant_type=pkce")));
});

test("real SSR SDK: missing PKCE verifier fails without attempting an exchange", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture();
  assert.deepEqual(await verifyRecovery(new URL("https://app.invalid/auth/recovery?code=private-code&sb_flow_id=missing_flow"), f.client()), { ok: false, status: 400 });
  assert.equal(f.calls.length, 0);
});

test("verified email identity retains the existing member-scoped department/permission resolution", async () => {
  const f = fixture();
  const client = f.client();
  assert.deepEqual(await verifyInvitation(new URL("https://app.invalid/auth/invite?token_hash=invite-token&type=invite&department_id=other"), client), { ok: true });
  const result = await buildCurrentMemberResponse(client, {
    id: "cedar-member", departmentId: "cedar", role: "firefighter", name: "Local fixture",
  });
  assert.equal(result.status, 200);
  assert(result.body.ok);
  assert.equal(result.body.department?.id, "cedar");
  assert.deepEqual(result.body.permissions, { personnel_management: false, reports_management: false });
  const count = f.calls.length;
  const unauthorized = await buildCurrentMemberResponse(client, null);
  assert.equal(unauthorized.status, 401);
  assert.equal(f.calls.length, count);
});
