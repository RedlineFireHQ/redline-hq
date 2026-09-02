import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthAccountForExistingMember,
  type CreateAuthAccountDependencies,
  type CreateAuthAccountInput,
  type MemberAuthLinkCandidate,
} from "./create-auth-account";

type MockConfig = {
  createUserId?: string | null;
  createUserError?: string | null;
  linkSucceeds?: boolean;
  linkError?: string | null;
  deleteSucceeds?: boolean;
  deleteError?: string | null;
};

function buildMember(overrides: Partial<MemberAuthLinkCandidate> = {}): MemberAuthLinkCandidate {
  return {
    id: "member-1",
    department_id: "dep-1",
    email: "member@department.org",
    auth_user_id: null,
    ...overrides,
  };
}

function buildInput(overrides: Partial<CreateAuthAccountInput> = {}): CreateAuthAccountInput {
  return {
    requester: { departmentId: "dep-1" },
    hasManagePersonnelAccess: true,
    memberId: "member-1",
    temporaryPassword: "TempPass123!",
    member: buildMember(),
    ...overrides,
  };
}

function createDependencies(config: MockConfig = {}) {
  const calls = {
    create: 0,
    link: 0,
    delete: 0,
  };

  const dependencies: CreateAuthAccountDependencies = {
    createAuthUser: async () => {
      calls.create += 1;

      if (config.createUserError) {
        return {
          userId: null,
          errorMessage: config.createUserError,
        };
      }

      return {
        userId: config.createUserId ?? "auth-user-1",
        errorMessage: null,
      };
    },
    linkMemberAuthUser: async () => {
      calls.link += 1;

      if (config.linkSucceeds === false) {
        return {
          linked: false,
          errorMessage: config.linkError ?? "Link failed",
        };
      }

      return {
        linked: true,
        errorMessage: null,
      };
    },
    deleteAuthUser: async () => {
      calls.delete += 1;

      if (config.deleteSucceeds === false) {
        return {
          deleted: false,
          errorMessage: config.deleteError ?? "Delete failed",
        };
      }

      return {
        deleted: true,
        errorMessage: null,
      };
    },
  };

  return { dependencies, calls };
}

test("unauthorized requester returns 401", async () => {
  const { dependencies, calls } = createDependencies();

  const result = await createAuthAccountForExistingMember(
    buildInput({ requester: null }),
    dependencies,
  );

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Unauthorized" });
  assert.equal(calls.create, 0);
});

test("wrong department returns 404", async () => {
  const { dependencies, calls } = createDependencies();

  const result = await createAuthAccountForExistingMember(
    buildInput({ member: buildMember({ department_id: "dep-2" }) }),
    dependencies,
  );

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Member not found in your department.",
  });
  assert.equal(calls.create, 0);
});

test("member without email returns 400", async () => {
  const { dependencies, calls } = createDependencies();

  const result = await createAuthAccountForExistingMember(
    buildInput({ member: buildMember({ email: null }) }),
    dependencies,
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Member must have a valid email before creating an account.",
  });
  assert.equal(calls.create, 0);
});

test("member already linked returns 409 and does not call auth create", async () => {
  const { dependencies, calls } = createDependencies();

  const result = await createAuthAccountForExistingMember(
    buildInput({ member: buildMember({ auth_user_id: "existing-auth-id" }) }),
    dependencies,
  );

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    ok: false,
    error: "This member already has an authentication account.",
  });
  assert.equal(calls.create, 0);
  assert.equal(calls.link, 0);
  assert.equal(calls.delete, 0);
});

test("successful auth creation and member link returns 200", async () => {
  const { dependencies, calls } = createDependencies({ createUserId: "auth-created-1" });

  const result = await createAuthAccountForExistingMember(buildInput(), dependencies);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    memberId: "member-1",
    authUserId: "auth-created-1",
  });
  assert.equal(calls.create, 1);
  assert.equal(calls.link, 1);
  assert.equal(calls.delete, 0);
});

test("auth creation failure returns 400", async () => {
  const { dependencies, calls } = createDependencies({ createUserError: "Email already registered" });

  const result = await createAuthAccountForExistingMember(buildInput(), dependencies);

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Email already registered",
  });
  assert.equal(calls.create, 1);
  assert.equal(calls.link, 0);
  assert.equal(calls.delete, 0);
});

test("member-link failure triggers successful compensating auth deletion", async () => {
  const { dependencies, calls } = createDependencies({
    createUserId: "auth-created-2",
    linkSucceeds: false,
    linkError: "Unable to link member to new auth user",
    deleteSucceeds: true,
  });

  const result = await createAuthAccountForExistingMember(buildInput(), dependencies);

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    ok: false,
    error: "Unable to link member to new auth user",
  });
  assert.equal(calls.create, 1);
  assert.equal(calls.link, 1);
  assert.equal(calls.delete, 1);
});