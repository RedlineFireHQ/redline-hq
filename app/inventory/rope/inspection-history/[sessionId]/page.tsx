import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type InspectionSession = {
  id: string;
  test_date: string | null;
  tester: string | null;
  created_at: string | null;
};

type RopeResultRow = {
  testing_session_id: string | null;
  rope_item_id: string | null;
  rope_identifier: string | null;
  test_date: string | null;
  tester: string | null;
  result: string | null;
};

type RopeItemRow = {
  id: string;
  rope_name: string | null;
  rope_type: string | null;
  length_ft: number | null;
};

type DeficiencyRow = {
  id: string;
  deficiency_number: string | null;
  rope_item_id: string | null;
  status_info: { active: boolean | null; name: string | null } | { active: boolean | null; name: string | null }[] | null;
};

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatResult(value: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "pass") {
    return "PASS";
  }
  if (normalized === "fail") {
    return "FAIL";
  }
  return value ?? "-";
}

function getResultBadgeClasses(result: string) {
  const normalized = result.trim().toLowerCase();
  if (normalized === "pass") {
    return "border border-green-700/40 bg-green-900/20 text-green-200";
  }
  if (normalized === "fail") {
    return "border border-red-700/40 bg-red-900/20 text-red-200";
  }
  return "border border-white/15 bg-neutral-900 text-neutral-200";
}

function getDeficiencySummary(deficiencies: string[]) {
  if (deficiencies.length === 0) {
    return "None";
  }

  return deficiencies.join(", ");
}

export default async function RopeInspectionHistorySessionPage({ params }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;
  const { sessionId } = await params;

  if (!departmentId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection Session</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to determine your department.</p>
        </div>
      </div>
    );
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("rope_testing_sessions")
    .select("id, test_date, tester, created_at")
    .eq("id", sessionId)
    .eq("department_id", departmentId)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection Session</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">Inspection session not found.</p>
        </div>
        <div className="rounded-2xl border border-red-900 bg-[#242424] p-6 text-sm text-red-200">
          {sessionError?.message ?? "No inspection session matched this record."}
        </div>
        <Link
          href="/inventory/rope/inspection-history"
          className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          Back to Inspection History
        </Link>
      </div>
    );
  }

  const session = sessionData as InspectionSession;

  const { data: resultRows } = await supabase
    .from("rope_testing_results")
    .select("testing_session_id, rope_item_id, rope_identifier, test_date, tester, result")
    .eq("testing_session_id", session.id)
    .eq("department_id", departmentId)
    .order("rope_identifier", { ascending: true });

  const results = (resultRows ?? []) as RopeResultRow[];
  const ropeIds = results
    .map((row) => row.rope_item_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const { data: ropeRows } = ropeIds.length
    ? await supabase
        .from("rope_items")
        .select("id, rope_name, rope_type, length_ft")
        .eq("department_id", departmentId)
        .in("id", ropeIds)
    : { data: [] as RopeItemRow[] };

  const { data: deficiencyRows } = ropeIds.length
    ? await supabase
        .from("deficiencies")
        .select("id, deficiency_number, rope_item_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .in("rope_item_id", ropeIds)
    : { data: [] as DeficiencyRow[] };

  const ropeById = new Map<string, RopeItemRow>();
  for (const rope of (ropeRows ?? []) as RopeItemRow[]) {
    ropeById.set(rope.id, rope);
  }

  const deficiencySummaryByRopeId = new Map<string, string[]>();
  for (const row of (deficiencyRows ?? []) as DeficiencyRow[]) {
    if (!row.rope_item_id) {
      continue;
    }

    const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
    const statusName = statusInfo?.name ?? (statusInfo?.active ? "Active" : "Unknown");
    const deficiencyLabel = `${row.deficiency_number ?? row.id} (${statusName})`;
    const existing = deficiencySummaryByRopeId.get(row.rope_item_id) ?? [];
    existing.push(deficiencyLabel);
    deficiencySummaryByRopeId.set(row.rope_item_id, existing);
  }

  const passedCount = results.filter((row) => (row.result ?? "").trim().toLowerCase() === "pass").length;
  const failedCount = results.filter((row) => (row.result ?? "").trim().toLowerCase() === "fail").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection Session</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">
            {formatDate(session.test_date)} • {session.tester ?? "-"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-white/15 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-200">
            {results.length} Ropes Inspected
          </span>
          <Link
            href="/inventory/rope/inspection-history"
            className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Inspection History
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Inspection Date</p>
            <p className="mt-2 text-sm font-semibold text-white">{formatDate(session.test_date)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Inspector</p>
            <p className="mt-2 text-sm font-semibold text-white">{session.tester ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-green-700/30 bg-green-900/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-green-300">Passed</p>
            <p className="mt-2 text-sm font-semibold text-green-100">{passedCount}</p>
          </div>
          <div className="rounded-xl border border-red-700/30 bg-red-900/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-red-300">Failed</p>
            <p className="mt-2 text-sm font-semibold text-red-100">{failedCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                {["Asset ID", "Rope", "Type", "Length", "Result", "Related Deficiency"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
                    No inspection results were recorded in this session.
                  </td>
                </tr>
              ) : (
                results.map((row, index) => {
                  const rope = ropeById.get(row.rope_item_id ?? "");
                  const result = formatResult(row.result);
                  const deficiencies = row.rope_item_id
                    ? deficiencySummaryByRopeId.get(row.rope_item_id) ?? []
                    : [];

                  return (
                    <tr key={`${row.rope_item_id ?? "row"}-${index}`} className="transition hover:bg-white/5">
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-white">{row.rope_identifier ?? "-"}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{rope?.rope_name ?? "-"}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{rope?.rope_type ?? "-"}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{rope?.length_ft ?? "-"} ft</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getResultBadgeClasses(result)}`}>
                          {result}
                        </span>
                      </td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                        {getDeficiencySummary(deficiencies)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
