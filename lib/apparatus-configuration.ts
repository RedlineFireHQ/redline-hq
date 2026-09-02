import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
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

type ConfigurationPayload = {
  checkRequirement?: {
    id?: unknown;
    score_profile?: unknown;
    interval_days?: unknown;
    is_active?: unknown;
    notes?: unknown;
    effective_start_at?: unknown;
    effective_end_at?: unknown;
  } | null;
  maintenanceRequirements?: Array<{
    id?: unknown;
    name?: unknown;
    maintenance_type?: unknown;
    is_active?: unknown;
    notes?: unknown;
    methods?: Array<{
      id?: unknown;
      method_type?: unknown;
      interval_value?: unknown;
      due_soon_threshold_value?: unknown;
      early_overdue_threshold_value?: unknown;
      moderate_overdue_threshold_value?: unknown;
    }>;
  }>;
  equipmentRequirements?: Array<{
    id?: unknown;
    equipment_source?: unknown;
    equipment_id?: unknown;
    display_name?: unknown;
    is_required?: unknown;
    is_critical?: unknown;
    is_active?: unknown;
    notes?: unknown;
    effective_start_at?: unknown;
    effective_end_at?: unknown;
  }>;
  inspectionChecklistItems?: Array<{
    id?: unknown;
    section_name?: unknown;
    item_label?: unknown;
    is_required?: unknown;
    is_active?: unknown;
    display_order?: unknown;
  }>;
};

async function saveCheckRequirement(
  supabase: SupabaseClient,
  departmentId: string,
  apparatusId: string,
  checkRequirement: NonNullable<ConfigurationPayload["checkRequirement"]>,
) {
  const scoreProfile = normalizeText(checkRequirement.score_profile);
  const intervalDays = normalizeOptionalNumber(checkRequirement.interval_days);

  if (!scoreProfile || !intervalDays) {
    return { ok: true };
  }

  const { error } = await supabase.from("apparatus_check_requirements").upsert(
    {
      id: normalizeText(checkRequirement.id) ?? undefined,
      department_id: departmentId,
      apparatus_id: apparatusId,
      score_profile: scoreProfile,
      interval_days: intervalDays,
      is_active: normalizeBoolean(checkRequirement.is_active, true),
      notes: normalizeText(checkRequirement.notes),
      effective_start_at: normalizeText(checkRequirement.effective_start_at),
      effective_end_at: normalizeText(checkRequirement.effective_end_at),
    },
    { onConflict: "apparatus_id" },
  );

  if (error) {
    return { ok: false, error: error.message || "Unable to save apparatus check requirement." };
  }

  return { ok: true };
}

async function saveMaintenanceRequirements(
  supabase: SupabaseClient,
  departmentId: string,
  apparatusId: string,
  maintenanceRequirements: NonNullable<ConfigurationPayload["maintenanceRequirements"]>,
) {
  for (const requirement of maintenanceRequirements) {
    const name = normalizeText(requirement.name);
    if (!name) {
      continue;
    }

    const requirementPayload = {
      department_id: departmentId,
      apparatus_id: apparatusId,
      name,
      maintenance_type: normalizeText(requirement.maintenance_type),
      is_active: normalizeBoolean(requirement.is_active, true),
      notes: normalizeText(requirement.notes),
    };

    let requirementId = normalizeText(requirement.id);
    if (requirementId) {
      const { error } = await supabase
        .from("apparatus_maintenance_requirements")
        .update(requirementPayload)
        .eq("id", requirementId)
        .eq("apparatus_id", apparatusId)
        .eq("department_id", departmentId);

      if (error) {
        return { ok: false, error: error.message || "Unable to save maintenance requirement." };
      }
    } else {
      const { data, error } = await supabase
        .from("apparatus_maintenance_requirements")
        .insert(requirementPayload)
        .select("id")
        .maybeSingle();

      if (error) {
        return { ok: false, error: error.message || "Unable to save maintenance requirement." };
      }

      requirementId = typeof data?.id === "string" ? data.id : null;
    }

    if (!requirementId) {
      continue;
    }

    const methods = requirement.methods ?? [];
    for (const method of methods) {
      const methodType = normalizeText(method.method_type);
      const intervalValue = normalizeOptionalNumber(method.interval_value);
      const dueSoon = normalizeOptionalNumber(method.due_soon_threshold_value);
      const earlyOverdue = normalizeOptionalNumber(method.early_overdue_threshold_value);
      const moderateOverdue = normalizeOptionalNumber(method.moderate_overdue_threshold_value);

      if (!methodType || intervalValue === null || dueSoon === null || earlyOverdue === null || moderateOverdue === null) {
        continue;
      }

      const methodPayload = {
        department_id: departmentId,
        apparatus_maintenance_requirement_id: requirementId,
        method_type: methodType,
        interval_value: intervalValue,
        due_soon_threshold_value: dueSoon,
        early_overdue_threshold_value: earlyOverdue,
        moderate_overdue_threshold_value: moderateOverdue,
      };

      const methodId = normalizeText(method.id);
      if (methodId) {
        const { error } = await supabase
          .from("apparatus_maintenance_requirement_methods")
          .update(methodPayload)
          .eq("id", methodId)
          .eq("apparatus_maintenance_requirement_id", requirementId)
          .eq("department_id", departmentId);

        if (error) {
          return { ok: false, error: error.message || "Unable to save maintenance method." };
        }
      } else {
        const { error } = await supabase.from("apparatus_maintenance_requirement_methods").upsert(methodPayload, {
          onConflict: "apparatus_maintenance_requirement_id,method_type",
        });

        if (error) {
          return { ok: false, error: error.message || "Unable to save maintenance method." };
        }
      }
    }
  }

  return { ok: true };
}

async function saveEquipmentRequirements(
  supabase: SupabaseClient,
  departmentId: string,
  apparatusId: string,
  equipmentRequirements: NonNullable<ConfigurationPayload["equipmentRequirements"]>,
) {
  for (const requirement of equipmentRequirements) {
    const equipmentSource = normalizeText(requirement.equipment_source);
    const equipmentId = normalizeText(requirement.equipment_id);

    if (!equipmentSource || !equipmentId) {
      continue;
    }

    const payload = {
      department_id: departmentId,
      apparatus_id: apparatusId,
      equipment_source: equipmentSource,
      equipment_id: equipmentId,
      display_name: normalizeText(requirement.display_name),
      is_required: normalizeBoolean(requirement.is_required, true),
      is_critical: normalizeBoolean(requirement.is_critical, false),
      is_active: normalizeBoolean(requirement.is_active, true),
      notes: normalizeText(requirement.notes),
      effective_start_at: normalizeText(requirement.effective_start_at),
      effective_end_at: normalizeText(requirement.effective_end_at),
    };

    const requirementId = normalizeText(requirement.id);
    if (requirementId) {
      const { error } = await supabase
        .from("apparatus_equipment_requirements")
        .update(payload)
        .eq("id", requirementId)
        .eq("apparatus_id", apparatusId)
        .eq("department_id", departmentId);

      if (error) {
        return { ok: false, error: error.message || "Unable to save equipment requirement." };
      }
    } else {
      const { error } = await supabase.from("apparatus_equipment_requirements").upsert(payload, {
        onConflict: "apparatus_id,equipment_source,equipment_id",
      });

      if (error) {
        return { ok: false, error: error.message || "Unable to save equipment requirement." };
      }
    }
  }

  return { ok: true };
}

async function saveChecklistItems(
  supabase: SupabaseClient,
  departmentId: string,
  apparatusId: string,
  checklistItems: NonNullable<ConfigurationPayload["inspectionChecklistItems"]>,
) {
  for (const item of checklistItems) {
    const sectionName = normalizeText(item.section_name) ?? "General";
    const itemLabel = normalizeText(item.item_label);

    if (!itemLabel) {
      continue;
    }

    const payload = {
      department_id: departmentId,
      apparatus_id: apparatusId,
      section_name: sectionName,
      item_label: itemLabel,
      is_required: normalizeBoolean(item.is_required, true),
      is_active: normalizeBoolean(item.is_active, true),
      display_order: normalizeOptionalNumber(item.display_order) ?? 0,
    };

    const itemId = normalizeText(item.id);
    if (itemId) {
      const { error } = await supabase
        .from("apparatus_inspection_checklist_items")
        .update(payload)
        .eq("id", itemId)
        .eq("apparatus_id", apparatusId)
        .eq("department_id", departmentId);

      if (error) {
        return { ok: false, error: error.message || "Unable to save checklist item." };
      }
    } else {
      const { error } = await supabase.from("apparatus_inspection_checklist_items").insert(payload);

      if (error) {
        return { ok: false, error: error.message || "Unable to save checklist item." };
      }
    }
  }

  return { ok: true };
}

export async function applyApparatusConfiguration(
  supabase: SupabaseClient,
  departmentId: string,
  apparatusId: string,
  configuration: unknown,
) {
  const payload = (configuration ?? {}) as ConfigurationPayload;

  if (payload.checkRequirement) {
    const result = await saveCheckRequirement(supabase, departmentId, apparatusId, payload.checkRequirement);
    if (!result.ok) {
      return result;
    }
  }

  if (payload.maintenanceRequirements?.length) {
    const result = await saveMaintenanceRequirements(
      supabase,
      departmentId,
      apparatusId,
      payload.maintenanceRequirements,
    );
    if (!result.ok) {
      return result;
    }
  }

  if (payload.equipmentRequirements?.length) {
    const result = await saveEquipmentRequirements(
      supabase,
      departmentId,
      apparatusId,
      payload.equipmentRequirements,
    );
    if (!result.ok) {
      return result;
    }
  }

  if (payload.inspectionChecklistItems?.length) {
    const result = await saveChecklistItems(
      supabase,
      departmentId,
      apparatusId,
      payload.inspectionChecklistItems,
    );
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}
