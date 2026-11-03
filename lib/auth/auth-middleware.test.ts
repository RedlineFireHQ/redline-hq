import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://middleware-fixture.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-fixture-anon";
const middlewareModule = import("../../middleware");

for (const path of ["/auth/invite", "/auth/recovery", "/api/cron/notification-emails"]) {
  test(`only exact public callbacks/cron bypass browser-session authentication: ${path}`, async () => {
    const { middleware } = await middlewareModule;
    const response = await middleware(new NextRequest(`https://app.invalid${path}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
}

for (const path of ["/auth/recovery/other", "/auth/invite/other", "/api/cron/other", "/change-password", "/operations/deficiencies/fixture"]) {
  test(`anonymous requests remain protected: ${path}`, async () => {
    const { middleware } = await middlewareModule;
    const response = await middleware(new NextRequest(`https://app.invalid${path}`));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://app.invalid/login");
  });
}

test("legacy login PKCE callbacks reach server exchange before login/must-change redirects", async () => {
  const { middleware } = await middlewareModule;
  const response = await middleware(new NextRequest("https://app.invalid/login?code=local-code&sb_flow_id=local_flow"));
  assert.equal(response.headers.get("location"), "https://app.invalid/auth/recovery?code=local-code&sb_flow_id=local_flow");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("callback errors are handled by the recovery endpoint rather than silently showing login", async () => {
  const { middleware } = await middlewareModule;
  const response = await middleware(new NextRequest("https://app.invalid/login?error=access_denied&error_code=otp_expired"));
  assert.equal(new URL(response.headers.get("location")!).pathname, "/auth/recovery");
});

for (const path of ["/login", "/", "/privacy", "/delete-account"]) {
  test(`existing anonymous public route remains available: ${path}`, async () => {
    const { middleware } = await middlewareModule;
    const response = await middleware(new NextRequest(`https://app.invalid${path}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
  });
}

for (const mustChangePassword of [false, true]) {
  test(`existing signed-in login/password protections remain intact: forced=${mustChangePassword}`, async (t) => {
    const { middleware } = await middlewareModule;
    const user = { id: "local-user", user_metadata: { must_change_password: mustChangePassword } };
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "HS256" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
    const cookie = `base64-${encode({
      access_token: token, refresh_token: "fixture-refresh", user,
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer",
    })}`;
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, "https://middleware-fixture.invalid");
      assert.equal(url.pathname, "/auth/v1/user");
      return Response.json(user);
    });
    const request = (path: string) => new NextRequest(`https://app.invalid${path}`, {
      headers: { cookie: `sb-middleware-fixture-auth-token=${cookie}` },
    });
    const login = await middleware(request("/login"));
    assert.equal(login.headers.get("location"), `https://app.invalid/${mustChangePassword ? "change-password?first=1" : ""}`);
    const protectedPage = await middleware(request("/operations/deficiencies/fixture"));
    assert.equal(protectedPage.status, mustChangePassword ? 307 : 200);
    const passwordPage = await middleware(request("/change-password?recovery=1"));
    assert.equal(passwordPage.status, 200);
    const callback = await middleware(request("/login?code=local-code&sb_flow_id=local_flow"));
    assert.equal(new URL(callback.headers.get("location")!).pathname, "/auth/recovery");
  });
}
