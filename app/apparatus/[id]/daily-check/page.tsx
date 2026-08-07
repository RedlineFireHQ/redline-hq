import PageLayout from "@/components/layout/PageLayout";
import { getApparatusById } from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

interface DailyCheckPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    result?: "ready" | "ready-with-deficiencies" | "out-of-service";
    confirm?: string;
    submit?: string;
    completionError?: string;
    deficiencyConfirm?: string;
    pendingResult?: "ready-with-deficiencies" | "out-of-service";
  }>;
}

export default async function DailyCheckPage({
  params,
  searchParams,
}: DailyCheckPageProps) {
  const { id } = await params;
  const { result, confirm, submit, completionError, deficiencyConfirm, pendingResult } = await searchParams;
  const apparatus = await getApparatusById(id);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let inspectorName = "Unknown Inspector";

  if (user?.email) {
    const { data: member } = await supabase
      .from("members")
      .select("first_name, last_name")
      .eq("email", user.email)
      .maybeSingle();

    const firstName = typeof member?.first_name === "string" ? member.first_name.trim() : "";
    const lastName = typeof member?.last_name === "string" ? member.last_name.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();
    inspectorName = fullName || user.email;
  }

  const routeApparatusName = id
    .split("-")
    .map((segment) =>
      segment ? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}` : segment
    )
    .join(" ");

  const apparatusName =
    typeof apparatus?.name === "string" && apparatus.name.trim()
      ? apparatus.name.trim()
      : routeApparatusName;

  const departmentName =
    typeof apparatus?.department_name === "string" && apparatus.department_name.trim()
      ? apparatus.department_name.trim()
      : typeof apparatus?.department?.name === "string" && apparatus.department.name.trim()
        ? apparatus.department.name.trim()
        : "Not Available";

  const now = new Date();
  const inspectionDate = now.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
  const inspectionTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const selectedResult =
    result === "ready-with-deficiencies" || result === "out-of-service" || result === "ready"
      ? result
      : null;

  const requiresDeficiency =
    selectedResult === "ready-with-deficiencies" || selectedResult === "out-of-service";

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const { data: latestInspectionForPeriod } = await supabase
    .from("apparatus_inspections")
    .select("id, status, created_at")
    .eq("apparatus_id", id)
    .gte("created_at", dayStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inspectionAlreadyCompleted = Boolean(latestInspectionForPeriod?.id);

  const { count: reportedDeficiencyCount } = await supabase
    .from("deficiencies")
    .select("id", { count: "exact", head: true })
    .eq("apparatus_id", id);

  const { data: reportedDeficienciesRaw } = await supabase
    .from("deficiencies")
    .select("id, deficiency_number, description")
    .eq("apparatus_id", id)
    .order("reported_at", { ascending: false })
    .limit(6);

  const reportedDeficiencies = (reportedDeficienciesRaw ?? []).map((item) => {
    const row = item as Record<string, unknown>;
    const idValue = row.id;
    const deficiencyNumberValue = row.deficiency_number;
    const descriptionValue = row.description;

    return {
      id: typeof idValue === "string" ? idValue : String(idValue ?? ""),
      deficiencyNumber:
        typeof deficiencyNumberValue === "string" ? deficiencyNumberValue : "Unassigned",
      description:
        typeof descriptionValue === "string" && descriptionValue.trim()
          ? descriptionValue.trim()
          : "No description provided.",
    };
  });

  const deficiencyCount = reportedDeficiencyCount ?? 0;
  const hasRequiredDeficiency = selectedResult ? !requiresDeficiency || deficiencyCount > 0 : false;
  const canCompleteInspection = Boolean(selectedResult) && hasRequiredDeficiency && !inspectionAlreadyCompleted;
  const showConfirmationDialog = confirm === "1" && canCompleteInspection;
  const selectedPendingResult =
    pendingResult === "ready-with-deficiencies" || pendingResult === "out-of-service"
      ? pendingResult
      : null;
  const showDeficiencyConfirmDialog = deficiencyConfirm === "1" && selectedPendingResult !== null;

  console.log("[daily-check] completion gate values", {
    submit,
    confirm,
    result,
    selectedResult,
    requiresDeficiency,
    deficiencyCount,
    hasRequiredDeficiency,
    inspectionAlreadyCompleted,
    canCompleteInspection,
    id,
    mappedStatus:
      selectedResult === "ready"
        ? "ready"
        : selectedResult === "ready-with-deficiencies"
          ? "needs_attention"
          : selectedResult === "out-of-service"
            ? "out_of_service"
            : null,
  });

  if (submit === "1" && canCompleteInspection && selectedResult) {
    console.log("ENTERED COMPLETION BRANCH");
    console.log("========================================\nCOMPLETE INSPECTION ACTION STARTED\nApparatus ID:", id, "\n========================================");
    const mappedStatus =
      selectedResult === "ready"
        ? "ready"
        : selectedResult === "ready-with-deficiencies"
          ? "needs_attention"
          : "out_of_service";
    console.log("[daily-check] mappedStatus before save_apparatus_inspection", {
      apparatusId: id,
      selectedResult,
      mappedStatus,
    });

    console.log("CALLING save_apparatus_inspection");

    const { error: completionErrorResult } = await supabase.rpc("save_apparatus_inspection", {
      p_apparatus_id: id,
      p_status: mappedStatus,
      p_notes: null,
    });

    console.log("completionErrorResult", completionErrorResult);

    if (completionErrorResult) {
      const encodedError = encodeURIComponent(
        completionErrorResult.message || "Unable to complete inspection."
      );
      redirect(
        `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1&completionError=${encodedError}`
      );
    }

    redirect("/apparatus");
  }

  const readyHref = `/apparatus/${id}/daily-check?result=ready`;
  const readyWithDeficienciesConfirmHref = `/apparatus/${id}/daily-check?result=ready-with-deficiencies&deficiencyConfirm=1&pendingResult=ready-with-deficiencies`;
  const outOfServiceConfirmHref = `/apparatus/${id}/daily-check?result=out-of-service&deficiencyConfirm=1&pendingResult=out-of-service`;
  const readyWithDeficienciesLaunchHref = `/deficiencies/report?apparatusId=${id}&returnTo=/apparatus/${id}/daily-check?result=ready-with-deficiencies`;
  const outOfServiceLaunchHref = `/deficiencies/report?apparatusId=${id}&returnTo=/apparatus/${id}/daily-check?result=out-of-service`;
  const addAnotherDeficiencyHref =
    selectedResult === "out-of-service"
      ? outOfServiceLaunchHref
      : readyWithDeficienciesLaunchHref;
  const openConfirmHref = selectedResult
    ? `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1`
    : `/apparatus/${id}/daily-check`;
  const completeHref = selectedResult
    ? `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1&submit=1`
    : `/apparatus/${id}/daily-check`;
  const cancelConfirmHref = selectedResult
    ? `/apparatus/${id}/daily-check?result=${selectedResult}`
    : `/apparatus/${id}/daily-check`;
  const launchConfirmedDeficiencyHref =
    selectedPendingResult === "out-of-service"
      ? outOfServiceLaunchHref
      : readyWithDeficienciesLaunchHref;

  const completionErrorMessage =
    typeof completionError === "string" && completionError.trim()
      ? decodeURIComponent(completionError)
      : null;

  const completedStatusLabel =
    latestInspectionForPeriod?.status === "out_of_service"
      ? "Out of Service"
      : latestInspectionForPeriod?.status === "needs_attention"
        ? "Ready for Service with Deficiencies"
        : "Ready for Service";

  const completedAtLabel = latestInspectionForPeriod?.created_at
    ? new Date(latestInspectionForPeriod.created_at).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const requiresEngineHoursToday = false;
  const requiresMileageToday = false;

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
            Apparatus Check
          </p>

          <h1 className="mt-2 text-5xl font-black tracking-tight text-white">
            {apparatusName.toUpperCase()}
          </h1>

          <p className="mt-3 text-neutral-400">
            Record the operational result of an inspection already completed.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Apparatus</p>
              <p className="mt-1 text-sm font-semibold text-white">{apparatusName}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Department</p>
              <p className="mt-1 text-sm font-semibold text-white">{departmentName}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Inspector</p>
              <p className="mt-1 text-sm font-semibold text-white">{inspectorName}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Inspection Date</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {inspectionDate} at {inspectionTime}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
          <h2 className="text-3xl font-bold text-white">Overall Inspection Result</h2>

          <div className="mt-8 space-y-4">
            <label className="block cursor-pointer">
              <input type="radio" checked={selectedResult === "ready"} readOnly className="peer sr-only" />
              <Link
                href={readyHref}
                className={`block rounded-xl border bg-neutral-900 p-6 transition ${
                  selectedResult === "ready"
                    ? "border-green-500 bg-green-950/20"
                    : "border-neutral-700 hover:border-green-500 hover:bg-green-950/20"
                }`}
              >
                <h3 className="text-xl font-bold text-white">Ready for Service</h3>
                <p className="mt-2 text-neutral-300">
                  All operational systems are functioning properly.
                </p>

                <span className="mt-4 inline-flex rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800">
                  Review Inspection Items
                </span>
              </Link>
            </label>

            <label className="block cursor-pointer">
              <input
                type="radio"
                checked={selectedResult === "ready-with-deficiencies"}
                readOnly
                className="peer sr-only"
              />
              <Link
                href={readyWithDeficienciesConfirmHref}
                className={`block rounded-xl border bg-neutral-900 p-6 transition ${
                  selectedResult === "ready-with-deficiencies"
                    ? "border-yellow-500 bg-yellow-950/20"
                    : "border-neutral-700 hover:border-yellow-500 hover:bg-yellow-950/20"
                }`}
              >
                <h3 className="text-xl font-bold text-white">Ready for Service with Deficiencies</h3>
                <p className="mt-2 text-neutral-300">
                  Apparatus can safely respond, but deficiencies were identified.
                </p>
              </Link>
            </label>

            <label className="block cursor-pointer">
              <input
                type="radio"
                checked={selectedResult === "out-of-service"}
                readOnly
                className="peer sr-only"
              />
              <Link
                href={outOfServiceConfirmHref}
                className={`block rounded-xl border bg-neutral-900 p-6 transition ${
                  selectedResult === "out-of-service"
                    ? "border-red-500 bg-red-950/20"
                    : "border-neutral-700 hover:border-red-500 hover:bg-red-950/20"
                }`}
              >
                <h3 className="text-xl font-bold text-white">Out of Service</h3>
                <p className="mt-2 text-neutral-300">
                  Apparatus cannot safely respond.
                </p>
              </Link>
            </label>

            {(selectedResult === "ready-with-deficiencies" || selectedResult === "out-of-service") && (
              <div className="rounded-xl border border-neutral-700 bg-[#1B1B1B] p-5">
                <h4 className="text-lg font-bold text-white">Open Deficiencies</h4>

                {deficiencyCount > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-emerald-300">
                    {`\u2713 ${deficiencyCount} ${deficiencyCount === 1 ? "Deficiency" : "Deficiencies"} Reported`}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-300">
                    A deficiency report is required before this inspection can be completed.
                  </p>
                )}

                {reportedDeficiencies.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {reportedDeficiencies.map((deficiency) => (
                      <div
                        key={deficiency.id}
                        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
                      >
                        <p className="text-sm text-neutral-200">{`\u2713 ${deficiency.description}`}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <Link
                  href={addAnotherDeficiencyHref}
                  className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  Add Another Deficiency
                </Link>
              </div>
            )}
          </div>
        </div>

        {(requiresEngineHoursToday || requiresMileageToday) && (
          <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
            <h2 className="text-2xl font-bold text-white">Hours / Mileage</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {requiresEngineHoursToday ? (
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-200">Engine Hours</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Enter current engine hours"
                    className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
                  />
                </label>
              ) : null}

              {requiresMileageToday ? (
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-200">Mileage</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter current mileage"
                    className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
                  />
                </label>
              ) : null}
            </div>
          </div>
        )}

        {/* These flags will later be driven by department inspection schedule configuration. */}
        {/* Future readiness calculations will consume captured Engine Hours and Mileage values. */}

        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
          {inspectionAlreadyCompleted ? (
            <div className="space-y-4">
              <div id="completed-inspection-summary" className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-200">Inspection Already Completed</p>
                <p className="mt-1 text-sm text-emerald-100">Status: {completedStatusLabel}</p>
                {completedAtLabel ? <p className="mt-1 text-sm text-emerald-100">Completed: {completedAtLabel}</p> : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/apparatus/${id}`}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  Return to Apparatus
                </Link>
                <Link
                  href="#completed-inspection-summary"
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  View Completed Inspection Summary
                </Link>
              </div>
            </div>
          ) : canCompleteInspection ? (
            <Link
              href={openConfirmHref}
              className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700"
            >
              Complete Inspection
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-xl bg-red-900/60 px-8 py-4 text-lg font-bold text-white/70"
            >
              Complete Inspection
            </button>
          )}

          {!inspectionAlreadyCompleted && !selectedResult ? (
            <p className="mt-3 text-sm text-amber-300">Select an inspection result before continuing.</p>
          ) : null}

          {!inspectionAlreadyCompleted && selectedResult && !hasRequiredDeficiency ? (
            <p className="mt-3 text-sm text-amber-300">
              A deficiency report is required before this inspection can be completed.
            </p>
          ) : null}
        </div>

        <div className="flex">
          <Link
            href={`/apparatus/${id}`}
            className="rounded-xl border border-neutral-700 px-6 py-4 text-white transition hover:bg-neutral-800"
          >
            Back to Apparatus
          </Link>
        </div>

        {showConfirmationDialog ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#171717] p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white">Confirm Inspection Completion</h3>
              <p className="mt-4 text-sm text-neutral-300">
                By completing this inspection, you certify that you have inspected this apparatus according to your department's inspection procedures. Any deficiencies identified during the inspection have been reported.
              </p>

              {completionErrorMessage ? (
                <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {completionErrorMessage}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-3">
                <Link
                  href={cancelConfirmHref}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  Cancel
                </Link>
                <Link
                  href={completeHref}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Yes, Complete Inspection
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showDeficiencyConfirmDialog ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#171717] p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white">Report Deficiency</h3>
              <p className="mt-4 text-sm text-neutral-300">
                You selected an inspection result that requires a deficiency report.
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                Would you like to report a deficiency now?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <Link
                  href={cancelConfirmHref}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  Cancel
                </Link>
                <Link
                  href={launchConfirmedDeficiencyHref}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Report Deficiency
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}