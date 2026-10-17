import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const activeDepartmentCookieName = "redline_active_department_id";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status });
}

function shouldUseSecureCookie(requestUrl: URL) {
  return (
    requestUrl.protocol === "https:" ||
    requestUrl.hostname === "localhost" ||
    requestUrl.hostname === "127.0.0.1"
  );
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const authUserId = typeof user?.id === "string" ? user.id : "";
    const email = user?.email?.trim() ?? "";

    if (!authUserId && !email) {
      return jsonResponse({ ok: false, error: "Not authenticated." }, 401);
    }

    const payload = (await request.json().catch(() => ({}))) as { departmentId?: unknown };
    const requestedDepartmentId =
      typeof payload.departmentId === "string" ? payload.departmentId.trim() : "";

    if (!requestedDepartmentId) {
      return jsonResponse({ ok: false, error: "A department is required." }, 400);
    }

    // Resolve every department membership for this user. RLS on members already
    // restricts this to the user's own rows; we additionally scope by identity.
    let membershipQuery = supabase.from("members").select("department_id");

    if (authUserId) {
      membershipQuery = membershipQuery.eq("auth_user_id", authUserId);
    } else {
      membershipQuery = membershipQuery.eq("email", email);
    }

    const { data: membershipRows, error: membershipError } = await membershipQuery;

    if (membershipError) {
      return jsonResponse({ ok: false, error: "Unable to verify department membership." }, 400);
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

    response.cookies.set(activeDepartmentCookieName, requestedDepartmentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(requestUrl),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to switch department.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
