"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { DailyLogFields } from "@/lib/daily-log";

export async function saveDailyLog(input: DailyLogFields, id: string | null, version: string | null) {
  const client = await createSupabaseServerClient();
  const member = await getCurrentMember(client);
  if (!member?.departmentId) return { error: "Please sign in to an active department." };
  const { data, error } = await client.rpc("save_daily_log", {
    p_department_id: member.departmentId, p_id: id,
    p_entry_date: input.entry_date || null, p_entry_time: input.entry_time || null,
    p_location: input.location || null, p_activity: input.activity || null, p_unit: input.unit || null,
    p_expected_version: version,
  });
  if (error) {
    console.error("Daily Log save failed", error.code, error.message);
    return { error: "Unable to save. You must be the creator or an Administrator to edit. If the entry changed, reload and try again." };
  }
  if (typeof data !== "string") throw new Error("Invalid Daily Log save response.");
  revalidatePath("/daily-log");
  revalidatePath("/mobile/daily-log");
  return { id: data };
}

export async function archiveDailyLog(id: string, version: string) {
  const client = await createSupabaseServerClient();
  const member = await getCurrentMember(client);
  if (!member?.departmentId) return { error: "Please sign in to an active department." };
  const { error } = await client.rpc("archive_daily_log", {
    p_department_id: member.departmentId, p_id: id, p_expected_version: version,
  });
  if (error) {
    console.error("Daily Log archive failed", error.code, error.message);
    return { error: "Unable to archive. A department Administrator is required. If the entry changed, reload and try again." };
  }
  revalidatePath("/daily-log");
  revalidatePath("/mobile/daily-log");
  return { ok: true };
}
