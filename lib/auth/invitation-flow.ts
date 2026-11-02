type InvitationClient = {
  auth: {
    verifyOtp: (params: { token_hash: string; type: "invite" }) => PromiseLike<{
      data: {
        user: { id: string } | null;
        session: { user: { id: string } } | null;
      };
      error: { code?: string; status?: number } | null;
    }>;
  };
};

export async function verifyInvitation(url: URL, client: InvitationClient) {
  const tokenHash = url.searchParams.get("token_hash");
  if (
    url.searchParams.getAll("token_hash").length !== 1 ||
    url.searchParams.getAll("type").length !== 1 ||
    url.searchParams.get("type") !== "invite" ||
    !tokenHash?.trim()
  ) {
    return { ok: false as const, status: 400 };
  }

  const { data, error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });

  if (error || !data.user || !data.session || data.session.user.id !== data.user.id) {
    console.error("Invitation verification failed.", {
      code: error?.code,
      status: error?.status,
    });
    return { ok: false as const, status: error && (!error.status || error.status >= 500) ? 503 : 400 };
  }

  return { ok: true as const };
}
