import { getCurrentMember } from "@/lib/current-member";
import { recalculateMemberEmsCreditAccounting } from "@/lib/ems/persistent-allocation";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RecalculatePayload = {
  memberId?: unknown;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as RecalculatePayload;
    const requestedMemberId = typeof payload.memberId === "string" ? payload.memberId.trim() : "";

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
    }

    const targetMemberId = requestedMemberId || currentMember.id;

    if (!targetMemberId) {
      return jsonResponse({ ok: false, error: "Member id is required." }, 400);
    }

    if (targetMemberId !== currentMember.id) {
      const [canManageTraining, canManagePersonnel, canManageCertifications] = await Promise.all([
        hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_management"),
        hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "personnel_management"),
        hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "certification_management"),
      ]);

      if (!canManageTraining && !canManagePersonnel && !canManageCertifications) {
        return jsonResponse({ ok: false, error: "Forbidden." }, 403);
      }
    }

    const admin = createSupabaseAdminClient();

    const result = await recalculateMemberEmsCreditAccounting({
      supabase: admin,
      departmentId: currentMember.departmentId,
      memberId: targetMemberId,
      requestedByMemberId: currentMember.id,
    });

    return jsonResponse({ ok: true, memberId: targetMemberId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to recalculate EMS credit allocations.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
