import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ActiveApparatusOption = {
  id: string;
  name: string | null;
};

export type ArchivedApparatusRow = {
  id: string;
  name: string | null;
  type: string | null;
  department_id: string | null;
  lifecycle_status: "active" | "archived" | null;
};

async function getOpenDeficiencyStatusId() {
  const { data, error } = await supabase
    .from("deficiency_statuses")
    .select("id, name")
    .order("display_order", { ascending: true });

  if (error) {
    console.error(error);
    return null;
  }

  const openStatus = (data ?? []).find((row) => {
    const record = row as Record<string, unknown>;
    return typeof record.name === "string" && record.name.trim().toLowerCase() === "open";
  }) as Record<string, unknown> | undefined;

  return typeof openStatus?.id === "string" ? openStatus.id : null;
}

export async function getApparatus(client?: SupabaseClient) {
  const targetClient = client ?? supabase;
  const { data, error } = await targetClient
    .from("apparatus")
    .select("*")
    .eq("lifecycle_status", "active")
    .order("name");

  if (error) {
    console.error("[getApparatus] apparatus query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      usingServerClient: Boolean(client),
    });
    return [];
  }

  return data ?? [];
}

export async function getActiveApparatusOptions({
  client,
  departmentId,
}: {
  client?: SupabaseClient;
  departmentId?: string | null;
} = {}): Promise<ActiveApparatusOption[]> {
  const targetClient = client ?? supabase;
  let query = targetClient
    .from("apparatus")
    .select("id, name")
    .eq("lifecycle_status", "active")
    .order("name", { ascending: true });

  if (typeof departmentId === "string" && departmentId.trim().length > 0) {
    query = query.eq("department_id", departmentId.trim());
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getActiveApparatusOptions] apparatus options query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      usingServerClient: Boolean(client),
      hasDepartmentFilter: Boolean(departmentId),
    });
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    name: typeof row.name === "string" ? row.name : null,
  }));
}

export async function getArchivedApparatus(
  departmentId: string | null,
  client?: SupabaseClient,
): Promise<ArchivedApparatusRow[]> {
  if (!departmentId) {
    return [];
  }

  const targetClient = client ?? supabase;

  const { data, error } = await targetClient
    .from("apparatus")
    .select("id, name, type, department_id, lifecycle_status")
    .eq("department_id", departmentId)
    .eq("lifecycle_status", "archived")
    .order("name");

  if (error) {
    console.error(error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    name: typeof row.name === "string" ? row.name : null,
    type: typeof row.type === "string" ? row.type : null,
    department_id: typeof row.department_id === "string" ? row.department_id : null,
    lifecycle_status:
      row.lifecycle_status === "active" || row.lifecycle_status === "archived"
        ? row.lifecycle_status
        : null,
  }));
}

export async function getOpenDeficiencyCountsByApparatusIds(apparatusIds: string[]) {
  if (apparatusIds.length === 0) {
    return {};
  }

  const openStatusId = await getOpenDeficiencyStatusId();

  if (!openStatusId) {
    return {};
  }

  const { data, error } = await supabase
    .from("deficiencies")
    .select("apparatus_id")
    .eq("status", openStatusId)
    .in("apparatus_id", apparatusIds);

  if (error) {
    console.error(error);
    return {};
  }

  return (data ?? []).reduce<Record<string, number>>((accumulator, row) => {
    const record = row as Record<string, unknown>;
    const apparatusId = typeof record.apparatus_id === "string" ? record.apparatus_id : "";

    if (!apparatusId) {
      return accumulator;
    }

    accumulator[apparatusId] = (accumulator[apparatusId] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function getApparatusById(id: string, client?: SupabaseClient) {
  const targetClient = client ?? supabase;

  const { data, error } = await targetClient
    .from("apparatus")
    .select("*, department:departments(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getApparatusById] apparatus lookup failed", {
      apparatusId: id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      usingServerClient: Boolean(client),
    });
    return null;
  }

  return data ?? null;
}

export async function getAssetById(id: string) {
  console.log("[getAssetById] Requested asset ID:", id);

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[getAssetById] Full Supabase error");
    console.error("Requested ID:", id);
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
    throw new Error(
      typeof error === "string"
        ? error
        : error?.message ?? JSON.stringify(error)
    );
  }

  console.log("[getAssetById] Retrieved asset:", data);

  return data;
}

export async function updateApparatusStatus(
  id: string,
  status: "ready" | "needs_attention" | "out_of_service"
) {
  const { error } = await supabase
    .from("apparatus")
    .update({
      status,
      last_inspection_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return false;
  }

  return true;
}

interface SaveInspectionParams {
  apparatusId: string;
  status: "ready" | "needs_attention" | "out_of_service";
  notes: string;
}

export async function saveInspection({
  apparatusId,
  status,
  notes,
}: SaveInspectionParams) {
  // Create an inspection history record
  const { error: inspectionError } = await supabase
    .from("apparatus_inspections")
    .insert({
      apparatus_id: apparatusId,
      status,
      notes,
    });

  if (inspectionError) {
    console.error(inspectionError);
    return false;
  }

  // Update the current apparatus status
  const success = await updateApparatusStatus(apparatusId, status);

  return success;
}