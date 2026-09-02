import PageLayout from "@/components/layout/PageLayout";
import InspectionHelpersPanel from "@/components/apparatus/InspectionHelpersPanel";
import { getApparatusById } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getChecklistProgress,
  isChecklistSubmissionAllowed,
  type ApparatusChecklistResultStatus,
} from "@/lib/apparatus/checklist";
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
    checkSessionId?: string;
    helperAction?: "add" | "remove";
    helperMemberId?: string;
    helperError?: string;
    helperSearch?: string;
    mileage?: string;
    engineHours?: string;
  }>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function mapResultToStatus(
  result: "ready" | "ready-with-deficiencies" | "out-of-service" | null,
): "ready" | "needs_attention" | "out_of_service" | null {
  if (result === "ready") {
    return "ready";
  }

  if (result === "ready-with-deficiencies") {
    return "needs_attention";
  }

  if (result === "out-of-service") {
    return "out_of_service";
  }

  return null;
}

function parseOptionalMileageInput(value: string | undefined): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseOptionalEngineHoursInput(value: string | undefined): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function buildDailyCheckHref(
  apparatusId: string,
  input: {
    result?: "ready" | "ready-with-deficiencies" | "out-of-service" | null;
    confirm?: string;
    completionError?: string;
    deficiencyConfirm?: string;
    pendingResult?: "ready-with-deficiencies" | "out-of-service" | null;
    checkSessionId?: string | null;
    helperError?: string | null;
    helperAction?: "add" | "remove" | null;
    helperMemberId?: string | null;
    helperSearch?: string | null;
    mileage?: string | null;
    engineHours?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (input.result) {
    params.set("result", input.result);
  }

  if (input.confirm === "1") {
    params.set("confirm", "1");
  }

  if (input.completionError) {
    params.set("completionError", encodeURIComponent(input.completionError));
  }

  if (input.deficiencyConfirm === "1") {
    params.set("deficiencyConfirm", "1");
  }

  if (input.pendingResult) {
    params.set("pendingResult", input.pendingResult);
  }

  if (input.checkSessionId) {
    params.set("checkSessionId", input.checkSessionId);
  }

  if (input.helperError) {
    params.set("helperError", encodeURIComponent(input.helperError));
  }

  if (input.helperAction) {
    params.set("helperAction", input.helperAction);
  }

  if (input.helperMemberId) {
    params.set("helperMemberId", input.helperMemberId);
  }

  if (input.helperSearch && input.helperSearch.trim()) {
    params.set("helperSearch", input.helperSearch.trim());
  }

  if (input.mileage && input.mileage.trim()) {
    params.set("mileage", input.mileage.trim());
  }

  if (input.engineHours && input.engineHours.trim()) {
    params.set("engineHours", input.engineHours.trim());
  }

  const query = params.toString();
  return query.length > 0 ? `/apparatus/${apparatusId}/daily-check?${query}` : `/apparatus/${apparatusId}/daily-check`;
}

export default async function DailyCheckPage({
  params,
  searchParams,
}: DailyCheckPageProps) {
  const { id } = await params;
  const {
    result,
    confirm,
    submit,
    completionError,
    deficiencyConfirm,
    pendingResult,
    checkSessionId,
    helperAction,
    helperMemberId,
    helperError,
    helperSearch,
    mileage,
    engineHours,
  } = await searchParams;
  const apparatus = await getApparatusById(id);
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let inspectorName = "Unknown Inspector";
  let currentMemberId: string | null = null;

  if (currentMember) {
    currentMemberId = currentMember.id;
    inspectorName = currentMember.name || user?.email || inspectorName;
  } else if (user?.email) {
    const { data: member } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("email", user.email)
      .maybeSingle();

    currentMemberId = typeof member?.id === "string" ? member.id : null;
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
  const selectedPendingResult =
    pendingResult === "ready-with-deficiencies" || pendingResult === "out-of-service"
      ? pendingResult
      : null;
  const mappedStatus = mapResultToStatus(selectedResult);
  const selectedHelperAction = helperAction === "add" || helperAction === "remove" ? helperAction : null;
  const selectedHelperMemberId = normalizeUuid(helperMemberId);
  const requestedCheckSessionId = normalizeUuid(checkSessionId);
  const mileageInput = typeof mileage === "string" ? mileage.trim() : "";
  const engineHoursInput = typeof engineHours === "string" ? engineHours.trim() : "";
  const parsedMileage = parseOptionalMileageInput(mileageInput);
  const parsedEngineHours = parseOptionalEngineHoursInput(engineHoursInput);

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

  let activeCheckSessionId: string | null = null;
  let checkSessionErrorMessage: string | null = null;

  if (!inspectionAlreadyCompleted) {
    const { data: sessionId, error: sessionError } = await supabase.rpc(
      "get_or_create_apparatus_check_session",
      {
        p_apparatus_id: id,
        p_existing_session_id: requestedCheckSessionId,
        p_selected_result: mappedStatus,
      },
    );

    if (sessionError) {
      checkSessionErrorMessage =
        sessionError.message || "Unable to start this apparatus check session.";
    } else if (typeof sessionId === "string" && sessionId.trim().length > 0) {
      activeCheckSessionId = sessionId;
    } else {
      checkSessionErrorMessage = "Unable to resolve this apparatus check session.";
    }
  }

  if (
    !inspectionAlreadyCompleted &&
    activeCheckSessionId &&
    selectedHelperAction &&
    selectedHelperMemberId &&
    currentMemberId &&
    apparatus?.department_id
  ) {
    let helperMutationError: string | null = null;

    if (selectedHelperMemberId === currentMemberId) {
      helperMutationError = "Inspector is already included and cannot be added as a helper.";
    } else if (selectedHelperAction === "add") {
      const { error: addHelperError } = await supabase
        .from("apparatus_check_session_members")
        .upsert(
          [
            {
              session_id: activeCheckSessionId,
              department_id: apparatus.department_id,
              member_id: selectedHelperMemberId,
              added_by_member_id: currentMemberId,
            },
          ],
          {
            onConflict: "session_id,member_id",
            ignoreDuplicates: true,
          },
        );

      if (addHelperError) {
        helperMutationError = addHelperError.message || "Unable to add helper participant.";
      }
    } else {
      const { error: removeHelperError } = await supabase
        .from("apparatus_check_session_members")
        .delete()
        .eq("session_id", activeCheckSessionId)
        .eq("member_id", selectedHelperMemberId);

      if (removeHelperError) {
        helperMutationError = removeHelperError.message || "Unable to remove helper participant.";
      }
    }

    redirect(
      buildDailyCheckHref(id, {
        result: selectedResult,
        confirm,
        deficiencyConfirm,
        pendingResult: selectedPendingResult,
        checkSessionId: activeCheckSessionId,
        helperError: helperMutationError,
        helperSearch,
        mileage: mileageInput,
        engineHours: engineHoursInput,
      }),
    );
  }

  type SessionMemberRow = {
    member_id: string;
    created_at: string | null;
  };

  type DepartmentMemberRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };

  let helperParticipants: Array<{ memberId: string; name: string }> = [];
  let availableHelpers: Array<{ memberId: string; name: string }> = [];

  if (activeCheckSessionId && currentMember?.departmentId) {
    const { data: helperMemberRowsRaw } = await supabase
      .from("apparatus_check_session_members")
      .select("member_id, created_at")
      .eq("session_id", activeCheckSessionId)
      .order("created_at", { ascending: true });

    const helperMemberRows = (helperMemberRowsRaw ?? []) as SessionMemberRow[];
    const helperMemberIds = Array.from(
      new Set(
        helperMemberRows
          .map((row) => row.member_id)
          .filter((memberId): memberId is string => typeof memberId === "string" && memberId.length > 0),
      ),
    );

    let helperNameById: Record<string, string> = {};
    if (helperMemberIds.length > 0) {
      const { data: helperMemberNameRowsRaw } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .in("id", helperMemberIds);

      helperNameById = ((helperMemberNameRowsRaw ?? []) as DepartmentMemberRow[]).reduce<Record<string, string>>(
        (accumulator, row) => {
          const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
          const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
          accumulator[row.id] = `${firstName} ${lastName}`.trim() || row.id;
          return accumulator;
        },
        {},
      );
    }

    helperParticipants = helperMemberRows.map((row) => ({
      memberId: row.member_id,
      name: helperNameById[row.member_id] ?? "Unknown Member",
    }));

    const selectedHelperIdSet = new Set(helperParticipants.map((row) => row.memberId));
    const { data: departmentMemberRowsRaw } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("department_id", currentMember.departmentId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    availableHelpers = ((departmentMemberRowsRaw ?? []) as DepartmentMemberRow[])
      .filter((row) => row.id !== currentMemberId && !selectedHelperIdSet.has(row.id))
      .map((row) => {
        const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
        const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
        return {
          memberId: row.id,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim() || row.id,
        };
      })
      .sort((left, right) => {
        const leftHasFirstName = left.firstName.length > 0;
        const rightHasFirstName = right.firstName.length > 0;

        if (leftHasFirstName !== rightHasFirstName) {
          return leftHasFirstName ? -1 : 1;
        }

        if (leftHasFirstName && rightHasFirstName) {
          const firstNameCompare = left.firstName.localeCompare(right.firstName, undefined, {
            sensitivity: "base",
          });
          if (firstNameCompare !== 0) {
            return firstNameCompare;
          }
        }

        const lastNameCompare = left.lastName.localeCompare(right.lastName, undefined, {
          sensitivity: "base",
        });
        if (lastNameCompare !== 0) {
          return lastNameCompare;
        }

        return left.memberId.localeCompare(right.memberId, undefined, {
          sensitivity: "base",
        });
      })
      .map(({ memberId, name }) => ({ memberId, name }));
  }

  const { count: reportedDeficiencyCount } = activeCheckSessionId
    ? await supabase
        .from("deficiencies")
        .select("id", { count: "exact", head: true })
        .eq("apparatus_id", id)
        .eq("check_session_id", activeCheckSessionId)
    : { count: 0 };

  const { data: reportedDeficienciesRaw } = activeCheckSessionId
    ? await supabase
        .from("deficiencies")
        .select("id, deficiency_number, description")
        .eq("apparatus_id", id)
        .eq("check_session_id", activeCheckSessionId)
        .order("reported_at", { ascending: false })
        .limit(6)
    : { data: [] };

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
  const [{ data: checklistSettingRow }, { data: checklistItemRowsData }, { data: checklistProgressRowsData }] = await Promise.all([
    supabase
      .from("apparatus_inspection_settings")
      .select("require_checklist")
      .eq("department_id", apparatus?.department_id ?? "")
      .maybeSingle(),
    supabase
      .from("apparatus_inspection_checklist_items")
      .select("id, is_required")
      .eq("department_id", apparatus?.department_id ?? "")
      .eq("apparatus_id", id)
      .eq("is_active", true),
    currentMemberId
      ? supabase
          .from("apparatus_inspection_checklist_progress")
          .select("checklist_item_id, status")
          .eq("department_id", apparatus?.department_id ?? "")
          .eq("apparatus_id", id)
          .eq("member_id", currentMemberId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const checklistRequired = checklistSettingRow?.require_checklist === true;
  const checklistItems = ((checklistItemRowsData ?? []) as Array<{ id: string; is_required: boolean }>).map(
    (row) => ({
      id: row.id,
      isRequired: row.is_required === true,
    }),
  );
  const checklistProgressRows = ((checklistProgressRowsData ?? []) as Array<{ checklist_item_id: string; status: string }>).map(
    (row) => ({
      checklistItemId: row.checklist_item_id,
      status: row.status as ApparatusChecklistResultStatus,
    }),
  );
  const checklistProgress = getChecklistProgress(checklistItems, checklistProgressRows);
  const checklistSubmissionAllowed = isChecklistSubmissionAllowed({
    requireChecklist: checklistRequired,
    items: checklistItems,
    progressRows: checklistProgressRows,
  });

  const canCompleteInspection =
    Boolean(selectedResult) &&
    hasRequiredDeficiency &&
    !inspectionAlreadyCompleted &&
    checklistSubmissionAllowed &&
    Boolean(activeCheckSessionId) &&
    !checkSessionErrorMessage;
  const showConfirmationDialog = confirm === "1" && canCompleteInspection;
  const showDeficiencyConfirmDialog = deficiencyConfirm === "1" && selectedPendingResult !== null;

  console.log("[daily-check] completion gate values", {
    submit,
    confirm,
    result,
    selectedResult,
    requiresDeficiency,
    checklistRequired,
    checklistSubmissionAllowed,
    checklistRequiredCount: checklistProgress.requiredCount,
    checklistCompletedRequiredCount: checklistProgress.completedRequired,
    deficiencyCount,
    hasRequiredDeficiency,
    inspectionAlreadyCompleted,
    canCompleteInspection,
    id,
    mappedStatus,
    activeCheckSessionId,
    checkSessionErrorMessage,
  });

  if (submit === "1" && canCompleteInspection && selectedResult && mappedStatus && activeCheckSessionId) {
    console.log("ENTERED COMPLETION BRANCH");
    console.log("========================================\nCOMPLETE INSPECTION ACTION STARTED\nApparatus ID:", id, "\n========================================");
    console.log("[daily-check] mappedStatus before save_apparatus_inspection", {
      apparatusId: id,
      selectedResult,
      mappedStatus,
      activeCheckSessionId,
    });

    console.log("CALLING complete_apparatus_check");

    const { error: completionErrorResult } = await supabase.rpc("complete_apparatus_check", {
      p_session_id: activeCheckSessionId,
      p_final_status: mappedStatus,
      p_notes: null,
      p_mileage: parsedMileage,
      p_engine_hours: parsedEngineHours,
    });

    console.log("completionErrorResult", completionErrorResult);

    if (completionErrorResult) {
      const encodedError = encodeURIComponent(
        completionErrorResult.message || "Unable to complete inspection."
      );
      const errorSessionQueryPart = activeCheckSessionId
        ? `&checkSessionId=${encodeURIComponent(activeCheckSessionId)}`
        : "";
      redirect(
        `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1&completionError=${encodedError}${errorSessionQueryPart}`
      );
    }

    redirect("/apparatus");
  }

  if (submit === "1" && selectedResult && !activeCheckSessionId && !inspectionAlreadyCompleted) {
    const sessionMessage = checkSessionErrorMessage || "Unable to continue this apparatus check session.";
    const requestedSessionQueryPart = requestedCheckSessionId
      ? `&checkSessionId=${encodeURIComponent(requestedCheckSessionId)}`
      : "";
    redirect(
      `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1&completionError=${encodeURIComponent(sessionMessage)}${requestedSessionQueryPart}`,
    );
  }

  if (submit === "1" && selectedResult && !checklistSubmissionAllowed) {
    const checklistMessage = checklistRequired
      ? "Complete all required checklist items before submitting this inspection."
      : "Checklist state is not ready for submission.";
    const checklistSessionQueryPart = activeCheckSessionId
      ? `&checkSessionId=${encodeURIComponent(activeCheckSessionId)}`
      : "";
    redirect(
      `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1&completionError=${encodeURIComponent(checklistMessage)}${checklistSessionQueryPart}`,
    );
  }

  const sessionQueryPart = activeCheckSessionId
    ? `&checkSessionId=${encodeURIComponent(activeCheckSessionId)}`
    : "";
  const readingsQueryPart = [
    mileageInput ? `mileage=${encodeURIComponent(mileageInput)}` : "",
    engineHoursInput ? `engineHours=${encodeURIComponent(engineHoursInput)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const readingsSuffix = readingsQueryPart ? `&${readingsQueryPart}` : "";
  const readyHref = `/apparatus/${id}/daily-check?result=ready${sessionQueryPart}${readingsSuffix}`;
  const readyWithDeficienciesConfirmHref = `/apparatus/${id}/daily-check?result=ready-with-deficiencies&deficiencyConfirm=1&pendingResult=ready-with-deficiencies${sessionQueryPart}${readingsSuffix}`;
  const outOfServiceConfirmHref = `/apparatus/${id}/daily-check?result=out-of-service&deficiencyConfirm=1&pendingResult=out-of-service${sessionQueryPart}${readingsSuffix}`;
  const readyWithDeficienciesReturnTo = `/apparatus/${id}/daily-check?result=ready-with-deficiencies${sessionQueryPart}${readingsSuffix}`;
  const outOfServiceReturnTo = `/apparatus/${id}/daily-check?result=out-of-service${sessionQueryPart}${readingsSuffix}`;
  const readyWithDeficienciesLaunchHref = `/deficiencies/report?apparatusId=${id}${activeCheckSessionId ? `&checkSessionId=${encodeURIComponent(activeCheckSessionId)}` : ""}&returnTo=${encodeURIComponent(readyWithDeficienciesReturnTo)}`;
  const outOfServiceLaunchHref = `/deficiencies/report?apparatusId=${id}${activeCheckSessionId ? `&checkSessionId=${encodeURIComponent(activeCheckSessionId)}` : ""}&returnTo=${encodeURIComponent(outOfServiceReturnTo)}`;
  const addAnotherDeficiencyHref =
    selectedResult === "out-of-service"
      ? outOfServiceLaunchHref
      : readyWithDeficienciesLaunchHref;
  const completeHref = selectedResult
    ? `/apparatus/${id}/daily-check?result=${selectedResult}&confirm=1&submit=1${sessionQueryPart}${readingsSuffix}`
    : `/apparatus/${id}/daily-check`;
  const cancelConfirmHref = selectedResult
    ? `/apparatus/${id}/daily-check?result=${selectedResult}${sessionQueryPart}${readingsSuffix}`
    : `/apparatus/${id}/daily-check`;
  const launchConfirmedDeficiencyHref =
    selectedPendingResult === "out-of-service"
      ? outOfServiceLaunchHref
      : readyWithDeficienciesLaunchHref;
  const reviewInspectionItemsHref = `/apparatus/${id}/daily-check/checklist?returnTo=${encodeURIComponent(
    selectedResult
        ? `/apparatus/${id}/daily-check?result=${selectedResult}${sessionQueryPart}${readingsSuffix}`
        : `/apparatus/${id}/daily-check${activeCheckSessionId ? `?checkSessionId=${encodeURIComponent(activeCheckSessionId)}` : ""}${activeCheckSessionId && readingsQueryPart ? `&${readingsQueryPart}` : !activeCheckSessionId && readingsQueryPart ? `?${readingsQueryPart}` : ""}`,
  )}`;

  const completionErrorMessage =
    typeof completionError === "string" && completionError.trim()
      ? decodeURIComponent(completionError)
      : null;
  const helperErrorMessage =
    typeof helperError === "string" && helperError.trim() ? decodeURIComponent(helperError) : null;
  const helperSearchText = typeof helperSearch === "string" ? helperSearch.trim() : "";

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

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/apparatuspageimage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
            Apparatus Check
          </p>

          <h1
            className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            {apparatusName}
          </h1>

          <p className="mt-3 text-neutral-400">
            Record the operational result of an inspection already completed.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Inspection Workflow</p>
            <h2 className="mt-1 text-lg font-bold text-white">General Information</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Apparatus Department</p>
              <p className="mt-1 text-sm font-semibold text-white">{departmentName}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Inspector</p>
              <p className="mt-1 text-sm font-semibold text-white">{inspectorName}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Date</p>
              <p className="mt-1 text-sm font-semibold text-white">{inspectionDate}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Time</p>
              <p className="mt-1 text-sm font-semibold text-white">{inspectionTime}</p>
            </div>
          </div>

          {!inspectionAlreadyCompleted ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Mileage</span>
                <input
                  form="complete-inspection-form"
                  name="mileage"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={mileageInput}
                  placeholder="Optional"
                  className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Engine Hours</span>
                <input
                  form="complete-inspection-form"
                  name="engineHours"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  defaultValue={engineHoursInput}
                  placeholder="Optional"
                  className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
          <h2 className="text-3xl font-bold text-white">Overall Inspection Result</h2>

          {checkSessionErrorMessage ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {checkSessionErrorMessage}
            </p>
          ) : null}

          <div className="mt-8 space-y-4">
            <Link
              href={readyHref}
              className={`block cursor-pointer rounded-xl border bg-neutral-900 p-6 transition ${
                selectedResult === "ready"
                  ? "border-green-500 bg-green-950/20"
                  : "border-neutral-700 hover:border-green-500 hover:bg-green-950/20"
              }`}
            >
                <h3 className="text-xl font-bold text-white">Ready for Service</h3>
                <p className="mt-2 text-neutral-300">
                  All operational systems are functioning properly.
                </p>
            </Link>

            <Link
              href={readyWithDeficienciesConfirmHref}
              className={`block cursor-pointer rounded-xl border bg-neutral-900 p-6 transition ${
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

            <Link
              href={outOfServiceConfirmHref}
              className={`block cursor-pointer rounded-xl border bg-neutral-900 p-6 transition ${
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

            <div className="rounded-xl border border-neutral-700 bg-[#1B1B1B] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-300">Inspection Checklist</h4>
                  {checklistRequired ? (
                    <p className="mt-1 text-sm text-neutral-400">
                      Required items: {checklistProgress.completedRequired}/{checklistProgress.requiredCount} complete
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-neutral-400">Optional</p>
                  )}
                </div>
                <Link
                  href={reviewInspectionItemsHref}
                  className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-100 transition hover:bg-neutral-800"
                >
                  Review Inspection Items
                </Link>
              </div>
              {checklistRequired ? (
                checklistSubmissionAllowed ? (
                  <p className="mt-3 text-sm text-emerald-300">
                    All required inspection items completed.
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-amber-300">
                    Complete all required inspection items before submitting this apparatus check.
                  </p>
                )
              ) : (
                <p className="mt-3 text-sm text-neutral-400">Review the inspection items if desired. You may complete the inspection without completing every item.</p>
              )}
            </div>

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

        {!inspectionAlreadyCompleted && activeCheckSessionId ? (
          <InspectionHelpersPanel
            departmentId={apparatus?.department_id ?? ""}
            currentMemberId={currentMemberId ?? ""}
            activeCheckSessionId={activeCheckSessionId}
            helperParticipants={helperParticipants}
            availableHelpers={availableHelpers}
            helperErrorMessage={helperErrorMessage}
            initialSearch={helperSearchText}
          />
        ) : null}

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
            <form id="complete-inspection-form" method="get" action={`/apparatus/${id}/daily-check`}>
              <input type="hidden" name="result" value={selectedResult ?? ""} />
              <input type="hidden" name="confirm" value="1" />
              {activeCheckSessionId ? <input type="hidden" name="checkSessionId" value={activeCheckSessionId} /> : null}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700"
              >
                Complete Inspection
              </button>
            </form>
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

          {!inspectionAlreadyCompleted && selectedResult && hasRequiredDeficiency && checklistRequired && !checklistSubmissionAllowed ? (
            <p className="mt-3 text-sm text-amber-300">
              Complete all required checklist items before this inspection can be completed.
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
                By completing this inspection, you certify that you have inspected this apparatus according to your department&apos;s inspection procedures. Any deficiencies identified during the inspection have been reported.
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