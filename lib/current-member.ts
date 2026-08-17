import { createSupabaseServerClient } from "@/lib/supabase-server";

type CurrentMemberRole = "firefighter" | "officer" | "administrator";

export type CurrentMember = {
  id: string;
  departmentId: string | null;
  name: string;
  role: CurrentMemberRole;
};

function normalizeRole(value: unknown): CurrentMemberRole {
  if (typeof value !== "string") {
    return "firefighter";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "administrator") {
    return "administrator";
  }

  if (normalized === "officer") {
    return "officer";
  }

  return "firefighter";
}

export async function getCurrentMember(
  existingClient?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<CurrentMember | null> {
  const supabase = existingClient ?? (await createSupabaseServerClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authUserId = typeof user?.id === "string" ? user.id : "";
  const email = user?.email?.trim() ?? "";

  if (!authUserId && !email) {
    return null;
  }

  let data: Record<string, unknown> | null = null;
  let error: unknown = null;

  if (authUserId) {
    const authUserLookup = await supabase
      .from("members")
      .select("id, department_id, first_name, last_name, role")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    data = (authUserLookup.data as Record<string, unknown> | null) ?? null;
    error = authUserLookup.error;
  }

  if (!data && email) {
    const emailFallbackLookup = await supabase
      .from("members")
      .select("id, department_id, first_name, last_name, role")
      .eq("email", email)
      .maybeSingle();

    data = (emailFallbackLookup.data as Record<string, unknown> | null) ?? null;
    error = emailFallbackLookup.error;
  }

  if (error || !data) {
    return null;
  }

  const row = data;
  const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  const normalizedRole = normalizeRole(row.role);

  return {
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    departmentId:
      typeof row.department_id === "string" ? row.department_id : null,
    name: fullName || email,
    role: normalizedRole,
  };
}
