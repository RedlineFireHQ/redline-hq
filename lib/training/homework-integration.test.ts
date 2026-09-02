import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildHomeworkAssignmentInsert,
  buildCompletedTogetherHomeworkMemberAssignments,
  buildHomeworkMemberAssignments,
  buildHomeworkSubmissionUpdate,
  buildOutstandingRequiredHomework,
  calculateApprovedHomeworkHours,
  canAssignHomework,
  getHomeworkMaterialGate,
  type HomeworkAssignmentLike,
  type HomeworkAssignmentMemberLike,
} from "./homework-integration";
import { buildMemberReadinessScore } from "@/lib/readiness/member-readiness";
import { computeDepartmentScore } from "@/lib/readiness/department-readiness";
import {
  calculateComplianceBucketHours,
  getTrainingComplianceBucketByCategoryName,
} from "@/lib/training/compliance-buckets";

test("HW1. Homework assignment insert payload is built from existing assignment schema", () => {
  const payload = buildHomeworkAssignmentInsert({
    departmentId: "dep-1",
    title: "SCBA Familiarization",
    categoryId: "cat-1",
    description: "Complete module and submit notes",
    dueAt: "2026-09-15T23:59:59.000Z",
    hoursCredit: 2,
    isRequired: true,
    reviewRequired: true,
    supportingDocumentId: "doc-1",
    externalVideoUrl: null,
    externalAudioUrl: null,
    actorMemberId: "member-officer",
  });

  assert.equal(payload.title, "SCBA Familiarization");
  assert.equal(payload.is_required, true);
  assert.equal(payload.review_required, true);
  assert.equal(payload.status, "active");
});

test("HW2. Assignment can target one or more members without duplicates", () => {
  const rows = buildHomeworkMemberAssignments({
    departmentId: "dep-1",
    assignmentId: "assignment-1",
    memberIds: ["m1", "m2", "m1"],
    dueAt: "2026-09-15T23:59:59.000Z",
    actorMemberId: "member-officer",
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.member_id).sort(),
    ["m1", "m2"],
  );
});

test("HW3. Required and optional values are preserved", () => {
  const requiredPayload = buildHomeworkAssignmentInsert({
    departmentId: "dep-1",
    title: "Required Drill",
    categoryId: "cat-1",
    description: null,
    dueAt: null,
    hoursCredit: 1,
    isRequired: true,
    reviewRequired: true,
    supportingDocumentId: null,
    externalVideoUrl: null,
    externalAudioUrl: null,
    actorMemberId: "member-officer",
  });

  const optionalPayload = buildHomeworkAssignmentInsert({
    departmentId: "dep-1",
    title: "Optional Drill",
    categoryId: "cat-1",
    description: null,
    dueAt: null,
    hoursCredit: 1,
    isRequired: false,
    reviewRequired: true,
    supportingDocumentId: null,
    externalVideoUrl: null,
    externalAudioUrl: null,
    actorMemberId: "member-officer",
  });

  assert.equal(requiredPayload.is_required, true);
  assert.equal(optionalPayload.is_required, false);
});

test("HW4. Assigned firefighter sees only their own homework", () => {
  const assignments = new Map<string, HomeworkAssignmentLike>([
    [
      "a1",
      {
        id: "a1",
        title: "SCBA Familiarization",
        category_id: "cat-1",
        due_at: "2026-09-15T23:59:59.000Z",
        hours_credit: 2,
        is_required: true,
        status: "active",
      },
    ],
  ]);

  const rows: HomeworkAssignmentMemberLike[] = [
    {
      id: "am-1",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "assigned",
      hours_earned: null,
      due_at: "2026-09-15T23:59:59.000Z",
    },
    {
      id: "am-2",
      member_id: "m2",
      training_assignment_id: "a1",
      completion_status: "assigned",
      hours_earned: null,
      due_at: "2026-09-15T23:59:59.000Z",
    },
  ];

  const m1Outstanding = buildOutstandingRequiredHomework({
    memberId: "m1",
    assignmentMembers: rows,
    assignmentById: assignments,
  });

  assert.equal(m1Outstanding.length, 1);
  assert.equal(m1Outstanding[0]?.row.member_id, "m1");
});

test("HW5. Firefighter cannot assign homework", () => {
  assert.equal(canAssignHomework("firefighter"), false);
  assert.equal(canAssignHomework("officer"), true);
  assert.equal(canAssignHomework("administrator"), true);
});

test("HW6. Completion submission transitions to pending_review", () => {
  const payload = buildHomeworkSubmissionUpdate("Done and uploaded evidence");
  assert.equal(payload.completion_status, "pending_review");
  assert.equal(payload.completion_notes, "Done and uploaded evidence");
});

test("HW6B. Required assigned materials must be opened before submission", () => {
  const blocked = getHomeworkMaterialGate({
    assignment: {
      supporting_document_id: "doc-1",
      external_video_url: "https://example.com/video",
      external_audio_url: null,
    },
    opened: {
      document: true,
      video: false,
      audio: false,
    },
  });

  assert.equal(blocked.canSubmit, false);
  assert.deepEqual(blocked.missingRequired, ["video"]);

  const allowed = getHomeworkMaterialGate({
    assignment: {
      supporting_document_id: "doc-1",
      external_video_url: "https://example.com/video",
      external_audio_url: null,
    },
    opened: {
      document: true,
      video: true,
      audio: false,
    },
  });

  assert.equal(allowed.canSubmit, true);
  assert.deepEqual(allowed.missingRequired, []);
});

test("HW6C. No-material assignment can submit without material opens", () => {
  const gate = getHomeworkMaterialGate({
    assignment: {
      supporting_document_id: null,
      external_video_url: null,
      external_audio_url: null,
    },
    opened: {
      document: false,
      video: false,
      audio: false,
    },
  });

  assert.equal(gate.canSubmit, true);
  assert.deepEqual(gate.missingRequired, []);
});

test("HW7/HW8/HW13. Only approved homework counts and duplicates are ignored", () => {
  const assignments = new Map<string, HomeworkAssignmentLike>([
    [
      "a1",
      {
        id: "a1",
        title: "SCBA Familiarization",
        category_id: "cat-1",
        due_at: null,
        hours_credit: 2,
        is_required: true,
        status: "active",
      },
    ],
  ]);

  const rows: HomeworkAssignmentMemberLike[] = [
    {
      id: "am-1",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "pending_review",
      hours_earned: 2,
      due_at: null,
    },
    {
      id: "am-1b",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "rejected",
      hours_earned: 2,
      due_at: null,
    },
    {
      id: "am-2",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "approved",
      hours_earned: 2,
      due_at: null,
    },
    {
      id: "am-2",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "approved",
      hours_earned: 2,
      due_at: null,
    },
  ];

  const hours = calculateApprovedHomeworkHours({
    assignmentMembers: rows,
    assignmentById: assignments,
  });

  assert.equal(hours, 2);
});

test("HW9. Approved homework hours feed existing readiness engine", () => {
  const requirementRows = [
    {
      id: "req-1",
      name: "Annual Hours",
      requirement_kind: "annual_hours",
      period_type: "annual",
      minimum_hours: 4,
      category_id: null,
      active: true,
    },
  ];

  const scoreWithoutHomework = buildMemberReadinessScore({
    requirementRows,
    departmentHours: 2,
    evaluationDate: "2026-12-31",
    categoryHours: [],
    categoryNameById: new Map(),
  });

  const scoreWithHomework = buildMemberReadinessScore({
    requirementRows,
    departmentHours: 4,
    evaluationDate: "2026-12-31",
    categoryHours: [],
    categoryNameById: new Map(),
  });

  const trainingFactorWithout = scoreWithoutHomework.factors.find((factor) => factor.category === "training");
  const trainingFactorWith = scoreWithHomework.factors.find((factor) => factor.category === "training");

  assert.equal(trainingFactorWithout?.completionPercent, 50);
  assert.equal(trainingFactorWith?.completionPercent, 100);

  assert.equal(trainingFactorWithout?.completed, false);
  assert.equal(trainingFactorWith?.completed, true);
});

test("HW10/HW11. Outstanding required homework appears and is cleared after approval", () => {
  const assignments = new Map<string, HomeworkAssignmentLike>([
    [
      "a1",
      {
        id: "a1",
        title: "SCBA Familiarization",
        category_id: "cat-1",
        due_at: "2026-09-15T23:59:59.000Z",
        hours_credit: 2,
        is_required: true,
        status: "active",
      },
    ],
  ]);

  const outstandingRows: HomeworkAssignmentMemberLike[] = [
    {
      id: "am-1",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "assigned",
      hours_earned: null,
      due_at: "2026-09-15T23:59:59.000Z",
    },
  ];

  const approvedRows: HomeworkAssignmentMemberLike[] = [
    {
      id: "am-1",
      member_id: "m1",
      training_assignment_id: "a1",
      completion_status: "approved",
      hours_earned: 2,
      due_at: "2026-09-15T23:59:59.000Z",
    },
  ];

  assert.equal(
    buildOutstandingRequiredHomework({ memberId: "m1", assignmentMembers: outstandingRows, assignmentById: assignments }).length,
    1,
  );
  assert.equal(
    buildOutstandingRequiredHomework({ memberId: "m1", assignmentMembers: approvedRows, assignmentById: assignments }).length,
    0,
  );
});

test("HW12. Department readiness increases through existing score composition", () => {
  const before = computeDepartmentScore(80, 90);
  const after = computeDepartmentScore(85, 90);
  assert.equal(before, 83.5);
  assert.equal(after, 86.75);
  assert.ok(after > before);
});

test("HW14/HW15. Homework payloads do not create event attendance or outside submissions", () => {
  const row = buildHomeworkMemberAssignments({
    departmentId: "dep-1",
    assignmentId: "assignment-1",
    memberIds: ["m1"],
    dueAt: null,
    actorMemberId: "member-officer",
  })[0] as Record<string, unknown>;

  assert.equal(Object.hasOwn(row, "training_event_id"), false);
  assert.equal(Object.hasOwn(row, "submission_id"), false);
  assert.equal(Object.hasOwn(row, "training_assignment_id"), true);
});

test("HW16/HW17. Completed-together payload dedupes members and never duplicates actor", () => {
  const rows = buildCompletedTogetherHomeworkMemberAssignments({
    departmentId: "dep-1",
    assignmentId: "assignment-1",
    memberIds: ["m2", "m3", "m2", "member-firefighter"],
    dueAt: "2026-09-15T23:59:59.000Z",
    actorMemberId: "member-firefighter",
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.member_id).sort(),
    ["m2", "m3"],
  );
  assert.equal(rows.every((row) => row.completion_status === "pending_review"), true);
});

test("HW18. Completed-together payload never grants approval or training hours", () => {
  const rows = buildCompletedTogetherHomeworkMemberAssignments({
    departmentId: "dep-1",
    assignmentId: "assignment-1",
    memberIds: ["m2", "m3"],
    dueAt: "2026-09-15T23:59:59.000Z",
    actorMemberId: "member-firefighter",
  }) as Array<Record<string, unknown>>;

  for (const row of rows) {
    assert.equal(row.completion_status, "pending_review");
    assert.equal(Object.hasOwn(row, "hours_earned"), false);
    assert.equal(Object.hasOwn(row, "reviewed_by"), false);
    assert.equal(Object.hasOwn(row, "reviewed_at"), false);
    assert.equal(Object.hasOwn(row, "review_notes"), false);
  }
});

test("HW19. Completed-together payload is pinned to one existing assignment id", () => {
  const rows = buildCompletedTogetherHomeworkMemberAssignments({
    departmentId: "dep-1",
    assignmentId: "assignment-source-1",
    memberIds: ["m2", "m3", "m4"],
    dueAt: null,
    actorMemberId: "member-firefighter",
  });

  assert.equal(rows.length, 3);
  assert.equal(rows.every((row) => row.training_assignment_id === "assignment-source-1"), true);
});

test("HW20. Completed-together migration guardrails enforce secure same-assignment behavior", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20260820040000_add_homework_completed_together_rpc.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /where\s+am\.id\s*=\s*p_source_assignment_member_id[\s\S]*am\.member_id\s*=\s*v_requester_id[\s\S]*am\.department_id\s*=\s*v_requester_department_id/i);
  assert.match(sql, /am\.completion_status/i);
  assert.match(sql, /if\s+v_source_completion_status\s*<>\s*'pending_review'\s+then/i);
  assert.match(sql, /submit your own homework for review before adding members who completed it with you/i);
  assert.match(sql, /coalesce\(m\.active,\s*true\)\s*=\s*true/i);
  assert.match(sql, /select\s+distinct\s+x\.member_id/i);
  assert.match(sql, /x\.member_id\s*<>\s*v_requester_id/i);
  assert.match(sql, /if\s+v_target_count\s*>\s*25\s+then/i);
  assert.match(sql, /insert\s+into\s+public\.training_assignment_members/i);
  assert.match(sql, /v_assignment_id/i);
  assert.match(sql, /'pending_review'/i);
  assert.match(sql, /hours_earned\s*=\s*null/i);
  assert.match(sql, /where\s+public\.training_assignment_members\.completion_status\s*<>\s*'approved'/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.training_assignments/i);
});

test("HW21. Source row status gating blocks assigned/in_progress/rejected/approved and allows pending_review", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20260820040000_add_homework_completed_together_rpc.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /v_source_completion_status/i);
  assert.match(sql, /<>\s*'pending_review'/i);
  assert.doesNotMatch(sql, /=\s*'assigned'\s+then/i);
  assert.doesNotMatch(sql, /=\s*'in_progress'\s+then/i);
  assert.doesNotMatch(sql, /=\s*'rejected'\s+then/i);
  assert.doesNotMatch(sql, /=\s*'approved'\s+then/i);
});

test("HW22. Mixed Fire + EMS hours stay separated for annual compliance", () => {
  const categoryNameById = new Map<string, string>([
    ["fire-suppression", "Fire Suppression"],
    ["ems", "EMS"],
    ["driver-operator", "Driver/Operator"],
  ]);

  const totals = calculateComplianceBucketHours(
    [
      { categoryId: "fire-suppression", hours: 10 },
      { categoryId: "ems", hours: 2 },
      { categoryId: "driver-operator", hours: 4 },
    ],
    categoryNameById,
  );

  assert.equal(totals.fireAnnualHours, 14);
  assert.equal(totals.emsContinuingEducationHours, 2);
  assert.equal(totals.totalHours, 16);
});

test("HW23. EMS hours do not satisfy Fire annual requirement progress", () => {
  const requirementRows = [
    {
      id: "req-annual",
      name: "Required Annual Training Hours",
      requirement_kind: "annual_hours",
      period_type: "annual",
      minimum_hours: 24,
      category_id: null,
      active: true,
    },
  ];

  const score = buildMemberReadinessScore({
    requirementRows,
    departmentHours: 14,
    evaluationDate: "2026-12-31",
    categoryHours: [
      { categoryId: "fire-suppression", categoryName: "Fire Suppression", hours: 10 },
      { categoryId: "ems", categoryName: "EMS", hours: 2 },
      { categoryId: "driver-operator", categoryName: "Driver/Operator", hours: 4 },
    ],
    categoryNameById: new Map([
      ["fire-suppression", "Fire Suppression"],
      ["ems", "EMS"],
      ["driver-operator", "Driver/Operator"],
    ]),
  });

  const annualFactor = score.factors.find((factor) => factor.id === "req-annual");
  assert.equal(annualFactor?.currentValue, "14.00 hrs");
  assert.equal(annualFactor?.requiredValue, "24.00 hrs");
  assert.equal(annualFactor?.completed, false);
});

test("HW24. Fire category behavior remains intact for known ISO/Fire categories", () => {
  assert.equal(getTrainingComplianceBucketByCategoryName("Fire Suppression"), "fire_annual");
  assert.equal(getTrainingComplianceBucketByCategoryName("Driver/Operator"), "fire_annual");
  assert.equal(getTrainingComplianceBucketByCategoryName("Hazmat"), "fire_annual");
});

test("HW25. EMS and Other categories are excluded from Fire annual bucket", () => {
  assert.equal(getTrainingComplianceBucketByCategoryName("EMS"), "ems_ce");
  assert.equal(getTrainingComplianceBucketByCategoryName("Other"), "other");
  assert.equal(getTrainingComplianceBucketByCategoryName("Fire Prevention/Public Education"), "other");
});
