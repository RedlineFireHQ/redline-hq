import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScaledCustomCheckBoundaries,
  calculateOverallApparatusReadiness,
  type ApparatusReadinessInput,
} from "./apparatus-readiness";

function buildBaseInput(): ApparatusReadinessInput {
  return {
    now: new Date("2026-08-18T12:00:00.000Z"),
    explicitOutOfService: false,
    apparatusCheck: {
      lastCompletedAt: "2026-08-18T06:00:00.000Z",
      intervalDays: 1,
      scoreProfile: "daily",
    },
    conditionDeficiencies: [],
    maintenanceRequirements: [
      {
        requirementId: "req-1",
        name: "Engine Service",
        methods: [
          {
            methodType: "time_days",
            intervalValue: 30,
            dueSoonThresholdValue: 3,
            earlyOverdueThresholdValue: 2,
            moderateOverdueThresholdValue: 10,
            elapsedSinceService: 20,
          },
        ],
      },
    ],
    equipmentRequirements: [
      {
        requirementId: "eq-1",
        equipmentSource: "asset",
        equipmentId: "asset-1",
        isRequired: true,
        isCritical: false,
        isOperational: true,
      },
    ],
  };
}

test("A. Perfect apparatus = 100%", () => {
  const result = calculateOverallApparatusReadiness(buildBaseInput());
  assert.equal(result.scorePercent, 100);
  assert.equal(result.status, "ready");
});

test("B. Apparatus Check current", () => {
  const result = calculateOverallApparatusReadiness(buildBaseInput());
  assert.equal(result.bucketScores.apparatusChecks, 20);
});

test("C. Apparatus Check overdue progression", () => {
  const input = buildBaseInput();

  input.apparatusCheck.lastCompletedAt = "2026-08-17T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 15);

  input.apparatusCheck.lastCompletedAt = "2026-08-16T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 10);

  input.apparatusCheck.lastCompletedAt = "2026-08-15T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 5);

  input.apparatusCheck.lastCompletedAt = "2026-08-14T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 0);
});

test("C2. Monthly profile overdue progression", () => {
  const input = buildBaseInput();
  input.apparatusCheck.intervalDays = 30;
  input.apparatusCheck.scoreProfile = "monthly";

  input.apparatusCheck.lastCompletedAt = "2026-07-19T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 10);

  input.apparatusCheck.lastCompletedAt = "2026-07-18T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 5);

  input.apparatusCheck.lastCompletedAt = "2026-07-17T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 0);
});

test("C3. Weekly/other intervals are supported by interval_days + selected profile", () => {
  const input = buildBaseInput();
  input.apparatusCheck.intervalDays = 7;
  input.apparatusCheck.scoreProfile = "daily";

  input.apparatusCheck.lastCompletedAt = "2026-08-11T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 15);

  input.apparatusCheck.lastCompletedAt = "2026-08-10T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 10);
});

test("C4. Weekly 7-day scaled boundaries", () => {
  const input = buildBaseInput();
  input.apparatusCheck.intervalDays = 7;

  input.apparatusCheck.lastCompletedAt = "2026-08-11T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 15);

  input.apparatusCheck.lastCompletedAt = "2026-08-10T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 10);

  input.apparatusCheck.lastCompletedAt = "2026-08-08T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 5);

  input.apparatusCheck.lastCompletedAt = "2026-08-05T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 0);
});

test("C5. 14-day scaled boundaries", () => {
  const input = buildBaseInput();
  input.apparatusCheck.intervalDays = 14;

  input.apparatusCheck.lastCompletedAt = "2026-08-04T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 15);

  input.apparatusCheck.lastCompletedAt = "2026-08-01T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 10);

  input.apparatusCheck.lastCompletedAt = "2026-07-29T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 5);

  input.apparatusCheck.lastCompletedAt = "2026-07-21T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 0);
});

test("C6. 21-day scaled boundaries", () => {
  const input = buildBaseInput();
  input.apparatusCheck.intervalDays = 21;

  input.apparatusCheck.lastCompletedAt = "2026-07-28T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 15);

  input.apparatusCheck.lastCompletedAt = "2026-07-23T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 10);

  input.apparatusCheck.lastCompletedAt = "2026-07-17T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 5);

  input.apparatusCheck.lastCompletedAt = "2026-07-07T06:00:00.000Z";
  assert.equal(calculateOverallApparatusReadiness(input).bucketScores.apparatusChecks, 0);
});

test("C7. Deterministic scaled boundary rounding across approved intervals", () => {
  assert.deepEqual(calculateScaledCustomCheckBoundaries(2), {
    quarterOverdueBoundary: 1,
    halfOverdueBoundary: 2,
    fullyOverdueBoundary: 2,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(3), {
    quarterOverdueBoundary: 1,
    halfOverdueBoundary: 2,
    fullyOverdueBoundary: 3,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(4), {
    quarterOverdueBoundary: 1,
    halfOverdueBoundary: 2,
    fullyOverdueBoundary: 4,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(5), {
    quarterOverdueBoundary: 1,
    halfOverdueBoundary: 3,
    fullyOverdueBoundary: 5,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(6), {
    quarterOverdueBoundary: 2,
    halfOverdueBoundary: 3,
    fullyOverdueBoundary: 6,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(7), {
    quarterOverdueBoundary: 2,
    halfOverdueBoundary: 4,
    fullyOverdueBoundary: 7,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(14), {
    quarterOverdueBoundary: 4,
    halfOverdueBoundary: 7,
    fullyOverdueBoundary: 14,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(21), {
    quarterOverdueBoundary: 5,
    halfOverdueBoundary: 11,
    fullyOverdueBoundary: 21,
  });

  assert.deepEqual(calculateScaledCustomCheckBoundaries(29), {
    quarterOverdueBoundary: 7,
    halfOverdueBoundary: 15,
    fullyOverdueBoundary: 29,
  });
});

test("C8. Scaled boundary safeguards enforce minimum day and separation", () => {
  for (const intervalDays of [2, 3, 4, 5, 6, 7, 14, 21, 29]) {
    const boundaries = calculateScaledCustomCheckBoundaries(intervalDays);
    assert.ok(boundaries.quarterOverdueBoundary >= 1);
    assert.ok(boundaries.halfOverdueBoundary >= boundaries.quarterOverdueBoundary + 1);
    assert.equal(boundaries.fullyOverdueBoundary, intervalDays);
  }
});

test("D. One Minor deficiency", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-1", priorityName: "Low", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 39);
});

test("D2. Multiple Minor deficiencies stack", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d1", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d2", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d3", priorityName: "Low", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 37);
});

test("E. One Significant deficiency", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-1", priorityName: "Medium", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 35);
});

test("F. One Critical deficiency triggers OOS and 40-point condition loss", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-1", priorityName: "Critical", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 0);
  assert.equal(result.isOutOfService, true);
});

test("F2. Critical linked to non-critical equipment remains OOS and keeps condition at 0", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-critical", priorityName: "Critical", isActive: true, countInCondition: true },
  ];
  input.equipmentRequirements = [
    {
      requirementId: "eq-1",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: false,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 0);
  assert.equal(result.isOutOfService, true);
});

test("F3. Critical linked to critical equipment remains OOS and keeps condition at 0", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-critical", priorityName: "Critical", isActive: true, countInCondition: true },
  ];
  input.equipmentRequirements = [
    {
      requirementId: "eq-1",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: true,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 0);
  assert.equal(result.isOutOfService, true);
});

test("F4. Critical cannot be suppressed by dedupe flag", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-critical", priorityName: "Critical", isActive: true, countInCondition: false },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 0);
  assert.equal(result.isOutOfService, true);
});

test("G. Critical resolved + remaining Minor deficiencies", () => {
  const withCritical = buildBaseInput();
  withCritical.conditionDeficiencies = [
    { id: "dc", priorityName: "Critical", isActive: true, countInCondition: true },
    { id: "d1", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d2", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d3", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d4", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d5", priorityName: "Low", isActive: true, countInCondition: true },
  ];

  const criticalResult = calculateOverallApparatusReadiness(withCritical);
  assert.equal(criticalResult.bucketScores.conditionSafety, 0);

  const resolvedCritical = buildBaseInput();
  resolvedCritical.conditionDeficiencies = [
    { id: "d1", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d2", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d3", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d4", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d5", priorityName: "Low", isActive: true, countInCondition: true },
  ];

  const resolvedResult = calculateOverallApparatusReadiness(resolvedCritical);
  assert.equal(resolvedResult.bucketScores.conditionSafety, 35);
  assert.equal(resolvedResult.isOutOfService, false);
});

test("H. Maintenance Due Soon", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 28;
  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 19);
});

test("I. Maintenance Due", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 30;
  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 17);
});

test("J. Maintenance severely overdue", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 60;
  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 0);
});

test("K. Missing non-critical required equipment", () => {
  const input = buildBaseInput();
  input.equipmentRequirements = [
    {
      requirementId: "eq-1",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: false,
      isOperational: true,
    },
    {
      requirementId: "eq-2",
      equipmentSource: "asset",
      equipmentId: "asset-2",
      isRequired: true,
      isCritical: false,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.requiredEquipment, 10);
});

test("L. Missing critical required equipment triggers OOS", () => {
  const input = buildBaseInput();
  input.equipmentRequirements = [
    {
      requirementId: "eq-1",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: true,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.isOutOfService, true);
});

test("M. Multiple active deficiencies stack deductions", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d1", priorityName: "Low", isActive: true, countInCondition: true },
    { id: "d2", priorityName: "Medium", isActive: true, countInCondition: true },
    { id: "d3", priorityName: "High", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 29);
});

test("M2. Critical + Significant still floors at 0", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d1", priorityName: "Critical", isActive: true, countInCondition: true },
    { id: "d2", priorityName: "High", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 0);
  assert.equal(result.isOutOfService, true);
});

test("N. Multiple maintenance methods use whichever comes first", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements = [
    {
      requirementId: "req-1",
      name: "Pump service",
      methods: [
        {
          methodType: "time_days",
          intervalValue: 30,
          dueSoonThresholdValue: 3,
          earlyOverdueThresholdValue: 2,
          moderateOverdueThresholdValue: 10,
          elapsedSinceService: 15,
        },
        {
          methodType: "mileage",
          intervalValue: 500,
          dueSoonThresholdValue: 25,
          earlyOverdueThresholdValue: 10,
          moderateOverdueThresholdValue: 40,
          elapsedSinceService: 560,
        },
      ],
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 0);
});

test("N2. Maintenance early overdue", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 31;

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 15);
});

test("N3. Maintenance moderately overdue", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 36;

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 10);
});

test("N4. Engine-hours method can control requirement", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements = [
    {
      requirementId: "req-eh",
      name: "Pump runtime service",
      methods: [
        {
          methodType: "engine_hours",
          intervalValue: 100,
          dueSoonThresholdValue: 5,
          earlyOverdueThresholdValue: 2,
          moderateOverdueThresholdValue: 10,
          elapsedSinceService: 111,
        },
      ],
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 0);
});

test("O. Optional equipment does not affect score", () => {
  const input = buildBaseInput();
  input.equipmentRequirements = [
    {
      requirementId: "eq-required",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: false,
      isOperational: true,
    },
    {
      requirementId: "eq-optional",
      equipmentSource: "asset",
      equipmentId: "asset-2",
      isRequired: false,
      isCritical: false,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.requiredEquipment, 20);
});

test("O2. Missing required equipment configuration returns not scored", () => {
  const input = buildBaseInput();
  input.equipmentRequirements = [];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.requiredEquipment, null);
  assert.equal(result.status, "not_scored");
});

test("P. Score never falls below 0", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d1", priorityName: "Critical", isActive: true, countInCondition: true },
    { id: "d2", priorityName: "Critical", isActive: true, countInCondition: true },
  ];
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 100;
  input.equipmentRequirements = [
    {
      requirementId: "eq-1",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: false,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.scorePercent, 20);
  assert.ok((result.scorePercent ?? 0) >= 0);
});

test("Q. Score never exceeds 100", () => {
  const result = calculateOverallApparatusReadiness(buildBaseInput());
  assert.ok((result.scorePercent ?? 0) <= 100);
});

test("Q2. OOS gate remains independent of numeric readiness", () => {
  const input = buildBaseInput();
  input.explicitOutOfService = true;

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.scorePercent, 100);
  assert.equal(result.isOutOfService, true);
  assert.equal(result.status, "out_of_service");
});

test("R. Same issue is not double-counted between Condition and Equipment", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-1", priorityName: "Low", isActive: true, countInCondition: false },
  ];
  input.equipmentRequirements = [
    {
      requirementId: "eq-1",
      equipmentSource: "asset",
      equipmentId: "asset-1",
      isRequired: true,
      isCritical: false,
      isOperational: false,
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 40);
  assert.equal(result.bucketScores.requiredEquipment, 0);
  assert.equal(result.scorePercent, 80);
});
