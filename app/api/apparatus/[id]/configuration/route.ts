import { getCurrentMember } from "@/lib/current-member";
import { canManageApparatus } from "@/lib/member-permissions";
import { applyApparatusConfiguration, normalizeCheckFrequencyIntervalDays } from "@/lib/apparatus-configuration-simple";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const configuration = await request.json();

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const hasPermission = await canManageApparatus(
      supabase,
      currentMember.departmentId,
      currentMember.role,
    );

    if (!hasPermission) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: apparatusRow, error: apparatusError } = await supabase
      .from("apparatus")
      .select("id, department_id")
      .eq("id", id)
      .maybeSingle();

    if (apparatusError) {
      return jsonResponse({ ok: false, error: apparatusError.message || "Unable to load apparatus." }, 400);
    }

    if (!apparatusRow || apparatusRow.department_id !== currentMember.departmentId) {
      return jsonResponse({ ok: false, error: "Apparatus not found." }, 404);
    }

    const configurationRecord =
      typeof configuration === "object" && configuration !== null ? (configuration as Record<string, unknown>) : {};
    const checkFrequencyValue = typeof configurationRecord.checkFrequency === "string" ? configurationRecord.checkFrequency.trim() : "";
    const customCheckFrequencyValue = typeof configurationRecord.customCheckFrequency === "string" ? configurationRecord.customCheckFrequency.trim() : "";
    const checkFrequency =
      checkFrequencyValue === "Custom" && customCheckFrequencyValue
        ? customCheckFrequencyValue
        : checkFrequencyValue;

    const intervalDays = checkFrequencyValue
      ? normalizeCheckFrequencyIntervalDays(checkFrequencyValue, customCheckFrequencyValue)
      : null;

    if (intervalDays === null) {
      return jsonResponse({ ok: false, error: "Choose a valid check frequency before saving configuration." }, 400);
    }

    const { error: apparatusUpdateError } = await supabase
      .from("apparatus")
      .update({
        check_frequency: checkFrequency || null,
      })
      .eq("id", id)
      .eq("department_id", currentMember.departmentId);

    if (apparatusUpdateError) {
      return jsonResponse({ ok: false, error: apparatusUpdateError.message || "Unable to save apparatus configuration." }, 400);
    }

    const result = await applyApparatusConfiguration(
      supabase,
      currentMember.departmentId,
      id,
      configuration,
    );

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error || "Unable to save apparatus configuration." }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save apparatus configuration.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
