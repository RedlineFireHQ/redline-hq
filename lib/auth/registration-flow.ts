export const pendingRegistrationCookieName = "redline_pending_registration_department_code";

type Awaitable<T> = PromiseLike<T> | T;

type RpcError = {
  message?: string;
} | null;

type CandidateRow = {
  member_id?: string;
  department_id?: string;
  already_linked?: boolean;
};

type ClaimRow = {
  member_id?: string;
  department_id?: string;
};

type AuthUser = {
  id?: string;
  email?: string;
} | null;

export type RegisterPayload = {
  email?: unknown;
  departmentCode?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
};

export type JoinPayload = {
  departmentCode?: unknown;
};

type RegisterSupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Awaitable<{ data: unknown; error: RpcError }>;
  auth: {
    signUp: (args: {
      email: string;
      password: string;
      options: { emailRedirectTo: string };
    }) => Awaitable<{
      data: { session: unknown; user?: AuthUser };
      error: RpcError;
    }>;
    signOut: () => Awaitable<{ error: RpcError }>;
  };
};

type JoinSupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Awaitable<{ data: unknown; error: RpcError }>;
  auth: {
    getUser: () => Awaitable<{ data: { user: AuthUser } }>;
  };
};

export type RegisterFlowResult = {
  status: number;
  body:
    | {
        ok: true;
        requiresConfirmation: boolean;
        memberId: string;
        departmentId: string;
      }
    | {
        ok: false;
        error: string;
        accountCreated?: boolean;
      };
  setPendingDepartmentCode?: string;
  clearPendingDepartmentCode?: boolean;
};

export type JoinFlowResult = {
  status: number;
  body:
    | {
        ok: true;
        memberId?: string;
        departmentId?: string;
        skipped?: boolean;
      }
    | {
        ok: false;
        error: string;
      };
  clearPendingDepartmentCode?: boolean;
};

export function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function shouldUseSecureCookie(requestUrl: URL) {
  return (
    requestUrl.protocol === "https:" ||
    requestUrl.hostname === "localhost" ||
    requestUrl.hostname === "127.0.0.1"
  );
}

function statusFromMessage(message: string, fallbackStatus = 400) {
  const lowered = message.toLowerCase();

  if (lowered.includes("unauthorized")) {
    return 401;
  }

  if (lowered.includes("already registered") || lowered.includes("already exists") || lowered.includes("conflict")) {
    return 409;
  }

  return fallbackStatus;
}

function normalizeJoinErrorMessage(error: RpcError, fallbackMessage: string) {
  const rawMessage = typeof error?.message === "string" ? error.message.trim() : "";

  if (!rawMessage || rawMessage === "{}") {
    return fallbackMessage;
  }

  return rawMessage;
}

export async function processRegisterRequest(
  supabase: RegisterSupabaseLike,
  requestUrl: URL,
  payload: RegisterPayload,
): Promise<RegisterFlowResult> {
  const email = normalizeString(payload.email).toLowerCase();
  const departmentCode = normalizeString(payload.departmentCode);
  const password = typeof payload.password === "string" ? payload.password : "";
  const confirmPassword = typeof payload.confirmPassword === "string" ? payload.confirmPassword : "";

  if (!isValidEmail(email)) {
    return {
      status: 400,
      body: { ok: false, error: "Enter a valid email address." },
      clearPendingDepartmentCode: true,
    };
  }

  if (!departmentCode) {
    return {
      status: 400,
      body: { ok: false, error: "Department code is required." },
      clearPendingDepartmentCode: true,
    };
  }

  if (password.length < 8) {
    return {
      status: 400,
      body: { ok: false, error: "Password must be at least 8 characters long." },
      clearPendingDepartmentCode: true,
    };
  }

  if (password !== confirmPassword) {
    return {
      status: 400,
      body: { ok: false, error: "Passwords do not match." },
      clearPendingDepartmentCode: true,
    };
  }

  const { data: candidateData, error: candidateError } = await supabase.rpc(
    "validate_department_registration_candidate",
    {
      p_email: email,
      p_registration_code: departmentCode,
    },
  );

  if (candidateError) {
    return {
      status: 400,
      body: { ok: false, error: candidateError.message || "Unable to validate department registration." },
      clearPendingDepartmentCode: true,
    };
  }

  const candidateRow = Array.isArray(candidateData) && candidateData.length > 0 ? (candidateData[0] as CandidateRow) : null;

  if (!candidateRow || typeof candidateRow.member_id !== "string" || typeof candidateRow.department_id !== "string") {
    return {
      status: 400,
      body: { ok: false, error: "Email and department code do not match an active roster member." },
      clearPendingDepartmentCode: true,
    };
  }

  if (candidateRow.already_linked === true) {
    return {
      status: 409,
      body: { ok: false, error: "This roster member already has a Redline account. Log in instead." },
      clearPendingDepartmentCode: true,
    };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${requestUrl.origin}/login`,
    },
  });

  if (signUpError) {
    const message = signUpError.message || "Unable to create Redline account.";
    return {
      status: statusFromMessage(message, 400),
      body: { ok: false, error: message },
      clearPendingDepartmentCode: true,
    };
  }

  if (signUpData.session) {
    const { error: linkError } = await supabase.rpc("claim_department_membership_by_code", {
      p_registration_code: departmentCode,
    });

    if (linkError) {
      await supabase.auth.signOut();

      return {
        status: statusFromMessage(linkError.message || "Unable to link the account to the department.", 400),
        body: {
          ok: false,
          error:
            "Your account was created, but we could not connect it to the department. Sign in again and retry your department code, or contact your administrator.",
          accountCreated: true,
        },
        clearPendingDepartmentCode: true,
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        requiresConfirmation: false,
        memberId: candidateRow.member_id,
        departmentId: candidateRow.department_id,
      },
      clearPendingDepartmentCode: true,
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      requiresConfirmation: true,
      memberId: candidateRow.member_id,
      departmentId: candidateRow.department_id,
    },
    setPendingDepartmentCode: departmentCode,
  };
}

export async function processJoinDepartmentRequest(
  supabase: JoinSupabaseLike,
  payload: JoinPayload,
  pendingDepartmentCode = "",
): Promise<JoinFlowResult> {
  const departmentCode = normalizeString(payload.departmentCode) || normalizeString(pendingDepartmentCode);

  if (!departmentCode) {
    return {
      status: 200,
      body: { ok: true, skipped: true },
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authUserId = typeof user?.id === "string" ? user.id : "";
  const authEmail = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";

  if (!authUserId || !isValidEmail(authEmail)) {
    return {
      status: 401,
      body: { ok: false, error: "Unauthorized" },
    };
  }

  const { data, error } = await supabase.rpc("claim_department_membership_by_code", {
    p_registration_code: departmentCode,
  });

  if (error) {
    const message = normalizeJoinErrorMessage(
      error,
      "We signed you in, but could not connect your account to the department.",
    );
    return {
      status: statusFromMessage(message, 400),
      body: { ok: false, error: message },
      clearPendingDepartmentCode: true,
    };
  }

  const memberRow = Array.isArray(data) && data.length > 0 ? (data[0] as ClaimRow) : null;

  if (!memberRow || typeof memberRow.member_id !== "string" || typeof memberRow.department_id !== "string") {
    return {
      status: 400,
      body: { ok: false, error: "Unable to join department." },
      clearPendingDepartmentCode: true,
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      memberId: memberRow.member_id,
      departmentId: memberRow.department_id,
    },
    clearPendingDepartmentCode: true,
  };
}