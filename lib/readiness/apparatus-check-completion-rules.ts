export type FinalInspectionStatus = "ready" | "needs_attention" | "out_of_service";
export type OosSource = "deficiency" | "manual" | null;

export type ApparatusCheckCompletionInput = {
  finalStatus: FinalInspectionStatus;
  linkedDeficiencyCount: number;
  hasForeignApparatusDeficiency: boolean;
  hasForeignDepartmentDeficiency: boolean;
  checklistRequired: boolean;
  checklistComplete: boolean;
  sessionCompleted: boolean;
  isSessionOwner: boolean;
  isDepartmentMatch: boolean;
};

export type ApparatusCheckCompletionDecision = {
  allowCompletion: boolean;
  reason:
    | "already_completed"
    | "session_owner_mismatch"
    | "session_department_mismatch"
    | "checklist_incomplete"
    | "linked_deficiency_scope_mismatch"
    | "ready_with_linked_deficiencies"
    | "status_requires_deficiency"
    | "ok";
  outOfServiceSource: OosSource;
};

export function evaluateApparatusCheckCompletion(
  input: ApparatusCheckCompletionInput,
): ApparatusCheckCompletionDecision {
  if (input.sessionCompleted) {
    return {
      allowCompletion: false,
      reason: "already_completed",
      outOfServiceSource: null,
    };
  }

  if (!input.isSessionOwner) {
    return {
      allowCompletion: false,
      reason: "session_owner_mismatch",
      outOfServiceSource: null,
    };
  }

  if (!input.isDepartmentMatch) {
    return {
      allowCompletion: false,
      reason: "session_department_mismatch",
      outOfServiceSource: null,
    };
  }

  if (input.checklistRequired && !input.checklistComplete) {
    return {
      allowCompletion: false,
      reason: "checklist_incomplete",
      outOfServiceSource: null,
    };
  }

  if (input.hasForeignApparatusDeficiency || input.hasForeignDepartmentDeficiency) {
    return {
      allowCompletion: false,
      reason: "linked_deficiency_scope_mismatch",
      outOfServiceSource: null,
    };
  }

  if (input.finalStatus === "ready" && input.linkedDeficiencyCount > 0) {
    return {
      allowCompletion: false,
      reason: "ready_with_linked_deficiencies",
      outOfServiceSource: null,
    };
  }

  if (
    (input.finalStatus === "needs_attention" ||
      input.finalStatus === "out_of_service") &&
    input.linkedDeficiencyCount === 0
  ) {
    return {
      allowCompletion: false,
      reason: "status_requires_deficiency",
      outOfServiceSource: null,
    };
  }

  return {
    allowCompletion: true,
    reason: "ok",
    outOfServiceSource:
      input.finalStatus === "out_of_service" ? "deficiency" : null,
  };
}

export type SessionLifecycleState = "in_progress" | "completed" | "abandoned" | "expired";

export type SessionHelperAddInput = {
  sessionState: SessionLifecycleState;
  isSessionOwner: boolean;
  targetMemberExists: boolean;
  targetMemberActive: boolean;
  targetMemberDepartmentMatchesSession: boolean;
  isTargetPrimaryInspector: boolean;
  alreadyParticipant: boolean;
};

export type SessionHelperAddDecision = {
  allowed: boolean;
  reason:
    | "ok"
    | "session_inactive"
    | "session_owner_mismatch"
    | "target_member_invalid"
    | "target_member_inactive"
    | "target_member_department_mismatch"
    | "primary_cannot_be_helper"
    | "duplicate_helper";
};

export function evaluateSessionHelperAdd(input: SessionHelperAddInput): SessionHelperAddDecision {
  if (input.sessionState !== "in_progress") {
    return { allowed: false, reason: "session_inactive" };
  }

  if (!input.isSessionOwner) {
    return { allowed: false, reason: "session_owner_mismatch" };
  }

  if (!input.targetMemberExists) {
    return { allowed: false, reason: "target_member_invalid" };
  }

  if (!input.targetMemberActive) {
    return { allowed: false, reason: "target_member_inactive" };
  }

  if (!input.targetMemberDepartmentMatchesSession) {
    return { allowed: false, reason: "target_member_department_mismatch" };
  }

  if (input.isTargetPrimaryInspector) {
    return { allowed: false, reason: "primary_cannot_be_helper" };
  }

  if (input.alreadyParticipant) {
    return { allowed: false, reason: "duplicate_helper" };
  }

  return { allowed: true, reason: "ok" };
}

export type SessionDeficiencyReporterInput = {
  sessionState: SessionLifecycleState;
  reporterExists: boolean;
  reporterIsActive: boolean;
  reporterDepartmentMatchesSession: boolean;
  reporterIsSessionOwner: boolean;
  reporterIsSessionHelper: boolean;
};

export type SessionDeficiencyReporterDecision = {
  allowed: boolean;
  reason:
    | "ok"
    | "session_inactive"
    | "reporter_invalid"
    | "reporter_inactive"
    | "reporter_department_mismatch"
    | "reporter_not_participant";
};

export function evaluateSessionDeficiencyReporter(
  input: SessionDeficiencyReporterInput,
): SessionDeficiencyReporterDecision {
  if (input.sessionState !== "in_progress") {
    return { allowed: false, reason: "session_inactive" };
  }

  if (!input.reporterExists) {
    return { allowed: false, reason: "reporter_invalid" };
  }

  if (!input.reporterIsActive) {
    return { allowed: false, reason: "reporter_inactive" };
  }

  if (!input.reporterDepartmentMatchesSession) {
    return { allowed: false, reason: "reporter_department_mismatch" };
  }

  if (input.reporterIsSessionOwner || input.reporterIsSessionHelper) {
    return { allowed: true, reason: "ok" };
  }

  return { allowed: false, reason: "reporter_not_participant" };
}

export type InspectionParticipationRecord = {
  inspectionId: string;
  ownerMemberId: string;
  helperMemberIds: string[];
};

export function buildParticipationCreditCounts(
  records: InspectionParticipationRecord[],
): Record<string, number> {
  const memberToInspectionIds = new Map<string, Set<string>>();

  for (const record of records) {
    if (!memberToInspectionIds.has(record.ownerMemberId)) {
      memberToInspectionIds.set(record.ownerMemberId, new Set<string>());
    }
    memberToInspectionIds.get(record.ownerMemberId)?.add(record.inspectionId);

    const uniqueHelpers = Array.from(new Set(record.helperMemberIds));
    for (const helperMemberId of uniqueHelpers) {
      if (!memberToInspectionIds.has(helperMemberId)) {
        memberToInspectionIds.set(helperMemberId, new Set<string>());
      }
      memberToInspectionIds.get(helperMemberId)?.add(record.inspectionId);
    }
  }

  const counts: Record<string, number> = {};
  for (const [memberId, inspectionIds] of memberToInspectionIds.entries()) {
    counts[memberId] = inspectionIds.size;
  }

  return counts;
}

export function buildInspectionParticipantSummary(input: {
  inspectorName: string;
  helperNames: string[];
}) {
  const assistedByNames = input.helperNames.filter((name) => name.trim().length > 0);
  return {
    inspector: input.inspectorName,
    assistedBy: assistedByNames.length > 0 ? assistedByNames.join(", ") : null,
  };
}

export function buildCompletionFootprint(input: {
  completionAllowed: boolean;
  helperMemberIds: string[];
}) {
  if (!input.completionAllowed) {
    return {
      inspectionRowsCreated: 0,
      completedSessionRows: 0,
      retainedHelperRows: 0,
    };
  }

  return {
    inspectionRowsCreated: 1,
    completedSessionRows: 1,
    retainedHelperRows: Array.from(new Set(input.helperMemberIds)).length,
  };
}
