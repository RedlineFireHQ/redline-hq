export type CertificationStatus = "current" | "expiring_soon" | "expired";

export type TrainingRequirementKind = "annual_hours" | "category_hours" | "topic" | "recurring";

export type ReadinessFactorCategory = "training" | "certification" | "qualification" | "other";

export type DeficiencyImpactState = "no_impact" | "small_impact" | "moderate_impact" | "maximum_impact";

export type ReadinessFactor = {
  id: string;
  title: string;
  category: ReadinessFactorCategory;
  statusLabel: string;
  appliesTo: string;
  unitLabel: string;
  periodLabel: string;
  standardReference: string | null;
  requiredValue: string;
  currentValue: string;
  completionPercent: number;
  completed: boolean;
  actionNeeded: string;
};

export type ReadinessCoachItem = {
  factorId: string;
  title: string;
  explanation: string;
  currentStatus: string;
  currentValue: string;
  targetValue: string;
  remainingValue: string;
  href: string | null;
};

export type QualificationReadinessInput = {
  hasAssignedRole: boolean;
  roleName: string | null;
  requiredQualifications: string[];
  completedQualifications: string[];
  missingQualifications: string[];
};

export type ReadinessScoreState = {
  configured: boolean;
  configurationState: "not_configured" | "configured";
  configurationMessage: string;
  scorePercent: number | null;
  remainingPercent: number | null;
  qualificationsScore: number | null;
  qualificationsMaxScore: number;
  qualificationsStatus: "no_role" | "not_configured" | "complete" | "missing";
  missingQualifications: string[];
  completedRequirements: number;
  incompleteRequirements: number;
  deficiencyPenaltyPercent: number;
  deficiencyCategoryMaxPercent: number;
  deficiencyImpactingCount: number;
  factors: ReadinessFactor[];
  coachItems: ReadinessCoachItem[];
};

export type DeficiencyReadinessInput = {
  id: string;
  deficiencyNumber: string | null;
  description: string | null;
  priorityName: string | null;
  assignedToMemberId: string | null;
  statusName: string | null;
  statusActive: boolean | null;
  createdAt: string | null;
  reportedAt: string | null;
  personalAssignedAt: string | null;
};

export type RequirementInput = {
  id: string;
  name: string;
  requirement_kind: string;
  period_type?: string;
  minimum_hours: number | string | null;
  category_id: string | null;
  due_frequency_rule?: string | null;
  required_topic?: string | null;
  sort_order?: number;
  config_json?: unknown;
  active: boolean;
};

type CertificationRequirementStatus = {
  certificationId: string;
  certificationName: string;
  status: CertificationStatus;
};

const QUALIFICATIONS_BUCKET_MAX = 10;
const DEFICIENCIES_BUCKET_MAX = 10;
const CERTIFICATION_WEIGHT_PERCENT = 40;
const TRAINING_WEIGHT_PERCENT = 40;
const QUALIFICATIONS_WEIGHT_PERCENT = 10;
const DEFICIENCIES_WEIGHT_PERCENT = 10;

function clampRange(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.min(maximum, value));
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

function getAverageCategoryCompletionPercent(factors: ReadinessFactor[], category: ReadinessFactorCategory) {
  const categoryFactors = factors.filter((factor) => factor.category === category);
  if (categoryFactors.length === 0) {
    return 0;
  }

  const totalCompletionPercent = categoryFactors.reduce((total, factor) => total + factor.completionPercent, 0);
  return clampRange(totalCompletionPercent / categoryFactors.length, 0, 100);
}

export function calculateQualificationsBucketScore(completedRequiredQualifications: number, totalRequiredQualifications: number) {
  if (totalRequiredQualifications <= 0) {
    return null;
  }

  const safeCompletedRequiredQualifications = clampRange(
    completedRequiredQualifications,
    0,
    totalRequiredQualifications,
  );

  const qualificationRatio = safeCompletedRequiredQualifications / totalRequiredQualifications;
  return clampRange(qualificationRatio * QUALIFICATIONS_BUCKET_MAX, 0, QUALIFICATIONS_BUCKET_MAX);
}

export function calculateOverallReadinessScorePercent(input: {
  certificationsCategoryPercent: number;
  trainingCategoryPercent: number;
  qualificationsCategoryPercent: number;
  deficienciesCategoryPercent: number;
}) {
  const certificationsContribution =
    clampRange(input.certificationsCategoryPercent, 0, 100) * (CERTIFICATION_WEIGHT_PERCENT / 100);
  const trainingContribution =
    clampRange(input.trainingCategoryPercent, 0, 100) * (TRAINING_WEIGHT_PERCENT / 100);
  const qualificationsContribution =
    clampRange(input.qualificationsCategoryPercent, 0, 100) * (QUALIFICATIONS_WEIGHT_PERCENT / 100);
  const deficienciesContribution =
    clampRange(input.deficienciesCategoryPercent, 0, 100) * (DEFICIENCIES_WEIGHT_PERCENT / 100);

  return clampRange(
    certificationsContribution + trainingContribution + qualificationsContribution + deficienciesContribution,
    0,
    100,
  );
}

function normalizeDeficiencyPriority(priorityName: string | null) {
  const normalized = (priorityName ?? "").trim().toLowerCase();
  if (normalized === "critical") {
    return "critical" as const;
  }

  if (normalized === "high") {
    return "high" as const;
  }

  if (normalized === "medium") {
    return "medium" as const;
  }

  if (normalized === "low") {
    return "low" as const;
  }

  return null;
}

export function getDeficiencyImpactState(priorityName: string | null, ageDays: number): DeficiencyImpactState {
  const priority = normalizeDeficiencyPriority(priorityName);
  const normalizedAgeDays = Math.max(0, Math.floor(ageDays));

  if (!priority) {
    return "no_impact";
  }

  if (priority === "critical") {
    if (normalizedAgeDays <= 2) {
      return "no_impact";
    }

    if (normalizedAgeDays <= 7) {
      return "small_impact";
    }

    if (normalizedAgeDays <= 14) {
      return "moderate_impact";
    }

    return "maximum_impact";
  }

  if (priority === "high") {
    if (normalizedAgeDays <= 6) {
      return "no_impact";
    }

    if (normalizedAgeDays <= 14) {
      return "small_impact";
    }

    if (normalizedAgeDays <= 30) {
      return "moderate_impact";
    }

    return "maximum_impact";
  }

  if (priority === "medium") {
    if (normalizedAgeDays <= 13) {
      return "no_impact";
    }

    if (normalizedAgeDays <= 30) {
      return "small_impact";
    }

    if (normalizedAgeDays <= 60) {
      return "moderate_impact";
    }

    return "maximum_impact";
  }

  if (normalizedAgeDays <= 29) {
    return "no_impact";
  }

  if (normalizedAgeDays <= 60) {
    return "small_impact";
  }

  if (normalizedAgeDays <= 90) {
    return "moderate_impact";
  }

  return "maximum_impact";
}

export function getDeficiencyImpactPenaltyPercent(impactState: DeficiencyImpactState) {
  if (impactState === "small_impact") {
    return 2.5;
  }

  if (impactState === "moderate_impact") {
    return 5;
  }

  if (impactState === "maximum_impact") {
    return 10;
  }

  return 0;
}

function formatImpactStateLabel(impactState: DeficiencyImpactState) {
  if (impactState === "small_impact") {
    return "Small Impact";
  }

  if (impactState === "moderate_impact") {
    return "Moderate Impact";
  }

  if (impactState === "maximum_impact") {
    return "Maximum Impact";
  }

  return "No Impact";
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

export function parseHours(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCertificationStatus(expiresAt: string | null, warningDays: number): CertificationStatus {
  if (!expiresAt) {
    return "current";
  }

  const expiration = parseLocalDate(expiresAt);
  if (Number.isNaN(expiration.getTime())) {
    return "current";
  }

  const today = parseLocalDate(getTodayKey());
  const daysRemaining = Math.floor((expiration.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) {
    return "expired";
  }

  if (daysRemaining <= warningDays) {
    return "expiring_soon";
  }

  return "current";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeRequirementKind(value: string): TrainingRequirementKind | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "annual_hours") {
    return "annual_hours";
  }

  if (normalized === "category_hours") {
    return "category_hours";
  }

  if (normalized === "topic") {
    return "topic";
  }

  if (normalized === "recurring") {
    return "recurring";
  }

  return null;
}

function parseStringConfigValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseRequirementConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      requirementSource: null as string | null,
      certificationId: null as string | null,
      unitLabel: null as string | null,
      appliesTo: null as string | null,
      standardReference: null as string | null,
      periodLabel: null as string | null,
      requiredAmountLabel: null as string | null,
    };
  }

  const record = value as Record<string, unknown>;
  const requirementSource = parseStringConfigValue(record.requirement_source ?? record.requirementSource ?? record.source);
  const certificationId = parseStringConfigValue(record.certification_id ?? record.certificationId);
  const unitLabel = parseStringConfigValue(record.unit_label ?? record.unitLabel ?? record.unit);
  const appliesTo = parseStringConfigValue(record.applies_to ?? record.appliesTo);
  const standardReference = parseStringConfigValue(record.standard_reference ?? record.standardReference ?? record.reference);
  const periodLabel = parseStringConfigValue(record.period_label ?? record.periodLabel);
  const requiredAmountLabel = parseStringConfigValue(record.required_amount_label ?? record.requiredAmountLabel);

  return {
    requirementSource,
    certificationId,
    unitLabel,
    appliesTo,
    standardReference,
    periodLabel,
    requiredAmountLabel,
  };
}

function formatHours(hours: number) {
  return `${hours.toFixed(2)} hrs`;
}

function getPeriodLabel(periodType: string | undefined, configPeriodLabel: string | null) {
  if (periodType === "annual") {
    return "Annual";
  }

  if (periodType === "rolling_30_days") {
    return "Rolling 30 Days";
  }

  if (periodType === "rolling_90_days") {
    return "Rolling 90 Days";
  }

  if (periodType === "rolling_365_days") {
    return "Rolling 365 Days";
  }

  if (configPeriodLabel) {
    return configPeriodLabel;
  }

  return "Custom";
}

export function buildMemberReadinessScore(input: {
  requirementRows: RequirementInput[];
  departmentHours: number;
  categoryHours: Array<{ categoryId: string | null; categoryName: string; hours: number }>;
  categoryNameById: Map<string, string>;
  certificationStatuses?: CertificationRequirementStatus[];
  qualificationReadiness?: QualificationReadinessInput;
  deficiencyItems?: DeficiencyReadinessInput[];
  currentMemberId?: string;
}): ReadinessScoreState {
  const activeRequirements = input.requirementRows.filter((row) => row.active);
  if (activeRequirements.length === 0) {
    return {
      configured: false,
      configurationState: "not_configured",
      configurationMessage: "Readiness requirements are not configured.",
      scorePercent: null,
      remainingPercent: null,
      qualificationsScore: null,
      qualificationsMaxScore: QUALIFICATIONS_BUCKET_MAX,
      qualificationsStatus: "not_configured",
      missingQualifications: [],
      completedRequirements: 0,
      incompleteRequirements: 0,
      deficiencyPenaltyPercent: 0,
      deficiencyCategoryMaxPercent: DEFICIENCIES_BUCKET_MAX,
      deficiencyImpactingCount: 0,
      factors: [],
      coachItems: [],
    };
  }

  const categoryHoursById = new Map<string, number>();
  for (const row of input.categoryHours) {
    if (!row.categoryId) {
      continue;
    }

    categoryHoursById.set(row.categoryId, row.hours);
  }

  const factors: ReadinessFactor[] = [];
  let completedRequirements = 0;
  let incompleteRequirements = 0;

  const certificationStatusById = new Map<string, CertificationStatus>();
  const certificationNameById = new Map<string, string>();
  for (const row of input.certificationStatuses ?? []) {
    certificationStatusById.set(row.certificationId, row.status);
    certificationNameById.set(row.certificationId, row.certificationName);
  }

  for (const row of activeRequirements) {
    const kind = normalizeRequirementKind(row.requirement_kind);
    if (!kind) {
      continue;
    }

    const minimumHours = parseHours(row.minimum_hours);
    const requirementName = row.name.trim() || "Training Requirement";
    const config = parseRequirementConfig(row.config_json);
    const appliesTo = config.appliesTo ?? "All Members";
    const periodLabel = getPeriodLabel(row.period_type, config.periodLabel);

    if (kind === "annual_hours") {
      const completionPercent = minimumHours > 0 ? clampPercent((input.departmentHours / minimumHours) * 100) : 0;
      const completed = minimumHours > 0 && input.departmentHours >= minimumHours;
      if (completed) {
        completedRequirements += 1;
      } else {
        incompleteRequirements += 1;
      }

      factors.push({
        id: row.id,
        title: requirementName,
        category: "training",
        statusLabel: completed ? "Complete" : "Incomplete",
        appliesTo,
        unitLabel: config.unitLabel ?? "hours",
        periodLabel,
        standardReference: config.standardReference,
        requiredValue: formatHours(minimumHours),
        currentValue: formatHours(input.departmentHours),
        completionPercent,
        completed,
        actionNeeded: completed
          ? "No action needed."
          : `Complete ${formatHours(Math.max(0, minimumHours - input.departmentHours))} more training hours.`,
      });

      continue;
    }

    if (kind === "category_hours") {
      const categoryId = row.category_id;
      const categoryName = categoryId
        ? input.categoryNameById.get(categoryId) || "Category"
        : "Category";
      const currentHours = categoryId ? categoryHoursById.get(categoryId) ?? 0 : 0;
      const completionPercent = minimumHours > 0 ? clampPercent((currentHours / minimumHours) * 100) : 0;
      const completed = minimumHours > 0 && currentHours >= minimumHours;
      if (completed) {
        completedRequirements += 1;
      } else {
        incompleteRequirements += 1;
      }

      factors.push({
        id: row.id,
        title: requirementName,
        category: "training",
        statusLabel: completed ? "Complete" : "Incomplete",
        appliesTo,
        unitLabel: config.unitLabel ?? "hours",
        periodLabel,
        standardReference: config.standardReference,
        requiredValue: `${formatHours(minimumHours)} in ${categoryName}`,
        currentValue: `${formatHours(currentHours)} in ${categoryName}`,
        completionPercent,
        completed,
        actionNeeded: completed
          ? "No action needed."
          : `Complete ${formatHours(Math.max(0, minimumHours - currentHours))} more hours in ${categoryName}.`,
      });

      continue;
    }

    if (
      kind === "recurring" &&
      config.requirementSource === "certification" &&
      config.certificationId
    ) {
      const certificationId = config.certificationId;
      const status = certificationStatusById.get(certificationId) ?? "expired";
      const certificationName = certificationNameById.get(certificationId) ?? "Certification";
      const completed = status !== "expired";
      const completionPercent = completed ? 100 : 0;

      if (completed) {
        completedRequirements += 1;
      } else {
        incompleteRequirements += 1;
      }

      factors.push({
        id: row.id,
        title: requirementName,
        category: "certification",
        statusLabel: completed ? "Current" : "Expired or Missing",
        appliesTo,
        unitLabel: config.unitLabel ?? "certification",
        periodLabel,
        standardReference: config.standardReference,
        requiredValue: `Current ${certificationName}`,
        currentValue: completed ? "Current" : "Expired or Missing",
        completionPercent,
        completed,
        actionNeeded: completed
          ? "No action needed."
          : `Renew or add a current ${certificationName} certification.`,
      });

      continue;
    }

    // Topic/recurring requirements are represented but not yet evaluable without additional config fields.
    incompleteRequirements += 1;
    factors.push({
      id: row.id,
      title: requirementName,
      category: kind === "topic" ? "training" : "other",
      statusLabel: "Configuration Needed",
      appliesTo,
      unitLabel: config.unitLabel ?? "custom",
      periodLabel,
      standardReference: config.standardReference,
      requiredValue: "Configured requirement",
      currentValue: "Evaluation pending",
      completionPercent: 0,
      completed: false,
      actionNeeded: "Requirement needs additional configuration before completion can be calculated.",
    });
  }

  let qualificationsScore: number | null = null;
  let qualificationsStatus: ReadinessScoreState["qualificationsStatus"] = "not_configured";
  let missingQualifications: string[] = [];
  let qualificationsConfigurationMessage = "";

  const qualificationReadiness = input.qualificationReadiness;
  if (!qualificationReadiness || !qualificationReadiness.hasAssignedRole) {
    qualificationsStatus = "no_role";
    qualificationsConfigurationMessage = "Assign a current role before qualifications readiness can be scored.";
    incompleteRequirements += 1;
    factors.push({
      id: "qualifications-current-role",
      title: "Qualifications (Current Role)",
      category: "qualification",
      statusLabel: "No Role Assigned",
      appliesTo: qualificationReadiness?.roleName ?? "Assigned Role",
      unitLabel: "qualifications",
      periodLabel: "Current",
      standardReference: null,
      requiredValue: `${QUALIFICATIONS_BUCKET_MAX.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      currentValue: "Role assignment required",
      completionPercent: 0,
      completed: false,
      actionNeeded: "Ask your administrator to assign your current department role so required qualifications can be evaluated.",
    });
  } else if (qualificationReadiness.requiredQualifications.length === 0) {
    qualificationsStatus = "not_configured";
    qualificationsConfigurationMessage = "No required qualifications are configured for your current role.";
    incompleteRequirements += 1;
    factors.push({
      id: "qualifications-current-role",
      title: "Qualifications (Current Role)",
      category: "qualification",
      statusLabel: "Not Configured",
      appliesTo: qualificationReadiness.roleName ?? "Assigned Role",
      unitLabel: "qualifications",
      periodLabel: "Current",
      standardReference: null,
      requiredValue: `${QUALIFICATIONS_BUCKET_MAX.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      currentValue: "No required qualifications configured",
      completionPercent: 0,
      completed: false,
      actionNeeded: "No required qualifications are configured for your current role.",
    });
  } else {
    missingQualifications = qualificationReadiness.missingQualifications;
    qualificationsStatus = missingQualifications.length === 0 ? "complete" : "missing";
    const completedRequiredQualifications = Math.max(
      0,
      qualificationReadiness.requiredQualifications.length - missingQualifications.length,
    );
    qualificationsScore = calculateQualificationsBucketScore(
      completedRequiredQualifications,
      qualificationReadiness.requiredQualifications.length,
    );
    const completed = missingQualifications.length === 0;
    const completionPercent = qualificationsScore === null
      ? 0
      : clampRange((qualificationsScore / QUALIFICATIONS_BUCKET_MAX) * 100, 0, 100);
    const missingList = missingQualifications.join(", ");

    if (completed) {
      completedRequirements += 1;
    } else {
      incompleteRequirements += 1;
    }

    factors.push({
      id: "qualifications-current-role",
      title: "Qualifications (Current Role)",
      category: "qualification",
      statusLabel: completed ? "Complete" : "Missing Required Qualifications",
      appliesTo: qualificationReadiness.roleName ?? "Assigned Role",
      unitLabel: "qualifications",
      periodLabel: "Current",
      standardReference: null,
      requiredValue: `${QUALIFICATIONS_BUCKET_MAX.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      currentValue: qualificationsScore === null
        ? "Not scored"
        : `${qualificationsScore.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      completionPercent,
      completed,
      actionNeeded: completed
        ? "All role-required qualifications are complete."
        : `Complete the missing required qualification${missingQualifications.length > 1 ? "s" : ""}: ${missingList}.`,
    });
  }

  const deficiencyItems = input.deficiencyItems ?? [];
  const activePersonalDeficiencies = deficiencyItems.filter((item) => {
    if (!item.assignedToMemberId) {
      return false;
    }

    if (input.currentMemberId && item.assignedToMemberId !== input.currentMemberId) {
      return false;
    }

    return !isDeficiencyResolved(item.statusName, item.statusActive);
  });

  const now = new Date();
  const evaluatedDeficiencies = activePersonalDeficiencies.map((item) => {
    const personalAssignedAt =
      parseIsoTimestamp(item.personalAssignedAt) ?? now;

    const ageDays = calculateDaysBetween(personalAssignedAt, now);
    const impactState = getDeficiencyImpactState(item.priorityName, ageDays);
    const penaltyPercent = getDeficiencyImpactPenaltyPercent(impactState);

    return {
      ...item,
      ageDays,
      impactState,
      penaltyPercent,
    };
  });

  const impactingDeficiencies = evaluatedDeficiencies.filter((item) => item.penaltyPercent > 0);
  const uncappedDeficiencyPenalty = impactingDeficiencies.reduce((total, item) => total + item.penaltyPercent, 0);
  const deficiencyPenaltyPercent = Math.min(DEFICIENCIES_BUCKET_MAX, uncappedDeficiencyPenalty);
  const deficiencyCompletionPercent = clampPercent(
    ((DEFICIENCIES_BUCKET_MAX - deficiencyPenaltyPercent) / DEFICIENCIES_BUCKET_MAX) * 100,
  );

  if (deficiencyPenaltyPercent === 0) {
    completedRequirements += 1;
  } else {
    incompleteRequirements += 1;
  }

  const highestImpactDeficiency = [...impactingDeficiencies].sort((a, b) => b.penaltyPercent - a.penaltyPercent)[0] ?? null;

  const deficiencyActionNeeded = highestImpactDeficiency
    ? `What is wrong: ${highestImpactDeficiency.deficiencyNumber ?? highestImpactDeficiency.id} (${highestImpactDeficiency.priorityName ?? "Unknown"}) has been assigned to you for ${highestImpactDeficiency.ageDays} day${highestImpactDeficiency.ageDays === 1 ? "" : "s"} and is at ${formatImpactStateLabel(highestImpactDeficiency.impactState)} (${highestImpactDeficiency.penaltyPercent.toFixed(1)}%). Why it matters: active deficiencies assigned to you reduce your personal readiness. Action: complete the repair workflow and resolve this deficiency to remove its readiness penalty.`
    : "No action needed.";

  factors.push({
    id: "deficiencies-current-responsibility",
    title: "Deficiencies (Current Responsibility)",
    category: "other",
    statusLabel: deficiencyPenaltyPercent > 0 ? "Impacting Readiness" : "No Impact",
    appliesTo: "Current Responsible Party",
    unitLabel: "% penalty",
    periodLabel: "Active",
    standardReference: "Redline Ready Deficiencies Locked Model",
    requiredValue: "0.0% penalty",
    currentValue: `${deficiencyPenaltyPercent.toFixed(1)}% penalty from ${impactingDeficiencies.length} active impacting deficiency${impactingDeficiencies.length === 1 ? "" : "ies"}`,
    completionPercent: deficiencyCompletionPercent,
    completed: deficiencyPenaltyPercent === 0,
    actionNeeded: deficiencyActionNeeded,
  });

  const coachItems: ReadinessCoachItem[] = factors
    .filter((factor) => !factor.completed)
    .map((factor) => {
      let remainingValue = "Action required";
      if (factor.currentValue.includes("hrs") && factor.requiredValue.includes("hrs")) {
        remainingValue = factor.actionNeeded.replace("Complete ", "").replace(" more ", " ");
      }

      return {
        factorId: factor.id,
        title: factor.title,
        explanation: factor.actionNeeded,
        currentStatus: factor.statusLabel,
        currentValue: factor.currentValue,
        targetValue: factor.requiredValue,
        remainingValue,
        href: "/my-readiness",
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const certificationsCategoryPercent = getAverageCategoryCompletionPercent(factors, "certification");
  const trainingCategoryPercent = getAverageCategoryCompletionPercent(factors, "training");
  const qualificationsCategoryPercent = qualificationsScore === null
    ? null
    : clampRange((qualificationsScore / QUALIFICATIONS_BUCKET_MAX) * 100, 0, 100);

  const scorePercent = qualificationsCategoryPercent === null
    ? null
    : roundToTenths(calculateOverallReadinessScorePercent({
      certificationsCategoryPercent,
      trainingCategoryPercent,
      qualificationsCategoryPercent,
      deficienciesCategoryPercent: deficiencyCompletionPercent,
    }));

  const remainingPercent = scorePercent === null
    ? null
    : roundToTenths(clampRange(100 - scorePercent, 0, 100));

  const configurationMessage = qualificationsCategoryPercent === null
    ? qualificationsConfigurationMessage
    : "Department-defined readiness requirements are configured.";

  return {
    configured: true,
    configurationState: "configured",
    configurationMessage,
    scorePercent,
    remainingPercent,
    qualificationsScore,
    qualificationsMaxScore: QUALIFICATIONS_BUCKET_MAX,
    qualificationsStatus,
    missingQualifications,
    completedRequirements,
    incompleteRequirements,
    deficiencyPenaltyPercent,
    deficiencyCategoryMaxPercent: DEFICIENCIES_BUCKET_MAX,
    deficiencyImpactingCount: impactingDeficiencies.length,
    factors,
    coachItems,
  };
}