import { supabase } from "./supabase";

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