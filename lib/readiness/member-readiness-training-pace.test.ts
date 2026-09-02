import assert from "node:assert/strict";
import test from "node:test";

import { buildMemberReadinessScore, type RequirementInput } from "@/lib/readiness/member-readiness";

function annualRequirement(minimumHours: number): RequirementInput {
  return {
    id: "annual-fire",
    name: "Annual Fire Training Hours",
    requirement_kind: "annual_hours",
    period_type: "annual",
    minimum_hours: minimumHours,
    category_id: null,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 1,
    config_json: null,
    active: true,
  };
}

function categoryRequirement(id: string, categoryId: string, minimumHours: number): RequirementInput {
  return {
    id,
    name: `Category ${categoryId}`,
    requirement_kind: "category_hours",
    period_type: "annual",
    minimum_hours: minimumHours,
    category_id: categoryId,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 2,
    config_json: null,
    active: true,
  };
}

function recurringCertificationRequirement(certificationId: string): RequirementInput {
  return {
    id: `recurring-${certificationId}`,
    name: `Recurring ${certificationId}`,
    requirement_kind: "recurring",
    period_type: "annual",
    minimum_hours: null,
    category_id: null,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 3,
    config_json: {
      requirementSource: "certification",
      certificationId,
    },
    active: true,
  };
}

function recurringTrainingRequirement(id: string, categoryId: string, minimumHours: number): RequirementInput {
  return {
    id,
    name: `Recurring ${id}`,
    requirement_kind: "recurring",
    period_type: "annual",
    minimum_hours: minimumHours,
    category_id: categoryId,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 4,
    config_json: null,
    active: true,
  };
}

function recurringTrainingRequirementByTopic(id: string, requiredTopic: string, minimumHours: number): RequirementInput {
  return {
    id,
    name: `Recurring ${id}`,
    requirement_kind: "recurring",
    period_type: "annual",
    minimum_hours: minimumHours,
    category_id: null,
    due_frequency_rule: null,
    required_topic: requiredTopic,
    sort_order: 4,
    config_json: null,
    active: true,
  };
}

function buildPaceScore(input: {
  asOfDate: string;
  departmentHours: number;
  annualHoursRequired?: number;
  memberStartDate?: string | null;
  requirementRows?: RequirementInput[];
  categoryHours?: Array<{ categoryId: string | null; categoryName: string; hours: number }>;
  categoryNameById?: Map<string, string>;
  trainingAssignments?: Array<{
    id: string;
    title: string;
    category_id: string | null;
    due_at: string | null;
    hours_credit: number;
    is_required: boolean;
    review_required: boolean;
    status: string;
  }>;
  assignmentMembers?: Array<{
    id: string;
    training_assignment_id: string;
    completion_status: string;
    due_at: string | null;
    completed_at: string | null;
    hours_earned: number | string | null;
  }>;
  certificationStatuses?: Array<{ certificationId: string; certificationName: string; status: "current" | "expiring_soon" | "expired" }>;
}) {
  return buildMemberReadinessScore({
    requirementRows: input.requirementRows ?? [annualRequirement(input.annualHoursRequired ?? 24)],
    departmentHours: input.departmentHours,
    categoryHours: input.categoryHours ?? [],
    categoryNameById: input.categoryNameById ?? new Map(),
    trainingAssignments: input.trainingAssignments ?? [],
    assignmentMembers: input.assignmentMembers ?? [],
    certificationStatuses: input.certificationStatuses,
    qualificationReadiness: {
      hasAssignedRole: true,
      roleName: "Firefighter",
      requiredQualifications: [],
      completedQualifications: [],
      missingQualifications: [],
    },
    deficiencyItems: [],
    currentMemberId: "member-1",
    evaluationDate: input.asOfDate,
    memberStartDate: input.memberStartDate ?? null,
  });
}

function getFactor(score: ReturnType<typeof buildMemberReadinessScore>, factorId: string) {
  return score.factors.find((factor) => factor.id === factorId) ?? null;
}

function getTrainingPointsFromScore(score: ReturnType<typeof buildMemberReadinessScore>, factorId = "annual-fire") {
  const factor = getFactor(score, factorId);
  if (!factor) {
    return 0;
  }

  return (factor.completionPercent / 100) * 40;
}

function getWeightedTrainingPercent(score: ReturnType<typeof buildMemberReadinessScore>) {
  const trainingFactors = score.factors.filter((factor) => factor.category === "training");
  const totalWeight = trainingFactors.reduce((total, factor) => total + (factor.weightPercent ?? 1), 0);
  if (totalWeight <= 0) {
    return 100;
  }

  return trainingFactors.reduce(
    (total, factor) => total + factor.completionPercent * (factor.weightPercent ?? 1),
    0,
  ) / totalWeight;
}

function getCoachMetric(actionNeeded: string, pattern: RegExp) {
  const match = actionNeeded.match(pattern);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(value) ? value : null;
}

test("TP1. 24 hours/year at beginning of year is not treated as 0/24", () => {
  const score = buildPaceScore({ asOfDate: "2026-01-01", departmentHours: 0 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(annual?.completed, true);
  assert.equal(getTrainingPointsFromScore(score), 40);
});

test("TP2. 24 hours/year with 1 hour completed is proportional and not catastrophic", () => {
  const score = buildPaceScore({ asOfDate: "2026-02-01", departmentHours: 1 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.ok((annual?.completionPercent ?? 0) >= 90);
  assert.ok(getTrainingPointsFromScore(score) >= 36);
});

test("TP3. 24 hours/year with a 2-hour deficit behind pace is a moderate reduction", () => {
  const score = buildPaceScore({ asOfDate: "2026-03-31", departmentHours: 3.85 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.equal(annual?.completionPercent, 92);
  assert.ok(getTrainingPointsFromScore(score) > 36);
});

test("TP4. Approximately 3.29 expected hours and 0 completed is not a 40-point loss", () => {
  const score = buildPaceScore({ asOfDate: "2026-02-20", departmentHours: 0 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.ok(annual?.actionNeeded.includes("3.29 hrs expected by now") ?? false);
  assert.equal(annual?.completionPercent, 86);
  assert.ok(getTrainingPointsFromScore(score) > 30);
});

test("TP5. On pace yields full 40/40 training credit", () => {
  const score = buildPaceScore({ asOfDate: "2026-03-31", departmentHours: 6 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(getTrainingPointsFromScore(score), 40);
});

test("TP6. Slightly behind pace has a small reduction", () => {
  const score = buildPaceScore({ asOfDate: "2026-03-31", departmentHours: 5 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.ok((annual?.completionPercent ?? 0) >= 95);
  assert.ok((annual?.completionPercent ?? 0) < 100);
});

test("TP7. Larger deficit has a larger reduction", () => {
  const slightBehind = buildPaceScore({ asOfDate: "2026-03-31", departmentHours: 5 });
  const largerDeficit = buildPaceScore({ asOfDate: "2026-06-30", departmentHours: 6 });

  const slightPercent = getFactor(slightBehind, "annual-fire")?.completionPercent ?? 0;
  const largerPercent = getFactor(largerDeficit, "annual-fire")?.completionPercent ?? 0;

  assert.ok(largerPercent < slightPercent);
});

test("TP8. Severe deficit has substantial reduction", () => {
  const score = buildPaceScore({ asOfDate: "2026-10-01", departmentHours: 2 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.ok((annual?.completionPercent ?? 0) < 40);
  assert.ok(getTrainingPointsFromScore(score) < 16);
});

test("TP9. Catch-up restores readiness", () => {
  const behind = buildPaceScore({ asOfDate: "2026-06-30", departmentHours: 4 });
  const caughtUp = buildPaceScore({ asOfDate: "2026-06-30", departmentHours: 12 });

  const behindAnnual = getFactor(behind, "annual-fire");
  const caughtUpAnnual = getFactor(caughtUp, "annual-fire");

  assert.ok(behindAnnual && caughtUpAnnual);
  assert.ok((caughtUpAnnual?.completionPercent ?? 0) > (behindAnnual?.completionPercent ?? 0));
  assert.equal(caughtUpAnnual?.completionPercent, 100);
  assert.equal(getTrainingPointsFromScore(caughtUp), 40);
});

test("TP10. Extra hours cannot exceed 40/40", () => {
  const score = buildPaceScore({ asOfDate: "2026-12-31", departmentHours: 60 });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(getTrainingPointsFromScore(score), 40);
  assert.ok((score.scorePercent ?? 0) <= 100);
});

test("TP11. September new member on pace through December is not penalized for Jan-Aug", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 8,
    memberStartDate: "2026-09-01",
  });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(getTrainingPointsFromScore(score), 40);
});

test("TP12. 30-hour volunteer department remains reasonable under small deficit", () => {
  const score = buildPaceScore({
    asOfDate: "2026-05-01",
    annualHoursRequired: 30,
    departmentHours: 7,
  });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.ok((annual?.completionPercent ?? 0) >= 85);
  assert.ok((annual?.completionPercent ?? 0) <= 95);
});

test("TP13. High-hour department scales deficit impact proportionally", () => {
  const volunteer = buildPaceScore({
    asOfDate: "2026-05-01",
    annualHoursRequired: 30,
    departmentHours: 7,
  });
  const highHour = buildPaceScore({
    asOfDate: "2026-05-01",
    annualHoursRequired: 120,
    departmentHours: 36.6,
  });

  const volunteerPercent = getFactor(volunteer, "annual-fire")?.completionPercent ?? 0;
  const highHourPercent = getFactor(highHour, "annual-fire")?.completionPercent ?? 0;

  assert.ok(highHourPercent > volunteerPercent);
  assert.ok(highHourPercent >= 98);
});

test("TP14. Existing category-hour requirements still work", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [
      annualRequirement(24),
      categoryRequirement("cat-fire-suppression", "fire-suppression", 10),
    ],
    categoryHours: [
      { categoryId: "fire-suppression", categoryName: "Fire Suppression", hours: 5 },
    ],
    categoryNameById: new Map([["fire-suppression", "Fire Suppression"]]),
  });

  const annual = getFactor(score, "annual-fire");
  const category = getFactor(score, "cat-fire-suppression");

  assert.ok(annual && category);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(category?.completionPercent, 50);
});

test("TP15. Existing recurring requirements still work", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [annualRequirement(24), recurringCertificationRequirement("ff1")],
    certificationStatuses: [
      { certificationId: "ff1", certificationName: "Firefighter 1", status: "expired" },
    ],
  });

  const recurring = getFactor(score, "recurring-ff1");
  const annual = getFactor(score, "annual-fire");

  assert.ok(recurring && annual);
  assert.equal(recurring?.completed, false);
  assert.equal(annual?.completionPercent, 100);
});

test("TP16. Existing assigned training credited hours still work", () => {
  const beforeCredit = buildPaceScore({ asOfDate: "2026-12-31", departmentHours: 20 });
  const afterCredit = buildPaceScore({ asOfDate: "2026-12-31", departmentHours: 24 });

  const beforeAnnual = getFactor(beforeCredit, "annual-fire");
  const afterAnnual = getFactor(afterCredit, "annual-fire");

  assert.ok(beforeAnnual && afterAnnual);
  assert.ok((afterAnnual?.completionPercent ?? 0) > (beforeAnnual?.completionPercent ?? 0));
  assert.equal(afterAnnual?.completionPercent, 100);
});

test("TP17. No double-counting of the same annual training deficiency", () => {
  const score = buildPaceScore({ asOfDate: "2026-12-31", departmentHours: 12 });

  const incompleteTrainingFactors = score.factors.filter(
    (factor) => factor.category === "training" && factor.completed === false,
  );

  assert.equal(incompleteTrainingFactors.length, 1);
  assert.equal(score.incompleteRequirements, 1);
});

test("TP18. Mid-year member pace deduction uses annual requirement points-per-hour", () => {
  const score = buildPaceScore({
    asOfDate: "2026-08-27",
    departmentHours: 1,
    memberStartDate: "2026-07-08",
  });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);
  assert.ok(annual?.actionNeeded.includes("3.29 hrs expected by now") ?? false);
  assert.ok(annual?.actionNeeded.includes("2.29 hrs more training hours") ?? false);

  const pointsPerHour = getCoachMetric(
    annual?.actionNeeded ?? "",
    /worth ([0-9.]+) readiness points per applicable hour/,
  );
  assert.equal(pointsPerHour, Number((40 / 24).toFixed(2)));
});

test("TP19. Training bucket points equal coach deficit math for annual requirement", () => {
  const score = buildPaceScore({
    asOfDate: "2026-08-27",
    departmentHours: 1,
    memberStartDate: "2026-07-08",
  });
  const annual = getFactor(score, "annual-fire");

  assert.ok(annual);

  const pointsPerHour = getCoachMetric(
    annual?.actionNeeded ?? "",
    /worth ([0-9.]+) readiness points per applicable hour/,
  );
  const paceDeficit = getCoachMetric(
    annual?.actionNeeded ?? "",
    /Complete ([0-9.]+) hrs more training hours/,
  );

  assert.ok(pointsPerHour !== null);
  assert.ok(paceDeficit !== null);

  const expectedPoints = 40 - (paceDeficit ?? 0) * (pointsPerHour ?? 0);
  const actualPoints = getTrainingPointsFromScore(score);
  assert.ok(Math.abs(actualPoints - expectedPoints) < 0.3);
});

test("TP20. Training components normalize across the active 20/10/6/4 model", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [
      annualRequirement(24),
      categoryRequirement("cat-fire-suppression", "fire-suppression", 10),
      recurringTrainingRequirement("rec-hazmat", "hazmat", 6),
    ],
    categoryHours: [
      { categoryId: "fire-suppression", categoryName: "Fire Suppression", hours: 5 },
      { categoryId: "hazmat", categoryName: "Hazmat", hours: 3 },
    ],
    categoryNameById: new Map([
      ["fire-suppression", "Fire Suppression"],
      ["hazmat", "Hazmat"],
    ]),
    trainingAssignments: [
      {
        id: "assign-required",
        title: "Required Drill",
        category_id: null,
        due_at: null,
        hours_credit: 4,
        is_required: true,
        review_required: false,
        status: "active",
      },
    ],
    assignmentMembers: [
      {
        id: "assign-member-1",
        training_assignment_id: "assign-required",
        completion_status: "approved",
        due_at: null,
        completed_at: "2026-12-31",
        hours_earned: 2,
      },
    ],
  });

  const annual = getFactor(score, "annual-fire");
  const category = getFactor(score, "cat-fire-suppression");
  const recurring = getFactor(score, "rec-hazmat");
  const assigned = getFactor(score, "assign-required");

  assert.ok(annual && category && recurring && assigned);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(category?.completionPercent, 50);
  assert.equal(recurring?.completionPercent, 50);
  assert.equal(assigned?.completionPercent, 50);

  const weightedTrainingPercent = getWeightedTrainingPercent(score);

  assert.equal(weightedTrainingPercent, 75);
});

test("TP21. Annual-only configuration keeps inactive training components neutral", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 18,
    requirementRows: [annualRequirement(24)],
  });

  const annual = getFactor(score, "annual-fire");
  const trainingFactors = score.factors.filter((factor) => factor.category === "training");

  assert.ok(annual);
  assert.equal(trainingFactors.length, 1);
  assert.equal(trainingFactors[0]?.weightPercent, 20);
  assert.equal(getWeightedTrainingPercent(score), annual?.completionPercent ?? 0);
});

test("TP22. Category requirement only credits applicable category hours", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [
      annualRequirement(24),
      categoryRequirement("cat-hazmat", "hazmat", 4),
    ],
    categoryHours: [
      { categoryId: "fire-suppression", categoryName: "Fire Suppression", hours: 12 },
    ],
    categoryNameById: new Map([
      ["hazmat", "Hazmat"],
      ["fire-suppression", "Fire Suppression"],
    ]),
  });

  const category = getFactor(score, "cat-hazmat");
  assert.ok(category);
  assert.equal(category?.completionPercent, 0);
  assert.equal(category?.completed, false);
});

test("TP23. Recurring requirement only credits applicable training", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [
      annualRequirement(24),
      recurringTrainingRequirement("rec-hazmat", "hazmat", 4),
    ],
    categoryHours: [
      { categoryId: "fire-suppression", categoryName: "Fire Suppression", hours: 8 },
    ],
    categoryNameById: new Map([
      ["hazmat", "Hazmat"],
      ["fire-suppression", "Fire Suppression"],
    ]),
  });

  const recurring = getFactor(score, "rec-hazmat");
  assert.ok(recurring);
  assert.equal(recurring?.completionPercent, 0);
  assert.equal(recurring?.completed, false);
});

test("TP24. Annual and category overlap can both receive credit", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [
      annualRequirement(24),
      categoryRequirement("cat-hazmat", "hazmat", 4),
    ],
    categoryHours: [
      { categoryId: "hazmat", categoryName: "Hazmat", hours: 4 },
    ],
    categoryNameById: new Map([
      ["hazmat", "Hazmat"],
    ]),
  });

  const annual = getFactor(score, "annual-fire");
  const category = getFactor(score, "cat-hazmat");

  assert.ok(annual && category);
  assert.equal(annual?.completionPercent, 100);
  assert.equal(category?.completionPercent, 100);
});

test("TP25. Unmappable recurring topic stays neutral instead of guessing", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [
      annualRequirement(24),
      recurringTrainingRequirementByTopic("rec-topic", "confined-space", 4),
    ],
    categoryHours: [
      { categoryId: "hazmat", categoryName: "Hazmat", hours: 8 },
    ],
    categoryNameById: new Map([
      ["hazmat", "Hazmat"],
    ]),
  });

  const recurring = getFactor(score, "rec-topic");
  const annual = getFactor(score, "annual-fire");

  assert.equal(recurring, null);
  assert.ok(annual);
  assert.equal(getWeightedTrainingPercent(score), annual?.completionPercent ?? 0);
});

test("TP26. Assigned required behavior is unchanged", () => {
  const score = buildPaceScore({
    asOfDate: "2026-12-31",
    departmentHours: 24,
    requirementRows: [annualRequirement(24)],
    trainingAssignments: [
      {
        id: "assign-required",
        title: "Required Drill",
        category_id: null,
        due_at: null,
        hours_credit: 4,
        is_required: true,
        review_required: false,
        status: "active",
      },
    ],
    assignmentMembers: [
      {
        id: "assign-member-1",
        training_assignment_id: "assign-required",
        completion_status: "approved",
        due_at: null,
        completed_at: "2026-12-31",
        hours_earned: 2,
      },
    ],
  });

  const assigned = getFactor(score, "assign-required");
  assert.ok(assigned);
  assert.equal(assigned?.completionPercent, 50);
  assert.equal(assigned?.requiredValue, "4.00 hrs");
  assert.equal(assigned?.currentValue, "2.00 hrs");
});
