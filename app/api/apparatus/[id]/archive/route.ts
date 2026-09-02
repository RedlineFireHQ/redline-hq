import { getCurrentMember } from "@/lib/current-member";
import { canManageApparatus } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const hasApparatusPermission = await canManageApparatus(
      supabase,
      currentMember.departmentId,
      currentMember.role,
    );

    if (!hasApparatusPermission) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: existingRow, error: fetchError } = await supabase
      .from("apparatus")
      .select("id, department_id, lifecycle_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return jsonResponse({ ok: false, error: fetchError.message || "Unable to archive apparatus." }, 400);
    }

    if (!existingRow) {
      return jsonResponse({ ok: false, error: "Apparatus not found." }, 404);
    }

    if (existingRow.department_id !== currentMember.departmentId) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { error } = await supabase
      .from("apparatus")
      .update({ lifecycle_status: "archived" })
      .eq("id", id)
      .eq("department_id", currentMember.departmentId);

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to archive apparatus." }, 400);
    }

    return jsonResponse({ ok: true, lifecycle_status: "archived" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to archive apparatus.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
