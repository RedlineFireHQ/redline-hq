import type { SupabaseClient } from "@supabase/supabase-js";
import { canManagePersonnel } from "@/lib/member-permissions";
import { buildFitReport, type ReportMember, type ReportTest } from "@/lib/scba-mask-fit/report";
import { FIT_TEST_TIME_ZONE, fitTestLocalDate } from "@/lib/scba-mask-fit/status";
import { formatReportPeriodLabel } from "@/lib/reports/date-range";
import type { ReportRow, ReportRunRequest, ReportRunResponse, ReportSourceConfig } from "@/lib/reports/types";

type Context = { supabase: SupabaseClient; departmentId: string; departmentName: string | null; memberRole: string };

export async function runScbaMaskFitReport(
  request: ReportRunRequest, context: Context, source: ReportSourceConfig, from: string, to: string,
): Promise<ReportRunResponse> {
  if (!await canManagePersonnel(context.supabase, context.departmentId, context.memberRole)) {
    return { ok: false, errorCode: "FORBIDDEN", error: "Personnel management permission is required for fit test reports." };
  }
  const members: ReportMember[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await context.supabase.from("members")
      .select("id, first_name, last_name").eq("department_id", context.departmentId)
      .order("last_name").order("first_name").order("id").range(offset, offset + 499);
    if (error) return { ok: false, errorCode: "QUERY_ERROR", error: `Unable to load personnel: ${error.message}` };
    for (const member of data ?? []) members.push({
      id: String(member.id),
      name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || String(member.id),
    });
    if ((data?.length ?? 0) < 500) break;
  }
  const tests: ReportTest[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await context.supabase.rpc("search_scba_mask_fit_history", {
      p_department_id: context.departmentId, p_offset: offset, p_limit: 500,
    });
    if (error) return { ok: false, errorCode: "QUERY_ERROR", error: `Unable to load fit tests: ${error.message}` };
    const page = (data ?? []) as ReportTest[];
    tests.push(...page);
    if (page.length < 500) break;
  }
  const mode = request.filters.view === "history" ? "history" : "latest";
  const today = fitTestLocalDate(new Date());
  const allTime = request.dateRange.preset === "all-time";
  const lines = buildFitReport(members, tests, {
    mode, memberId: request.filters.member_id || "all", search: request.searchTerm,
    from, to, today, allTime,
  });
  const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
  const page = Math.max(1, Number(request.page) || 1);
  const rows: ReportRow[] = lines.slice((page - 1) * pageSize, page * pageSize).map((line) => ({ ...line }));
  return {
    ok: true, comingSoon: false,
    source: { key: source.key, name: source.name, description: source.description },
    departmentName: context.departmentName, generatedAt: new Date().toISOString(),
    period: { from, to, label: allTime ? "All Time" : formatReportPeriodLabel(from, to), basisLabel: "Test date" },
    filtersApplied: [
      { label: "View", value: mode === "latest" ? "Latest Test per Member" : "Historical Test Records" },
      ...(request.filters.member_id && request.filters.member_id !== "all"
        ? [{ label: "Member", value: members.find((member) => member.id === request.filters.member_id)?.name ?? request.filters.member_id }]
        : []),
      ...(request.searchTerm.trim() ? [{ label: "Search", value: request.searchTerm.trim() }] : []),
    ],
    columns: source.columns, rows, totalRows: lines.length, page, pageSize,
    message: mode === "latest" ? `Statuses are as of ${today} (${FIT_TEST_TIME_ZONE}). Members with no test are included.${allTime ? "" : " Dated tests outside the selected period are excluded."}` : "Historical test statuses do not determine the member's current standing.",
  };
}
