import { getCurrentMember, type CurrentMember } from "@/lib/current-member";
import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  findCurrentTrackProfile,
  resolveAuthoritativeEmsCertificationsForMember,
  resolveCertificationStatusFromTrack,
  type EmsTrackProfileAuthorityRow,
} from "@/lib/ems/authoritative-certifications";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildMemberReadinessScore,
  calculateOverallReadinessScorePercent,
  getCertificationStatus,
  getDeficiencyImpactPenaltyPercent,
  getDeficiencyImpactState,
  parseHours,
  type DeficiencyReadinessInput,
  type QualificationReadinessInput,
  type ReadinessFactor,
  type ReadinessScoreState,
  type RequirementInput,
} from "@/lib/readiness/member-readiness";
import { buildScoredCertificationStatuses } from "@/lib/readiness/scored-certifications";
import {
  buildCanonicalMemberCertificationRows,
  buildQualificationReadinessAdapter,
  type CatalogRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";
import {
  getApparatusReadinessList,
  getStatusLabelForReadinessRow,
  type ApparatusReadinessListRow,
} from "@/lib/readiness/apparatus-readiness-data";
import {
  calculateMaintenanceServiceBucketScore,
  type ApparatusMaintenanceRequirementEvaluation,
} from "@/lib/readiness/apparatus-readiness";
import { calculateComplianceBucketHours } from "@/lib/training/compliance-buckets";
import { department } from "@/lib/department";

const PERSONNEL_WEIGHT = 0.65;
const APPARATUS_WEIGHT = 0.35;
const APPARATUS_CHECKS_BUCKET_MAX = 20;
const APPARATUS_CONDITION_BUCKET_MAX = 40;
const APPARATUS_MAINTENANCE_BUCKET_MAX = 20;
const APPARATUS_EQUIPMENT_BUCKET_MAX = 20;
const MEMBER_DEFICIENCIES_BUCKET_MAX = 10;
const CERTIFICATION_WARNING_DAYS = department.settings.certificationWarningDays;

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  department_role_id: string | null;
  active: boolean | null;
  hire_start_date: string | null;
  created_at: string | null;
};

type MemberCertificationRow = {
  member_id: string;
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
};

type MemberQualificationRow = {
  member_id: string;
  qualification_id: string;
};

type TrainingAttendanceRow = {
  member_id: string;
  training_event_id: string;
};

type TrainingEventRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
};

type OutsideSubmissionRow = {
  member_id: string;
  category_id: string | null;
  hours: number | string | null;
};

type AssignmentMemberApprovedRow = {
  member_id: string;
  training_assignment_id: string;
  hours_earned: number | string | null;
};

type AssignmentRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
  status: string;
};

type TrainingCategoryRow = {
  id: string;
  name: string;
};

type CertificationTypeRow = {
  id: string;
  name: string;
  ems_authority: "iowa" | "nremt" | null;
  ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
};

type DepartmentRoleRow = {
  id: string;
  name: string;
  active: boolean;
};

type DeficiencyStatusRelation = {
  name: string | null;
  active: boolean | null;
};

type DeficiencyPriorityRelation = {
  name: string | null;
};

type DeficiencyAssignedRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  assigned_to: string | null;
  created_at: string | null;
  reported_at: string | null;
  status_info: DeficiencyStatusRelation | DeficiencyStatusRelation[] | null;
  priority_info: DeficiencyPriorityRelation | DeficiencyPriorityRelation[] | null;
};

type DeficiencyAssignmentHistoryRow = {
  deficiency_id: string;
  member_id: string | null;
  event_type: string | null;
  created_at: string | null;
};

type DepartmentReadinessStatus =
  | "not_yet_rated"
  | "redline_ready"
  | "not_redline_ready"
  | "needs_attention";

export type DepartmentReadinessCoachAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ownerLabel: string;
  category: "personnel" | "apparatus";
  audience: "all" | "officer_admin";
  potentialDepartmentImpactPercent: number | null;
};

export type DepartmentReadinessResult = {
  departmentScore: number | null;
  personnelScore: number | null;
  apparatusScore: number | null;
  personnelWeight: number;
  apparatusWeight: number;
  activeMemberCount: number;
  scoredMemberCount: number;
  apparatusCount: number;
  status: DepartmentReadinessStatus;
  statusMessage: string;
  notYetRated: boolean;
  scoredMembersLabel: string;
  participationMode: "explicit_apparatus_opt_in";
  participationLimitation: string;
  topCoachActions: DepartmentReadinessCoachAction[];
  remainingCoachActions: DepartmentReadinessCoachAction[];
};

export function calculateDepartmentComposite(input: {
  personnelScore: number | null;
  apparatusScore: number | null;
  scoredMemberCount: number;
  participatingApparatusCount: number;
}) {
  if (input.scoredMemberCount === 0) {
    return null;
  }

  if (input.personnelScore === null) {
    return null;
  }

  if (input.participatingApparatusCount === 0 || input.apparatusScore === null) {
    return roundToTwo(input.personnelScore);
  }

  return computeDepartmentScore(input.personnelScore, input.apparatusScore);
}

type DepartmentReadinessInputs = {
  departmentId: string;
  viewer: CurrentMember;
};

type MemberReadinessResult = {
  memberId: string;
  memberName: string;
  scorePercent: number | null;
  readinessState: ReadinessScoreState;
  highestDeficiencyPenaltyPercent: number;
};

type ApparatusIssueActionDraft = {
  idSuffix: string;
  title: string;
  description: string;
  scoreDelta: number | null;
};

export type ApparatusParticipationInput = {
  includeInDepartmentReadiness: boolean;
  readinessState: "evaluated" | "evaluation_error";
  scorePercent: number | null;
};

function toMemberName(row: MemberRow) {
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unknown Member";
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function deriveDepartmentReadinessStatus(score: number | null): {
  status: DepartmentReadinessStatus;
  statusMessage: string;
  notYetRated: boolean;
} {
  if (score === null) {
    return {
      status: "not_yet_rated",
      statusMessage: "NOT YET RATED",
      notYetRated: true,
    };
  }

  if (score >= 90) {
    return {
      status: "redline_ready",
      statusMessage:
        "Your Department is REDLINE READY.\n\nSee how to improve your score with the REDLINE READINESS COACH™ below.",
      notYetRated: false,
    };
  }

  if (score >= 80) {
    return {
      status: "not_redline_ready",
      statusMessage:
        "Your Department is NOT REDLINE READY.\n\nSee how to become REDLINE READY with the REDLINE READINESS COACH™ below.",
      notYetRated: false,
    };
  }

  return {
    status: "needs_attention",
    statusMessage:
      "Operational Readiness Needs Attention.\n\nSee the REDLINE READINESS COACH™ below to see how you can become REDLINE READY.",
    notYetRated: false,
  };
}

export function computeDepartmentScore(personnelScore: number, apparatusScore: number) {
  return roundToTwo(personnelScore * PERSONNEL_WEIGHT + apparatusScore * APPARATUS_WEIGHT);
}

function normalizeDeficiencyStatus(
  relation: DeficiencyStatusRelation | DeficiencyStatusRelation[] | null,
) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  if (!row) {
    return { name: null, active: null };
  }

  return {
    name: typeof row.name === "string" ? row.name : null,
    active: typeof row.active === "boolean" ? row.active : null,
  };
}

function normalizeDeficiencyPriority(
  relation: DeficiencyPriorityRelation | DeficiencyPriorityRelation[] | null,
) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  if (!row) {
    return { name: null };
  }

  return {
    name: typeof row.name === "string" ? row.name : null,
  };
}

function isDeficiencyResolved(statusName: string | null, statusActive: boolean | null) {
  if (statusActive === false) {
    return true;
  }

  const normalizedStatus = (statusName ?? "").trim().toLowerCase();
  return normalizedStatus === "resolved" || normalizedStatus === "closed";
}

function parseIsoTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function calculateDaysBetween(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((endUtc - startUtc) / millisecondsPerDay));
}

function getHighestDeficiencyPenaltyForMember(deficiencyItems: DeficiencyReadinessInput[], memberId: string) {
  const now = new Date();
  let highestPenalty = 0;

  for (const item of deficiencyItems) {
    if (!item.assignedToMemberId || item.assignedToMemberId !== memberId) {
      continue;
    }

    if (isDeficiencyResolved(item.statusName, item.statusActive)) {
      continue;
    }

    const personalAssignedAt = parseIsoTimestamp(item.personalAssignedAt) ?? now;
    const ageDays = calculateDaysBetween(personalAssignedAt, now);
    const impactState = getDeficiencyImpactState(item.priorityName, ageDays);
    const penaltyPercent = getDeficiencyImpactPenaltyPercent(impactState);
    if (penaltyPercent > highestPenalty) {
      highestPenalty = penaltyPercent;
    }
  }

  return highestPenalty;
}

function getAverageFactorCompletionForCategory(
  factors: ReadinessFactor[],
  category: ReadinessFactor["category"],
  overrideFactorId: string | null,
  overrideCompletionPercent: number,
) {
  const categoryFactors = factors.filter((factor) => factor.category === category);
  if (categoryFactors.length === 0) {
    return 0;
  }

  const total = categoryFactors.reduce((sum, factor) => {
    if (overrideFactorId && factor.id === overrideFactorId) {
      return sum + clamp(overrideCompletionPercent, 0, 100);
    }

    return sum + clamp(factor.completionPercent, 0, 100);
  }, 0);

  return clamp(total / categoryFactors.length, 0, 100);
}

export function simulateMemberScoreForResolvedCoachFactor(input: {
  readinessState: ReadinessScoreState;
  factorId: string;
  highestDeficiencyPenaltyPercent: number;
  resolvedQualificationName?: string;
}) {
  const { readinessState, factorId, highestDeficiencyPenaltyPercent, resolvedQualificationName } = input;
  const factor = readinessState.factors.find((item) => item.id === factorId);

  if (!factor) {
    return readinessState.scorePercent;
  }

  let certificationsCategoryPercent = getAverageFactorCompletionForCategory(
    readinessState.factors,
    "certification",
    null,
    0,
  );

  let trainingCategoryPercent = getAverageFactorCompletionForCategory(
    readinessState.factors,
    "training",
    null,
    0,
  );

  let qualificationsCategoryPercent =
    readinessState.qualificationsScore === null
      ? null
      : clamp(
          (readinessState.qualificationsScore / readinessState.qualificationsMaxScore) * 100,
          0,
          100,
        );

  let deficienciesCategoryPercent = clamp(
    ((MEMBER_DEFICIENCIES_BUCKET_MAX - readinessState.deficiencyPenaltyPercent) /
      MEMBER_DEFICIENCIES_BUCKET_MAX) *
      100,
    0,
    100,
  );

  if (factor.category === "certification") {
    certificationsCategoryPercent = getAverageFactorCompletionForCategory(
      readinessState.factors,
      "certification",
      factor.id,
      100,
    );
  } else if (factor.category === "training") {
    trainingCategoryPercent = getAverageFactorCompletionForCategory(
      readinessState.factors,
      "training",
      factor.id,
      100,
    );
  } else if (factor.category === "qualification") {
    const normalizedResolvedQualification = (resolvedQualificationName ?? "").trim().toLowerCase();
    const missingQualifications = readinessState.missingQualifications;
    const hasMatchingQualification =
      normalizedResolvedQualification.length > 0 &&
      missingQualifications.some(
        (qualificationName) => qualificationName.trim().toLowerCase() === normalizedResolvedQualification,
      );

    if (!hasMatchingQualification) {
      return readinessState.scorePercent;
    }

    const missingCount = missingQualifications.length;
    if (missingCount <= 0) {
      return readinessState.scorePercent;
    }

    if (readinessState.qualificationsScore === null) {
      return readinessState.scorePercent;
    }

    const currentQualificationsPercent = clamp(
      (readinessState.qualificationsScore / readinessState.qualificationsMaxScore) * 100,
      0,
      100,
    );
    const incompleteRatio = 1 - currentQualificationsPercent / 100;

    if (incompleteRatio <= 0) {
      return readinessState.scorePercent;
    }

    const estimatedTotalRequired = missingCount / incompleteRatio;
    const totalRequired = Math.max(1, Math.round(estimatedTotalRequired));
    const reconstructedMissing = totalRequired * incompleteRatio;

    if (Math.abs(reconstructedMissing - missingCount) > 0.01) {
      return readinessState.scorePercent;
    }

    const completedCount = totalRequired - missingCount;
    const nextCompletedCount = clamp(completedCount + 1, 0, totalRequired);
    qualificationsCategoryPercent = clamp((nextCompletedCount / totalRequired) * 100, 0, 100);
  } else if (factor.id === "deficiencies-current-responsibility") {
    const reducedPenalty = Math.max(0, readinessState.deficiencyPenaltyPercent - highestDeficiencyPenaltyPercent);
    deficienciesCategoryPercent = clamp(
      ((MEMBER_DEFICIENCIES_BUCKET_MAX - reducedPenalty) / MEMBER_DEFICIENCIES_BUCKET_MAX) * 100,
      0,
      100,
    );
  }

  if (qualificationsCategoryPercent === null) {
    return null;
  }

  return roundToTenths(
    calculateOverallReadinessScorePercent({
      certificationsCategoryPercent,
      trainingCategoryPercent,
      qualificationsCategoryPercent,
      deficienciesCategoryPercent,
    }),
  );
}

function computeMemberActionImpact(input: {
  departmentScore: number | null;
  personnelScore: number | null;
  apparatusScore: number | null;
  scoredMemberCount: number;
  apparatusCount: number;
  currentMemberScore: number | null;
  simulatedMemberScore: number | null;
}) {
  const {
    departmentScore,
    personnelScore,
    apparatusScore,
    scoredMemberCount,
    apparatusCount,
    currentMemberScore,
    simulatedMemberScore,
  } = input;

  if (
    departmentScore === null ||
    personnelScore === null ||
    currentMemberScore === null ||
    simulatedMemberScore === null ||
    scoredMemberCount <= 0
  ) {
    return null;
  }

  const memberDelta = simulatedMemberScore - currentMemberScore;
  const simulatedPersonnel = personnelScore + memberDelta / scoredMemberCount;

  const simulatedDepartment =
    apparatusCount > 0 && apparatusScore !== null
      ? computeDepartmentScore(simulatedPersonnel, apparatusScore)
      : roundToTwo(simulatedPersonnel);

  return roundToTwo(Math.max(0, simulatedDepartment - departmentScore));
}

function computeApparatusActionImpact(input: {
  departmentScore: number | null;
  personnelScore: number | null;
  apparatusScore: number | null;
  apparatusCount: number;
  apparatusScoreDelta: number | null;
}) {
  const {
    departmentScore,
    personnelScore,
    apparatusScore,
    apparatusCount,
    apparatusScoreDelta,
  } = input;

  if (
    departmentScore === null ||
    personnelScore === null ||
    apparatusScore === null ||
    apparatusScoreDelta === null ||
    apparatusCount <= 0
  ) {
    return null;
  }

  const simulatedApparatus = clamp(apparatusScore + apparatusScoreDelta / apparatusCount, 0, 100);
  const simulatedDepartment = computeDepartmentScore(personnelScore, simulatedApparatus);
  return roundToTwo(Math.max(0, simulatedDepartment - departmentScore));
}

export function simulateMaintenanceScoreAfterResolvingSingleRequirement(input: {
  maintenanceRequirements: ApparatusMaintenanceRequirementEvaluation[];
  currentMaintenanceScore: number | null;
  requirementId: string;
}) {
  if (typeof input.currentMaintenanceScore !== "number") {
    return null;
  }

  if (!input.requirementId || input.maintenanceRequirements.length === 0) {
    return null;
  }

  const simulatedRequirements = input.maintenanceRequirements.map((requirement) => {
    if (requirement.requirementId !== input.requirementId) {
      return {
        ...requirement,
        methods: requirement.methods.map((method) => ({ ...method })),
      };
    }

    return {
      ...requirement,
      methods: requirement.methods.map((method) => ({
        ...method,
        elapsedSinceService: 0,
      })),
    };
  });

  const simulated = calculateMaintenanceServiceBucketScore(simulatedRequirements);
  if (typeof simulated.score !== "number") {
    return null;
  }

  return roundToTwo(clamp(simulated.score, 0, APPARATUS_MAINTENANCE_BUCKET_MAX));
}

export function simulateConditionScoreAfterResolvingSingleIssue(input: {
  currentConditionScore: number;
  minorCount: number;
  significantCount: number;
  criticalCount: number;
}) {
  const totalDeduction =
    Math.max(0, input.minorCount) +
    Math.max(0, input.significantCount) * 5 +
    Math.max(0, input.criticalCount) * 40;

  let singleIssueDeduction = 0;
  if (input.criticalCount > 0) {
    singleIssueDeduction = 40;
  } else if (input.significantCount > 0) {
    singleIssueDeduction = 5;
  } else if (input.minorCount > 0) {
    singleIssueDeduction = 1;
  }

  const afterOneFix = Math.max(0, totalDeduction - singleIssueDeduction);
  return clamp(APPARATUS_CONDITION_BUCKET_MAX - afterOneFix, 0, APPARATUS_CONDITION_BUCKET_MAX);
}

export function getParticipatingApparatusScores(rows: ApparatusParticipationInput[]) {
  return rows
    .filter((row) => row.includeInDepartmentReadiness)
    .filter((row) => row.readinessState === "evaluated" && typeof row.scorePercent === "number")
    .map((row) => row.scorePercent as number);
}

function buildApparatusIssueActions(row: ApparatusReadinessListRow): ApparatusIssueActionDraft[] {
  const drafts: ApparatusIssueActionDraft[] = [];
  const readiness = row.readiness;

  if (readiness.status === "not_scored") {
    drafts.push({
      idSuffix: "configuration",
      title: "CONFIGURATION REQUIRED",
      description: "This apparatus is included but cannot be scored until readiness configuration is completed.",
      scoreDelta: null,
    });

    return drafts;
  }

  const checksScore = readiness.bucketScores.apparatusChecks;
  if (typeof checksScore === "number" && checksScore < APPARATUS_CHECKS_BUCKET_MAX) {
    drafts.push({
      idSuffix: "checks",
      title: "Complete the due apparatus check",
      description: "Resolve the check cadence gap for this apparatus without changing other readiness categories.",
      scoreDelta: roundToTwo(APPARATUS_CHECKS_BUCKET_MAX - checksScore),
    });
  }

  const conditionScore = readiness.bucketScores.conditionSafety;
  if (typeof conditionScore === "number") {
    const counts = readiness.metadata.activeConditionCounts;
    if (counts.critical > 0) {
      const nextScore = simulateConditionScoreAfterResolvingSingleIssue({
        currentConditionScore: conditionScore,
        minorCount: counts.minor,
        significantCount: counts.significant,
        criticalCount: counts.critical,
      });
      drafts.push({
        idSuffix: "critical-deficiency",
        title: "Resolve one critical condition deficiency",
        description: "Simulates resolving only one critical deficiency while leaving all other condition issues unchanged.",
        scoreDelta: roundToTwo(Math.max(0, nextScore - conditionScore)),
      });
    } else if (counts.significant > 0) {
      const nextScore = simulateConditionScoreAfterResolvingSingleIssue({
        currentConditionScore: conditionScore,
        minorCount: counts.minor,
        significantCount: counts.significant,
        criticalCount: counts.critical,
      });
      drafts.push({
        idSuffix: "significant-deficiency",
        title: "Resolve one significant condition deficiency",
        description: "Simulates resolving only one significant deficiency while leaving other condition issues unchanged.",
        scoreDelta: roundToTwo(Math.max(0, nextScore - conditionScore)),
      });
    } else if (counts.minor > 0) {
      const nextScore = simulateConditionScoreAfterResolvingSingleIssue({
        currentConditionScore: conditionScore,
        minorCount: counts.minor,
        significantCount: counts.significant,
        criticalCount: counts.critical,
      });
      drafts.push({
        idSuffix: "minor-deficiency",
        title: "Resolve one minor condition deficiency",
        description: "Simulates resolving only one minor deficiency while leaving other condition issues unchanged.",
        scoreDelta: roundToTwo(Math.max(0, nextScore - conditionScore)),
      });
    }
  }

  const maintenanceScore = readiness.bucketScores.maintenanceService;
  const maintenanceRequirements = row.simulationData?.maintenanceRequirements ?? [];
  if (typeof maintenanceScore === "number" && maintenanceRequirements.length > 0) {
    for (const requirement of maintenanceRequirements) {
      const simulatedMaintenanceScore = simulateMaintenanceScoreAfterResolvingSingleRequirement({
        maintenanceRequirements,
        currentMaintenanceScore: maintenanceScore,
        requirementId: requirement.requirementId,
      });

      if (typeof simulatedMaintenanceScore !== "number") {
        continue;
      }

      const delta = roundToTwo(Math.max(0, simulatedMaintenanceScore - maintenanceScore));
      if (delta <= 0) {
        continue;
      }

      drafts.push({
        idSuffix: `maintenance-${requirement.requirementId}`,
        title: `Complete maintenance: ${requirement.name}`,
        description:
          "Simulates completing exactly this one maintenance requirement while leaving all other maintenance requirements unchanged.",
        scoreDelta: delta,
      });
    }
  }

  const equipmentScore = readiness.bucketScores.requiredEquipment;
  const nonCritical = readiness.metadata.nonCriticalRequiredEquipment;
  const nonOperationalCount = Math.max(0, nonCritical.totalCount - nonCritical.operationalCount);
  if (
    typeof equipmentScore === "number" &&
    nonCritical.totalCount > 0 &&
    nonOperationalCount > 0
  ) {
    drafts.push({
      idSuffix: "equipment",
      title: "Restore one required equipment readiness issue",
      description: "Simulates restoring one required non-critical equipment item while leaving other equipment issues unchanged.",
      scoreDelta: roundToTwo(APPARATUS_EQUIPMENT_BUCKET_MAX / nonCritical.totalCount),
    });
  }

  if (drafts.length === 0) {
    const statusLabel = getStatusLabelForReadinessRow(row);
    if (statusLabel !== "Ready") {
      drafts.push({
        idSuffix: "general",
        title: "Resolve apparatus readiness issue",
        description: `Current status is ${statusLabel}. Resolve one underlying issue to improve readiness.`,
        scoreDelta: null,
      });
    }
  }

  return drafts;
}

export function sortCoachActions(actions: DepartmentReadinessCoachAction[]) {
  return [...actions].sort((a, b) => {
    if (a.potentialDepartmentImpactPercent === null && b.potentialDepartmentImpactPercent === null) {
      return a.title.localeCompare(b.title);
    }

    if (a.potentialDepartmentImpactPercent === null) {
      return 1;
    }

    if (b.potentialDepartmentImpactPercent === null) {
      return -1;
    }

    if (a.potentialDepartmentImpactPercent === b.potentialDepartmentImpactPercent) {
      return a.title.localeCompare(b.title);
    }

    return b.potentialDepartmentImpactPercent - a.potentialDepartmentImpactPercent;
  });
}

export function filterCoachActionsForRole(
  actions: DepartmentReadinessCoachAction[],
  role: CurrentMember["role"],
) {
  if (role === "firefighter") {
    return actions.filter((action) => action.audience === "all");
  }

  return actions;
}

export async function getDepartmentReadinessData(
  input: DepartmentReadinessInputs,
): Promise<DepartmentReadinessResult> {
  const { departmentId, viewer } = input;
  const supabase = await createSupabaseServerClient();

  const { data: memberRowsData, error: memberRowsError } = await supabase
    .from("members")
    .select("id, first_name, last_name, role, department_role_id, active, hire_start_date, created_at")
    .eq("department_id", departmentId)
    .eq("active", true)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (memberRowsError) {
    throw new Error(memberRowsError.message || "Unable to load active members.");
  }

  const members = (memberRowsData ?? []) as MemberRow[];
  const activeMemberCount = members.length;
  const memberIds = members.map((row) => row.id);

  const [
    { data: requirementsRows, error: requirementsError },
    { data: certificationTypeRows, error: certificationTypeError },
    { data: qualificationTypeRows, error: qualificationTypeError },
    { data: departmentRoleRows, error: departmentRoleError },
    { data: roleRequiredCertificationRows, error: roleRequiredCertificationError },
    { data: roleRequiredQualificationRows, error: roleRequiredQualificationError },
  ] = await Promise.all([
    supabase
      .from("training_requirements")
      .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json")
      .eq("department_id", departmentId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("certifications")
      .select("id, name, ems_authority, ems_certification_level")
      .eq("department_id", departmentId),
    supabase
      .from("qualifications")
      .select("id, name, active")
      .eq("department_id", departmentId),
    supabase
      .from("department_roles")
      .select("id, name, active")
      .eq("department_id", departmentId),
    supabase
      .from("role_required_certifications")
      .select("department_role_id, certification_id")
      .eq("department_id", departmentId),
    supabase
      .from("role_required_qualifications")
      .select("department_role_id, qualification_id")
      .eq("department_id", departmentId),
  ]);

  if (
    requirementsError ||
    certificationTypeError ||
    qualificationTypeError ||
    departmentRoleError ||
    roleRequiredCertificationError ||
    roleRequiredQualificationError
  ) {
    throw new Error(
      requirementsError?.message ||
        certificationTypeError?.message ||
        qualificationTypeError?.message ||
        departmentRoleError?.message ||
        roleRequiredCertificationError?.message ||
        roleRequiredQualificationError?.message ||
        "Unable to load readiness configuration.",
    );
  }

  const requirements = (requirementsRows ?? []) as RequirementInput[];
  const certificationTypes = (certificationTypeRows ?? []) as CertificationTypeRow[];
  const qualificationTypes = ((qualificationTypeRows ?? []) as CatalogRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
  const departmentRoles = ((departmentRoleRows ?? []) as DepartmentRoleRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
  const roleRequiredCertifications =
    ((roleRequiredCertificationRows ?? []) as RoleRequiredCertificationRow[]).map((row) => ({
      department_role_id: row.department_role_id,
      certification_id: row.certification_id,
    }));
  const roleRequiredQualifications =
    ((roleRequiredQualificationRows ?? []) as RoleRequiredQualificationRow[]).map((row) => ({
      department_role_id: row.department_role_id,
      qualification_id: row.qualification_id,
    }));

  const certificationCatalog: CatalogRow[] = certificationTypes.map((row) => ({
    id: row.id,
    name: row.name,
    active: true,
  }));
  const certificationNameById = new Map(certificationTypes.map((row) => [row.id, row.name]));
  const departmentRoleById = new Map(departmentRoles.map((row) => [row.id, row]));

  const [
    memberCertificationRows,
    memberQualificationRows,
    attendanceRows,
    outsideRows,
    assignmentMemberApprovedRows,
    emsTrackRows,
    assignedDeficiencyRows,
  ] = memberIds.length
    ? await Promise.all([
        supabase
          .from("member_certifications")
          .select("member_id, certification_id, certificate_number, issued_at, expires_at")
          .eq("department_id", departmentId)
          .in("member_id", memberIds),
        supabase
          .from("member_qualifications")
          .select("member_id, qualification_id")
          .eq("department_id", departmentId)
          .in("member_id", memberIds),
        supabase
          .from("training_event_attendance")
          .select("member_id, training_event_id")
          .eq("department_id", departmentId)
          .in("member_id", memberIds)
          .eq("attendance_status", "attending"),
        supabase
          .from("training_outside_submissions")
          .select("member_id, category_id, hours")
          .eq("department_id", departmentId)
          .in("member_id", memberIds)
          .eq("status", "approved"),
        supabase
          .from("training_assignment_members")
          .select("member_id, training_assignment_id, hours_earned")
          .eq("department_id", departmentId)
          .in("member_id", memberIds)
          .eq("completion_status", "approved"),
        supabase
          .from("ems_member_track_profiles")
          .select("member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
          .eq("department_id", departmentId)
          .in("member_id", memberIds)
          .order("effective_start_date", { ascending: false }),
        supabase
          .from("deficiencies")
          .select(
            "id, deficiency_number, description, assigned_to, created_at, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name)",
          )
          .in("assigned_to", memberIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (
    memberCertificationRows.error ||
    memberQualificationRows.error ||
    attendanceRows.error ||
    outsideRows.error ||
    assignmentMemberApprovedRows.error ||
    emsTrackRows.error ||
    assignedDeficiencyRows.error
  ) {
    throw new Error(
      memberCertificationRows.error?.message ||
        memberQualificationRows.error?.message ||
        attendanceRows.error?.message ||
        outsideRows.error?.message ||
        assignmentMemberApprovedRows.error?.message ||
        emsTrackRows.error?.message ||
        assignedDeficiencyRows.error?.message ||
        "Unable to load member readiness data.",
    );
  }

  const certificationTypeById = buildCertificationTypeMetaById(
    certificationTypes.map((row) => ({
      id: row.id,
      ems_authority: row.ems_authority,
      ems_certification_level: row.ems_certification_level,
    })),
  );

  const certificationsByMember = new Map<string, MemberCertificationRow[]>();
  for (const row of (memberCertificationRows.data ?? []) as MemberCertificationRow[]) {
    const list = certificationsByMember.get(row.member_id) ?? [];
    list.push(row);
    certificationsByMember.set(row.member_id, list);
  }

  const qualificationsByMember = new Map<string, MemberQualificationRow[]>();
  for (const row of (memberQualificationRows.data ?? []) as MemberQualificationRow[]) {
    const list = qualificationsByMember.get(row.member_id) ?? [];
    list.push(row);
    qualificationsByMember.set(row.member_id, list);
  }

  const emsProfilesByMember = new Map<string, EmsTrackProfileAuthorityRow[]>();
  for (const row of (emsTrackRows.data ?? []) as Array<Record<string, unknown>>) {
    const memberId = typeof row.member_id === "string" ? row.member_id : "";
    if (!memberId) {
      continue;
    }

    const profile: EmsTrackProfileAuthorityRow = {
      track: row.track === "nremt" ? "nremt" : "iowa",
      certification_level:
        row.certification_level === "emr" ||
        row.certification_level === "emt" ||
        row.certification_level === "aemt" ||
        row.certification_level === "paramedic"
          ? row.certification_level
          : "emt",
      track_status:
        row.track_status === "active" ||
        row.track_status === "inactive" ||
        row.track_status === "expired" ||
        row.track_status === "not_maintained" ||
        row.track_status === "needs_review"
          ? row.track_status
          : "needs_review",
      maintain_track: row.maintain_track === true,
      certification_number: typeof row.certification_number === "string" ? row.certification_number : null,
      expiration_date: typeof row.expiration_date === "string" ? row.expiration_date : null,
      effective_start_date: typeof row.effective_start_date === "string" ? row.effective_start_date : "",
      effective_end_date: typeof row.effective_end_date === "string" ? row.effective_end_date : null,
    };

    const list = emsProfilesByMember.get(memberId) ?? [];
    list.push(profile);
    emsProfilesByMember.set(memberId, list);
  }

  const attendanceByMember = new Map<string, TrainingAttendanceRow[]>();
  const attendedEventIds = new Set<string>();
  for (const row of (attendanceRows.data ?? []) as TrainingAttendanceRow[]) {
    const list = attendanceByMember.get(row.member_id) ?? [];
    list.push(row);
    attendanceByMember.set(row.member_id, list);
    if (row.training_event_id) {
      attendedEventIds.add(row.training_event_id);
    }
  }

  const outsideByMember = new Map<string, OutsideSubmissionRow[]>();
  for (const row of (outsideRows.data ?? []) as OutsideSubmissionRow[]) {
    const list = outsideByMember.get(row.member_id) ?? [];
    list.push(row);
    outsideByMember.set(row.member_id, list);
  }

  const approvedAssignmentMembersByMember = new Map<string, AssignmentMemberApprovedRow[]>();
  const approvedAssignmentIds = new Set<string>();
  for (const row of (assignmentMemberApprovedRows.data ?? []) as AssignmentMemberApprovedRow[]) {
    const list = approvedAssignmentMembersByMember.get(row.member_id) ?? [];
    list.push(row);
    approvedAssignmentMembersByMember.set(row.member_id, list);
    if (typeof row.training_assignment_id === "string" && row.training_assignment_id.length > 0) {
      approvedAssignmentIds.add(row.training_assignment_id);
    }
  }

  const assignmentsResult = approvedAssignmentIds.size
    ? await supabase
        .from("training_assignments")
        .select("id, category_id, hours_credit, status")
        .eq("department_id", departmentId)
        .in("id", Array.from(approvedAssignmentIds))
    : { data: [] as unknown[], error: null };

  if (assignmentsResult.error) {
    throw new Error(assignmentsResult.error.message || "Unable to load assignment details.");
  }

  const assignmentById = new Map(
    ((assignmentsResult.data ?? []) as AssignmentRow[]).map((row) => [row.id, row]),
  );

  const assignedDeficiencies = (assignedDeficiencyRows.data ?? []) as DeficiencyAssignedRow[];
  const deficienciesByMember = new Map<string, DeficiencyAssignedRow[]>();
  for (const row of assignedDeficiencies) {
    const memberId = typeof row.assigned_to === "string" ? row.assigned_to : "";
    if (!memberId) {
      continue;
    }

    const list = deficienciesByMember.get(memberId) ?? [];
    list.push(row);
    deficienciesByMember.set(memberId, list);
  }

  const assignedDeficiencyIds = assignedDeficiencies
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const assignmentHistoryRowsResult = assignedDeficiencyIds.length
    ? await supabase
        .from("deficiency_history")
        .select("deficiency_id, member_id, event_type, created_at")
        .in("deficiency_id", assignedDeficiencyIds)
        .in("member_id", memberIds)
        .eq("event_type", "Assigned")
        .order("created_at", { ascending: false })
    : { data: [] as unknown[], error: null };

  if (assignmentHistoryRowsResult.error) {
    throw new Error(assignmentHistoryRowsResult.error.message || "Unable to load deficiency assignment history.");
  }

  const personalAssignedAtByMember = new Map<string, Map<string, string>>();
  for (const row of (assignmentHistoryRowsResult.data ?? []) as DeficiencyAssignmentHistoryRow[]) {
    if (!row.member_id || !row.deficiency_id || !row.created_at) {
      continue;
    }

    const byDeficiency = personalAssignedAtByMember.get(row.member_id) ?? new Map<string, string>();
    if (!byDeficiency.has(row.deficiency_id)) {
      byDeficiency.set(row.deficiency_id, row.created_at);
    }
    personalAssignedAtByMember.set(row.member_id, byDeficiency);
  }

  const attendedEventsResult = attendedEventIds.size
    ? await supabase
        .from("training_events")
        .select("id, category_id, hours_credit")
        .eq("department_id", departmentId)
        .in("id", Array.from(attendedEventIds))
    : { data: [] as unknown[], error: null };

  if (attendedEventsResult.error) {
    throw new Error(attendedEventsResult.error.message || "Unable to load attended events.");
  }

  const eventsById = new Map<string, TrainingEventRow>();
  const categoryIds = new Set<string>();
  for (const row of (attendedEventsResult.data ?? []) as TrainingEventRow[]) {
    eventsById.set(row.id, row);
    if (typeof row.category_id === "string" && row.category_id.length > 0) {
      categoryIds.add(row.category_id);
    }
  }

  for (const row of (outsideRows.data ?? []) as OutsideSubmissionRow[]) {
    if (typeof row.category_id === "string" && row.category_id.length > 0) {
      categoryIds.add(row.category_id);
    }
  }

  for (const row of assignmentById.values()) {
    if (typeof row.category_id === "string" && row.category_id.length > 0) {
      categoryIds.add(row.category_id);
    }
  }

  const categoryRowsResult = categoryIds.size
    ? await supabase
        .from("training_categories")
        .select("id, name")
        .eq("department_id", departmentId)
        .in("id", Array.from(categoryIds))
    : { data: [] as unknown[], error: null };

  if (categoryRowsResult.error) {
    throw new Error(categoryRowsResult.error.message || "Unable to load category data.");
  }

  const categoryNameById = new Map(
    ((categoryRowsResult.data ?? []) as TrainingCategoryRow[]).map((row) => [row.id, row.name]),
  );
  const qualificationCatalog: CatalogRow[] = qualificationTypes.map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));

  const memberResults: MemberReadinessResult[] = [];

  for (const member of members) {
    const memberId = member.id;
    const memberName = toMemberName(member);
    const rawMemberCertifications = certificationsByMember.get(memberId) ?? [];
    const memberQualifications = qualificationsByMember.get(memberId) ?? [];
    const memberCertifications = buildCanonicalMemberCertificationRows({
      certificationTypes: certificationCatalog,
      qualificationTypes: qualificationCatalog,
      memberCertifications: rawMemberCertifications,
      memberQualifications,
    }).map((row) => ({
      member_id: row.member_id ?? memberId,
      certification_id: row.certification_id,
      certificate_number: row.certificate_number ?? null,
      issued_at: row.issued_at ?? "",
      expires_at: row.expires_at,
    }));

    const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
      memberCertifications,
      certificationTypeById,
    });

    const memberProfiles = emsProfilesByMember.get(memberId) ?? [];
    const effectiveIowaProfile = applyAuthoritativeCertificationToTrackProfile({
      track: "iowa",
      profile: findCurrentTrackProfile(memberProfiles, "iowa"),
      authoritativeCertification: authoritativeEmsCertifications.iowa,
    });
    const effectiveNremtProfile = applyAuthoritativeCertificationToTrackProfile({
      track: "nremt",
      profile: findCurrentTrackProfile(memberProfiles, "nremt"),
      authoritativeCertification: authoritativeEmsCertifications.nremt,
    });

    const certificationStatuses = memberCertifications.map((record) => {
      const certMeta = certificationTypeById.get(record.certification_id);
      const genericStatus = getCertificationStatus(record.expires_at, CERTIFICATION_WARNING_DAYS);
      const sourceTrack = certMeta?.authority === "iowa"
        ? effectiveIowaProfile
        : certMeta?.authority === "nremt"
          ? effectiveNremtProfile
          : null;

      const status = resolveCertificationStatusFromTrack({
        track: sourceTrack,
        warningDays: CERTIFICATION_WARNING_DAYS,
        genericStatus,
      });

      return {
        certificationId: record.certification_id,
        certificationName: certificationNameById.get(record.certification_id) ?? "Certification",
        status,
      };
    });

    const memberDepartmentRoleId =
      typeof member.department_role_id === "string" ? member.department_role_id : null;
    const memberRequirementStartDate = member.hire_start_date ?? member.created_at ?? null;

    const selectedDepartmentRole = memberDepartmentRoleId
      ? departmentRoleById.get(memberDepartmentRoleId) ?? null
      : null;

    const qualificationReadinessAdapter = buildQualificationReadinessAdapter({
      memberDepartmentRoleId,
      certificationTypes: certificationCatalog,
      qualificationTypes,
      roleRequiredCertifications,
      roleRequiredQualifications,
      memberCertifications: memberCertifications.map((record) => ({
        certification_id: record.certification_id,
        expires_at: record.expires_at,
      })),
      memberQualifications: memberQualifications.map((record) => ({
        qualification_id: record.qualification_id,
      })),
    });

    const qualificationReadiness: QualificationReadinessInput = {
      hasAssignedRole: memberDepartmentRoleId !== null,
      roleName: selectedDepartmentRole?.name ?? null,
      requiredQualifications: qualificationReadinessAdapter.requiredQualifications,
      completedQualifications: qualificationReadinessAdapter.completedQualifications,
      missingQualifications: qualificationReadinessAdapter.missingQualifications,
    };
    const scoredCertificationStatuses = buildScoredCertificationStatuses({
      memberDepartmentRoleId,
      certificationStatuses: certificationStatuses.map((row) => ({
        certificationId: row.certificationId,
        certificationName: row.certificationName,
        status: row.status,
        authority: certificationTypeById.get(row.certificationId)?.authority ?? null,
        expiresAt: memberCertifications.find((record) => record.certification_id === row.certificationId)?.expires_at ?? null,
      })),
      roleRequiredCertifications,
      includeIowaAuthority: effectiveIowaProfile !== null,
      includeNremtAuthority: effectiveNremtProfile?.maintain_track === true,
      certificationNameById,
    });

    const memberAttendance = attendanceByMember.get(memberId) ?? [];
    const memberOutside = outsideByMember.get(memberId) ?? [];
    const approvedMemberAssignments = approvedAssignmentMembersByMember.get(memberId) ?? [];

    const categoryHoursMap = new Map<string, { categoryId: string | null; categoryName: string; hours: number }>();
    const complianceRows: Array<{ categoryId: string | null; hours: number | string | null }> = [];

    for (const attendance of memberAttendance) {
      const event = eventsById.get(attendance.training_event_id);
      if (!event) {
        continue;
      }

      const hours = parseHours(event.hours_credit);
      complianceRows.push({
        categoryId: event.category_id,
        hours,
      });
      const categoryKey = event.category_id || "uncategorized";
      const categoryName = event.category_id
        ? categoryNameById.get(event.category_id) ?? "Uncategorized"
        : "Uncategorized";
      const current = categoryHoursMap.get(categoryKey) ?? {
        categoryId: event.category_id,
        categoryName,
        hours: 0,
      };
      current.hours += hours;
      categoryHoursMap.set(categoryKey, current);
    }

    for (const outside of memberOutside) {
      const hours = parseHours(outside.hours);
      complianceRows.push({
        categoryId: outside.category_id,
        hours,
      });
      const categoryKey = outside.category_id || "uncategorized";
      const categoryName = outside.category_id
        ? categoryNameById.get(outside.category_id) ?? "Uncategorized"
        : "Uncategorized";
      const current = categoryHoursMap.get(categoryKey) ?? {
        categoryId: outside.category_id,
        categoryName,
        hours: 0,
      };
      current.hours += hours;
      categoryHoursMap.set(categoryKey, current);
    }

    for (const approvedAssignmentMember of approvedMemberAssignments) {
      const assignment = assignmentById.get(approvedAssignmentMember.training_assignment_id);
      if (!assignment || assignment.status === "archived") {
        continue;
      }

      const assignmentHours = parseHours(assignment.hours_credit);
      const rowHours = parseHours(approvedAssignmentMember.hours_earned);
      const creditedHours = rowHours > 0 ? rowHours : assignmentHours;

      complianceRows.push({
        categoryId: assignment.category_id,
        hours: creditedHours,
      });
      const categoryKey = assignment.category_id || "uncategorized";
      const categoryName = assignment.category_id
        ? categoryNameById.get(assignment.category_id) ?? "Uncategorized"
        : "Uncategorized";
      const current = categoryHoursMap.get(categoryKey) ?? {
        categoryId: assignment.category_id,
        categoryName,
        hours: 0,
      };
      current.hours += creditedHours;
      categoryHoursMap.set(categoryKey, current);
    }

    const departmentHours = calculateComplianceBucketHours(complianceRows, categoryNameById).fireAnnualHours;

    const deficiencyRows = deficienciesByMember.get(memberId) ?? [];
    const assignedAtByDeficiency = personalAssignedAtByMember.get(memberId) ?? new Map<string, string>();

    const deficiencyItems: DeficiencyReadinessInput[] = deficiencyRows.map((row) => {
      const statusRelation = normalizeDeficiencyStatus(row.status_info);
      const priorityRelation = normalizeDeficiencyPriority(row.priority_info);

      return {
        id: row.id,
        deficiencyNumber: row.deficiency_number,
        description: row.description,
        priorityName: priorityRelation.name,
        assignedToMemberId: row.assigned_to,
        statusName: statusRelation.name,
        statusActive: statusRelation.active,
        createdAt: row.created_at,
        reportedAt: row.reported_at,
        personalAssignedAt: assignedAtByDeficiency.get(row.id) ?? null,
      };
    });

    const readinessState = buildMemberReadinessScore({
      requirementRows: requirements,
      departmentHours,
      categoryHours: Array.from(categoryHoursMap.values()),
      categoryNameById,
      certificationStatuses,
      scoredCertificationStatuses,
      qualificationReadiness,
      deficiencyItems,
      currentMemberId: memberId,
      memberStartDate: memberRequirementStartDate,
    });

    const highestDeficiencyPenaltyPercent = getHighestDeficiencyPenaltyForMember(deficiencyItems, memberId);

    memberResults.push({
      memberId,
      memberName,
      scorePercent: readinessState.scorePercent,
      readinessState,
      highestDeficiencyPenaltyPercent,
    });
  }

  const scoredMembers = memberResults.filter((result) => typeof result.scorePercent === "number");
  const scoredMemberCount = scoredMembers.length;

  const personnelScore =
    scoredMemberCount > 0
      ? roundToTwo(
          scoredMembers.reduce((total, result) => total + (result.scorePercent ?? 0), 0) /
            scoredMemberCount,
        )
      : null;

  const readinessRows = await getApparatusReadinessList();
  const includedApparatusRows = readinessRows.filter(
    (row) =>
      row.apparatus.lifecycle_status !== "archived" &&
      row.apparatus.include_in_department_readiness !== false,
  );
  const participatingScores = getParticipatingApparatusScores(
    includedApparatusRows.map((row) => ({
      includeInDepartmentReadiness: row.apparatus.include_in_department_readiness !== false,
      readinessState: row.readinessState,
      scorePercent: row.readiness.scorePercent,
    })),
  );

  const apparatusCount = participatingScores.length;
  const apparatusScore =
    apparatusCount > 0
      ? roundToTwo(participatingScores.reduce((total, value) => total + value, 0) / apparatusCount)
      : null;

  const departmentScore = calculateDepartmentComposite({
    personnelScore,
    apparatusScore,
    scoredMemberCount,
    participatingApparatusCount: apparatusCount,
  });

  const { status, statusMessage, notYetRated } = deriveDepartmentReadinessStatus(departmentScore);

  const coachActions: DepartmentReadinessCoachAction[] = [];

  for (const member of memberResults) {
    if (typeof member.scorePercent !== "number") {
      continue;
    }

    for (const coachItem of member.readinessState.coachItems) {
      const factor = member.readinessState.factors.find((item) => item.id === coachItem.factorId);
      const qualificationTargets =
        factor?.category === "qualification" && member.readinessState.missingQualifications.length > 0
          ? member.readinessState.missingQualifications
          : [null];

      for (const qualificationTarget of qualificationTargets) {
      const simulatedMemberScore = simulateMemberScoreForResolvedCoachFactor({
        readinessState: member.readinessState,
        factorId: coachItem.factorId,
        highestDeficiencyPenaltyPercent: member.highestDeficiencyPenaltyPercent,
        resolvedQualificationName: qualificationTarget ?? undefined,
      });

      const qualificationLabel = qualificationTarget ? `: ${qualificationTarget}` : "";
      const actionDescription = qualificationTarget
        ? `Complete required qualification '${qualificationTarget}'. ${coachItem.explanation}`
        : coachItem.explanation;

      coachActions.push({
        id: `member-${member.memberId}-${coachItem.factorId}${qualificationTarget ? `-${qualificationTarget}` : ""}`,
        title: `${member.memberName} - ${coachItem.title}${qualificationLabel}`,
        description: actionDescription,
        href: "/my-readiness",
        ownerLabel: member.memberName,
        category: "personnel",
        audience: member.memberId === viewer.id ? "all" : "officer_admin",
        potentialDepartmentImpactPercent: computeMemberActionImpact({
          departmentScore,
          personnelScore,
          apparatusScore,
          scoredMemberCount,
          apparatusCount,
          currentMemberScore: member.scorePercent,
          simulatedMemberScore,
        }),
      });
      }
    }
  }

  for (const row of includedApparatusRows) {
    const statusLabel = getStatusLabelForReadinessRow(row);
    if (statusLabel === "Ready") {
      continue;
    }

    const issueActions = buildApparatusIssueActions(row);
    for (const issue of issueActions) {
      coachActions.push({
        id: `apparatus-${row.apparatus.id}-${issue.idSuffix}`,
        title: `${row.apparatus.name} - ${issue.title}`,
        description: issue.description,
        href: `/apparatus/${row.apparatus.id}`,
        ownerLabel: row.apparatus.name,
        category: "apparatus",
        audience: "officer_admin",
        potentialDepartmentImpactPercent: computeApparatusActionImpact({
          departmentScore,
          personnelScore,
          apparatusScore,
          apparatusCount,
          apparatusScoreDelta: issue.scoreDelta,
        }),
      });
    }
  }

  const visibleActions = filterCoachActionsForRole(coachActions, viewer.role);
  const sortedActions = sortCoachActions(visibleActions);
  const topCoachActions = sortedActions.slice(0, 5);
  const remainingCoachActions = sortedActions.slice(5);

  return {
    departmentScore,
    personnelScore,
    apparatusScore,
    personnelWeight: PERSONNEL_WEIGHT,
    apparatusWeight: APPARATUS_WEIGHT,
    activeMemberCount,
    scoredMemberCount,
    apparatusCount,
    status,
    statusMessage,
    notYetRated,
    scoredMembersLabel: `${scoredMemberCount} of ${activeMemberCount} active members scored.`,
    participationMode: "explicit_apparatus_opt_in",
    participationLimitation:
      "Only apparatus with Department Readiness participation enabled are included in the apparatus composite.",
    topCoachActions,
    remainingCoachActions,
  };
}

export async function getDepartmentReadinessDataForCurrentMember() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    return null;
  }

  const result = await getDepartmentReadinessData({
    departmentId: currentMember.departmentId,
    viewer: currentMember,
  });

  return {
    currentMember,
    result,
  };
}
