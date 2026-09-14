import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type InspectionSession = {
  id: string;
  test_date: string | null;
  tester: string | null;
  created_at: string | null;
};

type InspectionResult = {
  testing_session_id: string | null;
  result: string | null;
};

type RopeRecord = {
  id: string;
  rope_identifier: string | null;
  rope_name: string | null;
  rope_type: string | null;
  length_ft: number | null;
};

type RopeInspectionHistoryRecord = {
  testing_session_id: string | null;
  result: string | null;
  test_date: string | null;
  tester: string | null;
  rope_identifier: string | null;
  rope_item_id: string | null;
};

type PageProps = {
  searchParams: Promise<{
    ropeId?: string;
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

export default async function RopeInspectionHistoryPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;

  const resolvedSearchParams = await searchParams;
  const ropeId = typeof resolvedSearchParams.ropeId === "string" ? resolvedSearchParams.ropeId.trim() : "";

  if (!departmentId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection History</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to determine your department.</p>
        </div>
      </div>
    );
  }

  const { data: sessionRows, error: sessionError } = await supabase
    .from("rope_testing_sessions")
    .select("id, test_date, tester, created_at")
    .eq("department_id", departmentId)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (ropeId) {
    const { data: ropeRow, error: ropeError } = await supabase
      .from("rope_items")
      .select("id, rope_identifier, rope_name, rope_type, length_ft")
      .eq("department_id", departmentId)
      .eq("id", ropeId)
      .maybeSingle();

    const { data: ropeHistoryRows, error: ropeHistoryError } = await supabase
      .from("rope_testing_results")
      .select("testing_session_id, result, test_date, tester, rope_identifier, rope_item_id")
      .eq("department_id", departmentId)
      .eq("rope_item_id", ropeId)
      .order("test_date", { ascending: false })
      .order("created_at", { ascending: false });

    const { data: deficiencyRows } = await supabase
      .from("deficiencies")
      .select("id, deficiency_number, rope_item_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
      .eq("rope_item_id", ropeId);

    if (ropeError || ropeHistoryError) {
      return (
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
            <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection History</h1>
            <p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to load rope inspection history.</p>
          </div>
          <div className="rounded-2xl border border-red-900 bg-[#242424] p-6 text-sm text-red-200">
            {ropeError?.message || ropeHistoryError?.message || "Unable to load rope inspection history."}
          </div>
        </div>
      );
    }

    const rope = ropeRow as RopeRecord | null;
    const ropeHistory = (ropeHistoryRows ?? []) as RopeInspectionHistoryRecord[];

    const deficiencyLabels = (deficiencyRows ?? []).map((row) => {
      const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
      const statusName = statusInfo?.name ?? (statusInfo?.active ? "Active" : "Unknown");
      return `${row.deficiency_number ?? row.id} (${statusName})`;
    });

    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
            <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">ROPE INSPECTION HISTORY</h1>
            <p className="mt-3 max-w-2xl text-lg text-neutral-400">
              Rope {rope?.rope_identifier ?? ropeId}
              {rope?.rope_name ? ` • ${rope.rope_name}` : ""}
              {rope?.rope_type ? ` • ${rope.rope_type}` : ""}
            </p>
          </div>

          <Link
            href="/inventory/rope/inspection-history"
            className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to All History
          </Link>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {["Inspection Date", "Inspector", "Result", "Related Deficiency"].map((label) => (
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
                {ropeHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
                      No rope inspection records were found for this rope.
                    </td>
                  </tr>
                ) : (
                  ropeHistory.map((row, index) => (
                    <tr key={`${row.testing_session_id ?? ropeId}-${index}`} className="transition hover:bg-white/5">
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-white">{formatDate(row.test_date)}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.tester ?? "-"}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.result === "pass" ? "border border-green-700/40 bg-green-900/20 text-green-200" : "border border-red-700/40 bg-red-900/20 text-red-200"}`}>
                          {formatResult(row.result)}
                        </span>
                      </td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                        {deficiencyLabels.length > 0 ? deficiencyLabels.join(", ") : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection History</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to load inspection history right now.</p>
        </div>
        <div className="rounded-2xl border border-red-900 bg-[#242424] p-6 text-sm text-red-200">
          {sessionError.message}
        </div>
      </div>
    );
  }

  const sessions = (sessionRows ?? []) as InspectionSession[];
  const sessionIds = sessions.map((session) => session.id).filter(Boolean);

  const { data: resultRows } = sessionIds.length
    ? await supabase
        .from("rope_testing_results")
        .select("testing_session_id, result")
        .eq("department_id", departmentId)
        .in("testing_session_id", sessionIds)
    : { data: [] as InspectionResult[] };

  const countsBySessionId = new Map<string, { total: number; passed: number; failed: number }>();
  for (const sessionId of sessionIds) {
    countsBySessionId.set(sessionId, { total: 0, passed: 0, failed: 0 });
  }

  for (const row of (resultRows ?? []) as InspectionResult[]) {
    if (!row.testing_session_id) {
      continue;
    }

    const aggregate = countsBySessionId.get(row.testing_session_id) ?? { total: 0, passed: 0, failed: 0 };
    aggregate.total += 1;
    if ((row.result ?? "").trim().toLowerCase() === "pass") {
      aggregate.passed += 1;
    } else if ((row.result ?? "").trim().toLowerCase() === "fail") {
      aggregate.failed += 1;
    }
    countsBySessionId.set(row.testing_session_id, aggregate);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Rope</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Inspection History</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">
            Recent rope inspection sessions recorded by the department.
          </p>
        </div>

        <Link
          href="/inventory/rope"
          className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          Back to Rope Inventory
        </Link>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                {["Inspection Date", "Inspector", "Ropes Inspected", "Passed", "Failed", "View"].map((label) => (
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
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-white">No Rope Inspection History</p>
                      <p>Completed rope inspection sessions will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const counts = countsBySessionId.get(session.id) ?? { total: 0, passed: 0, failed: 0 };
                  return (
                    <tr key={session.id} className="transition hover:bg-white/5">
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-white">{formatDate(session.test_date)}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{session.tester ?? "-"}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{counts.total}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-green-200">{counts.passed}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-red-200">{counts.failed}</td>
                      <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                        <Link
                          href={`/inventory/rope/inspection-history/${session.id}`}
                          className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
                        >
                          View Session
                        </Link>
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
