import type { SupabaseClient } from "@supabase/supabase-js";
import { RED_OAK_FIRE_DEPARTMENT_ID } from "@/lib/red-oak-ems-competency";
import type { ReportRunRequest, ReportRunResponse, ReportSourceConfig } from "@/lib/reports/types";

type Context = { supabase: SupabaseClient; departmentId: string; departmentName: string | null; memberRole: string };

export async function runRedOakEmsCompetencyReport(
  request: ReportRunRequest,
  context: Context,
  source: ReportSourceConfig,
): Promise<ReportRunResponse> {
  if (context.departmentId !== RED_OAK_FIRE_DEPARTMENT_ID) {
    return { ok: false, errorCode: "FORBIDDEN", error: "This report is available only to Red Oak Fire Department." };
  }

  let query = context.supabase.from("red_oak_ems_competency_verifications")
    .select("id, member_id, verification_year, certification_level, evaluator, skill_results, remediation_skills, remediation_training_completed, re_verification_date, re_verification_outcome, overall_status, member_signature, member_signature_date, evaluator_signature, evaluator_signature_date, cqi_service_director_review, cqi_service_director_review_date, created_at")
    .eq("department_id", RED_OAK_FIRE_DEPARTMENT_ID)
    .order("verification_year", { ascending: false })
    .order("created_at", { ascending: false });

  if (request.filters.member_id && request.filters.member_id !== "all") {
    query = query.eq("member_id", request.filters.member_id);
  }
  const year = request.filters.verification_year?.trim();
  if (year) {
    if (!/^\d{4}$/.test(year)) {
      return { ok: false, errorCode: "INVALID_INPUT", error: "Enter a four-digit verification year." };
    }
    query = query.eq("verification_year", Number(year));
  }

  const { data, error } = await query;
  if (error) return { ok: false, errorCode: "QUERY_ERROR", error: "Unable to load competency verifications: " + error.message };

  const memberIds = Array.from(new Set((data ?? []).map((row) => String(row.member_id))));
  const names = new Map<string, string>();
  if (memberIds.length) {
    const { data: memberRows, error: memberError } = await context.supabase.from("members")
      .select("id, first_name, last_name").eq("department_id", RED_OAK_FIRE_DEPARTMENT_ID).in("id", memberIds);
    if (memberError) return { ok: false, errorCode: "QUERY_ERROR", error: "Unable to load member names: " + memberError.message };
    for (const member of memberRows ?? []) names.set(String(member.id), `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim());
  }

  const rows = (data ?? []).map((row) => ({
    member_name: names.get(String(row.member_id)) ?? "Unknown Member",
    verification_year: String(row.verification_year),
    certification_level: row.certification_level,
    overall_status: row.overall_status,
    evaluator: row.evaluator,
    skill_results_json: JSON.stringify(row.skill_results ?? []),
    remediation_skills: row.remediation_skills ?? "",
    remediation_training_completed: row.remediation_training_completed ?? "",
    re_verification_date: row.re_verification_date ?? "",
    re_verification_outcome: row.re_verification_outcome ?? "",
    member_signature: row.member_signature ?? "",
    member_signature_date: row.member_signature_date ?? "",
    evaluator_signature: row.evaluator_signature ?? "",
    evaluator_signature_date: row.evaluator_signature_date ?? "",
    cqi_service_director_review: row.cqi_service_director_review ?? "",
    cqi_service_director_review_date: row.cqi_service_director_review_date ?? "",
  }));

  const search = request.searchTerm.trim().toLowerCase();
  const filtered = search ? rows.filter((row) =>
    row.member_name.toLowerCase().includes(search)
    || row.certification_level.toLowerCase().includes(search)
    || row.evaluator.toLowerCase().includes(search)
  ) : rows;

  return {
    ok: true, comingSoon: false,
    source: { key: source.key, name: source.name, description: source.description },
    departmentName: context.departmentName, generatedAt: new Date().toISOString(),
    period: { from: "", to: "", label: "All Verification Years", basisLabel: "Annual verification year" },
    filtersApplied: [
      ...(year ? [{ label: "Verification Year", value: year }] : []),
      ...(request.filters.member_id && request.filters.member_id !== "all"
        ? [{ label: "Member", value: names.get(request.filters.member_id) ?? request.filters.member_id }] : []),
      ...(search ? [{ label: "Search", value: request.searchTerm.trim() }] : []),
    ],
    columns: source.columns, rows: filtered, totalRows: filtered.length, page: 1, pageSize: filtered.length,
  };
}
