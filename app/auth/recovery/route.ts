import { NextResponse, type NextRequest } from "next/server";
import { verifyRecovery } from "@/lib/auth/recovery-flow";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const result = await verifyRecovery(request.nextUrl, supabase);
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };

  if (!result.ok) {
    return new NextResponse(
      result.status === 503
        ? "Password recovery is temporarily unavailable. Please try again."
        : "This password reset link is invalid, expired, or already used. Request a new link from the Redline HQ login page. For older links, open it in the same browser where you requested the reset.",
      { status: result.status, headers },
    );
  }

  return NextResponse.redirect(new URL("/change-password?recovery=1", request.url), {
    status: 303,
    headers,
  });
}
