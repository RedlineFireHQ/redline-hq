type RecoveryResult = {
  data: {
    user: { id: string } | null;
    session: { user: { id: string } } | null;
    redirectType?: string | null;
  };
  error: { code?: string; status?: number } | null;
};

type RecoveryClient = {
  auth: {
    verifyOtp: (params: { token_hash: string; type: "recovery" }) => PromiseLike<RecoveryResult>;
    exchangeCodeForSession: (code: string, options?: { flowId: string }) => PromiseLike<RecoveryResult>;
  };
};

export async function verifyRecovery(url: URL, client: RecoveryClient) {
  const params = url.searchParams;
  const tokenHash = params.get("token_hash");
  const code = params.get("code");
  const flowId = params.get("sb_flow_id");
  const invalid = { ok: false as const, status: 400 };

  if (
    ["error", "error_code", "access_token", "refresh_token"].some((key) => params.has(key)) ||
    ["token_hash", "type", "code", "sb_flow_id"].some((key) => params.getAll(key).length > 1)
  ) {
    return invalid;
  }

  let result: RecoveryResult;
  if (tokenHash?.trim() && params.get("type") === "recovery" && !params.has("code") && !params.has("sb_flow_id")) {
    result = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  } else if (
    code?.trim() && !params.has("token_hash") && !params.has("type") &&
    (!params.has("sb_flow_id") || (flowId !== null && /^[a-zA-Z0-9_-]{8,64}$/.test(flowId)))
  ) {
    result = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  } else {
    return invalid;
  }

  const { data, error } = result;
  if (
    error || !data.user || !data.session || data.session.user.id !== data.user.id ||
    (code !== null && data.redirectType !== "recovery")
  ) {
    console.error("Password recovery verification failed.", { code: error?.code, status: error?.status });
    return { ok: false as const, status: error && (!error.status || error.status === 429 || error.status >= 500) ? 503 : 400 };
  }

  return { ok: true as const };
}
