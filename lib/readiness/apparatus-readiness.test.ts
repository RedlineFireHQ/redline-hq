import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScaledCustomCheckBoundaries,
  calculateOverallApparatusReadiness,
  type ApparatusReadinessInput,
} from "./apparatus-readiness";
import { ensureApparatusReadinessRowContract, getStatusLabelForReadinessRow } from "./apparatus-readiness-data";
import {
  getApparatusStateAfterDeficiencyResolution,
  getOutOfServiceSourceForInspectionStatus,
} from "../apparatus/out-of-service-source";
import {
  buildCompletionFootprint,
  buildInspectionParticipantSummary,
  buildParticipationCreditCounts,
  evaluateApparatusCheckCompletion,
  evaluateSessionDeficiencyReporter,
  evaluateSessionHelperAdd,
} from "./apparatus-check-completion-rules";

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

test("A2. Fully configured apparatus with no historical readiness events starts at 100%", () => {
  const input = buildBaseInput();
  input.apparatusCheck.lastCompletedAt = null;
  input.maintenanceRequirements = [
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
          elapsedSinceService: 0,
        },
      ],
    },
  ];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.isScoreAvailable, true);
  assert.equal(result.bucketScores.apparatusChecks, 20);
  assert.equal(result.bucketScores.maintenanceService, 20);
  assert.equal(result.scorePercent, 100);
  assert.equal(result.status, "ready");
});

test("A3. Unconfigured apparatus remains not scored and never assumes 100%", () => {
  const result = calculateOverallApparatusReadiness({
    now: new Date("2026-08-18T12:00:00.000Z"),
    explicitOutOfService: false,
    apparatusCheck: {
      lastCompletedAt: null,
      intervalDays: null,
      scoreProfile: null,
    },
    conditionDeficiencies: [],
    maintenanceRequirements: [],
    equipmentRequirements: [],
  });

  assert.equal(result.isScoreAvailable, false);
  assert.equal(result.scorePercent, null);
  assert.equal(result.status, "not_scored");
});

test("A4. Configured apparatus with actual readiness deficiency follows locked scoring", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements[0].methods[0].elapsedSinceService = 60;

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.isScoreAvailable, true);
  assert.equal(result.bucketScores.maintenanceService, 0);
  assert.equal(result.scorePercent, 80);
  assert.equal(result.status, "needs_attention");
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

test("C9. Data contract returns explicit readiness for configuration-required apparatus", () => {
  const apparatus = {
    id: "a-1",
    department_id: "d-1",
    name: "Engine 1",
    type: "Engine",
    include_in_department_readiness: true,
    status: "in_service",
    last_inspection_at: null,
    mileage: null,
    engine_hours: null,
  };

  const configurationRequiredReadiness = calculateOverallApparatusReadiness({
    now: new Date("2026-08-18T12:00:00.000Z"),
    explicitOutOfService: false,
    apparatusCheck: {
      lastCompletedAt: null,
      intervalDays: null,
      scoreProfile: null,
    },
    conditionDeficiencies: [],
    maintenanceRequirements: [],
    equipmentRequirements: [],
  });
  const row = ensureApparatusReadinessRowContract(
    apparatus,
    {
      apparatus,
      readiness: configurationRequiredReadiness,
      simulationData: {
        maintenanceRequirements: [],
      },
    },
    new Date("2026-08-18T12:00:00.000Z")
  );

  assert.equal(row.readinessState, "evaluated");
  assert.equal(row.evaluationErrorReason, "none");
  assert.equal(row.readiness.status, "not_scored");
  assert.equal(row.readiness.scorePercent, null);
  assert.equal(getStatusLabelForReadinessRow(row), "Configuration Required");
});

test("C10. Unexpected missing evaluation is marked Readiness Unavailable", () => {
  const apparatus = {
    id: "a-2",
    department_id: "d-1",
    name: "Rescue 2",
    type: "Rescue",
    include_in_department_readiness: true,
    status: "in_service",
    last_inspection_at: null,
    mileage: null,
    engine_hours: null,
  };

  const row = ensureApparatusReadinessRowContract(apparatus, undefined, new Date("2026-08-18T12:00:00.000Z"));
  assert.equal(row.readinessState, "evaluation_error");
  assert.equal(row.evaluationErrorReason, "missing_evaluation_result");
  assert.equal(row.readiness.status, "not_scored");
  assert.equal(row.readiness.scorePercent, null);
  assert.equal(getStatusLabelForReadinessRow(row), "Readiness Unavailable");
});

test("C11. OOS remains OOS even when evaluation is unavailable", () => {
  const apparatus = {
    id: "a-3",
    department_id: "d-1",
    name: "Rescue 3",
    type: "Rescue",
    include_in_department_readiness: true,
    status: "out_of_service",
    last_inspection_at: null,
    mileage: null,
    engine_hours: null,
  };

  const row = ensureApparatusReadinessRowContract(apparatus, undefined, new Date("2026-08-18T12:00:00.000Z"));
  assert.equal(row.readinessState, "evaluation_error");
  assert.equal(row.readiness.status, "out_of_service");
  assert.equal(row.readiness.isOutOfService, true);
  assert.equal(getStatusLabelForReadinessRow(row), "Out of Service");
});

test("C12. Mixed apparatus rows keep explicit non-conflated states", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");
  const apparatusRows = [
    {
      id: "a-1",
      department_id: "d-1",
      name: "Engine 1",
      type: "Engine",
      include_in_department_readiness: true,
      status: "in_service",
      last_inspection_at: null,
      mileage: null,
      engine_hours: null,
    },
    {
      id: "a-2",
      department_id: "d-1",
      name: "Truck 2",
      type: "Truck",
      include_in_department_readiness: true,
      status: "in_service",
      last_inspection_at: null,
      mileage: null,
      engine_hours: null,
    },
    {
      id: "a-3",
      department_id: "d-1",
      name: "Rescue 3",
      type: "Rescue",
      include_in_department_readiness: true,
      status: "out_of_service",
      last_inspection_at: null,
      mileage: null,
      engine_hours: null,
    },
  ];

  const configurationRequiredReadiness = calculateOverallApparatusReadiness({
    now,
    explicitOutOfService: false,
    apparatusCheck: {
      lastCompletedAt: null,
      intervalDays: null,
      scoreProfile: null,
    },
    conditionDeficiencies: [],
    maintenanceRequirements: [],
    equipmentRequirements: [],
  });

  const evaluatedRows = [
    {
      apparatus: apparatusRows[0],
      readiness: calculateOverallApparatusReadiness(buildBaseInput()),
      simulationData: {
        maintenanceRequirements: [],
      },
    },
    {
      apparatus: apparatusRows[1],
      readiness: configurationRequiredReadiness,
      simulationData: {
        maintenanceRequirements: [],
      },
    },
    undefined,
  ];

  const rows = apparatusRows.map((apparatus, index) =>
    ensureApparatusReadinessRowContract(apparatus, evaluatedRows[index], now)
  );

  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(row.readiness);
    assert.equal(typeof row.readiness.isOutOfService, "boolean");
  }

  assert.equal(rows[0].readinessState, "evaluated");
  assert.equal(rows[0].readiness.scorePercent !== null, true);
  assert.equal(getStatusLabelForReadinessRow(rows[0]), "Ready");

  assert.equal(rows[1].readinessState, "evaluated");
  assert.equal(rows[1].readiness.status, "not_scored");
  assert.equal(getStatusLabelForReadinessRow(rows[1]), "Configuration Required");

  assert.equal(rows[2].readinessState, "evaluation_error");
  assert.equal(rows[2].readiness.scorePercent, null);
  assert.equal(getStatusLabelForReadinessRow(rows[2]), "Out of Service");
});

test("C13. Current inspection and active deficiency are not the same as Checks Due", () => {
  const result = calculateOverallApparatusReadiness({
    ...buildBaseInput(),
    conditionDeficiencies: [
      { id: "d-1", priorityName: "Medium", isActive: true, countInCondition: true },
    ],
  });

  assert.equal(result.bucketScores.apparatusChecks, 20);
  assert.equal(result.status, "needs_attention");
  assert.equal(getStatusLabelForReadinessRow({
    apparatus: {
      id: "a-1",
      department_id: "d-1",
      name: "Engine 430",
      type: "Engine",
      include_in_department_readiness: true,
      status: "in_service",
      last_inspection_at: "2026-09-01T00:00:00.000Z",
      mileage: null,
      engine_hours: null,
    },
    readiness: result,
    simulationData: { maintenanceRequirements: [] },
    readinessState: "evaluated",
    evaluationErrorReason: "none",
  }), "Ready");
});

test("C14. Overdue inspection is labeled Checks Due even when readiness is otherwise not ready", () => {
  const result = calculateOverallApparatusReadiness({
    ...buildBaseInput(),
    apparatusCheck: {
      lastCompletedAt: "2026-08-10T06:00:00.000Z",
      intervalDays: 1,
      scoreProfile: "daily",
    },
    conditionDeficiencies: [
      { id: "d-1", priorityName: "Medium", isActive: true, countInCondition: true },
    ],
  });

  assert.equal(result.bucketScores.apparatusChecks, 0);
  assert.equal(result.status, "needs_attention");
  assert.equal(getStatusLabelForReadinessRow({
    apparatus: {
      id: "a-2",
      department_id: "d-1",
      name: "Engine 431",
      type: "Engine",
      include_in_department_readiness: true,
      status: "in_service",
      last_inspection_at: "2026-08-10T00:00:00.000Z",
      mileage: null,
      engine_hours: null,
    },
    readiness: result,
    simulationData: { maintenanceRequirements: [] },
    readinessState: "evaluated",
    evaluationErrorReason: "none",
  }), "Checks Due");
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

test("O2. Empty maintenance and equipment configuration is neutral", () => {
  const input = buildBaseInput();
  input.maintenanceRequirements = [];
  input.equipmentRequirements = [];

  const result = calculateOverallApparatusReadiness(input);
  assert.equal(result.bucketScores.maintenanceService, 20);
  assert.equal(result.bucketScores.requiredEquipment, 20);
  assert.equal(result.scorePercent, 100);
  assert.equal(result.status, "ready");
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

test("S1. Deficiency-driven OOS with one active deficiency remains OOS", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "deficiency",
    remainingActiveDeficiencyCount: 1,
  });

  assert.equal(result.statusChanged, false);
  assert.equal(result.nextStatus, "out_of_service");
  assert.equal(result.nextOutOfServiceSource, "deficiency");
});

test("S2. Deficiency-driven OOS with multiple active deficiencies remains OOS until the last one is resolved", () => {
  const withThreeRemaining = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "deficiency",
    remainingActiveDeficiencyCount: 3,
  });
  const withOneRemaining = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "deficiency",
    remainingActiveDeficiencyCount: 1,
  });

  assert.equal(withThreeRemaining.statusChanged, false);
  assert.equal(withThreeRemaining.nextStatus, "out_of_service");
  assert.equal(withOneRemaining.statusChanged, false);
  assert.equal(withOneRemaining.nextStatus, "out_of_service");
});

test("S3. Deficiency-driven OOS returns to Ready when the last active deficiency is resolved", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "deficiency",
    remainingActiveDeficiencyCount: 0,
  });

  assert.equal(result.statusChanged, true);
  assert.equal(result.nextStatus, "ready");
  assert.equal(result.nextOutOfServiceSource, null);
});

test("S4. Manual OOS remains OOS when a deficiency is resolved", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "manual",
    remainingActiveDeficiencyCount: 0,
  });

  assert.equal(result.statusChanged, false);
  assert.equal(result.nextStatus, "out_of_service");
  assert.equal(result.nextOutOfServiceSource, "manual");
});

test("S5. Legacy OOS remains OOS when a deficiency is resolved", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: null,
    remainingActiveDeficiencyCount: 0,
  });

  assert.equal(result.statusChanged, false);
  assert.equal(result.nextStatus, "out_of_service");
  assert.equal(result.nextOutOfServiceSource, null);
});

test("S6. Ready inspection clears out_of_service_source", () => {
  const result = getOutOfServiceSourceForInspectionStatus("ready");
  assert.equal(result, null);
});

test("S7. Ready with deficiencies inspection clears out_of_service_source", () => {
  const result = getOutOfServiceSourceForInspectionStatus("needs_attention");
  assert.equal(result, null);
});

test("S8. OOS inspection marks out_of_service_source as deficiency", () => {
  const result = getOutOfServiceSourceForInspectionStatus("out_of_service");
  assert.equal(result, "deficiency");
});

test("T1. Ready with zero linked deficiencies is allowed", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "ready",
    linkedDeficiencyCount: 0,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
  assert.equal(result.reason, "ok");
  assert.equal(result.outOfServiceSource, null);
});

test("T2. Ready with linked deficiencies is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "ready",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "ready_with_linked_deficiencies");
});

test("T3. Needs attention with one linked deficiency is allowed", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "needs_attention",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
  assert.equal(result.outOfServiceSource, null);
});

test("T4. Needs attention with multiple linked deficiencies is allowed", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "needs_attention",
    linkedDeficiencyCount: 3,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
});

test("T5. OOS with one linked deficiency is allowed and marked deficiency-driven", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
  assert.equal(result.outOfServiceSource, "deficiency");
});

test("T6. OOS with multiple linked deficiencies is allowed and marked deficiency-driven", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 4,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
  assert.equal(result.outOfServiceSource, "deficiency");
});

test("T7. OOS with zero linked deficiencies is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 0,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "status_requires_deficiency");
});

test("T8. Needs attention with zero linked deficiencies is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "needs_attention",
    linkedDeficiencyCount: 0,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "status_requires_deficiency");
});

test("T9. Session owner mismatch is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: false,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "session_owner_mismatch");
});

test("T10. Session department mismatch is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: false,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "session_department_mismatch");
});

test("T11. Completed session is idempotently rejected as already completed", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "ready",
    linkedDeficiencyCount: 0,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: true,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "already_completed");
});

test("T12. Checklist required and incomplete is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: true,
    checklistComplete: false,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "checklist_incomplete");
});

test("T13. Checklist required and complete is allowed", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: true,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
});

test("T14. Foreign-apparatus deficiency linkage is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: true,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "linked_deficiency_scope_mismatch");
});

test("T15. Foreign-department deficiency linkage is rejected", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: true,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "linked_deficiency_scope_mismatch");
});

test("T16. Old or unrelated deficiencies cannot satisfy a new OOS session", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 0,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, false);
  assert.equal(result.reason, "status_requires_deficiency");
});

test("T17. Active deficiency count keeps deficiency-driven OOS out of service", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "deficiency",
    remainingActiveDeficiencyCount: 2,
  });

  assert.equal(result.statusChanged, false);
  assert.equal(result.nextStatus, "out_of_service");
});

test("T18. Final active deficiency resolution returns deficiency-driven OOS to ready", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "deficiency",
    remainingActiveDeficiencyCount: 0,
  });

  assert.equal(result.statusChanged, true);
  assert.equal(result.nextStatus, "ready");
});

test("T19. Legacy OOS with null source remains protected", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: null,
    remainingActiveDeficiencyCount: 0,
  });

  assert.equal(result.statusChanged, false);
  assert.equal(result.nextStatus, "out_of_service");
});

test("T20. Manual OOS remains protected from automatic return", () => {
  const result = getApparatusStateAfterDeficiencyResolution({
    apparatusStatus: "out_of_service",
    outOfServiceSource: "manual",
    remainingActiveDeficiencyCount: 0,
  });

  assert.equal(result.statusChanged, false);
  assert.equal(result.nextStatus, "out_of_service");
});

test("T21. Single completion session can link multiple deficiencies to one inspection atomically (rule simulation)", () => {
  const result = evaluateApparatusCheckCompletion({
    finalStatus: "needs_attention",
    linkedDeficiencyCount: 3,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: true,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });

  assert.equal(result.allowCompletion, true);
  assert.equal(result.reason, "ok");
});

test("U1. Primary only completion creates one inspection row with zero retained helpers (rule simulation)", () => {
  const completion = evaluateApparatusCheckCompletion({
    finalStatus: "ready",
    linkedDeficiencyCount: 0,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: false,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });
  const footprint = buildCompletionFootprint({
    completionAllowed: completion.allowCompletion,
    helperMemberIds: [],
  });

  assert.equal(completion.allowCompletion, true);
  assert.equal(footprint.inspectionRowsCreated, 1);
  assert.equal(footprint.completedSessionRows, 1);
  assert.equal(footprint.retainedHelperRows, 0);
});

test("U2. One helper completion retains helper and still creates one inspection row (rule simulation)", () => {
  const completion = evaluateApparatusCheckCompletion({
    finalStatus: "needs_attention",
    linkedDeficiencyCount: 1,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: true,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });
  const footprint = buildCompletionFootprint({
    completionAllowed: completion.allowCompletion,
    helperMemberIds: ["adam"],
  });

  assert.equal(completion.allowCompletion, true);
  assert.equal(footprint.inspectionRowsCreated, 1);
  assert.equal(footprint.retainedHelperRows, 1);
});

test("U3. Multiple helpers completion retains all helpers and keeps one inspection row (rule simulation)", () => {
  const completion = evaluateApparatusCheckCompletion({
    finalStatus: "out_of_service",
    linkedDeficiencyCount: 2,
    hasForeignApparatusDeficiency: false,
    hasForeignDepartmentDeficiency: false,
    checklistRequired: true,
    checklistComplete: true,
    sessionCompleted: false,
    isSessionOwner: true,
    isDepartmentMatch: true,
  });
  const footprint = buildCompletionFootprint({
    completionAllowed: completion.allowCompletion,
    helperMemberIds: ["adam", "ron"],
  });

  assert.equal(completion.allowCompletion, true);
  assert.equal(footprint.inspectionRowsCreated, 1);
  assert.equal(footprint.retainedHelperRows, 2);
});

test("U4. Duplicate helper add is rejected", () => {
  const decision = evaluateSessionHelperAdd({
    sessionState: "in_progress",
    isSessionOwner: true,
    targetMemberExists: true,
    targetMemberActive: true,
    targetMemberDepartmentMatchesSession: true,
    isTargetPrimaryInspector: false,
    alreadyParticipant: true,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "duplicate_helper");
});

test("U5. Cross-department, inactive, and primary-as-helper adds are rejected", () => {
  const crossDepartment = evaluateSessionHelperAdd({
    sessionState: "in_progress",
    isSessionOwner: true,
    targetMemberExists: true,
    targetMemberActive: true,
    targetMemberDepartmentMatchesSession: false,
    isTargetPrimaryInspector: false,
    alreadyParticipant: false,
  });
  const inactive = evaluateSessionHelperAdd({
    sessionState: "in_progress",
    isSessionOwner: true,
    targetMemberExists: true,
    targetMemberActive: false,
    targetMemberDepartmentMatchesSession: true,
    isTargetPrimaryInspector: false,
    alreadyParticipant: false,
  });
  const primaryAsHelper = evaluateSessionHelperAdd({
    sessionState: "in_progress",
    isSessionOwner: true,
    targetMemberExists: true,
    targetMemberActive: true,
    targetMemberDepartmentMatchesSession: true,
    isTargetPrimaryInspector: true,
    alreadyParticipant: false,
  });

  assert.equal(crossDepartment.allowed, false);
  assert.equal(crossDepartment.reason, "target_member_department_mismatch");
  assert.equal(inactive.allowed, false);
  assert.equal(inactive.reason, "target_member_inactive");
  assert.equal(primaryAsHelper.allowed, false);
  assert.equal(primaryAsHelper.reason, "primary_cannot_be_helper");
});

test("U6. Helper deficiency reporting allows owner/helper and rejects non-participant", () => {
  const owner = evaluateSessionDeficiencyReporter({
    sessionState: "in_progress",
    reporterExists: true,
    reporterIsActive: true,
    reporterDepartmentMatchesSession: true,
    reporterIsSessionOwner: true,
    reporterIsSessionHelper: false,
  });
  const helper = evaluateSessionDeficiencyReporter({
    sessionState: "in_progress",
    reporterExists: true,
    reporterIsActive: true,
    reporterDepartmentMatchesSession: true,
    reporterIsSessionOwner: false,
    reporterIsSessionHelper: true,
  });
  const nonParticipant = evaluateSessionDeficiencyReporter({
    sessionState: "in_progress",
    reporterExists: true,
    reporterIsActive: true,
    reporterDepartmentMatchesSession: true,
    reporterIsSessionOwner: false,
    reporterIsSessionHelper: false,
  });

  assert.equal(owner.allowed, true);
  assert.equal(helper.allowed, true);
  assert.equal(nonParticipant.allowed, false);
  assert.equal(nonParticipant.reason, "reporter_not_participant");
});

test("U7. Helper deficiency reporting rejects cross-department, inactive, and completed-session reporters", () => {
  const crossDepartment = evaluateSessionDeficiencyReporter({
    sessionState: "in_progress",
    reporterExists: true,
    reporterIsActive: true,
    reporterDepartmentMatchesSession: false,
    reporterIsSessionOwner: false,
    reporterIsSessionHelper: true,
  });
  const inactive = evaluateSessionDeficiencyReporter({
    sessionState: "in_progress",
    reporterExists: true,
    reporterIsActive: false,
    reporterDepartmentMatchesSession: true,
    reporterIsSessionOwner: false,
    reporterIsSessionHelper: true,
  });
  const completedSession = evaluateSessionDeficiencyReporter({
    sessionState: "completed",
    reporterExists: true,
    reporterIsActive: true,
    reporterDepartmentMatchesSession: true,
    reporterIsSessionOwner: false,
    reporterIsSessionHelper: true,
  });

  assert.equal(crossDepartment.allowed, false);
  assert.equal(crossDepartment.reason, "reporter_department_mismatch");
  assert.equal(inactive.allowed, false);
  assert.equal(inactive.reason, "reporter_inactive");
  assert.equal(completedSession.allowed, false);
  assert.equal(completedSession.reason, "session_inactive");
});

test("U8. Participation credits are one per inspection for owner and helpers, with no owner double-count", () => {
  const credits = buildParticipationCreditCounts([
    {
      inspectionId: "inspection-1",
      ownerMemberId: "tom",
      helperMemberIds: ["adam", "ron", "tom", "adam"],
    },
  ]);

  assert.equal(credits.tom, 1);
  assert.equal(credits.adam, 1);
  assert.equal(credits.ron, 1);
  assert.equal(credits["non-participant"] ?? 0, 0);
});

test("U9. History participant summary omits Assisted By for primary-only inspections", () => {
  const primaryOnly = buildInspectionParticipantSummary({
    inspectorName: "Tom Smith",
    helperNames: [],
  });
  const withHelpers = buildInspectionParticipantSummary({
    inspectorName: "Tom Smith",
    helperNames: ["Adam Smith", "Ron Jones"],
  });

  assert.equal(primaryOnly.inspector, "Tom Smith");
  assert.equal(primaryOnly.assistedBy, null);
  assert.equal(withHelpers.assistedBy, "Adam Smith, Ron Jones");
});

test("U10. Only one inspection row is produced regardless of helper count (rule simulation)", () => {
  const zeroHelpers = buildCompletionFootprint({
    completionAllowed: true,
    helperMemberIds: [],
  });
  const oneHelper = buildCompletionFootprint({
    completionAllowed: true,
    helperMemberIds: ["adam"],
  });
  const twoHelpers = buildCompletionFootprint({
    completionAllowed: true,
    helperMemberIds: ["adam", "ron"],
  });

  assert.equal(zeroHelpers.inspectionRowsCreated, 1);
  assert.equal(oneHelper.inspectionRowsCreated, 1);
  assert.equal(twoHelpers.inspectionRowsCreated, 1);
  assert.equal(twoHelpers.retainedHelperRows, 2);
});
