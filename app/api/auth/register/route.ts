import { NextResponse } from "next/server";
import {
  pendingRegistrationCookieName,
  processRegisterRequest,
  shouldUseSecureCookie,
} from "@/lib/auth/registration-flow";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const supabase = await createSupabaseServerClient();
    const payload = (await request.json()) as import("@/lib/auth/registration-flow").RegisterPayload;
    const result = await processRegisterRequest(supabase, requestUrl, payload);
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

    if (result.setPendingDepartmentCode) {
      response.cookies.set(pendingRegistrationCookieName, result.setPendingDepartmentCode, {
        httpOnly: true,
        sameSite: "lax",
        secure: shouldUseSecureCookie(requestUrl),
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Redline account.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
