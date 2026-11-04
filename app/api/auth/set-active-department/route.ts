import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberMemberships } from "@/lib/current-member";
import { setActiveDepartmentCookie } from "@/lib/auth/active-department-cookie";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { rows: membershipRows } = await getMemberMemberships(supabase);
    if (membershipRows.length === 0) {
      return jsonResponse({ ok: false, error: "Not authenticated." }, 401);
    }

    const payload = (await request.json().catch(() => ({}))) as { departmentId?: unknown };
    const requestedDepartmentId =
      typeof payload.departmentId === "string" ? payload.departmentId.trim() : "";

    if (!requestedDepartmentId) {
      return jsonResponse({ ok: false, error: "A department is required." }, 400);
    }

    const allowedDepartmentIds = new Set(
      (membershipRows ?? [])
        .map((row) => (typeof row?.department_id === "string" ? row.department_id : ""))
        .filter((id) => id.length > 0),
    );

    // Never trust a browser-supplied department id — verify membership server-side.
    if (!allowedDepartmentIds.has(requestedDepartmentId)) {
      return jsonResponse({ ok: false, error: "You are not a member of that department." }, 403);
    }

    const response = jsonResponse({ ok: true, departmentId: requestedDepartmentId });

    setActiveDepartmentCookie(response, requestedDepartmentId);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to switch department.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
