import { getCurrentMember } from "@/lib/current-member";
import { canManageApparatus } from "@/lib/member-permissions";
import { applyApparatusConfiguration, normalizeCheckFrequencyIntervalDays } from "@/lib/apparatus-configuration-simple";
import type { SimpleApparatusConfigurationDraft } from "@/lib/apparatus-configuration-simple";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: unknown;
      type?: unknown;
      year?: unknown;
      make?: unknown;
      model?: unknown;
      vin?: unknown;
      pumpCapacity?: unknown;
      waterTankCapacity?: unknown;
      mileage?: unknown;
      engineHours?: unknown;
      checkFrequency?: unknown;
      status?: unknown;
      configuration?: unknown;
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

    const name = normalizeText(payload.name);
    const type = normalizeText(payload.type);
    const year = normalizeOptionalNumber(payload.year);
    const make = normalizeText(payload.make);
    const model = normalizeText(payload.model);
    const vin = normalizeText(payload.vin);
    const pumpCapacity = normalizeOptionalNumber(payload.pumpCapacity);
    const waterTankCapacity = normalizeOptionalNumber(payload.waterTankCapacity);
    const mileage = normalizeOptionalNumber(payload.mileage);
    const engineHours = normalizeOptionalNumber(payload.engineHours);
    const configuration = (payload.configuration ?? {}) as {
      checkFrequency?: unknown;
      customCheckFrequency?: unknown;
      maintenanceRequirements?: unknown;
    };
    const configurationCheckFrequency = normalizeText(configuration.checkFrequency);
    const configurationCustomCheckFrequency = normalizeText(configuration.customCheckFrequency);
    const checkFrequency =
      configurationCheckFrequency === "Custom" && configurationCustomCheckFrequency
        ? configurationCustomCheckFrequency
        : configurationCheckFrequency || normalizeText(payload.checkFrequency);
    const intervalDays = configurationCheckFrequency
      ? normalizeCheckFrequencyIntervalDays(configurationCheckFrequency, configurationCustomCheckFrequency)
      : null;

    if (intervalDays === null) {
      return jsonResponse({ ok: false, error: "Choose a valid check frequency before creating the apparatus." }, 400);
    }
    const status = normalizeText(payload.status);

    if (!name) {
      return jsonResponse({ ok: false, error: "Apparatus name is required." }, 400);
    }

    const validStatuses = new Set(["ready", "needs_attention", "out_of_service"]);
    const nextStatus = validStatuses.has(status) ? status : "ready";

    const { data, error } = await supabase
      .from("apparatus")
      .insert({
        department_id: currentMember.departmentId,
        name,
        type: type || null,
        year: year !== null ? year : null,
        make: make || null,
        model: model || null,
        vin: vin || null,
        pump_capacity: pumpCapacity !== null ? pumpCapacity : null,
        water_tank_capacity: waterTankCapacity !== null ? waterTankCapacity : null,
        mileage: mileage !== null ? mileage : null,
        engine_hours: engineHours !== null ? engineHours : null,
        check_frequency: checkFrequency || null,
        status: nextStatus,
        include_in_department_readiness: true,
      })
      .select("id")
      .single();

    if (error) {
      const statusCode = /forbidden|unauthorized|permission/i.test(error.message) ? 403 : 400;
      return jsonResponse({ ok: false, error: error.message || "Unable to create apparatus." }, statusCode);
    }

    if (data?.id && payload.configuration) {
      const configurationResult = await applyApparatusConfiguration(
        supabase,
        currentMember.departmentId,
        data.id,
        payload.configuration as SimpleApparatusConfigurationDraft,
      );

      if (!configurationResult.ok) {
        return jsonResponse(
          {
            ok: false,
            apparatusId: data.id,
            error: configurationResult.error || "Unable to apply apparatus configuration.",
          },
          400,
        );
      }
    }

    return jsonResponse({ ok: true, apparatusId: data?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create apparatus.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
