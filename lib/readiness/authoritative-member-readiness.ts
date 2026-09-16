import { department } from "@/lib/department";
import {
  applyAuthoritativeCertificationToTrackProfile,
  findCurrentTrackProfile,
  resolveAuthoritativeEmsCertificationsForMember,
  resolveCertificationStatusFromTrack,
  type EmsAuthority,
  type EmsTrackProfileAuthorityRow,
  type MemberCertificationAuthorityRow,
} from "@/lib/ems/authoritative-certifications";
import type { EmsCertificationLevel } from "@/lib/ems/requirements";
import {
  buildMemberReadinessScore,
  calculateOverallReadinessScorePercent,
  getCertificationStatus,
  parseHours,
  type DeficiencyReadinessInput,
  type QualificationReadinessInput,
  type ReadinessFactor,
  type ReadinessScoreState,
  type RequirementInput,
  type TrainingAssignmentInput,
  type TrainingAssignmentMemberInput,
} from "@/lib/readiness/member-readiness";
import { buildScoredCertificationStatuses } from "@/lib/readiness/scored-certifications";
import {
  buildQualificationReadinessAdapter,
  type CatalogRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";
import { calculateComplianceBucketHours } from "@/lib/training/compliance-buckets";

// The single certification-warning window used everywhere readiness is scored.
export const READINESS_CERTIFICATION_WARNING_DAYS = department.settings.certificationWarningDays;

export type AuthoritativeMemberCertificationRow = {
  id?: string;
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
};

export type CertificationTypeMetaById = Map<string, { authority: EmsAuthority | null; level: EmsCertificationLevel | null }>;

export type ComputeMemberReadinessInput = {
  currentMemberId: string;
  memberStartDate: string | null;
  memberDepartmentRoleId: string | null;
  roleName: string | null;
  evaluationDate?: string | Date;

  canonicalMemberCertifications: AuthoritativeMemberCertificationRow[];
  certificationNameById: Map<string, string>;
  certificationTypeById: CertificationTypeMetaById;
  emsTrackProfiles: EmsTrackProfileAuthorityRow[];
  roleRequiredCertifications: RoleRequiredCertificationRow[];

  certificationCatalog: CatalogRow[];
  qualificationCatalog: CatalogRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
  memberQualifications: Array<{ qualification_id: string }>;

  requirements: RequirementInput[];
  categoryNameById: Map<string, string>;
  fireAnnualComplianceRows: Array<{ categoryId: string | null; hours: number | string | null }>;
  categoryHours: Array<{ categoryId: string | null; categoryName: string; hours: number }>;
  trainingAssignments?: TrainingAssignmentInput[];
  assignmentMembers?: TrainingAssignmentMemberInput[];

  deficiencyItems: DeficiencyReadinessInput[];
};

export type AuthoritativeMemberReadinessResult = {
  readiness: ReadinessScoreState;
  fireAnnualTrainingHours: number;
  activeIowaProfile: EmsTrackProfileAuthorityRow | null;
  activeNremtProfile: EmsTrackProfileAuthorityRow | null;
  certificationStatuses: Array<{ certificationId: string; certificationName: string; status: ReturnType<typeof getCertificationStatus>; expiresAt: string | null }>;
};

/**
 * The one authoritative readiness calculation shared by /my-readiness, the Personnel
 * profile, the Command Center panel, and Department Readiness. Any change here applies
 * identically to every surface, eliminating per-screen scoring drift.
 */
export function computeAuthoritativeMemberReadiness(input: ComputeMemberReadinessInput): AuthoritativeMemberReadinessResult {
  const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
    memberCertifications: input.canonicalMemberCertifications.map<MemberCertificationAuthorityRow>((row) => ({
      member_id: input.currentMemberId,
      certification_id: row.certification_id,
      certificate_number: row.certificate_number,
      expires_at: row.expires_at,
      issued_at: row.issued_at,
    })),
    certificationTypeById: input.certificationTypeById,
  });

  const activeIowaProfile = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: findCurrentTrackProfile(input.emsTrackProfiles, "iowa"),
    authoritativeCertification: authoritativeEmsCertifications.iowa,
  });
  const activeNremtProfile = applyAuthoritativeCertificationToTrackProfile({
    track: "nremt",
    profile: findCurrentTrackProfile(input.emsTrackProfiles, "nremt"),
    authoritativeCertification: authoritativeEmsCertifications.nremt,
  });

  const certificationStatuses = input.canonicalMemberCertifications.map((row) => {
    const genericStatus = getCertificationStatus(row.expires_at, READINESS_CERTIFICATION_WARNING_DAYS);
    const meta = input.certificationTypeById.get(row.certification_id);
    const track = meta?.authority === "iowa" ? activeIowaProfile : meta?.authority === "nremt" ? activeNremtProfile : null;

    return {
      certificationId: row.certification_id,
      certificationName: input.certificationNameById.get(row.certification_id) ?? "Certification",
      status: resolveCertificationStatusFromTrack({
        track,
        warningDays: READINESS_CERTIFICATION_WARNING_DAYS,
        genericStatus,
      }),
      expiresAt: row.expires_at,
    };
  });

  const scoredCertificationStatuses = buildScoredCertificationStatuses({
    memberDepartmentRoleId: input.memberDepartmentRoleId,
    certificationStatuses: certificationStatuses.map((row) => ({
      certificationId: row.certificationId,
      certificationName: row.certificationName,
      status: row.status,
      authority: input.certificationTypeById.get(row.certificationId)?.authority ?? null,
      expiresAt: row.expiresAt,
    })),
    roleRequiredCertifications: input.roleRequiredCertifications,
    includeIowaAuthority: activeIowaProfile !== null,
    includeNremtAuthority: activeNremtProfile?.maintain_track === true,
    includeNonExpiringRoleRequirements: true,
    certificationNameById: input.certificationNameById,
  });

  const qualificationReadinessAdapter = buildQualificationReadinessAdapter({
    memberDepartmentRoleId: input.memberDepartmentRoleId,
    certificationTypes: input.certificationCatalog,
    qualificationTypes: input.qualificationCatalog,
    roleRequiredCertifications: input.roleRequiredCertifications,
    roleRequiredQualifications: input.roleRequiredQualifications,
    memberCertifications: input.canonicalMemberCertifications.map((row) => ({
      certification_id: row.certification_id,
      expires_at: row.expires_at,
    })),
    memberQualifications: input.memberQualifications,
  });

  const qualificationReadiness: QualificationReadinessInput = {
    hasAssignedRole: input.memberDepartmentRoleId !== null,
    roleName: input.roleName,
    requiredQualifications: qualificationReadinessAdapter.requiredQualifications,
    completedQualifications: qualificationReadinessAdapter.completedQualifications,
    missingQualifications: qualificationReadinessAdapter.missingQualifications,
  };

  const fireAnnualTrainingHours = calculateComplianceBucketHours(
    input.fireAnnualComplianceRows,
    input.categoryNameById,
  ).fireAnnualHours;

  const readiness = buildMemberReadinessScore({
    requirementRows: input.requirements,
    departmentHours: fireAnnualTrainingHours,
    categoryHours: input.categoryHours,
    categoryNameById: input.categoryNameById,
    trainingAssignments: input.trainingAssignments,
    assignmentMembers: input.assignmentMembers,
    certificationStatuses: certificationStatuses.map((row) => ({
      certificationId: row.certificationId,
      certificationName: row.certificationName,
      status: row.status,
    })),
    scoredCertificationStatuses,
    qualificationReadiness,
    currentMemberId: input.currentMemberId,
    memberStartDate: input.memberStartDate,
    deficiencyItems: input.deficiencyItems,
    evaluationDate: input.evaluationDate,
  });

  return {
    readiness,
    fireAnnualTrainingHours,
    activeIowaProfile,
    activeNremtProfile,
    certificationStatuses,
  };
}

const MEMBER_DEFICIENCIES_BUCKET_MAX = 10;

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
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
      return sum + clampRange(overrideCompletionPercent, 0, 100);
    }

    return sum + clampRange(factor.completionPercent, 0, 100);
  }, 0);

  return clampRange(total / categoryFactors.length, 0, 100);
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
      : clampRange(
          (readinessState.qualificationsScore / readinessState.qualificationsMaxScore) * 100,
          0,
          100,
        );

  let deficienciesCategoryPercent = clampRange(
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

    const currentQualificationsPercent = clampRange(
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
    const nextCompletedCount = clampRange(completedCount + 1, 0, totalRequired);
    qualificationsCategoryPercent = clampRange((nextCompletedCount / totalRequired) * 100, 0, 100);
  } else if (factor.id === "deficiencies-current-responsibility") {
    const reducedPenalty = Math.max(0, readinessState.deficiencyPenaltyPercent - highestDeficiencyPenaltyPercent);
    deficienciesCategoryPercent = clampRange(
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

export type FormattedCoachAction = {
  id: string;
  category: "training" | "certification" | "qualification" | "deficiency" | "other";
  categoryLabel: string;
  actionText: string;
  gainPercent: number | null;
  gainLabel: string | null;
  href: string;
  actionButtonLabel: string;
  isActionable: boolean;
};

export function formatAuthoritativeCoachAction(input: {
  factor: ReadinessFactor;
  readinessState: ReadinessScoreState;
  highestDeficiencyPenaltyPercent?: number;
  isSelf?: boolean;
  memberId?: string;
}): FormattedCoachAction {
  const { factor, readinessState, highestDeficiencyPenaltyPercent = 0, isSelf = true, memberId } = input;

  let categoryLabel = "Action Needed";
  let actionText = factor.actionNeeded;
  let href = isSelf ? "/my-readiness" : memberId ? `/personnel/${memberId}` : "/my-readiness";
  let actionButtonLabel = "View Details";
  let category: FormattedCoachAction["category"] = "other";
  let isActionable = !factor.completed;

  if (factor.category === "training") {
    category = "training";
    href = "/training";
    actionButtonLabel = "Go to Training";

    const reqHours = parseHours(factor.requiredValue);
    const curHours = parseHours(factor.currentValue);

    // 1. Fully satisfied annual training (e.g. 24/24 hrs)
    if (reqHours > 0 && curHours >= reqHours) {
      categoryLabel = "Training Complete";
      actionText = "Annual training requirement met.";
      isActionable = false;
    } else {
      // Extract shortfall to get back on pace from actionNeeded
      const paceShortfallMatch = factor.actionNeeded.match(
        /Complete\s+([0-9]+(?:\.[0-9]+)?)\s*(?:hrs?|hours?)?\s+more\s+training\s+hours\s+to\s+get\s+back\s+on\s+pace/i,
      );
      const paceShortfall = paceShortfallMatch ? Number.parseFloat(paceShortfallMatch[1]) : 0;

      // Extract category name
      const categoryMatch =
        factor.actionNeeded.match(/of\s+([A-Za-z0-9\s/,&-]+?)\s+training/i) ||
        factor.actionNeeded.match(/in\s+([A-Za-z0-9\s/,&-]+?)\./i);
      const categoryName = categoryMatch ? categoryMatch[1].trim() : "Fire Suppression";

      // Check if on pace:
      const isExplicitlyOnPace = factor.actionNeeded.toLowerCase().startsWith("on pace") || factor.completed;
      const isNegligibleShortfall = paceShortfallMatch ? paceShortfall <= 0.5 : factor.completionPercent >= 98;
      const isOnPace = isExplicitlyOnPace || isNegligibleShortfall;

      if (isOnPace) {
        categoryLabel = "You're on Track";
        actionText = "Keep up your current training pace.";
        isActionable = false;
      } else {
        const shortfallToDisplay = paceShortfall > 0 ? paceShortfall : Math.max(0, reqHours - curHours);
        categoryLabel = "Training Needed";
        actionText = `Complete ${shortfallToDisplay.toFixed(2)} more hours of ${categoryName} training.`;
        isActionable = true;
      }
    }
  } else if (factor.category === "certification") {
    category = "certification";
    categoryLabel = factor.statusLabel.toLowerCase().includes("expiring")
      ? "Certification Expiring Soon"
      : "Certification Needed";
    href = isSelf ? "/my-readiness" : memberId ? `/personnel/${memberId}` : "/certifications";
    actionButtonLabel = "View Certifications";
    isActionable = !factor.completed;

    if (factor.statusLabel.toLowerCase().includes("expiring")) {
      actionText = `Renew ${factor.title} before it expires.`;
    } else {
      actionText = `Renew or add a current ${factor.title} certification.`;
    }
  } else if (factor.category === "qualification") {
    category = "qualification";
    categoryLabel = "Qualification Needed";
    href = isSelf ? "/my-readiness" : memberId ? `/personnel/${memberId}` : "/qualification-tracks";
    actionButtonLabel = "View Qualifications";
    isActionable = !factor.completed;

    if (readinessState.missingQualifications.length > 0) {
      actionText = `Complete required qualification: ${readinessState.missingQualifications.join(", ")}.`;
    } else if (factor.actionNeeded.toLowerCase().includes("role")) {
      actionText = "Ask your administrator to assign your department role.";
    } else {
      actionText = `Complete required qualification for ${factor.title}.`;
    }
  } else if (factor.id === "deficiencies-current-responsibility" || factor.category === "other") {
    category = "deficiency";
    categoryLabel = "Deficiency Assigned";
    href = "/deficiencies";
    actionButtonLabel = "Go to Deficiencies";
    actionText = "Resolve active assigned deficiencies to remove the readiness penalty.";
    isActionable = !factor.completed;
  }

  let gain: number | null = null;
  let gainLabel: string | null = null;

  if (isActionable) {
    const simulatedScore = simulateMemberScoreForResolvedCoachFactor({
      readinessState,
      factorId: factor.id,
      highestDeficiencyPenaltyPercent,
    });

    const currentScore = readinessState.scorePercent ?? 0;
    gain = typeof simulatedScore === "number" ? Math.max(0, roundToTenths(simulatedScore - currentScore)) : null;
    gainLabel =
      gain !== null && gain > 0
        ? gain % 1 === 0
          ? `+${gain}% Readiness`
          : `+${gain.toFixed(1)}% Readiness`
        : null;
  }

  return {
    id: factor.id,
    category,
    categoryLabel,
    actionText,
    gainPercent: gain,
    gainLabel,
    href,
    actionButtonLabel,
    isActionable,
  };
}

export function buildAuthoritativeCoachActions(input: {
  readinessState: ReadinessScoreState;
  highestDeficiencyPenaltyPercent?: number;
  isSelf?: boolean;
  memberId?: string;
  limit?: number;
}): FormattedCoachAction[] {
  const { readinessState, highestDeficiencyPenaltyPercent = 0, isSelf = true, memberId, limit } = input;
  const actions = readinessState.factors
    .map((factor) =>
      formatAuthoritativeCoachAction({
        factor,
        readinessState,
        highestDeficiencyPenaltyPercent,
        isSelf,
        memberId,
      }),
    )
    .filter((action) => action.isActionable);

  return typeof limit === "number" ? actions.slice(0, limit) : actions;
}

export function getAuthoritativeCoachSummary(input: {
  readinessState: ReadinessScoreState;
  highestDeficiencyPenaltyPercent?: number;
  isSelf?: boolean;
}) {
  const { readinessState, highestDeficiencyPenaltyPercent = 0, isSelf = true } = input;
  if (!readinessState.configured) {
    return {
      label: "NEXT BEST ACTION",
      sentence: readinessState.configurationMessage || "Ask your department admin to configure readiness requirements.",
      href: "/my-readiness",
    };
  }

  const actionable = buildAuthoritativeCoachActions({
    readinessState,
    highestDeficiencyPenaltyPercent,
    isSelf,
  });

  if (actionable.length > 0) {
    const primary = actionable[0];
    return {
      label: primary.categoryLabel.toUpperCase(),
      sentence: `${primary.actionText}${primary.gainLabel ? ` (${primary.gainLabel})` : ""}`,
      href: primary.href,
    };
  }

  const trainingFactor = readinessState.factors.find((f) => f.category === "training");
  if (trainingFactor) {
    const reqHours = parseHours(trainingFactor.requiredValue);
    const curHours = parseHours(trainingFactor.currentValue);
    if (reqHours > 0 && curHours >= reqHours) {
      return {
        label: "TRAINING COMPLETE",
        sentence: "Annual training requirement met.",
        href: "/training",
      };
    }
  }

  return {
    label: "YOU'RE ON TRACK",
    sentence: "Keep up your current training pace.",
    href: "/my-readiness",
  };
}

