import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";
import { buildCurrentMemberResponse } from "@/lib/auth/current-member-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server-authoritative current-member resolver.
 *
 * The active department lives in the httpOnly `redline_active_department_id`
 * cookie, which client JavaScript cannot read. This route runs server-side,
 * where getCurrentMember() reads that cookie and resolves the correct member
 * row for the active department — so the client never has to guess among
 * multiple member rows that share one auth_user_id.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    const result = await buildCurrentMemberResponse(supabase, currentMember);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load current member.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
