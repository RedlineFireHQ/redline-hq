import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentMember } from "@/lib/current-member";

/**
 * Server-authoritative current-member response builder.
 *
 * Extracted from app/api/auth/current-member/route.ts so the resolution logic
 * can be tested with an injected client (same pattern as registration-flow).
 * The active department lives in the httpOnly `redline_active_department_id`
 * cookie; getCurrentMember() has already resolved which member row is active,
 * so this builder only ever loads that exact member id and scopes permission
 * checks to that member's department.
 */

export type CurrentMemberResponseResult = {
  status: number;
  body:
    | {
        ok: true;
        member: Record<string, unknown>;
        department: { id: string; name: string } | null;
        permissions: { personnel_management: boolean; reports_management: boolean };
      }
    | {
        ok: false;
        error: string;
      };
};

export async function buildCurrentMemberResponse(
  supabase: SupabaseClient,
  currentMember: CurrentMember | null,
): Promise<CurrentMemberResponseResult> {
  if (!currentMember) {
    return { status: 401, body: { ok: false, error: "Not authenticated." } };
  }

  // Load the full member row for the exact member getCurrentMember resolved.
  const { data: memberRow, error: memberError } = await supabase
    .from("members")
    .select("id, department_id, first_name, last_name, email, rank, role, department_role_id")
    .eq("id", currentMember.id)
    .maybeSingle();

  if (memberError) {
    return { status: 400, body: { ok: false, error: "Unable to load member profile." } };
  }

  const departmentId = currentMember.departmentId ?? null;

  let department: { id: string; name: string } | null = null;
  let permissions = { personnel_management: false, reports_management: false };

  if (departmentId) {
    const [personnelResult, reportsResult, departmentResult] = await Promise.all([
      supabase.rpc("member_has_app_permission", {
        p_department_id: departmentId,
        p_permission_key: "personnel_management",
      }),
      supabase.rpc("member_has_app_permission", {
        p_department_id: departmentId,
        p_permission_key: "reports_management",
      }),
      supabase.from("departments").select("id, name").eq("id", departmentId).maybeSingle(),
    ]);

    permissions = {
      personnel_management: !personnelResult.error && Boolean(personnelResult.data),
      reports_management: !reportsResult.error && Boolean(reportsResult.data),
    };

    const departmentName =
      typeof departmentResult.data?.name === "string" ? departmentResult.data.name : "";
    department = !departmentResult.error && departmentName ? { id: departmentId, name: departmentName } : null;
  }

  const member = memberRow
    ? { ...memberRow, name: currentMember.name }
    : {
        id: currentMember.id,
        department_id: departmentId,
        first_name: null,
        last_name: null,
        email: null,
        rank: null,
        role: currentMember.role,
        department_role_id: null,
        name: currentMember.name,
      };

  return { status: 200, body: { ok: true, member, department, permissions } };
}
