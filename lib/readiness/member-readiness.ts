export type CertificationStatus = "current" | "expiring_soon" | "expired";

export type TrainingRequirementKind = "annual_hours" | "category_hours" | "topic" | "recurring";

export type ReadinessFactorCategory = "training" | "certification" | "qualification" | "other";

export type DeficiencyImpactState = "no_impact" | "small_impact" | "moderate_impact" | "maximum_impact";

export type ReadinessFactor = {
  id: string;
  title: string;
  category: ReadinessFactorCategory;
  weightPercent?: number;
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
  qualificationsStatus: "no_role" | "not_configured" | "no_requirements" | "complete" | "missing";
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

export type TrainingAssignmentInput = {
  id: string;
  title: string;
  category_id: string | null;
  due_at: string | null;
  hours_credit: number | string | null;
  is_required: boolean;
  review_required: boolean;
  status: string;
};

export type TrainingAssignmentMemberInput = {
  id: string;
  training_assignment_id: string;
  completion_status: string;
  due_at: string | null;
  completed_at: string | null;
  hours_earned: number | string | null;
};

type DateInput = string | Date;

type CertificationRequirementStatus = {
  certificationId: string;
  certificationName: string;
  status: CertificationStatus;
};

function getCertificationCompletionPercent(status: CertificationStatus) {
  if (status === "expired") {
    return 0;
  }

  if (status === "expiring_soon") {
    return 50;
  }

  return 100;
}

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

  let weightedCompletionPercent = 0;
  let totalWeight = 0;

  for (const factor of categoryFactors) {
    const factorWeight = factor.weightPercent ?? 1;
    if (factorWeight <= 0) {
      continue;
    }

    weightedCompletionPercent += factor.completionPercent * factorWeight;
    totalWeight += factorWeight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  return clampRange(weightedCompletionPercent / totalWeight, 0, 100);
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

function toStartOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDateInput(value: DateInput | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toStartOfLocalDay(value);
  }

  if (typeof value === "string") {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseLocalDate(value)
      : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : toStartOfLocalDay(parsed);
  }

  return null;
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

function getDaysBetween(start: Date, end: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay));
}

function getAnnualTrainingCompletionPercentFromDeficit(input: {
  expectedHoursToDate: number;
  completedHours: number;
  annualRequiredHours: number;
  proratedAnnualRequirementHours: number;
}) {
  const expectedHoursToDate = Math.max(0, input.expectedHoursToDate);
  const completedHours = Math.max(0, input.completedHours);
  const annualRequiredHours = Math.max(0, input.annualRequiredHours);
  const proratedAnnualRequirementHours = Math.max(0, input.proratedAnnualRequirementHours);

  if (expectedHoursToDate <= 0 || annualRequiredHours <= 0 || proratedAnnualRequirementHours <= 0) {
    return {
      completionPercent: 100,
      trainingPointsEarned: TRAINING_WEIGHT_PERCENT,
      expectedDeficitHours: 0,
      pointsPerApplicableHour: 0,
    };
  }

  const expectedDeficitHours = Math.max(0, expectedHoursToDate - completedHours);
  const pointsPerApplicableHour = TRAINING_WEIGHT_PERCENT / annualRequiredHours;
  const deductedPoints = expectedDeficitHours * pointsPerApplicableHour;
  const trainingPointsEarned = clampRange(TRAINING_WEIGHT_PERCENT - deductedPoints, 0, TRAINING_WEIGHT_PERCENT);
  const completionPercent = clampPercent((trainingPointsEarned / TRAINING_WEIGHT_PERCENT) * 100);

  return {
    completionPercent,
    trainingPointsEarned,
    expectedDeficitHours,
    pointsPerApplicableHour,
  };
}

function getAnnualHoursProgress(input: {
  annualRequiredHours: number;
  completedHours: number;
  evaluationDate?: DateInput;
  memberStartDate?: DateInput | null;
}) {
  const annualRequiredHours = Math.max(0, input.annualRequiredHours);
  const completedHours = Math.max(0, input.completedHours);

  if (annualRequiredHours <= 0) {
    return {
      completionPercent: 100,
      completed: true,
      expectedHoursToDate: 0,
      proratedAnnualRequirementHours: 0,
      monthlyPaceHours: 0,
      shortfallHours: 0,
      trainingPointsEarned: TRAINING_WEIGHT_PERCENT,
      pointsPerApplicableHour: 0,
    };
  }

  const evaluationDate = parseDateInput(input.evaluationDate) ?? toStartOfLocalDay(new Date());
  const yearStart = new Date(evaluationDate.getFullYear(), 0, 1);
  const nextYearStart = new Date(evaluationDate.getFullYear() + 1, 0, 1);
  const yearLengthDays = getDaysBetween(yearStart, nextYearStart);

  const memberStartDate = parseDateInput(input.memberStartDate);
  const effectiveStartDate = memberStartDate && memberStartDate > yearStart ? memberStartDate : yearStart;
  const activeStartDate = effectiveStartDate > nextYearStart ? nextYearStart : effectiveStartDate;

  const activeDaysInYear = getDaysBetween(activeStartDate, nextYearStart);
  if (activeDaysInYear <= 0 || yearLengthDays <= 0) {
    return {
      completionPercent: 100,
      completed: true,
      expectedHoursToDate: 0,
      proratedAnnualRequirementHours: 0,
      monthlyPaceHours: 0,
      shortfallHours: 0,
      trainingPointsEarned: TRAINING_WEIGHT_PERCENT,
      pointsPerApplicableHour: 0,
    };
  }

  const proratedAnnualRequirementHours = annualRequiredHours * (activeDaysInYear / yearLengthDays);
  const averageDaysPerMonth = yearLengthDays / 12;
  const activeMonthsInYear = activeDaysInYear / averageDaysPerMonth;
  const monthlyPaceHours = activeMonthsInYear > 0 ? proratedAnnualRequirementHours / activeMonthsInYear : 0;

  const elapsedActiveDays = clampRange(getDaysBetween(activeStartDate, evaluationDate), 0, activeDaysInYear);
  const expectedHoursToDate = proratedAnnualRequirementHours * (elapsedActiveDays / activeDaysInYear);
  const trainingCompletion = getAnnualTrainingCompletionPercentFromDeficit({
    expectedHoursToDate,
    completedHours,
    annualRequiredHours,
    proratedAnnualRequirementHours,
  });
  const completionPercent = trainingCompletion.completionPercent;
  const completed = expectedHoursToDate <= 0 || completedHours >= expectedHoursToDate;
  const shortfallHours = Math.max(0, expectedHoursToDate - completedHours);

  return {
    completionPercent,
    completed,
    expectedHoursToDate,
    proratedAnnualRequirementHours,
    monthlyPaceHours,
    shortfallHours,
    trainingPointsEarned: trainingCompletion.trainingPointsEarned,
    pointsPerApplicableHour: trainingCompletion.pointsPerApplicableHour,
  };
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

function normalizeTrainingLookupKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function buildMemberReadinessScore(input: {
  requirementRows: RequirementInput[];
  departmentHours: number;
  categoryHours: Array<{ categoryId: string | null; categoryName: string; hours: number }>;
  categoryNameById: Map<string, string>;
  trainingAssignments?: TrainingAssignmentInput[];
  assignmentMembers?: TrainingAssignmentMemberInput[];
  certificationStatuses?: CertificationRequirementStatus[];
  scoredCertificationStatuses?: CertificationRequirementStatus[];
  qualificationReadiness?: QualificationReadinessInput;
  deficiencyItems?: DeficiencyReadinessInput[];
  currentMemberId?: string;
  evaluationDate?: DateInput;
  memberStartDate?: DateInput | null;
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

  const categoryIdsByNormalizedName = new Map<string, Set<string>>();
  for (const [categoryId, categoryName] of input.categoryNameById.entries()) {
    const normalizedName = normalizeTrainingLookupKey(categoryName);
    const existingIds = categoryIdsByNormalizedName.get(normalizedName);
    if (existingIds) {
      existingIds.add(categoryId);
    } else {
      categoryIdsByNormalizedName.set(normalizedName, new Set([categoryId]));
    }
  }

  const resolveTopicCategoryId = (requiredTopic: string | null | undefined) => {
    const normalizedTopic = normalizeTrainingLookupKey(requiredTopic);
    if (!normalizedTopic) {
      return null;
    }

    const matchedCategoryIds = categoryIdsByNormalizedName.get(normalizedTopic);
    if (!matchedCategoryIds || matchedCategoryIds.size !== 1) {
      return null;
    }

    return Array.from(matchedCategoryIds)[0] ?? null;
  };

  const factors: ReadinessFactor[] = [];
  let completedRequirements = 0;
  let incompleteRequirements = 0;
  const explicitCertificationRequirementIds = new Set<string>();

  const annualTrainingRequirements: Array<{
    row: RequirementInput;
    requirementName: string;
    config: ReturnType<typeof parseRequirementConfig>;
    appliesTo: string;
    periodLabel: string;
    minimumHours: number;
  }> = [];
  const categoryTrainingRequirements: Array<{
    row: RequirementInput;
    requirementName: string;
    config: ReturnType<typeof parseRequirementConfig>;
    appliesTo: string;
    periodLabel: string;
    minimumHours: number;
  }> = [];
  const recurringTrainingRequirements: Array<{
    row: RequirementInput;
    requirementName: string;
    config: ReturnType<typeof parseRequirementConfig>;
    appliesTo: string;
    periodLabel: string;
    minimumHours: number;
  }> = [];

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

    if (
      kind === "recurring" &&
      config.requirementSource === "certification" &&
      config.certificationId
    ) {
      const certificationId = config.certificationId;
      explicitCertificationRequirementIds.add(certificationId);
      const status = certificationStatusById.get(certificationId) ?? "expired";
      const certificationName = certificationNameById.get(certificationId) ?? "Certification";
      const completionPercent = getCertificationCompletionPercent(status);
      const completed = completionPercent >= 100;

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

    if (kind === "annual_hours") {
      annualTrainingRequirements.push({ row, requirementName, config, appliesTo, periodLabel, minimumHours });
      continue;
    }

    if (kind === "category_hours") {
      categoryTrainingRequirements.push({ row, requirementName, config, appliesTo, periodLabel, minimumHours });
      continue;
    }

    if (kind === "topic" || kind === "recurring") {
      recurringTrainingRequirements.push({ row, requirementName, config, appliesTo, periodLabel, minimumHours });
      continue;
    }
  }

  if (annualTrainingRequirements.length > 0) {
    const annualRequiredHours = annualTrainingRequirements.reduce(
      (total, requirement) => total + Math.max(0, requirement.minimumHours),
      0,
    );
    const annualProgress = getAnnualHoursProgress({
      annualRequiredHours,
      completedHours: input.departmentHours,
      evaluationDate: input.evaluationDate,
      memberStartDate: input.memberStartDate,
    });
    const annualRequirement = annualTrainingRequirements[0];
    const annualRequirementTitle = annualTrainingRequirements.length === 1
      ? annualRequirement.requirementName
      : "Annual Training Pace";
    const annualRequirementAppliesTo = annualTrainingRequirements[0].appliesTo;
    const annualCategoryNames = Array.from(
      new Set(
        annualTrainingRequirements
          .map((requirement) => requirement.row.category_id)
          .filter((categoryId): categoryId is string => Boolean(categoryId))
          .map((categoryId) => input.categoryNameById.get(categoryId) ?? "Category"),
      ),
    );
    const annualCategoryLabel = annualCategoryNames.length > 0
      ? ` of ${annualCategoryNames.join(", ")}`
      : "";

    const annualCompleted = annualProgress.completed;
    if (annualCompleted) {
      completedRequirements += 1;
    } else {
      incompleteRequirements += 1;
    }

    factors.push({
      id: annualTrainingRequirements.length === 1 ? annualRequirement.row.id : "training-annual-pace",
      title: annualRequirementTitle,
      category: "training",
      weightPercent: 20,
      statusLabel: annualCompleted ? "Complete" : "Incomplete",
      appliesTo: annualRequirementAppliesTo,
      unitLabel: annualRequirement.config.unitLabel ?? "hours",
      periodLabel: annualRequirement.periodLabel,
      standardReference: annualRequirement.config.standardReference,
      requiredValue: formatHours(annualRequiredHours),
      currentValue: formatHours(input.departmentHours),
      completionPercent: annualProgress.completionPercent,
      completed: annualCompleted,
      actionNeeded: annualCompleted
        ? "On pace for annual training requirement."
        : `Complete ${annualRequiredHours.toFixed(2)} hours${annualCategoryLabel} training. You have ${formatHours(input.departmentHours)} of ${formatHours(annualRequiredHours)} required hours recorded. Pace target is ${formatHours(annualProgress.monthlyPaceHours)} per month (${formatHours(annualProgress.expectedHoursToDate)} expected by now). Complete ${formatHours(annualProgress.shortfallHours)} more training hours to get back on pace. This requirement is worth ${annualProgress.pointsPerApplicableHour.toFixed(2)} readiness points per applicable hour.`,
    });
  }

  if (categoryTrainingRequirements.length > 0) {
    const categoryScoredRequirements = categoryTrainingRequirements
      .map((requirement) => {
        const categoryId = requirement.row.category_id ?? resolveTopicCategoryId(requirement.row.required_topic);
        return {
          requirement,
          categoryId,
          requiredHours: Math.max(0, requirement.minimumHours),
        };
      })
      .filter((row) => row.categoryId !== null && row.requiredHours > 0);

    if (categoryScoredRequirements.length > 0) {
      const categoryRequiredHours = categoryScoredRequirements.reduce(
        (total, row) => total + row.requiredHours,
        0,
      );
      const categoryCurrentHours = categoryScoredRequirements.reduce((total, row) => {
        const currentCategoryHours = categoryHoursById.get(row.categoryId ?? "") ?? 0;
        return total + Math.min(currentCategoryHours, row.requiredHours);
      }, 0);
    const categoryNames = Array.from(
      new Set(
          categoryScoredRequirements
          .map((row) => row.categoryId)
          .filter((categoryId): categoryId is string => Boolean(categoryId))
          .map((categoryId) => input.categoryNameById.get(categoryId) ?? "Category"),
      ),
    );
    const categoryLabel = categoryNames.length > 0 ? categoryNames.join(", ") : "Configured categories";
    const categoryCompleted = categoryRequiredHours > 0 && categoryCurrentHours >= categoryRequiredHours;
    if (categoryCompleted) {
      completedRequirements += 1;
    } else {
      incompleteRequirements += 1;
    }

    factors.push({
      id: categoryScoredRequirements.length === 1
        ? categoryScoredRequirements[0].requirement.row.id
        : "training-category-hours",
      title: categoryScoredRequirements.length === 1
        ? categoryScoredRequirements[0].requirement.requirementName
        : "Required Category Hours",
      category: "training",
      weightPercent: 10,
      statusLabel: categoryCompleted ? "Complete" : "Incomplete",
      appliesTo: categoryScoredRequirements[0].requirement.appliesTo,
      unitLabel: categoryScoredRequirements[0].requirement.config.unitLabel ?? "hours",
      periodLabel: categoryScoredRequirements[0].requirement.periodLabel,
      standardReference: categoryScoredRequirements[0].requirement.config.standardReference,
      requiredValue: `${formatHours(categoryRequiredHours)} in ${categoryLabel}`,
      currentValue: `${formatHours(categoryCurrentHours)} in ${categoryLabel}`,
      completionPercent: categoryRequiredHours > 0 ? clampPercent((categoryCurrentHours / categoryRequiredHours) * 100) : 0,
      completed: categoryCompleted,
      actionNeeded: categoryCompleted
        ? "No action needed."
        : `Complete ${formatHours(Math.max(0, categoryRequiredHours - categoryCurrentHours))} more hours in ${categoryLabel}.`,
    });
    }
  }

  if (recurringTrainingRequirements.length > 0) {
    const recurringCurrentHoursByRequirement = recurringTrainingRequirements.map((requirement) => {
      const categoryId = requirement.row.category_id ?? resolveTopicCategoryId(requirement.row.required_topic);
      const currentHours = categoryId ? (categoryHoursById.get(categoryId) ?? 0) : 0;
      return {
        requirement,
        categoryId,
        currentHours,
      };
    });

    const recurringScoredRequirements = recurringCurrentHoursByRequirement.filter((row) => row.categoryId !== null && row.requirement.minimumHours > 0);

    if (recurringScoredRequirements.length > 0) {
      const recurringRequiredHours = recurringScoredRequirements.reduce(
        (total, row) => total + Math.max(0, row.requirement.minimumHours),
        0,
      );
      const recurringCurrentHours = recurringScoredRequirements.reduce(
        (total, row) => total + Math.min(row.currentHours, Math.max(0, row.requirement.minimumHours)),
        0,
      );
      const recurringCompleted = recurringRequiredHours > 0 && recurringCurrentHours >= recurringRequiredHours;
      if (recurringCompleted) {
        completedRequirements += 1;
      } else {
        incompleteRequirements += 1;
      }

      factors.push({
        id: recurringScoredRequirements.length === 1
          ? recurringScoredRequirements[0].requirement.row.id
          : "training-required-recurring",
        title: recurringScoredRequirements.length === 1
          ? recurringScoredRequirements[0].requirement.requirementName
          : "Required / Recurring Training",
        category: "training",
        weightPercent: 6,
        statusLabel: recurringCompleted ? "Complete" : "Incomplete",
        appliesTo: recurringScoredRequirements[0].requirement.appliesTo,
        unitLabel: recurringScoredRequirements[0].requirement.config.unitLabel ?? "hours",
        periodLabel: recurringScoredRequirements[0].requirement.periodLabel,
        standardReference: recurringScoredRequirements[0].requirement.config.standardReference,
        requiredValue: `${formatHours(recurringRequiredHours)} of recurring/required training`,
        currentValue: `${formatHours(recurringCurrentHours)} completed`,
        completionPercent: clampPercent((recurringCurrentHours / recurringRequiredHours) * 100),
        completed: recurringCompleted,
        actionNeeded: recurringCompleted
          ? "No action needed."
          : `Complete ${formatHours(Math.max(0, recurringRequiredHours - recurringCurrentHours))} more recurring/required training hours.`,
      });
    }
  }

  const assignmentById = new Map((input.trainingAssignments ?? []).map((row) => [row.id, row]));
  const requiredAssignmentRows: Array<{ memberRow: TrainingAssignmentMemberInput; assignment: TrainingAssignmentInput }> = [];
  const seenAssignmentIds = new Set<string>();
  for (const memberRow of input.assignmentMembers ?? []) {
    const assignment = assignmentById.get(memberRow.training_assignment_id);
    if (!assignment || assignment.status === "archived" || assignment.is_required !== true) {
      continue;
    }

    if (seenAssignmentIds.has(assignment.id)) {
      continue;
    }

    seenAssignmentIds.add(assignment.id);
    requiredAssignmentRows.push({ memberRow, assignment });
  }

  if (requiredAssignmentRows.length > 0) {
    const requiredAssignmentHours = requiredAssignmentRows.reduce(
      (total, row) => total + parseHours(row.assignment.hours_credit),
      0,
    );
    const completedAssignmentHours = requiredAssignmentRows.reduce((total, row) => {
      const normalizedStatus = row.memberRow.completion_status.trim().toLowerCase();
      if (normalizedStatus !== "approved") {
        return total;
      }

      const rowHours = parseHours(row.memberRow.hours_earned);
      const assignmentHours = parseHours(row.assignment.hours_credit);
      return total + (rowHours > 0 ? rowHours : assignmentHours);
    }, 0);
    const assignmentCompleted = requiredAssignmentHours > 0 && completedAssignmentHours >= requiredAssignmentHours;
    if (assignmentCompleted) {
      completedRequirements += 1;
    } else {
      incompleteRequirements += 1;
    }

    factors.push({
      id: requiredAssignmentRows.length === 1
        ? requiredAssignmentRows[0].assignment.id
        : "training-assigned-required",
      title: requiredAssignmentRows.length === 1
        ? requiredAssignmentRows[0].assignment.title
        : "Assigned Required Training",
      category: "training",
      weightPercent: 4,
      statusLabel: assignmentCompleted ? "Complete" : "Incomplete",
      appliesTo: "Assigned Member",
      unitLabel: "hours",
      periodLabel: "Current",
      standardReference: null,
      requiredValue: formatHours(requiredAssignmentHours),
      currentValue: formatHours(completedAssignmentHours),
      completionPercent: requiredAssignmentHours > 0 ? clampPercent((completedAssignmentHours / requiredAssignmentHours) * 100) : 0,
      completed: assignmentCompleted,
      actionNeeded: assignmentCompleted
        ? "No action needed."
        : `Complete ${formatHours(Math.max(0, requiredAssignmentHours - completedAssignmentHours))} more assigned training hours.`,
    });
  }

  const synthesizedCertificationStatuses = (input.scoredCertificationStatuses ?? []).filter(
    (row) => !explicitCertificationRequirementIds.has(row.certificationId),
  );

  for (const row of synthesizedCertificationStatuses) {
    const completionPercent = getCertificationCompletionPercent(row.status);
    const completed = completionPercent >= 100;

    if (completed) {
      completedRequirements += 1;
    } else {
      incompleteRequirements += 1;
    }

    factors.push({
      id: `certification:${row.certificationId}`,
      title: row.certificationName,
      category: "certification",
      statusLabel:
        row.status === "expired"
          ? "Expired or Missing"
          : row.status === "expiring_soon"
            ? "Expiring Soon"
            : "Current",
      appliesTo: "Current Member",
      unitLabel: "certification",
      periodLabel: "Current",
      standardReference: null,
      requiredValue: `Current ${row.certificationName}`,
      currentValue:
        row.status === "expired"
          ? "Expired or Missing"
          : row.status === "expiring_soon"
            ? "Expiring Soon"
            : "Current",
      completionPercent,
      completed,
      actionNeeded:
        row.status === "current"
          ? "No action needed."
          : row.status === "expiring_soon"
            ? `Renew ${row.certificationName} before it expires.`
            : `Renew or add a current ${row.certificationName} certification.`,
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
    qualificationsStatus = "no_requirements";
    qualificationsScore = QUALIFICATIONS_BUCKET_MAX;
    qualificationsConfigurationMessage = "No required qualifications apply to your current role.";
    completedRequirements += 1;
    factors.push({
      id: "qualifications-current-role",
      title: "Qualifications (Current Role)",
      category: "qualification",
      statusLabel: "No Required Qualifications",
      appliesTo: qualificationReadiness.roleName ?? "Assigned Role",
      unitLabel: "qualifications",
      periodLabel: "Current",
      standardReference: null,
      requiredValue: `${QUALIFICATIONS_BUCKET_MAX.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      currentValue: `${QUALIFICATIONS_BUCKET_MAX.toFixed(1)} / ${QUALIFICATIONS_BUCKET_MAX}`,
      completionPercent: 100,
      completed: true,
      actionNeeded: "No action needed.",
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
    currentValue: `${deficiencyPenaltyPercent.toFixed(1)}% penalty from ${impactingDeficiencies.length} active impacting deficienc${impactingDeficiencies.length === 1 ? "y" : "ies"}`,
    completionPercent: deficiencyCompletionPercent,
    completed: deficiencyPenaltyPercent === 0,
    actionNeeded: deficiencyActionNeeded,
  });

  const coachItems: ReadinessCoachItem[] = factors
    .filter((factor) => !factor.completed)
    .map((factor) => {
      let remainingValue = "Action required";
      if (factor.category === "training") {
        const remainingHoursMatch = factor.actionNeeded.match(
          /Complete\s+([0-9]+(?:\.[0-9]+)?)\s*(?:hrs?|hours?)?\s+more\s+/i,
        );
        if (remainingHoursMatch) {
          remainingValue = `${remainingHoursMatch[1]} hrs`;
        }
      }

      return {
        factorId: factor.id,
        title: factor.title,
        explanation: factor.actionNeeded,
        currentStatus: factor.statusLabel,
        currentValue: factor.currentValue,
        targetValue: factor.requiredValue,
        remainingValue,
        href: factor.category === "training" ? "/training" : "/my-readiness",
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const certificationsCategoryPercent = getAverageCategoryCompletionPercent(factors, "certification");
  const trainingCategoryFactors = factors.filter((factor) => factor.category === "training");
  const trainingCategoryPercent = trainingCategoryFactors.length === 0
    ? 100
    : getAverageCategoryCompletionPercent(factors, "training");
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