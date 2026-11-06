import type { SupabaseClient } from "@supabase/supabase-js";
import { department } from "./department";

export type CompletedHoseResult = { hose_id: string; result: "pass" | "fail" };

export function hoseTestingDate(now = new Date(), timeZone = department.timezone): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function completeHoseTest(
  client: SupabaseClient,
  values: { departmentId: string; testingDate: string; tester: string; results: CompletedHoseResult[] },
): Promise<string> {
  const { data, error } = await client.rpc("complete_fire_hose_test", {
    p_department_id: values.departmentId,
    p_test_date: values.testingDate,
    p_tester: values.tester,
    p_results: values.results,
  });
  if (error) throw new Error(error.message || "Unable to save the completed hose test.");
  if (typeof data !== "string" || !data) throw new Error("Hose testing did not return a saved session.");
  return data;
}

export function formatHoseTestDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function hoseNextTestLabel(value: string | null | undefined, today = new Date()): string {
  if (!value) return "Pending";
  const localToday = hoseTestingDate(today);
  return value < localToday ? "Overdue" : formatHoseTestDate(value);
}
