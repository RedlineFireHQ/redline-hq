import { supabase } from "./supabase";

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

export async function getApparatus() {
  const { data, error } = await supabase
    .from("apparatus")
    .select("*")
    .order("name");

  if (error) {
    console.error(error);
    return [];
  }

  return data;
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

export async function getApparatusById(id: string) {
  const { data, error } = await supabase
    .from("apparatus")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
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