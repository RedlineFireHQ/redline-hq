export type CertificationStatus = "current" | "expiring_soon" | "expired";

export type TrainingRequirementKind = "annual_hours" | "category_hours" | "topic" | "recurring";

export type ReadinessFactorCategory = "training" | "certification" | "qualification" | "other";

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
  factors: ReadinessFactor[];
  coachItems: ReadinessCoachItem[];
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

  const qualificationReadiness = input.qualificationReadiness;
  if (!qualificationReadiness || !qualificationReadiness.hasAssignedRole) {
    qualificationsStatus = "no_role";
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
    const completed = missingQualifications.length === 0;
    qualificationsScore = completed ? QUALIFICATIONS_BUCKET_MAX : null;
    const completionPercent = completed ? 100 : 0;
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
        ? "Pending Redline deduction formula"
        : `${qualificationsScore.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      completionPercent,
      completed,
      actionNeeded: completed
        ? "All role-required qualifications are complete."
        : `Complete the missing required qualification${missingQualifications.length > 1 ? "s" : ""}: ${missingList}.`,
    });
  }

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

  return {
    configured: true,
    configurationState: "configured",
    configurationMessage: "Department-defined readiness requirements are configured.",
    scorePercent: null,
    remainingPercent: null,
    qualificationsScore,
    qualificationsMaxScore: QUALIFICATIONS_BUCKET_MAX,
    qualificationsStatus,
    missingQualifications,
    completedRequirements,
    incompleteRequirements,
    factors,
    coachItems,
  };
}