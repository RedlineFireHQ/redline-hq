import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { getMemberMemberships, selectCurrentMember } from "@/lib/current-member";
import { buildCurrentMemberResponse } from "@/lib/auth/current-member-response";
import { activeDepartmentCookieName, setActiveDepartmentCookie } from "@/lib/auth/active-department-cookie";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server-authoritative current-member resolver.
 *
 * The active department lives in the httpOnly `redline_active_department_id`
 * cookie, which client JavaScript cannot read. This route runs server-side,
 * where memberships are verified before repairing a sole-department selection
 * or requiring an explicit choice for an ambiguous account.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { rows, email } = await getMemberMemberships(supabase);
    const savedDepartmentId = (await cookies()).get(activeDepartmentCookieName)?.value ?? "";
    const currentMember = selectCurrentMember(rows, email, savedDepartmentId);
    if (!currentMember && rows.some((row) => row.department_id)) {
      const departmentIds = [...new Set(rows.flatMap((row) =>
        typeof row.department_id === "string" && row.department_id ? [row.department_id] : [],
      ))];
      const { data, error } = await supabase.from("departments")
        .select("id, name").in("id", departmentIds).order("name", { ascending: true });
      if (error) throw new Error("Unable to load available departments.");
      const response = NextResponse.json({
        ok: false,
        selectionRequired: true,
        error: "Select a department to continue.",
        departments: data ?? [],
      }, { status: 409 });
      if (savedDepartmentId) setActiveDepartmentCookie(response, "");
      return response;
    }
    const result = await buildCurrentMemberResponse(supabase, currentMember);
    const response = NextResponse.json(result.body, { status: result.status });
    if (result.body.ok && savedDepartmentId !== currentMember?.departmentId) {
      setActiveDepartmentCookie(response, currentMember?.departmentId ?? "");
    } else if (result.status === 401 && savedDepartmentId) {
      setActiveDepartmentCookie(response, "");
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load current member.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  setActiveDepartmentCookie(response, "");
  return response;
}
