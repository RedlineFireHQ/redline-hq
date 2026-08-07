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

  const email = user?.email?.trim();

  if (!email) {
    return null;
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, department_id, first_name, last_name, role")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as Record<string, unknown>;
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
