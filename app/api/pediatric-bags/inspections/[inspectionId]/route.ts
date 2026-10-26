import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { deletePediatricInspection } from "@/lib/pediatric-bags/data";

type RouteContext = {
  params: Promise<{ inspectionId: string }>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

/**
 * Administrator-only deletion of a single pediatric bag inspection.
 *
 * Server-side enforcement (in addition to the database RPC's own checks):
 * the caller must resolve to a member with role "administrator" in the ACTIVE
 * department (cookie-derived, never client-supplied), and the inspection must
 * belong to that same active department. The RPC then re-verifies
 * administrator membership in the inspection's own department and deletes only
 * the inspection + its snapshot rows in one transaction.
 */
export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { inspectionId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    if (currentMember.role !== "administrator") {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const result = await deletePediatricInspection(supabase, inspectionId, currentMember.departmentId);

    switch (result.status) {
      case "deleted":
        return jsonResponse({ ok: true });
      case "not_found":
        return jsonResponse({ ok: false, error: "Inspection not found." }, 404);
      case "forbidden":
        return jsonResponse({ ok: false, error: "Forbidden" }, 403);
      default:
        return jsonResponse({ ok: false, error: "Unable to delete inspection." }, 500);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete inspection.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
