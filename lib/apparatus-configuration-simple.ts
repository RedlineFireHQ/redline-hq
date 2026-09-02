import type { SupabaseClient } from "@supabase/supabase-js";

export const CHECK_FREQUENCY_OPTIONS = [
  "Daily",
  "Every 2 Days",
  "Every 3 Days",
  "Weekly",
  "Every 2 Weeks",
  "Monthly",
  "Quarterly",
  "Custom",
] as const;

export const MAINTENANCE_ITEM_OPTIONS = [
  "Oil Change",
  "Pump Service",
  "Engine Service",
  "Annual Service",
  "Tire Inspection",
  "Other",
] as const;

export const MAINTENANCE_INTERVAL_UNIT_OPTIONS = ["Months", "Miles", "Engine Hours"] as const;

export type CheckFrequencyOption = (typeof CHECK_FREQUENCY_OPTIONS)[number];
export type MaintenanceItemOption = (typeof MAINTENANCE_ITEM_OPTIONS)[number];
export type MaintenanceIntervalUnitOption = (typeof MAINTENANCE_INTERVAL_UNIT_OPTIONS)[number];

export type SimpleMaintenanceRequirementDraft = {
  id?: string;
  itemName: MaintenanceItemOption | string;
  customItemName: string;
  intervalAmount: string;
  intervalUnit: MaintenanceIntervalUnitOption | "";
};

export type SimpleApparatusConfigurationDraft = {
  checkFrequency: CheckFrequencyOption | "";
  customCheckFrequency: string;
  maintenanceRequirements: SimpleMaintenanceRequirementDraft[];
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function createBlankApparatusConfiguration(): SimpleApparatusConfigurationDraft {
  return {
    checkFrequency: "",
    customCheckFrequency: "",
    maintenanceRequirements: [],
  };
}

function frequencyToIntervalDays(checkFrequency: string, customCheckFrequency: string): number | null {
  const normalizedFrequency = normalizeText(checkFrequency).toLowerCase();

  if (normalizedFrequency === "daily") {
    return 1;
  }

  if (normalizedFrequency === "every 2 days") {
    return 2;
  }

  if (normalizedFrequency === "every 3 days") {
    return 3;
  }

  if (normalizedFrequency === "weekly") {
    return 7;
  }

  if (normalizedFrequency === "every 2 weeks") {
    return 14;
  }

  if (normalizedFrequency === "monthly") {
    return 30;
  }

  if (normalizedFrequency === "quarterly") {
    return 90;
  }

  if (normalizedFrequency !== "custom") {
    return null;
  }

  const customText = normalizeText(customCheckFrequency).toLowerCase();
  if (!customText) {
    return null;
  }

  const customMatch = customText.match(/^every\s+(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)$/i);
  if (!customMatch) {
    return null;
  }

  const amount = Number(customMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = customMatch[2].toLowerCase();
  if (unit.startsWith("day")) {
    return Math.round(amount);
  }

  if (unit.startsWith("week")) {
    return Math.round(amount * 7);
  }

  if (unit.startsWith("month")) {
    return Math.round(amount * 30);
  }

  return null;
}

function buildMaintenanceThresholds(intervalValue: number) {
  const dueSoon = Math.max(0, Math.round(intervalValue * 0.1));
  const earlyOverdue = Math.max(0, Math.round(intervalValue * 0.25));
  const moderateOverdue = Math.max(earlyOverdue, Math.round(intervalValue * 0.5));

  return {
    dueSoon,
    earlyOverdue,
    moderateOverdue,
  };
}

function maintenanceItemLabel(itemName: string, customItemName: string) {
  const trimmedName = normalizeText(itemName);
  if (trimmedName.toLowerCase() === "other") {
    return normalizeText(customItemName);
  }

  return trimmedName;
}

function maintenanceTypeFromLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function intervalValueFromDraft(intervalAmount: string, intervalUnit: MaintenanceIntervalUnitOption | "") {
  const amount = normalizeNumber(intervalAmount);
  if (amount === null || amount <= 0) {
    return null;
  }

  if (intervalUnit === "Months") {
    return Math.round(amount * 30);
  }

  return amount;
}

function methodTypeFromUnit(intervalUnit: MaintenanceIntervalUnitOption | "") {
  if (intervalUnit === "Miles") {
    return "mileage" as const;
  }

  if (intervalUnit === "Engine Hours") {
    return "engine_hours" as const;
  }

  return "time_days" as const;
}

export function normalizeCheckFrequencyIntervalDays(
  checkFrequency: string,
  customCheckFrequency: string,
): number | null {
  return frequencyToIntervalDays(checkFrequency, customCheckFrequency);
}

type ApplyConfigurationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function applyApparatusConfiguration(
  supabase: SupabaseClient,
  departmentId: string,
  apparatusId: string,
  configuration: SimpleApparatusConfigurationDraft,
): Promise<ApplyConfigurationResult> {
  const intervalDays = normalizeCheckFrequencyIntervalDays(configuration.checkFrequency, configuration.customCheckFrequency);
  if (intervalDays === null) {
    return {
      ok: false,
      error: "Choose a valid check frequency before creating the apparatus.",
    };
  }

  const checkRequirementPayload = {
    department_id: departmentId,
    apparatus_id: apparatusId,
    score_profile: intervalDays === 1 ? "daily" : intervalDays >= 30 ? "monthly" : "daily",
    interval_days: intervalDays,
    is_active: true,
    notes: null,
  };

  const { data: existingCheckRequirement, error: checkRequirementLookupError } = await supabase
    .from("apparatus_check_requirements")
    .select("id")
    .eq("apparatus_id", apparatusId)
    .eq("department_id", departmentId)
    .maybeSingle();

  if (checkRequirementLookupError) {
    return {
      ok: false,
      error: checkRequirementLookupError.message || "Unable to load apparatus check frequency.",
    };
  }

  const checkRequirementQuery = existingCheckRequirement?.id
    ? supabase
        .from("apparatus_check_requirements")
        .update(checkRequirementPayload)
        .eq("id", existingCheckRequirement.id)
        .eq("apparatus_id", apparatusId)
        .eq("department_id", departmentId)
    : supabase.from("apparatus_check_requirements").insert(checkRequirementPayload);

  const { error: checkRequirementError } = await checkRequirementQuery;

  if (checkRequirementError) {
    return {
      ok: false,
      error: checkRequirementError.message || "Unable to save apparatus check frequency.",
    };
  }

  for (const requirement of configuration.maintenanceRequirements) {
    const label = maintenanceItemLabel(requirement.itemName, requirement.customItemName);
    const intervalValue = intervalValueFromDraft(requirement.intervalAmount, requirement.intervalUnit);

    if (!label || intervalValue === null) {
      continue;
    }

    const methodType = methodTypeFromUnit(requirement.intervalUnit);
    const thresholds = buildMaintenanceThresholds(intervalValue);
    const maintenanceType = maintenanceTypeFromLabel(label);

    const requirementPayload = {
      department_id: departmentId,
      apparatus_id: apparatusId,
      name: label,
      maintenance_type: maintenanceType,
      is_active: true,
      notes: null,
    };

    let requirementId = requirement.id?.trim() || null;
    if (requirementId) {
      const { error: updateError } = await supabase
        .from("apparatus_maintenance_requirements")
        .update(requirementPayload)
        .eq("id", requirementId)
        .eq("apparatus_id", apparatusId)
        .eq("department_id", departmentId);

      if (updateError) {
        return {
          ok: false,
          error: updateError.message || "Unable to save maintenance requirement.",
        };
      }
    } else {
      const { data: insertedRequirement, error: insertError } = await supabase
        .from("apparatus_maintenance_requirements")
        .insert(requirementPayload)
        .select("id")
        .maybeSingle();

      if (insertError) {
        return {
          ok: false,
          error: insertError.message || "Unable to save maintenance requirement.",
        };
      }

      requirementId = typeof insertedRequirement?.id === "string" ? insertedRequirement.id : null;
    }

    if (!requirementId) {
      continue;
    }

    const { error: deleteMethodsError } = await supabase
      .from("apparatus_maintenance_requirement_methods")
      .delete()
      .eq("apparatus_maintenance_requirement_id", requirementId)
      .eq("department_id", departmentId);

    if (deleteMethodsError) {
      return {
        ok: false,
        error: deleteMethodsError.message || "Unable to replace maintenance schedule.",
      };
    }

    const methodPayload = {
      department_id: departmentId,
      apparatus_maintenance_requirement_id: requirementId,
      method_type: methodType,
      interval_value: intervalValue,
      due_soon_threshold_value: thresholds.dueSoon,
      early_overdue_threshold_value: thresholds.earlyOverdue,
      moderate_overdue_threshold_value: thresholds.moderateOverdue,
    };

    const { error: methodUpsertError } = await supabase
      .from("apparatus_maintenance_requirement_methods")
      .insert(methodPayload);

    if (methodUpsertError) {
      return {
        ok: false,
        error: methodUpsertError.message || "Unable to save maintenance schedule.",
      };
    }
  }

  return { ok: true };
}
