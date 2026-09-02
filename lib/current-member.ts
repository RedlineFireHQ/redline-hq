import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

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
  const cookieStore = await cookies();
  const activeDepartmentId = cookieStore.get("redline_active_department_id")?.value ?? "";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authUserId = typeof user?.id === "string" ? user.id : "";
  const email = user?.email?.trim() ?? "";

  if (!authUserId && !email) {
    return null;
  }

  let rows: Record<string, unknown>[] = [];
  let error: unknown = null;

  if (authUserId) {
    const authUserLookup = await supabase
      .from("members")
      .select("id, department_id, first_name, last_name, role")
      .eq("auth_user_id", authUserId)
      .order("department_id", { ascending: true });

    rows = (authUserLookup.data as Record<string, unknown>[] | null) ?? [];
    error = authUserLookup.error;
  }

  if (rows.length === 0 && email) {
    const emailFallbackLookup = await supabase
      .from("members")
      .select("id, department_id, first_name, last_name, role")
      .eq("email", email)
      .order("department_id", { ascending: true });

    rows = (emailFallbackLookup.data as Record<string, unknown>[] | null) ?? [];
    error = emailFallbackLookup.error;
  }

  if (error || rows.length === 0) {
    return null;
  }

  const selectedRow =
    activeDepartmentId && rows.length > 1
      ? rows.find((row) => typeof row.department_id === "string" && row.department_id === activeDepartmentId) ?? rows[0]
      : rows[0];

  const row = selectedRow;
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
