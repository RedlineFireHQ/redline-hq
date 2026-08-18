export type ApparatusCheckScoreProfile = "daily" | "monthly";

export type MaintenanceMethodType = "time_days" | "mileage" | "engine_hours";

export type MaintenanceReadinessState =
  | "current"
  | "due_soon"
  | "due"
  | "early_overdue"
  | "moderately_overdue"
  | "severely_overdue"
  | "unknown";

export type ApparatusReadinessStatus = "ready" | "needs_attention" | "out_of_service" | "not_scored";

export type ApparatusConditionDeficiency = {
  id: string;
  priorityName: string;
  isActive: boolean;
  countInCondition: boolean;
};

export type ApparatusCheckInput = {
  lastCompletedAt: string | null;
  intervalDays: number | null;
  scoreProfile: ApparatusCheckScoreProfile | null;
};

export type ApparatusMaintenanceMethodEvaluation = {
  methodType: MaintenanceMethodType;
  intervalValue: number;
  dueSoonThresholdValue: number;
  earlyOverdueThresholdValue: number;
  moderateOverdueThresholdValue: number;
  // Delta is elapsed days/miles/hours since latest applicable service.
  elapsedSinceService: number | null;
};

export type ApparatusMaintenanceRequirementEvaluation = {
  requirementId: string;
  name: string;
  methods: ApparatusMaintenanceMethodEvaluation[];
};

export type ApparatusEquipmentRequirementEvaluation = {
  requirementId: string;
  equipmentSource: string;
  equipmentId: string;
  isRequired: boolean;
  isCritical: boolean;
  isOperational: boolean;
};

export type ApparatusReadinessInput = {
  now: Date;
  explicitOutOfService: boolean;
  apparatusCheck: ApparatusCheckInput;
  conditionDeficiencies: ApparatusConditionDeficiency[];
  maintenanceRequirements: ApparatusMaintenanceRequirementEvaluation[];
  equipmentRequirements: ApparatusEquipmentRequirementEvaluation[];
};

export type ApparatusReadinessResult = {
  status: ApparatusReadinessStatus;
  isOutOfService: boolean;
  isScoreAvailable: boolean;
  scorePercent: number | null;
  remainingPercent: number | null;
  bucketScores: {
    apparatusChecks: number | null;
    conditionSafety: number | null;
    maintenanceService: number | null;
    requiredEquipment: number | null;
  };
  maintenanceState: MaintenanceReadinessState | null;
  blockingGaps: string[];
  metadata: {
    activeConditionCounts: {
      minor: number;
      significant: number;
      critical: number;
    };
    nonCriticalRequiredEquipment: {
      operationalCount: number;
      totalCount: number;
    };
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDaysOverdue(now: Date, dueAt: Date): number {
  const millisPerDay = 24 * 60 * 60 * 1000;
  const dueStart = new Date(dueAt);
  dueStart.setHours(0, 0, 0, 0);

  const nowStart = new Date(now);
  nowStart.setHours(0, 0, 0, 0);

  return Math.floor((nowStart.getTime() - dueStart.getTime()) / millisPerDay);
}

export function calculateApparatusChecksBucketScore(input: ApparatusCheckInput, now: Date) {
  if (!input.intervalDays || !input.scoreProfile) {
    return {
      score: null as number | null,
      blockingGap: "Missing apparatus check requirement configuration.",
    };
  }

  if (!input.lastCompletedAt) {
    return {
      score: 0,
      blockingGap: null as string | null,
    };
  }

  const completedAt = new Date(input.lastCompletedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return {
      score: null as number | null,
      blockingGap: "Invalid apparatus check completion timestamp.",
    };
  }

  const dueAt = new Date(completedAt);
  dueAt.setDate(dueAt.getDate() + input.intervalDays);

  const daysOverdue = getDaysOverdue(now, dueAt);

  if (daysOverdue < 0) {
    return { score: 20, blockingGap: null as string | null };
  }

  if (daysOverdue === 0) {
    return {
      score: input.scoreProfile === "daily" ? 15 : 10,
      blockingGap: null as string | null,
    };
  }

  if (daysOverdue === 1) {
    return {
      score: input.scoreProfile === "daily" ? 10 : 5,
      blockingGap: null as string | null,
    };
  }

  if (daysOverdue === 2) {
    return {
      score: input.scoreProfile === "daily" ? 5 : 0,
      blockingGap: null as string | null,
    };
  }

  return {
    score: 0,
    blockingGap: null as string | null,
  };
}

function normalizePriorityPenalty(priorityName: string) {
  const normalized = priorityName.trim().toLowerCase();

  // Locked mapping for apparatus-level condition scoring only:
  // Low -> Minor (-1), Medium/High -> Significant (-5), Critical -> Critical/OOS (-40).
  if (normalized === "critical") {
    return { deduction: 40, className: "critical" as const, isCritical: true };
  }

  if (normalized === "high" || normalized === "medium") {
    return { deduction: 5, className: "significant" as const, isCritical: false };
  }

  if (normalized === "low") {
    return { deduction: 1, className: "minor" as const, isCritical: false };
  }

  return { deduction: 0, className: "minor" as const, isCritical: false };
}

export function calculateConditionSafetyBucketScore(deficiencies: ApparatusConditionDeficiency[]) {
  let score = 40;
  let criticalCount = 0;
  let significantCount = 0;
  let minorCount = 0;

  for (const deficiency of deficiencies) {
    if (!deficiency.isActive) {
      continue;
    }

    const mapped = normalizePriorityPenalty(deficiency.priorityName);

    // Critical always wins: never suppress active critical deficiencies.
    if (!deficiency.countInCondition && !mapped.isCritical) {
      continue;
    }

    if (mapped.className === "critical") {
      criticalCount += 1;
    } else if (mapped.className === "significant") {
      significantCount += 1;
    } else {
      minorCount += 1;
    }

    score -= mapped.deduction;
  }

  return {
    score: clamp(score, 0, 40),
    hasCriticalGate: criticalCount > 0,
    counts: {
      minor: minorCount,
      significant: significantCount,
      critical: criticalCount,
    },
  };
}

function scoreForMaintenanceState(state: MaintenanceReadinessState): number {
  switch (state) {
    case "current":
      return 20;
    case "due_soon":
      return 19;
    case "due":
      return 17;
    case "early_overdue":
      return 15;
    case "moderately_overdue":
      return 10;
    case "severely_overdue":
      return 0;
    default:
      return 0;
  }
}

function maintenanceStateRank(state: MaintenanceReadinessState) {
  switch (state) {
    case "current":
      return 0;
    case "due_soon":
      return 1;
    case "due":
      return 2;
    case "early_overdue":
      return 3;
    case "moderately_overdue":
      return 4;
    case "severely_overdue":
      return 5;
    default:
      return 6;
  }
}

function evaluateMaintenanceMethod(method: ApparatusMaintenanceMethodEvaluation): MaintenanceReadinessState {
  if (method.elapsedSinceService === null) {
    return "unknown";
  }

  const elapsed = method.elapsedSinceService;
  const interval = method.intervalValue;

  if (elapsed < interval - method.dueSoonThresholdValue) {
    return "current";
  }

  if (elapsed < interval) {
    return "due_soon";
  }

  if (elapsed === interval) {
    return "due";
  }

  const overdueAmount = elapsed - interval;

  if (overdueAmount <= method.earlyOverdueThresholdValue) {
    return "early_overdue";
  }

  if (overdueAmount <= method.moderateOverdueThresholdValue) {
    return "moderately_overdue";
  }

  return "severely_overdue";
}

export function calculateMaintenanceServiceBucketScore(requirements: ApparatusMaintenanceRequirementEvaluation[]) {
  if (requirements.length === 0) {
    return {
      score: null as number | null,
      state: null as MaintenanceReadinessState | null,
      blockingGap: "Missing apparatus maintenance requirement configuration.",
    };
  }

  let worstState: MaintenanceReadinessState = "current";

  for (const requirement of requirements) {
    if (requirement.methods.length === 0) {
      return {
        score: null as number | null,
        state: null as MaintenanceReadinessState | null,
        blockingGap: `Maintenance requirement '${requirement.name}' has no methods.`,
      };
    }

    let requirementWorstState: MaintenanceReadinessState = "current";

    for (const method of requirement.methods) {
      const methodState = evaluateMaintenanceMethod(method);
      if (methodState === "unknown") {
        return {
          score: null as number | null,
          state: null as MaintenanceReadinessState | null,
          blockingGap: `Maintenance requirement '${requirement.name}' is missing data for method '${method.methodType}'.`,
        };
      }

      if (maintenanceStateRank(methodState) > maintenanceStateRank(requirementWorstState)) {
        requirementWorstState = methodState;
      }
    }

    if (maintenanceStateRank(requirementWorstState) > maintenanceStateRank(worstState)) {
      worstState = requirementWorstState;
    }
  }

  return {
    score: scoreForMaintenanceState(worstState),
    state: worstState,
    blockingGap: null as string | null,
  };
}

export function calculateRequiredEquipmentBucketScore(requirements: ApparatusEquipmentRequirementEvaluation[]) {
  const required = requirements.filter((requirement) => requirement.isRequired);

  if (required.length === 0) {
    return {
      score: null as number | null,
      hasCriticalEquipmentGate: false,
      blockingGap: "Missing required equipment configuration.",
      nonCriticalOperationalCount: 0,
      nonCriticalRequiredCount: 0,
    };
  }

  let hasCriticalEquipmentGate = false;
  let nonCriticalRequiredCount = 0;
  let nonCriticalOperationalCount = 0;

  for (const requirement of required) {
    if (requirement.isCritical && !requirement.isOperational) {
      hasCriticalEquipmentGate = true;
    }

    if (!requirement.isCritical) {
      nonCriticalRequiredCount += 1;
      if (requirement.isOperational) {
        nonCriticalOperationalCount += 1;
      }
    }
  }

  const nonCriticalScore =
    nonCriticalRequiredCount === 0
      ? 20
      : (nonCriticalOperationalCount / nonCriticalRequiredCount) * 20;

  return {
    score: clamp(nonCriticalScore, 0, 20),
    hasCriticalEquipmentGate,
    blockingGap: null as string | null,
    nonCriticalOperationalCount,
    nonCriticalRequiredCount,
  };
}

export function calculateOverallApparatusReadiness(input: ApparatusReadinessInput): ApparatusReadinessResult {
  const blockingGaps: string[] = [];

  const checksResult = calculateApparatusChecksBucketScore(input.apparatusCheck, input.now);
  if (checksResult.blockingGap) {
    blockingGaps.push(checksResult.blockingGap);
  }

  const conditionResult = calculateConditionSafetyBucketScore(input.conditionDeficiencies);

  const maintenanceResult = calculateMaintenanceServiceBucketScore(input.maintenanceRequirements);
  if (maintenanceResult.blockingGap) {
    blockingGaps.push(maintenanceResult.blockingGap);
  }

  const equipmentResult = calculateRequiredEquipmentBucketScore(input.equipmentRequirements);
  if (equipmentResult.blockingGap) {
    blockingGaps.push(equipmentResult.blockingGap);
  }

  const isOutOfService =
    input.explicitOutOfService ||
    conditionResult.hasCriticalGate ||
    equipmentResult.hasCriticalEquipmentGate;

  const isScoreAvailable =
    checksResult.score !== null &&
    maintenanceResult.score !== null &&
    equipmentResult.score !== null;

  const totalScore = isScoreAvailable
    ? clamp(
        checksResult.score! +
          conditionResult.score +
          maintenanceResult.score! +
          equipmentResult.score!,
        0,
        100
      )
    : null;

  const roundedScore = totalScore === null ? null : Math.round(totalScore * 100) / 100;
  const remainingPercent = roundedScore === null ? null : Math.max(0, 100 - roundedScore);

  const status: ApparatusReadinessStatus = isOutOfService
    ? "out_of_service"
    : !isScoreAvailable
      ? "not_scored"
      : roundedScore === 100
        ? "ready"
        : "needs_attention";

  return {
    status,
    isOutOfService,
    isScoreAvailable,
    scorePercent: roundedScore,
    remainingPercent,
    bucketScores: {
      apparatusChecks: checksResult.score,
      conditionSafety: conditionResult.score,
      maintenanceService: maintenanceResult.score,
      requiredEquipment: equipmentResult.score,
    },
    maintenanceState: maintenanceResult.state,
    blockingGaps,
    metadata: {
      activeConditionCounts: conditionResult.counts,
      nonCriticalRequiredEquipment: {
        operationalCount: equipmentResult.nonCriticalOperationalCount,
        totalCount: equipmentResult.nonCriticalRequiredCount,
      },
    },
  };
}
