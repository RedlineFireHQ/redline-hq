import { NextResponse, type NextRequest } from "next/server";
import { verifyInvitation } from "@/lib/auth/invitation-flow";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const result = await verifyInvitation(request.nextUrl, supabase);
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };

  if (!result.ok) {
    return new NextResponse(
      result.status === 503
        ? "Invitation verification is temporarily unavailable. Please try again."
        : "This invitation is invalid, expired, or already used. Please request a new invitation from your administrator.",
      { status: result.status, headers },
    );
  }

  return NextResponse.redirect(new URL("/change-password?first=1", request.url), {
    status: 303,
    headers,
  });
}
