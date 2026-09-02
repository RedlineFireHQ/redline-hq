import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  pendingRegistrationCookieName,
  processJoinDepartmentRequest,
  shouldUseSecureCookie,
} from "@/lib/auth/registration-flow";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const payload = ((await request.json().catch(() => ({}))) ?? {}) as import("@/lib/auth/registration-flow").JoinPayload;
    const cookieStore = await cookies();
    const pendingDepartmentCode = cookieStore.get(pendingRegistrationCookieName)?.value ?? "";
    const supabase = await createSupabaseServerClient();
    const result = await processJoinDepartmentRequest(supabase, payload, pendingDepartmentCode);
    const response = jsonResponse(result.body, result.status);

    if (result.clearPendingDepartmentCode) {
      response.cookies.set(pendingRegistrationCookieName, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: shouldUseSecureCookie(requestUrl),
        path: "/",
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to join department.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
