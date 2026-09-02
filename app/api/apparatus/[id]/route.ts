import { getCurrentMember } from "@/lib/current-member";
import { canManageApparatus } from "@/lib/member-permissions";
import { normalizeCheckFrequencyIntervalDays } from "@/lib/apparatus-configuration-simple";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as {
      type?: unknown;
      check_frequency?: unknown;
      year?: unknown;
      make?: unknown;
      model?: unknown;
      vin?: unknown;
      pump_capacity?: unknown;
      water_tank_capacity?: unknown;
      mileage?: unknown;
      engine_hours?: unknown;
    };

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
      .select("id, department_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return jsonResponse({ ok: false, error: fetchError.message || "Unable to load apparatus." }, 400);
    }

    if (!existingRow) {
      return jsonResponse({ ok: false, error: "Apparatus not found." }, 404);
    }

    if (existingRow.department_id !== currentMember.departmentId) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const updatePayload = {
      type: normalizeText(payload.type),
      check_frequency: normalizeText(payload.check_frequency),
      year: payload.year === null || payload.year === undefined || payload.year === "" ? null : normalizeOptionalNumber(payload.year),
      make: normalizeText(payload.make),
      model: normalizeText(payload.model),
      vin: normalizeText(payload.vin),
      pump_capacity: normalizeOptionalNumber(payload.pump_capacity),
      water_tank_capacity: normalizeOptionalNumber(payload.water_tank_capacity),
      mileage: normalizeOptionalNumber(payload.mileage),
      engine_hours: normalizeOptionalNumber(payload.engine_hours),
    };

    const { error } = await supabase
      .from("apparatus")
      .update(updatePayload)
      .eq("id", id)
      .eq("department_id", currentMember.departmentId);

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to update apparatus." }, 400);
    }

    const checkFrequencyText = normalizeText(payload.check_frequency);
    const intervalDays = checkFrequencyText
      ? normalizeCheckFrequencyIntervalDays(checkFrequencyText, checkFrequencyText)
      : null;

    if (intervalDays !== null) {
      const { error: checkRequirementError } = await supabase.from("apparatus_check_requirements").upsert(
        {
          department_id: currentMember.departmentId,
          apparatus_id: id,
          score_profile: intervalDays === 1 ? "daily" : intervalDays >= 30 ? "monthly" : "daily",
          interval_days: intervalDays,
          is_active: true,
          notes: null,
        },
        { onConflict: "apparatus_id" },
      );

      if (checkRequirementError) {
        return jsonResponse({ ok: false, error: checkRequirementError.message || "Unable to update check frequency." }, 400);
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update apparatus.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
