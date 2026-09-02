import assert from "node:assert/strict";
import test from "node:test";

import {
  processJoinDepartmentRequest,
  processRegisterRequest,
  type JoinPayload,
  type RegisterPayload,
} from "./registration-flow";

type MockConfig = {
  candidateData?: unknown;
  candidateError?: { message?: string } | null;
  signUpData?: { session: unknown; user?: { id?: string; email?: string } | null };
  signUpError?: { message?: string } | null;
  claimData?: unknown;
  claimError?: { message?: string } | null;
  user?: { id?: string; email?: string } | null;
};

function createSupabaseMock(config: MockConfig = {}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  let signOutCalls = 0;

  return {
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });

        if (fn === "validate_department_registration_candidate") {
          return {
            data: config.candidateData ?? [],
            error: config.candidateError ?? null,
          };
        }

        if (fn === "claim_department_membership_by_code") {
          return {
            data: config.claimData ?? [],
            error: config.claimError ?? null,
          };
        }

        throw new Error(`Unexpected rpc call: ${fn}`);
      },
      auth: {
        signUp: async () => ({
          data: config.signUpData ?? { session: null },
          error: config.signUpError ?? null,
        }),
        signOut: async () => {
          signOutCalls += 1;
          return { error: null };
        },
        getUser: async () => ({
          data: {
            user: config.user ?? null,
          },
        }),
      },
    },
    getRpcCalls: () => rpcCalls,
    getSignOutCalls: () => signOutCalls,
  };
}

function buildRegisterPayload(overrides: Partial<RegisterPayload> = {}): RegisterPayload {
  return {
    email: "jennings@redlinehq.com",
    departmentCode: "ELLIOTT-ABC123",
    password: "Redline1234!",
    confirmPassword: "Redline1234!",
    ...overrides,
  };
}

function buildRequestUrl() {
  return new URL("https://redlinehq.com/login");
}

test("AUTH1. eligible member + correct department code = success", async () => {
  const mock = createSupabaseMock({
    candidateData: [{ member_id: "member-1", department_id: "dep-1", already_linked: false }],
    signUpData: { session: { access_token: "token" } },
    claimData: [{ member_id: "member-1", department_id: "dep-1" }],
  });

  const result = await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload());

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    requiresConfirmation: false,
    memberId: "member-1",
    departmentId: "dep-1",
  });
  assert.deepEqual(
    mock.getRpcCalls().map((call) => call.fn),
    ["validate_department_registration_candidate", "claim_department_membership_by_code"],
  );
});

test("AUTH2. wrong department code = failure", async () => {
  const mock = createSupabaseMock({
    candidateData: [],
  });

  const result = await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload({ departmentCode: "WRONG" }));

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Email and department code do not match an active roster member.",
  });
});

test("AUTH3. email not belonging to an eligible member = failure", async () => {
  const mock = createSupabaseMock({
    candidateData: [],
  });

  const result = await processRegisterRequest(
    mock.client,
    buildRequestUrl(),
    buildRegisterPayload({ email: "not-a-member@redlinehq.com" }),
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Email and department code do not match an active roster member.",
  });
});

test("AUTH4. already-linked member = failure", async () => {
  const mock = createSupabaseMock({
    candidateData: [{ member_id: "member-1", department_id: "dep-1", already_linked: true }],
  });

  const result = await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload());

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    ok: false,
    error: "This roster member already has a Redline account. Log in instead.",
  });
});

test("AUTH5. duplicate Auth email = failure", async () => {
  const mock = createSupabaseMock({
    candidateData: [{ member_id: "member-1", department_id: "dep-1", already_linked: false }],
    signUpError: { message: "User already registered" },
  });

  const result = await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload());

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    ok: false,
    error: "User already registered",
  });
});

test("AUTH6. authenticated matching user + correct code = successful claim", async () => {
  const mock = createSupabaseMock({
    user: { id: "auth-1", email: "jennings@redlinehq.com" },
    claimData: [{ member_id: "member-1", department_id: "dep-1" }],
  });

  const result = await processJoinDepartmentRequest(
    mock.client,
    { departmentCode: "ELLIOTT-ABC123" },
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    memberId: "member-1",
    departmentId: "dep-1",
  });
});

test("AUTH7. authenticated user + wrong code = failure", async () => {
  const mock = createSupabaseMock({
    user: { id: "auth-1", email: "jennings@redlinehq.com" },
    claimError: { message: "Validation error: invalid department registration code." },
  });

  const result = await processJoinDepartmentRequest(mock.client, { departmentCode: "WRONG" });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Validation error: invalid department registration code.",
  });
});

test("AUTH8. authenticated user whose email does not match roster = failure", async () => {
  const mock = createSupabaseMock({
    user: { id: "auth-1", email: "different@redlinehq.com" },
    claimError: { message: "Validation error: no active roster member matches the authenticated account email." },
  });

  const result = await processJoinDepartmentRequest(mock.client, { departmentCode: "ELLIOTT-ABC123" });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Validation error: no active roster member matches the authenticated account email.",
  });
});

test("AUTH8B. authenticated user + non-useful join error normalizes to a human-readable message", async () => {
  const mock = createSupabaseMock({
    user: { id: "auth-1", email: "jennings@redlinehq.com" },
    claimError: { message: "{}" },
  });

  const result = await processJoinDepartmentRequest(mock.client, { departmentCode: "ELLIOTT-ABC123" });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "We signed you in, but could not connect your account to the department.",
  });
});

test("AUTH9. registration never creates a second public.members row", async () => {
  const mock = createSupabaseMock({
    candidateData: [{ member_id: "member-1", department_id: "dep-1", already_linked: false }],
    signUpData: { session: { access_token: "token" } },
    claimData: [{ member_id: "member-1", department_id: "dep-1" }],
  });

  await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload());

  assert.deepEqual(
    mock.getRpcCalls().map((call) => call.fn),
    ["validate_department_registration_candidate", "claim_department_membership_by_code"],
  );
});

test("AUTH10. existing member fields remain unchanged after claim", async () => {
  const candidateRow = {
    member_id: "member-1",
    department_id: "dep-1",
    already_linked: false,
    first_name: "Ron",
    last_name: "Jennings",
    role: "Firefighter",
    special_permissions_enabled: true,
  };
  const snapshot = structuredClone(candidateRow);
  const mock = createSupabaseMock({
    candidateData: [candidateRow],
    signUpData: { session: { access_token: "token" } },
    claimData: [{ member_id: "member-1", department_id: "dep-1" }],
  });

  const result = await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload());

  assert.equal(result.status, 200);
  assert.deepEqual(candidateRow, snapshot);
});

test("AUTH11. pending cookie fallback allows post-confirmation claim without exposing code to client JS", async () => {
  const mock = createSupabaseMock({
    user: { id: "auth-1", email: "jennings@redlinehq.com" },
    claimData: [{ member_id: "member-1", department_id: "dep-1" }],
  });

  const result = await processJoinDepartmentRequest(mock.client, {} satisfies JoinPayload, "ELLIOTT-ABC123");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    memberId: "member-1",
    departmentId: "dep-1",
  });
});

test("AUTH12. link failure after successful sign-up signs out and returns a clear error", async () => {
  const mock = createSupabaseMock({
    candidateData: [{ member_id: "member-1", department_id: "dep-1", already_linked: false }],
    signUpData: { session: { access_token: "token" } },
    claimError: { message: "Conflict: this roster member is already linked to a different authentication account." },
  });

  const result = await processRegisterRequest(mock.client, buildRequestUrl(), buildRegisterPayload());

  assert.equal(result.status, 409);
  assert.equal(mock.getSignOutCalls(), 1);
  assert.deepEqual(result.body, {
    ok: false,
    error:
      "Your account was created, but we could not connect it to the department. Sign in again and retry your department code, or contact your administrator.",
    accountCreated: true,
  });
});