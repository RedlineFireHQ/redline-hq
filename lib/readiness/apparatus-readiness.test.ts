import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("D. One Minor deficiency", () => {
  const input = buildBaseInput();
  input.conditionDeficiencies = [
    { id: "d-1", priorityName: "Low", isActive: true, countInCondition: true },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.conditionSafety, 39);
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
