export type MemberAuthLinkCandidate = {
  id: string;
  department_id: string | null;
  email: string | null;
  auth_user_id: string | null;
};

export type RequesterContext = {
  departmentId: string | null;
};

type CreateAuthUserResult = {
  userId: string | null;
  errorMessage: string | null;
};

type LinkMemberResult = {
  linked: boolean;
  errorMessage: string | null;
};

type DeleteAuthUserResult = {
  deleted: boolean;
  errorMessage: string | null;
};

export type CreateAuthAccountDependencies = {
  createAuthUser: (args: { email: string; password: string }) => Promise<CreateAuthUserResult>;
  linkMemberAuthUser: (args: {
    memberId: string;
    departmentId: string;
    authUserId: string;
  }) => Promise<LinkMemberResult>;
  deleteAuthUser: (args: { authUserId: string }) => Promise<DeleteAuthUserResult>;
};

export type CreateAuthAccountInput = {
  requester: RequesterContext | null;
  hasManagePersonnelAccess: boolean;
  memberId: string;
  temporaryPassword: string;
  member: MemberAuthLinkCandidate | null;
};

export type CreateAuthAccountResult = {
  status: number;
  body:
    | {
        ok: true;
        memberId: string;
        authUserId: string;
      }
    | {
        ok: false;
        error: string;
        authUserId?: string;
      };
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createAuthAccountForExistingMember(
  input: CreateAuthAccountInput,
  dependencies: CreateAuthAccountDependencies,
): Promise<CreateAuthAccountResult> {
  if (!input.requester?.departmentId) {
    return {
      status: 401,
      body: { ok: false, error: "Unauthorized" },
    };
  }

  if (!input.hasManagePersonnelAccess) {
    return {
      status: 403,
      body: { ok: false, error: "Forbidden" },
    };
  }

  const member = input.member;
  if (!member || member.department_id !== input.requester.departmentId || member.id !== input.memberId) {
    return {
      status: 404,
      body: { ok: false, error: "Member not found in your department." },
    };
  }

  const email = normalizeString(member.email).toLowerCase();
  if (!isValidEmail(email)) {
    return {
      status: 400,
      body: { ok: false, error: "Member must have a valid email before creating an account." },
    };
  }

  if (member.auth_user_id) {
    return {
      status: 409,
      body: { ok: false, error: "This member already has an authentication account." },
    };
  }

  if (input.temporaryPassword.length < 8) {
    return {
      status: 400,
      body: { ok: false, error: "Temporary password must be at least 8 characters long." },
    };
  }

  const createResult = await dependencies.createAuthUser({
    email,
    password: input.temporaryPassword,
  });

  if (!createResult.userId) {
    return {
      status: 400,
      body: { ok: false, error: createResult.errorMessage || "Unable to create authentication account." },
    };
  }

  const linkResult = await dependencies.linkMemberAuthUser({
    memberId: member.id,
    departmentId: input.requester.departmentId,
    authUserId: createResult.userId,
  });

  if (linkResult.linked) {
    return {
      status: 200,
      body: {
        ok: true,
        memberId: member.id,
        authUserId: createResult.userId,
      },
    };
  }

  const deleteResult = await dependencies.deleteAuthUser({ authUserId: createResult.userId });

  if (deleteResult.deleted) {
    return {
      status: 500,
      body: {
        ok: false,
        error:
          linkResult.errorMessage ||
          "Auth account was created but member linking failed. The auth account was rolled back.",
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error:
        linkResult.errorMessage ||
        "Auth account was created, but member linking failed and automatic rollback also failed.",
      authUserId: createResult.userId,
    },
  };
}