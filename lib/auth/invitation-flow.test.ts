import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyInvitation } from "./invitation-flow";

function createClient(options: {
  error?: { code: string; status: number };
  missingSession?: boolean;
  missingUser?: boolean;
  sessionUserId?: string;
} = {}) {
  const calls: Array<{ token_hash: string; type: "invite" }> = [];
  return {
    calls,
    client: {
      auth: {
        async verifyOtp(params: { token_hash: string; type: "invite" }) {
          calls.push(params);
          return {
            data: {
              user: options.missingUser ? null : { id: "invited-user" },
              session: options.missingSession ? null : { user: { id: options.sessionUserId ?? "invited-user" } },
            },
            error: options.error ?? null,
          };
        },
      },
    },
  };
}

test("verifies the single-use invitation token on the server", async () => {
  const { client, calls } = createClient();
  assert.deepEqual(
    await verifyInvitation(new URL("https://example.com/auth/invite?token_hash=invitation-token&type=invite"), client),
    { ok: true },
  );
  assert.deepEqual(calls, [{ token_hash: "invitation-token", type: "invite" }]);
});

for (const query of [
  "",
  "?type=invite",
  "?token_hash=&type=invite",
  "?token_hash=%20&type=invite",
  "?token_hash=token",
  "?token_hash=token&type=recovery",
  "?token_hash=token&type=signup",
  "?token_hash=one&token_hash=two&type=invite",
  "?token_hash=token&type=invite&type=recovery",
  "?access_token=token&refresh_token=token&type=invite",
  "?code=authorization-code",
]) {
  test(`rejects invalid invitation parameters without contacting Auth: ${query}`, async () => {
    const { client, calls } = createClient();
    assert.deepEqual(await verifyInvitation(new URL(`https://example.com/auth/invite${query}`), client), { ok: false, status: 400 });
    assert.equal(calls.length, 0);
  });
}

for (const options of [
  { error: { code: "otp_expired", status: 403 } },
  { missingSession: true },
  { missingUser: true },
  { sessionUserId: "different-user" },
]) {
  test(`does not accept an invalid/reused token or incomplete session: ${JSON.stringify(options)}`, async (t) => {
    const log = t.mock.method(console, "error", () => {});
    const { client } = createClient(options);
    assert.deepEqual(
      await verifyInvitation(new URL("https://example.com/auth/invite?token_hash=private-token&type=invite"), client),
      { ok: false, status: 400 },
    );
    assert(!JSON.stringify(log.mock.calls).includes("private-token"));
  });
}

for (const status of [0, 429, 500, 503]) {
  test(`reports temporary Auth failures explicitly: ${status}`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { client } = createClient({ error: { code: "unexpected_failure", status } });
    assert.deepEqual(
      await verifyInvitation(new URL("https://example.com/auth/invite?token_hash=token&type=invite"), client),
      { ok: false, status: 503 },
    );
  });
}

test("untrusted redirect parameters do not affect invitation verification", async () => {
  const { client, calls } = createClient();
  assert.deepEqual(
    await verifyInvitation(new URL("https://example.com/auth/invite?token_hash=token&type=invite&next=https://attacker.invalid"), client),
    { ok: true },
  );
  assert.deepEqual(calls, [{ token_hash: "token", type: "invite" }]);
});

test("email template points to server verification, not the implicit Auth URL", () => {
  const template = readFileSync(new URL("../../supabase/templates/invite.html", import.meta.url), "utf8");
  assert(template.includes("https://redlinefirehq.com/auth/invite?token_hash={{ .TokenHash }}&amp;type=invite"));
  assert(!template.includes(".ConfirmationURL"));
  assert(!template.includes(".SiteURL"));
});

test("only the exact invitation endpoint bypasses middleware authentication", () => {
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert(middleware.includes('request.nextUrl.pathname === "/auth/invite"'));
  assert(middleware.indexOf('request.nextUrl.pathname === "/auth/invite"') < middleware.indexOf("supabase.auth.getUser()"));
});

test("the browser authentication client remains PKCE and uses no implicit overrides", () => {
  const browserClient = readFileSync(new URL("../supabase.ts", import.meta.url), "utf8");
  assert(browserClient.includes("createBrowserClient"));
  assert(!browserClient.includes('flowType: "implicit"'));
  assert(!browserClient.includes("detectSessionInUrl: false"));
});

test("successful confirmation has a fixed password-setup destination and no-referrer/no-store headers", () => {
  const route = readFileSync(new URL("../../app/auth/invite/route.ts", import.meta.url), "utf8");
  assert(route.includes('new URL("/change-password?first=1", request.url)'));
  assert(route.includes('"Cache-Control": "private, no-store"'));
  assert(route.includes('"Referrer-Policy": "no-referrer"'));
  assert(!route.includes('searchParams.get("next")'));
});
