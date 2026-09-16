import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calculateDepartmentComposite,
  computeDepartmentScore,
  deriveDepartmentReadinessStatus,
  filterCoachActionsForRole,
  getParticipatingApparatusScores,
  simulateConditionScoreAfterResolvingSingleIssue,
  simulateMaintenanceScoreAfterResolvingSingleRequirement,
  simulateMemberScoreForResolvedCoachFactor,
  sortCoachActions,
  type DepartmentReadinessCoachAction,
} from "@/lib/readiness/department-readiness";

test("DR1. 65/35 formula computes weighted department score", () => {
  const score = computeDepartmentScore(92, 80);
  assert.equal(score, 87.8);
});

test("DR2. No participating apparatus falls back to personnel score", () => {
  const score = calculateDepartmentComposite({
    personnelScore: 91.25,
    apparatusScore: null,
    scoredMemberCount: 8,
    participatingApparatusCount: 0,
  });
  assert.equal(score, 91.25);
});

test("DR2A. Included but unscoreable apparatus still falls back to personnel score", () => {
  const includedRows = [
    { includeInDepartmentReadiness: true, readinessState: "evaluated" as const, scorePercent: null },
    { includeInDepartmentReadiness: true, readinessState: "evaluation_error" as const, scorePercent: null },
  ];

  const participatingScores = getParticipatingApparatusScores(includedRows);
  assert.deepEqual(participatingScores, []);

  const score = calculateDepartmentComposite({
    personnelScore: 91.25,
    apparatusScore: null,
    scoredMemberCount: 8,
    participatingApparatusCount: participatingScores.length,
  });

  assert.equal(score, 91.25);
});

test("DR3. Zero scored members returns NOT YET RATED state", () => {
  const score = calculateDepartmentComposite({
    personnelScore: null,
    apparatusScore: 88,
    scoredMemberCount: 0,
    participatingApparatusCount: 4,
  });
  assert.equal(score, null);

  const status = deriveDepartmentReadinessStatus(score);
  assert.equal(status.status, "not_yet_rated");
  assert.equal(status.notYetRated, true);
});

test("DR4. 90.00 boundary is REDLINE READY", () => {
  const status = deriveDepartmentReadinessStatus(90);
  assert.equal(status.status, "redline_ready");
});

test("DR5. 89.99 boundary is NOT REDLINE READY", () => {
  const status = deriveDepartmentReadinessStatus(89.99);
  assert.equal(status.status, "not_redline_ready");
});

test("DR6. 80.00 boundary is NOT REDLINE READY", () => {
  const status = deriveDepartmentReadinessStatus(80);
  assert.equal(status.status, "not_redline_ready");
});

test("DR7. 79.99 boundary is NEEDS ATTENTION", () => {
  const status = deriveDepartmentReadinessStatus(79.99);
  assert.equal(status.status, "needs_attention");
});

test("DR8. Single training action improves only training contribution", () => {
  const simulated = simulateMemberScoreForResolvedCoachFactor({
    readinessState: {
      configured: true,
      configurationState: "configured",
      configurationMessage: "Configured",
      scorePercent: 80,
      remainingPercent: 20,
      qualificationsScore: 8,
      qualificationsMaxScore: 10,
      qualificationsStatus: "missing",
      missingQualifications: ["Driver"],
      completedRequirements: 1,
      incompleteRequirements: 2,
      deficiencyPenaltyPercent: 2.5,
      deficiencyCategoryMaxPercent: 10,
      deficiencyImpactingCount: 1,
      factors: [
        {
          id: "training-1",
          title: "Training",
          category: "training",
          statusLabel: "Incomplete",
          appliesTo: "All",
          unitLabel: "hours",
          periodLabel: "Annual",
          standardReference: null,
          requiredValue: "12",
          currentValue: "6",
          completionPercent: 50,
          completed: false,
          actionNeeded: "Complete training",
        },
        {
          id: "cert-1",
          title: "Cert",
          category: "certification",
          statusLabel: "Current",
          appliesTo: "All",
          unitLabel: "cert",
          periodLabel: "Annual",
          standardReference: null,
          requiredValue: "Current",
          currentValue: "Current",
          completionPercent: 100,
          completed: true,
          actionNeeded: "No action",
        },
      ],
      coachItems: [],
    },
    factorId: "training-1",
    highestDeficiencyPenaltyPercent: 2.5,
  });

  assert.equal(simulated, 95.5);
});

test("DR9. Member with multiple issues only gets credit for one resolved action", () => {
  const readinessState = {
    configured: true,
    configurationState: "configured",
    configurationMessage: "Configured",
    scorePercent: 67,
    remainingPercent: 33,
    qualificationsScore: 10,
    qualificationsMaxScore: 10,
    qualificationsStatus: "complete",
    missingQualifications: [],
    completedRequirements: 1,
    incompleteRequirements: 2,
    deficiencyPenaltyPercent: 10,
    deficiencyCategoryMaxPercent: 10,
    deficiencyImpactingCount: 2,
    factors: [
      {
        id: "training-1",
        title: "Training",
        category: "training",
        statusLabel: "Incomplete",
        appliesTo: "All",
        unitLabel: "hours",
        periodLabel: "Annual",
        standardReference: null,
        requiredValue: "12",
        currentValue: "6",
        completionPercent: 50,
        completed: false,
        actionNeeded: "Complete training",
      },
      {
        id: "cert-1",
        title: "Cert",
        category: "certification",
        statusLabel: "Expired",
        appliesTo: "All",
        unitLabel: "cert",
        periodLabel: "Annual",
        standardReference: null,
        requiredValue: "Current",
        currentValue: "Expired",
        completionPercent: 0,
        completed: false,
        actionNeeded: "Renew cert",
      },
      {
        id: "deficiencies-current-responsibility",
        title: "Deficiencies",
        category: "other",
        statusLabel: "Impacting",
        appliesTo: "Member",
        unitLabel: "%",
        periodLabel: "Active",
        standardReference: null,
        requiredValue: "0",
        currentValue: "10.0% penalty",
        completionPercent: 0,
        completed: false,
        actionNeeded: "Resolve deficiency",
      },
    ],
    coachItems: [],
  } as const;

  const trainingOnly = simulateMemberScoreForResolvedCoachFactor({
    readinessState: readinessState as any,
    factorId: "training-1",
    highestDeficiencyPenaltyPercent: 5,
  });
  const certOnly = simulateMemberScoreForResolvedCoachFactor({
    readinessState: readinessState as any,
    factorId: "cert-1",
    highestDeficiencyPenaltyPercent: 5,
  });
  const deficiencyOnly = simulateMemberScoreForResolvedCoachFactor({
    readinessState: readinessState as any,
    factorId: "deficiencies-current-responsibility",
    highestDeficiencyPenaltyPercent: 5,
  });

  assert.equal(trainingOnly, 50);
  assert.equal(certOnly, 70);
  assert.equal(deficiencyOnly, 35);
  assert.notEqual(trainingOnly, 100);
  assert.notEqual(certOnly, 100);
  assert.notEqual(deficiencyOnly, 100);
});

test("DR10. Single apparatus condition issue does not clear unrelated condition issues", () => {
  const next = simulateConditionScoreAfterResolvingSingleIssue({
    currentConditionScore: 0,
    minorCount: 0,
    significantCount: 3,
    criticalCount: 1,
  });

  assert.equal(next, 25);
  assert.notEqual(next, 40);
});

test("DR11. 65/35 composite remains exact", () => {
  const department = computeDepartmentScore(88, 76);
  assert.equal(department, 83.8);
});

test("DR11A. 65/35 lock remains unchanged", () => {
  const personnel = 92;
  const apparatus = 80;
  const expected = Math.round((0.65 * personnel + 0.35 * apparatus) * 100) / 100;
  assert.equal(computeDepartmentScore(personnel, apparatus), expected);
});

test("DR12. Excluded apparatus contributes nothing", () => {
  const scores = getParticipatingApparatusScores([
    { includeInDepartmentReadiness: true, readinessState: "evaluated", scorePercent: 70 },
    { includeInDepartmentReadiness: false, readinessState: "evaluated", scorePercent: 20 },
    { includeInDepartmentReadiness: false, readinessState: "evaluation_error", scorePercent: null },
  ]);

  assert.deepEqual(scores, [70]);
});

test("DR13. Included apparatus contributes equally", () => {
  const scores = getParticipatingApparatusScores([
    { includeInDepartmentReadiness: true, readinessState: "evaluated", scorePercent: 100 },
    { includeInDepartmentReadiness: true, readinessState: "evaluated", scorePercent: 50 },
  ]);

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  assert.equal(average, 75);
});

test("DR14. Migration sets include_in_department_readiness default true", () => {
  const migrationPath = resolve(process.cwd(), "supabase/migrations/20260819020000_add_apparatus_department_readiness_participation.sql");
  const migrationSql = readFileSync(migrationPath, "utf8");

  assert.match(migrationSql, /include_in_department_readiness\s+boolean/i);
  assert.match(migrationSql, /default\s+true/i);
  assert.match(migrationSql, /not\s+null/i);
});

test("DR15. Coach actions are ranked by highest impact first", () => {
  const actions: DepartmentReadinessCoachAction[] = [
    {
      id: "a",
      title: "A",
      description: "A",
      href: "/a",
      ownerLabel: "A",
      category: "personnel",
      audience: "all",
      potentialDepartmentImpactPercent: 0.5,
    },
    {
      id: "b",
      title: "B",
      description: "B",
      href: "/b",
      ownerLabel: "B",
      category: "apparatus",
      audience: "officer_admin",
      potentialDepartmentImpactPercent: 2.1,
    },
    {
      id: "c",
      title: "C",
      description: "C",
      href: "/c",
      ownerLabel: "C",
      category: "personnel",
      audience: "all",
      potentialDepartmentImpactPercent: null,
    },
  ];

  const sorted = sortCoachActions(actions);
  assert.deepEqual(
    sorted.map((action) => action.id),
    ["b", "a", "c"],
  );

  const topFive = sorted.slice(0, 5);
  const remaining = sorted.slice(5);
  assert.equal(topFive.length, 3);
  assert.equal(remaining.length, 0);
});

test("DR16. Firefighter view filters to audience='all' actions", () => {
  const actions: DepartmentReadinessCoachAction[] = [
    {
      id: "all",
      title: "All",
      description: "All",
      href: "/all",
      ownerLabel: "All",
      category: "personnel",
      audience: "all",
      potentialDepartmentImpactPercent: 0.8,
    },
    {
      id: "officer",
      title: "Officer",
      description: "Officer",
      href: "/officer",
      ownerLabel: "Officer",
      category: "apparatus",
      audience: "officer_admin",
      potentialDepartmentImpactPercent: 1.2,
    },
  ];

  const firefighterActions = filterCoachActionsForRole(actions, "firefighter");
  const officerActions = filterCoachActionsForRole(actions, "officer");

  assert.deepEqual(firefighterActions.map((action) => action.id), ["all"]);
  assert.deepEqual(officerActions.map((action) => action.id), ["all", "officer"]);
});

test("DR16A. Full permission coverage allows firefighter-role managers to see department actions", () => {
  const actions: DepartmentReadinessCoachAction[] = [
    {
      id: "all",
      title: "All audience",
      description: "All members can see this.",
      href: "/my-readiness",
      ownerLabel: "Member",
      category: "personnel",
      audience: "all",
      potentialDepartmentImpactPercent: 1,
    },
    {
      id: "officer",
      title: "Department action",
      description: "Managers can see this.",
      href: "/training",
      ownerLabel: "Member",
      category: "personnel",
      audience: "officer_admin",
      potentialDepartmentImpactPercent: 2,
    },
  ];

  const normalFirefighterActions = filterCoachActionsForRole(actions, "firefighter");
  const grantAllActions = filterCoachActionsForRole(actions, "firefighter", true);

  assert.deepEqual(normalFirefighterActions.map((action) => action.id), ["all"]);
  assert.deepEqual(grantAllActions.map((action) => action.id), ["all", "officer"]);
});

test("DR17. One qualification action resolves only that qualification and does not over-credit", () => {
  const readinessState = {
    configured: true,
    configurationState: "configured",
    configurationMessage: "Configured",
    scorePercent: 93.3,
    remainingPercent: 6.7,
    qualificationsScore: 3.3333333333,
    qualificationsMaxScore: 10,
    qualificationsStatus: "missing",
    missingQualifications: ["Driver", "Pump Ops"],
    completedRequirements: 2,
    incompleteRequirements: 1,
    deficiencyPenaltyPercent: 0,
    deficiencyCategoryMaxPercent: 10,
    deficiencyImpactingCount: 0,
    factors: [
      {
        id: "training-1",
        title: "Training",
        category: "training",
        statusLabel: "Complete",
        appliesTo: "All",
        unitLabel: "hours",
        periodLabel: "Annual",
        standardReference: null,
        requiredValue: "12",
        currentValue: "12",
        completionPercent: 100,
        completed: true,
        actionNeeded: "No action",
      },
      {
        id: "cert-1",
        title: "Cert",
        category: "certification",
        statusLabel: "Current",
        appliesTo: "All",
        unitLabel: "cert",
        periodLabel: "Annual",
        standardReference: null,
        requiredValue: "Current",
        currentValue: "Current",
        completionPercent: 100,
        completed: true,
        actionNeeded: "No action",
      },
      {
        id: "qualifications-current-role",
        title: "Qualifications (Current Role)",
        category: "qualification",
        statusLabel: "Missing Required Qualifications",
        appliesTo: "Engineer",
        unitLabel: "qualifications",
        periodLabel: "Current",
        standardReference: null,
        requiredValue: "10.0 / 10",
        currentValue: "3.3 / 10",
        completionPercent: 33.3333333333,
        completed: false,
        actionNeeded: "Complete missing qualifications",
      },
    ],
    coachItems: [],
  } as const;

  const oneQualificationResolved = simulateMemberScoreForResolvedCoachFactor({
    readinessState: readinessState as any,
    factorId: "qualifications-current-role",
    highestDeficiencyPenaltyPercent: 0,
    resolvedQualificationName: "Driver",
  });

  const unknownQualification = simulateMemberScoreForResolvedCoachFactor({
    readinessState: readinessState as any,
    factorId: "qualifications-current-role",
    highestDeficiencyPenaltyPercent: 0,
    resolvedQualificationName: "Not In Missing List",
  });

  assert.equal(oneQualificationResolved, 96.7);
  assert.equal(unknownQualification, 93.3);
  assert.notEqual(oneQualificationResolved, 100);
});

test("DR18. One maintenance issue simulation updates only targeted requirement", () => {
  const maintenanceRequirements = [
    {
      requirementId: "req-a",
      name: "Pump PM",
      methods: [
        {
          methodType: "time_days",
          intervalValue: 100,
          dueSoonThresholdValue: 10,
          earlyOverdueThresholdValue: 20,
          moderateOverdueThresholdValue: 40,
          elapsedSinceService: 200,
        },
      ],
    },
    {
      requirementId: "req-b",
      name: "Generator PM",
      methods: [
        {
          methodType: "time_days",
          intervalValue: 100,
          dueSoonThresholdValue: 10,
          earlyOverdueThresholdValue: 20,
          moderateOverdueThresholdValue: 40,
          elapsedSinceService: 130,
        },
      ],
    },
  ] as const;

  const original = JSON.parse(JSON.stringify(maintenanceRequirements));

  const resolvingModerateOnly = simulateMaintenanceScoreAfterResolvingSingleRequirement({
    maintenanceRequirements: maintenanceRequirements as any,
    currentMaintenanceScore: 0,
    requirementId: "req-b",
  });

  const resolvingSevereOnly = simulateMaintenanceScoreAfterResolvingSingleRequirement({
    maintenanceRequirements: maintenanceRequirements as any,
    currentMaintenanceScore: 0,
    requirementId: "req-a",
  });

  assert.equal(resolvingModerateOnly, 0);
  assert.equal(resolvingSevereOnly, 10);
  assert.deepEqual(maintenanceRequirements, original);
});

test("DR19. Department impact recomputes from one-issue maintenance delta using 65/35", () => {
  const oldDepartment = computeDepartmentScore(82.4, 78.2);
  const maintenanceDelta = 10;
  const apparatusCount = 5;
  const newApparatus = 78.2 + maintenanceDelta / apparatusCount;
  const newDepartment = computeDepartmentScore(82.4, newApparatus);
  const impact = Math.round((newDepartment - oldDepartment) * 100) / 100;

  assert.equal(oldDepartment, 80.93);
  assert.equal(newDepartment, 81.63);
  assert.equal(impact, 0.7);
});
