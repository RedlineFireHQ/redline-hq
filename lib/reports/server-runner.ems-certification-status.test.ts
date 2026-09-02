import assert from "node:assert/strict";
import test from "node:test";

import { calculateEmsReadiness, type EmsManualAllocation, type EmsTrainingRecord } from "@/lib/ems/calculation";
import { IOWA_REQUIREMENTS } from "@/lib/ems/requirements";
import { runReport } from "./server-runner";
import type { ReportRunRequest, ReportRunResponse } from "./types";

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

function formatDateOnly(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(days: number) {
  const base = new Date();
  const utc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days);
  return formatDateOnly(new Date(utc));
}

function parseComparableDateLabel(value: string) {
  if (!value || value === "No Expiration" || value === "-") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDateOnly(parsed);
}

function makeRequest(filters: Record<string, string>): ReportRunRequest {
  return {
    category: "ems",
    searchTerm: "",
    dateRange: {
      preset: "custom",
      from: "2025-01-01",
      to: "2030-12-31",
    },
    filters,
    page: 1,
    pageSize: 200,
  };
}

function applyFilters(rows: Row[], filters: Array<{ key: string; op: "eq" | "in" | "gte" | "lt"; value: unknown }>) {
  return rows.filter((row) => {
    for (const filter of filters) {
      const rawValue = row[filter.key];

      if (filter.op === "eq") {
        if (rawValue !== filter.value) {
          return false;
        }
        continue;
      }

      if (filter.op === "in") {
        if (!Array.isArray(filter.value) || !filter.value.includes(rawValue)) {
          return false;
        }
        continue;
      }

      if (filter.op === "gte") {
        if (typeof rawValue !== "string" || typeof filter.value !== "string" || rawValue < filter.value) {
          return false;
        }
        continue;
      }

      if (filter.op === "lt") {
        if (typeof rawValue !== "string" || typeof filter.value !== "string" || rawValue >= filter.value) {
          return false;
        }
      }
    }

    return true;
  });
}

function createSupabaseMock(tableData: TableData) {
  class QueryBuilder {
    private readonly tableName: string;
    private readonly rows: Row[];
    private readonly filters: Array<{ key: string; op: "eq" | "in" | "gte" | "lt"; value: unknown }> = [];
    private readonly orderBy: Array<{ key: string; ascending: boolean }> = [];

    constructor(tableName: string) {
      this.tableName = tableName;
      this.rows = tableData[tableName] ?? [];
    }

    select() {
      return this;
    }

    eq(key: string, value: unknown) {
      this.filters.push({ key, op: "eq", value });
      return this;
    }

    in(key: string, values: unknown[]) {
      this.filters.push({ key, op: "in", value: values });
      return this;
    }

    gte(key: string, value: unknown) {
      this.filters.push({ key, op: "gte", value });
      return this;
    }

    lt(key: string, value: unknown) {
      this.filters.push({ key, op: "lt", value });
      return this;
    }

    order(key: string, options?: { ascending?: boolean }) {
      this.orderBy.push({ key, ascending: options?.ascending !== false });
      return this;
    }

    then(resolve: (value: { data: Row[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      try {
        let data = applyFilters(this.rows, this.filters);
        for (const order of this.orderBy) {
          data = [...data].sort((left, right) => {
            const leftValue = left[order.key];
            const rightValue = right[order.key];
            const leftComparable = typeof leftValue === "string" ? leftValue : String(leftValue ?? "");
            const rightComparable = typeof rightValue === "string" ? rightValue : String(rightValue ?? "");
            return order.ascending
              ? leftComparable.localeCompare(rightComparable)
              : rightComparable.localeCompare(leftComparable);
          });
        }

        return Promise.resolve(resolve({ data, error: null }));
      } catch (error) {
        if (reject) {
          return Promise.resolve(reject(error));
        }

        throw error;
      }
    }
  }

  return {
    from(tableName: string) {
      return new QueryBuilder(tableName);
    },
  };
}

function getRowByMember(rows: Row[], memberName: string) {
  const row = rows.find((item) => item.member_name === memberName);
  assert.ok(row, `Expected report row for ${memberName}`);
  return row;
}

test("EMS certification-status report matches existing readiness engine behavior and supports EMS filters", async () => {
  const departmentId = "dep-a";
  const otherDepartmentId = "dep-b";

  const memberData = [
    { id: "m1", department_id: departmentId, first_name: "Alex", last_name: "IowaTrack" },
    { id: "m2", department_id: departmentId, first_name: "Bailey", last_name: "NoNremt" },
    { id: "m3", department_id: departmentId, first_name: "Casey", last_name: "NoTrack" },
    { id: "m4", department_id: departmentId, first_name: "Dana", last_name: "NeedsAttention" },
    { id: "m5", department_id: departmentId, first_name: "Evan", last_name: "NotMaintained" },
    { id: "m6", department_id: departmentId, first_name: "Finley", last_name: "NextSixty" },
    { id: "m7", department_id: departmentId, first_name: "Gray", last_name: "NextNinety" },
    { id: "m8", department_id: otherDepartmentId, first_name: "Other", last_name: "Department" },
  ];

  const iowaRequirement = IOWA_REQUIREMENTS.emt;
  const iowaCompletionSourceId = "cs-m2-complete";

  const profileRows = [
    {
      id: "p-m1-iowa",
      department_id: departmentId,
      member_id: "m1",
      track: "iowa",
      certification_level: "emt",
      track_status: "active",
      maintain_track: true,
      certification_number: "IA-1001",
      expiration_date: addDays(20),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m1-nremt",
      department_id: departmentId,
      member_id: "m1",
      track: "nremt",
      certification_level: "emt",
      track_status: "active",
      maintain_track: true,
      certification_number: "NR-2001",
      expiration_date: addDays(70),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m2-iowa",
      department_id: departmentId,
      member_id: "m2",
      track: "iowa",
      certification_level: "emt",
      track_status: "active",
      maintain_track: true,
      certification_number: "IA-1002",
      expiration_date: addDays(-5),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m2-nremt",
      department_id: departmentId,
      member_id: "m2",
      track: "nremt",
      certification_level: "emt",
      track_status: "not_maintained",
      maintain_track: false,
      certification_number: "NR-2002",
      expiration_date: addDays(15),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m4-iowa",
      department_id: departmentId,
      member_id: "m4",
      track: "iowa",
      certification_level: "aemt",
      track_status: "active",
      maintain_track: true,
      certification_number: "IA-1004",
      expiration_date: addDays(35),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m5-iowa",
      department_id: departmentId,
      member_id: "m5",
      track: "iowa",
      certification_level: "emr",
      track_status: "not_maintained",
      maintain_track: true,
      certification_number: "IA-1005",
      expiration_date: addDays(120),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m6-iowa",
      department_id: departmentId,
      member_id: "m6",
      track: "iowa",
      certification_level: "aemt",
      track_status: "active",
      maintain_track: true,
      certification_number: "IA-1006",
      expiration_date: addDays(45),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m7-iowa",
      department_id: departmentId,
      member_id: "m7",
      track: "iowa",
      certification_level: "paramedic",
      track_status: "active",
      maintain_track: true,
      certification_number: "IA-1007",
      expiration_date: addDays(80),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
    {
      id: "p-m8-iowa",
      department_id: otherDepartmentId,
      member_id: "m8",
      track: "iowa",
      certification_level: "emt",
      track_status: "active",
      maintain_track: true,
      certification_number: "IA-9999",
      expiration_date: addDays(25),
      effective_start_date: "2026-01-01",
      effective_end_date: null,
    },
  ];

  const sourceRows = [
    {
      id: "cs-m1-1",
      department_id: departmentId,
      member_id: "m1",
      source_type: "training_event_attendance",
      source_record_id: "te-1",
      source_occurred_at: "2026-02-01",
      source_hours: 6,
      ems_core_topic: "cardiology",
      approval_state: "approved",
    },
    {
      id: "cs-m1-2",
      department_id: departmentId,
      member_id: "m1",
      source_type: "training_event_attendance",
      source_record_id: "te-2",
      source_occurred_at: "2026-03-01",
      source_hours: 4,
      ems_core_topic: "trauma",
      approval_state: "approved",
    },
    {
      id: "cs-m1-3",
      department_id: departmentId,
      member_id: "m1",
      source_type: "training_outside_submission",
      source_record_id: "os-1",
      source_occurred_at: "2026-04-01",
      source_hours: 7,
      ems_core_topic: "other",
      approval_state: "approved",
    },
    {
      id: "cs-m1-4",
      department_id: departmentId,
      member_id: "m1",
      source_type: "training_event_attendance",
      source_record_id: "te-3",
      source_occurred_at: "2026-05-01",
      source_hours: 5,
      ems_core_topic: "medical",
      approval_state: "needs_review",
    },
    {
      id: iowaCompletionSourceId,
      department_id: departmentId,
      member_id: "m2",
      source_type: "training_event_attendance",
      source_record_id: "te-complete",
      source_occurred_at: "2026-02-10",
      source_hours: 1,
      ems_core_topic: "other",
      approval_state: "approved",
    },
    {
      id: "cs-m6-1",
      department_id: departmentId,
      member_id: "m6",
      source_type: "training_event_attendance",
      source_record_id: "te-6",
      source_occurred_at: "2026-06-01",
      source_hours: 2,
      ems_core_topic: "operations",
      approval_state: "approved",
    },
    {
      id: "cs-m7-1",
      department_id: departmentId,
      member_id: "m7",
      source_type: "training_event_attendance",
      source_record_id: "te-7",
      source_occurred_at: "2026-06-15",
      source_hours: 3,
      ems_core_topic: "medical",
      approval_state: "approved",
    },
    {
      id: "cs-m8-1",
      department_id: otherDepartmentId,
      member_id: "m8",
      source_type: "training_event_attendance",
      source_record_id: "te-8",
      source_occurred_at: "2026-01-20",
      source_hours: 25,
      ems_core_topic: "cardiology",
      approval_state: "approved",
    },
  ];

  const allocationRows: Row[] = iowaRequirement.topicRequirements.map((topic, index) => ({
    member_id: "m2",
    credit_source_id: iowaCompletionSourceId,
    allocated_hours: topic.requiredHours,
    allocation_status: "manual_override",
    is_manual_override: true,
    requirement_set: { authority: "iowa" },
    requirement_component: { component_code: "core" },
    requirement_topic: { topic_code: topic.topic },
    sort_index: index,
    department_id: departmentId,
  }));

  allocationRows.push({
    member_id: "m1",
    credit_source_id: "cs-m1-2",
    allocated_hours: 2,
    allocation_status: "manual_override",
    is_manual_override: true,
    requirement_set: { authority: "nremt" },
    requirement_component: { component_code: "local_state_component" },
    requirement_topic: { topic_code: null },
    department_id: departmentId,
  });

  const supabase = createSupabaseMock({
    members: memberData,
    ems_member_track_profiles: profileRows,
    ems_credit_sources: sourceRows,
    ems_credit_allocations: allocationRows,
    ems_equipment: [],
    ems_supply_items: [],
    ems_supply_transaction_items: [],
    member_certifications: [],
    training_categories: [],
    training_event_attendance: [],
    training_outside_submissions: [],
  });

  const context = {
    supabase,
    departmentId,
    departmentName: "Department A",
    memberRole: "owner",
  } as never;

  const baseFilters = {
    report_type: "certification-status",
    report_scope: "iowa-and-nremt",
    member_id: "all",
    ems_level: "all",
    iowa_status: "all",
    nremt_maintained: "all",
    readiness_status: "all",
    expiration_window: "all",
  };

  const response = await runReport(makeRequest(baseFilters), context);
  assert.equal(response.ok, true);

  const payload = response as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(payload.source.key, "ems");
  assert.equal(payload.period.basisLabel, "Certification Snapshot Date");
  assert.equal(payload.rows.length, 6, "All Members + NREMT All should return EMS-track members only");
  const combinedColumnKeys = new Set(payload.columns.map((column) => column.key));
  assert.equal(combinedColumnKeys.has("iowa_progress"), true);
  assert.equal(combinedColumnKeys.has("nremt_progress"), true);
  assert.equal(combinedColumnKeys.has("iowa_required"), false);
  assert.equal(combinedColumnKeys.has("iowa_remaining"), false);
  assert.equal(combinedColumnKeys.has("iowa_airway_progress"), true);
  assert.equal(combinedColumnKeys.has("nremt_required"), false);
  assert.equal(combinedColumnKeys.has("nremt_remaining"), false);
  assert.equal(combinedColumnKeys.has("nremt_national_component_progress"), true);

  const rowM1 = getRowByMember(payload.rows, "Alex IowaTrack");
  const rowM2 = getRowByMember(payload.rows, "Bailey NoNremt");
  assert.equal(payload.rows.some((row) => row.member_name === "Casey NoTrack"), false, "Members with no EMS track should be excluded from EMS Certification Status roster");

  const profileM1Iowa = {
    level: "emt" as const,
    status: "active" as const,
    expirationDate: String(profileRows.find((row) => row.id === "p-m1-iowa")?.expiration_date ?? ""),
    maintainTrack: true,
  };
  const profileM1Nremt = {
    level: "emt" as const,
    status: "active" as const,
    expirationDate: String(profileRows.find((row) => row.id === "p-m1-nremt")?.expiration_date ?? ""),
    maintainTrack: true,
  };

  const trainingM1: EmsTrainingRecord[] = [
    {
      id: "training_event_attendance:te-1",
      occurredAt: "2026-02-01",
      hours: 6,
      coreTopic: "cardiology",
      needsReview: false,
      eligibleForIowa: true,
      eligibleForNremt: true,
      pediatricTagged: false,
    },
    {
      id: "training_event_attendance:te-2",
      occurredAt: "2026-03-01",
      hours: 4,
      coreTopic: "trauma",
      needsReview: false,
      eligibleForIowa: true,
      eligibleForNremt: true,
      pediatricTagged: false,
    },
    {
      id: "training_outside_submission:os-1",
      occurredAt: "2026-04-01",
      hours: 7,
      coreTopic: "other",
      needsReview: false,
      eligibleForIowa: true,
      eligibleForNremt: true,
      pediatricTagged: false,
    },
    {
      id: "training_event_attendance:te-3",
      occurredAt: "2026-05-01",
      hours: 5,
      coreTopic: "medical",
      needsReview: true,
      eligibleForIowa: true,
      eligibleForNremt: true,
      pediatricTagged: false,
    },
  ];

  const manualM1: EmsManualAllocation[] = [
    {
      recordId: "training_event_attendance:te-2",
      track: "nremt",
      component: "local_state_component",
      topic: null,
      hours: 2,
    },
  ];

  const expectedM1 = calculateEmsReadiness({
    iowaProfile: profileM1Iowa,
    nremtProfile: profileM1Nremt,
    trainingRecords: trainingM1,
    manualAllocations: manualM1,
  });

  assert.equal(rowM1.iowa_progress, `${expectedM1.iowa.totalCompleted.toFixed(2)} / ${expectedM1.iowa.totalRequired.toFixed(2)}`);
  assert.equal(rowM1.nremt_progress, `${expectedM1.nremt.totalCompleted.toFixed(2)} / ${expectedM1.nremt.totalRequired.toFixed(2)}`);
  assert.equal(rowM1.nremt_maintained, "Yes");
  assert.equal(parseComparableDateLabel(String(rowM1.iowa_expires_at)), profileM1Iowa.expirationDate);
  assert.equal(parseComparableDateLabel(String(rowM1.nremt_expires_at)), profileM1Nremt.expirationDate);
  assert.equal(
    rowM1.iowa_airway_progress,
    `${expectedM1.iowa.topics.find((topic) => topic.topic === "airway_respirations_ventilations")?.completed.toFixed(2) ?? "0.00"} / ${expectedM1.iowa.topics.find((topic) => topic.topic === "airway_respirations_ventilations")?.required.toFixed(2) ?? "0.00"}`,
  );
  assert.equal(
    rowM1.iowa_cardiology_progress,
    `${expectedM1.iowa.topics.find((topic) => topic.topic === "cardiology")?.completed.toFixed(2) ?? "0.00"} / ${expectedM1.iowa.topics.find((topic) => topic.topic === "cardiology")?.required.toFixed(2) ?? "0.00"}`,
  );
  assert.equal(
    rowM1.nremt_national_component_progress,
    expectedM1.nremt.nationalComponentRequired === null
      ? "-"
      : `${expectedM1.nremt.nationalComponentCompleted.toFixed(2)} / ${expectedM1.nremt.nationalComponentRequired.toFixed(2)}`,
  );
  assert.equal(
    rowM1.nremt_trauma_progress,
    `${expectedM1.nremt.nationalTopics.find((topic) => topic.topic === "trauma")?.completed.toFixed(2) ?? "0.00"} / ${expectedM1.nremt.nationalTopics.find((topic) => topic.topic === "trauma")?.required.toFixed(2) ?? "0.00"}`,
  );

  const expectedM1Cardiology = expectedM1.iowa.topics.find((topic) => topic.topic === "cardiology");
  assert.ok(expectedM1Cardiology);
  assert.equal(expectedM1Cardiology.completed, 6);
  assert.equal(expectedM1.unclassifiedRecordIds.includes("training_outside_submission:os-1"), true);
  assert.equal(expectedM1.unclassifiedRecordIds.includes("training_event_attendance:te-3"), true);

  assert.equal(rowM1.iowa_status, "Active");

  assert.equal(rowM2.nremt_maintained, "No");
  assert.equal(rowM2.nremt_status, "Not Maintained");

  const expectedM2 = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: String(profileRows.find((row) => row.id === "p-m2-iowa")?.expiration_date ?? ""),
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "not_maintained",
      expirationDate: String(profileRows.find((row) => row.id === "p-m2-nremt")?.expiration_date ?? ""),
      maintainTrack: false,
    },
    trainingRecords: [
      {
        id: "training_event_attendance:te-complete",
        occurredAt: "2026-02-10",
        hours: 1,
        coreTopic: "other",
        needsReview: false,
        eligibleForIowa: true,
        eligibleForNremt: true,
      },
    ],
    manualAllocations: iowaRequirement.topicRequirements.map((topic) => ({
      recordId: "training_event_attendance:te-complete",
      track: "iowa",
      component: "core",
      topic: topic.topic,
      hours: topic.requiredHours,
    })),
  });

  assert.equal(rowM2.iowa_progress, `${expectedM2.iowa.totalCompleted.toFixed(2)} / ${expectedM2.iowa.totalRequired.toFixed(2)}`);
  assert.equal(rowM2.nremt_progress, "-");

  const iowaScopeResponse = await runReport(makeRequest({ ...baseFilters, report_scope: "iowa", member_id: "m1" }), context);
  assert.equal(iowaScopeResponse.ok, true);
  const iowaScopePayload = iowaScopeResponse as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(iowaScopePayload.rows.length, 1);
  const iowaScopeColumnKeys = new Set(iowaScopePayload.columns.map((column) => column.key));
  assert.equal(iowaScopeColumnKeys.has("iowa_progress"), true);
  assert.equal(iowaScopeColumnKeys.has("iowa_status"), true);
  assert.equal(iowaScopeColumnKeys.has("iowa_airway_progress"), true);
  assert.equal(iowaScopeColumnKeys.has("nremt_progress"), false);
  assert.equal(iowaScopeColumnKeys.has("nremt_status"), false);
  assert.equal(iowaScopePayload.rows[0].member_name, "Alex IowaTrack");
  assert.equal(iowaScopePayload.rows[0].iowa_progress, `${expectedM1.iowa.totalCompleted.toFixed(2)} / ${expectedM1.iowa.totalRequired.toFixed(2)}`);

  const nremtScopeResponse = await runReport(makeRequest({ ...baseFilters, report_scope: "nremt", member_id: "m1" }), context);
  assert.equal(nremtScopeResponse.ok, true);
  const nremtScopePayload = nremtScopeResponse as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(nremtScopePayload.rows.length, 1);
  const nremtScopeColumnKeys = new Set(nremtScopePayload.columns.map((column) => column.key));
  assert.equal(nremtScopeColumnKeys.has("nremt_progress"), true);
  assert.equal(nremtScopeColumnKeys.has("nremt_status"), true);
  assert.equal(nremtScopeColumnKeys.has("nremt_national_component_progress"), true);
  assert.equal(nremtScopeColumnKeys.has("iowa_progress"), false);
  assert.equal(nremtScopeColumnKeys.has("iowa_status"), false);
  assert.equal(nremtScopePayload.rows[0].nremt_maintained, "Yes");

  const combinedScopeResponse = await runReport(makeRequest({ ...baseFilters, report_scope: "iowa-and-nremt", member_id: "m1" }), context);
  assert.equal(combinedScopeResponse.ok, true);
  const combinedScopePayload = combinedScopeResponse as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(combinedScopePayload.rows.length, 1);
  assert.equal(combinedScopePayload.rows[0].iowa_progress, `${expectedM1.iowa.totalCompleted.toFixed(2)} / ${expectedM1.iowa.totalRequired.toFixed(2)}`);
  assert.equal(combinedScopePayload.rows[0].nremt_progress, `${expectedM1.nremt.totalCompleted.toFixed(2)} / ${expectedM1.nremt.totalRequired.toFixed(2)}`);

  const memberFilter = await runReport(makeRequest({ ...baseFilters, member_id: "m1" }), context);
  assert.equal(memberFilter.ok, true);
  assert.equal((memberFilter as Extract<ReportRunResponse, { ok: true }>).rows.length, 1);
  assert.equal((memberFilter as Extract<ReportRunResponse, { ok: true }>).rows[0].member_name, "Alex IowaTrack");

  const levelFilter = await runReport(makeRequest({ ...baseFilters, ems_level: "aemt" }), context);
  assert.equal(levelFilter.ok, true);
  const levelNames = (levelFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(levelNames.sort(), ["Dana NeedsAttention", "Finley NextSixty"]);

  const iowaStatusFilter = await runReport(makeRequest({ ...baseFilters, iowa_status: "not_maintained" }), context);
  assert.equal(iowaStatusFilter.ok, true);
  const iowaStatusNames = (iowaStatusFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(iowaStatusNames, ["Evan NotMaintained"]);

  const nremtMaintainedFilter = await runReport(makeRequest({ ...baseFilters, nremt_maintained: "yes" }), context);
  assert.equal(nremtMaintainedFilter.ok, true);
  const nremtMaintainedNames = (nremtMaintainedFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(nremtMaintainedNames, ["Alex IowaTrack"]);

  const nremtNotMaintainedFilter = await runReport(makeRequest({ ...baseFilters, nremt_maintained: "no" }), context);
  assert.equal(nremtNotMaintainedFilter.ok, true);
  const nremtNotMaintainedNames = (nremtNotMaintainedFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(
    nremtNotMaintainedNames.sort(),
    ["Bailey NoNremt", "Dana NeedsAttention", "Evan NotMaintained", "Finley NextSixty", "Gray NextNinety"],
    "NREMT = No should include members not maintaining NREMT, including Iowa-only members",
  );

  const iowaOnlyNremtNo = await runReport(makeRequest({ ...baseFilters, member_id: "m6", nremt_maintained: "no" }), context);
  assert.equal(iowaOnlyNremtNo.ok, true);
  const iowaOnlyRows = (iowaOnlyNremtNo as Extract<ReportRunResponse, { ok: true }>).rows;
  assert.equal(iowaOnlyRows.length, 1);
  assert.equal(iowaOnlyRows[0].member_name, "Finley NextSixty");
  assert.equal(iowaOnlyRows[0].nremt_maintained, "No");

  const iowaScopeNremtAll = await runReport(makeRequest({ ...baseFilters, report_scope: "iowa", member_id: "m1", nremt_maintained: "all" }), context);
  assert.equal(iowaScopeNremtAll.ok, true);
  const iowaScopeNremtAllRows = (iowaScopeNremtAll as Extract<ReportRunResponse, { ok: true }>).rows;
  assert.equal(iowaScopeNremtAllRows.length, 1);
  assert.equal(iowaScopeNremtAllRows[0].member_name, "Alex IowaTrack");
  assert.equal(iowaScopeNremtAllRows[0].iowa_progress, `${expectedM1.iowa.totalCompleted.toFixed(2)} / ${expectedM1.iowa.totalRequired.toFixed(2)}`);

  const iowaScopeAllPopulation = await runReport(makeRequest({ ...baseFilters, report_scope: "iowa", member_id: "all", nremt_maintained: "all" }), context);
  assert.equal(iowaScopeAllPopulation.ok, true);
  const iowaScopeAllNames = (iowaScopeAllPopulation as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.equal(iowaScopeAllNames.includes("Alex IowaTrack"), true);
  assert.equal(iowaScopeAllNames.includes("Bailey NoNremt"), true);

  const iowaScopeNremtNo = await runReport(makeRequest({ ...baseFilters, report_scope: "iowa", nremt_maintained: "no" }), context);
  assert.equal(iowaScopeNremtNo.ok, true);
  const iowaScopeNremtNoNames = (iowaScopeNremtNo as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.equal(iowaScopeNremtNoNames.includes("Alex IowaTrack"), false);
  assert.equal(iowaScopeNremtNoNames.includes("Bailey NoNremt"), true);

  const nremtYesDoesNotNeedGenericCerts = await runReport(makeRequest({ ...baseFilters, member_id: "m1", nremt_maintained: "yes" }), context);
  assert.equal(nremtYesDoesNotNeedGenericCerts.ok, true);
  const nremtYesRows = (nremtYesDoesNotNeedGenericCerts as Extract<ReportRunResponse, { ok: true }>).rows;
  assert.equal(nremtYesRows.length, 1);
  assert.equal(nremtYesRows[0].member_name, "Alex IowaTrack");

  const readinessCompleteFilter = await runReport(makeRequest({ ...baseFilters, readiness_status: "complete" }), context);
  assert.equal(readinessCompleteFilter.ok, true);
  const readinessCompleteNames = (readinessCompleteFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(readinessCompleteNames, []);

  const readinessNoTrackFilter = await runReport(makeRequest({ ...baseFilters, readiness_status: "no_track" }), context);
  assert.equal(readinessNoTrackFilter.ok, true);
  const readinessNoTrackNames = (readinessNoTrackFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(readinessNoTrackNames, []);

  const expirationExpiredFilter = await runReport(makeRequest({ ...baseFilters, expiration_window: "expired" }), context);
  assert.equal(expirationExpiredFilter.ok, true);
  const expirationExpiredNames = (expirationExpiredFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(expirationExpiredNames, ["Bailey NoNremt"]);

  const expirationNext30Filter = await runReport(makeRequest({ ...baseFilters, expiration_window: "next-30" }), context);
  assert.equal(expirationNext30Filter.ok, true);
  const expirationNext30Names = (expirationNext30Filter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(expirationNext30Names, ["Alex IowaTrack"]);

  const expirationNext60Filter = await runReport(makeRequest({ ...baseFilters, expiration_window: "next-60" }), context);
  assert.equal(expirationNext60Filter.ok, true);
  const expirationNext60Names = (expirationNext60Filter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(expirationNext60Names.sort(), ["Alex IowaTrack", "Dana NeedsAttention", "Finley NextSixty"]);

  const expirationNext90Filter = await runReport(makeRequest({ ...baseFilters, expiration_window: "next-90" }), context);
  assert.equal(expirationNext90Filter.ok, true);
  const expirationNext90Names = (expirationNext90Filter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(expirationNext90Names.sort(), ["Alex IowaTrack", "Dana NeedsAttention", "Finley NextSixty", "Gray NextNinety"]);

  const expirationNoExpirationFilter = await runReport(makeRequest({ ...baseFilters, expiration_window: "no-expiration" }), context);
  assert.equal(expirationNoExpirationFilter.ok, true);
  const expirationNoExpirationNames = (expirationNoExpirationFilter as Extract<ReportRunResponse, { ok: true }>).rows.map((row) => String(row.member_name));
  assert.deepEqual(expirationNoExpirationNames, []);

  const returnedMembers = payload.rows.map((row) => String(row.member_name));
  assert.equal(returnedMembers.includes("Other Department"), false);
});

test("NREMT=No can be empty for a level when that level only has NREMT-maintained members", async () => {
  const departmentId = "dep-x";
  const supabase = createSupabaseMock({
    members: [
      { id: "m1", department_id: departmentId, first_name: "Adam", last_name: "Smith" },
      { id: "m2", department_id: departmentId, first_name: "Jordan", last_name: "Medic" },
    ],
    ems_member_track_profiles: [
      {
        id: "p1",
        department_id: departmentId,
        member_id: "m1",
        track: "iowa",
        certification_level: "emt",
        track_status: "active",
        maintain_track: true,
        certification_number: "EMT91137",
        expiration_date: "2027-04-15",
        effective_start_date: "2026-01-01",
        effective_end_date: null,
      },
      {
        id: "p2",
        department_id: departmentId,
        member_id: "m1",
        track: "nremt",
        certification_level: "emt",
        track_status: "active",
        maintain_track: true,
        certification_number: "NREMT91137",
        expiration_date: "2027-04-15",
        effective_start_date: "2026-01-01",
        effective_end_date: null,
      },
      {
        id: "p3",
        department_id: departmentId,
        member_id: "m2",
        track: "iowa",
        certification_level: "aemt",
        track_status: "active",
        maintain_track: true,
        certification_number: "AEMT1001",
        expiration_date: "2027-06-01",
        effective_start_date: "2026-01-01",
        effective_end_date: null,
      },
    ],
    ems_credit_sources: [],
    ems_credit_allocations: [],
    ems_equipment: [],
    ems_supply_items: [],
    ems_supply_transaction_items: [],
    member_certifications: [],
    training_categories: [],
    training_event_attendance: [],
    training_outside_submissions: [],
  });

  const context = {
    supabase,
    departmentId,
    departmentName: "Dept X",
    memberRole: "owner",
  } as never;

  const baseFilters = {
    report_type: "certification-status",
    report_scope: "iowa-and-nremt",
    member_id: "all",
    ems_level: "emt",
    iowa_status: "all",
    nremt_maintained: "all",
    readiness_status: "all",
    expiration_window: "all",
  };

  const nremtNo = await runReport(makeRequest({ ...baseFilters, nremt_maintained: "no" }), context);
  assert.equal(nremtNo.ok, true);
  assert.equal((nremtNo as Extract<ReportRunResponse, { ok: true }>).rows.length, 0);

  const nremtYes = await runReport(makeRequest({ ...baseFilters, nremt_maintained: "yes" }), context);
  assert.equal(nremtYes.ok, true);
  const yesRows = (nremtYes as Extract<ReportRunResponse, { ok: true }>).rows;
  assert.equal(yesRows.length, 1);
  assert.equal(yesRows[0].member_name, "Adam Smith");
});

test("Existing EMS report mode still works when certification-status mode is present", async () => {
  const departmentId = "dep-a";
  const supabase = createSupabaseMock({
    members: [{ id: "m1", department_id: departmentId, first_name: "Alex", last_name: "IowaTrack" }],
    ems_member_track_profiles: [],
    ems_credit_sources: [],
    ems_credit_allocations: [],
    ems_equipment: [],
    ems_supply_items: [
      {
        id: "s1",
        department_id: departmentId,
        item_name: "Oxygen Mask",
        item_category: "Airway",
        unit_of_measure: "ea",
        custom_unit_of_measure: null,
        quantity_on_hand: 3,
        reorder_threshold: 5,
        critical_threshold: 2,
        target_quantity: 10,
        location: "Medic 1",
        notes: "Primary stock",
        status: "Active",
        qr_identifier: "QR-1",
        created_at: "2026-01-10T00:00:00.000Z",
        updated_at: "2026-01-15T00:00:00.000Z",
      },
    ],
    ems_supply_transaction_items: [],
    member_certifications: [],
    training_categories: [],
    training_event_attendance: [],
    training_outside_submissions: [],
  });

  const context = {
    supabase,
    departmentId,
    departmentName: "Department A",
    memberRole: "owner",
  } as never;

  const response = await runReport(
    makeRequest({
      report_type: "supplies",
      member_id: "all",
      training_category_id: "all",
      equipment_id: "all",
      equipment_status: "all",
      supply_id: "all",
      supply_status: "all",
      supply_stock_level: "all",
      certification_status: "all",
      ems_level: "all",
      iowa_status: "all",
      nremt_maintained: "all",
      readiness_status: "all",
      expiration_window: "all",
    }),
    context,
  );

  assert.equal(response.ok, true);
  const payload = response as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].record_type, "Supply");
  assert.equal(payload.rows[0].item_name, "Oxygen Mask");
});

test("Existing EMS training and equipment report modes still work", async () => {
  const departmentId = "dep-c";
  const supabase = createSupabaseMock({
    members: [{ id: "m1", department_id: departmentId, first_name: "Alex", last_name: "Medic" }],
    ems_member_track_profiles: [],
    ems_credit_sources: [],
    ems_credit_allocations: [],
    ems_equipment: [
      {
        id: "eq1",
        department_id: departmentId,
        equipment_name: "Cardiac Monitor",
        equipment_type: "Monitor",
        manufacturer: "Corp",
        model: "X1",
        serial_number: "SN-1",
        equipment_number: "EQ-100",
        status: "Active",
        location: "Medic 2",
        placed_in_service_date: "2026-01-01",
        notes: "Ready",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    ems_supply_items: [],
    ems_supply_transaction_items: [],
    member_certifications: [],
    training_categories: [{ id: "cat1", department_id: departmentId, name: "EMS Cardiology" }],
    training_event_attendance: [
      {
        id: "att1",
        department_id: departmentId,
        training_event_id: "evt1",
        member_id: "m1",
        attendance_status: "attending",
      },
    ],
    training_events: [
      {
        id: "evt1",
        department_id: departmentId,
        title: "EMS Cardiology Review",
        category_id: "cat1",
        training_type: "EMS",
        location: "Station 1",
        starts_at: "2026-06-01T10:00:00.000Z",
        hours_credit: 2,
      },
    ],
    training_outside_submissions: [],
  });

  const context = {
    supabase,
    departmentId,
    departmentName: "Department C",
    memberRole: "owner",
  } as never;

  const trainingResponse = await runReport(
    makeRequest({
      report_type: "training",
      member_id: "all",
      training_category_id: "all",
      equipment_id: "all",
      equipment_status: "all",
      supply_id: "all",
      supply_status: "all",
      supply_stock_level: "all",
      certification_status: "all",
      ems_level: "all",
      iowa_status: "all",
      nremt_maintained: "all",
      readiness_status: "all",
      expiration_window: "all",
    }),
    context,
  );

  assert.equal(trainingResponse.ok, true);
  const trainingPayload = trainingResponse as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(trainingPayload.rows.length, 1);
  assert.equal(trainingPayload.rows[0].record_type, "Training");
  assert.equal(trainingPayload.rows[0].item_name, "EMS Cardiology Review");

  const equipmentResponse = await runReport(
    makeRequest({
      report_type: "equipment",
      member_id: "all",
      training_category_id: "all",
      equipment_id: "all",
      equipment_status: "all",
      supply_id: "all",
      supply_status: "all",
      supply_stock_level: "all",
      certification_status: "all",
      ems_level: "all",
      iowa_status: "all",
      nremt_maintained: "all",
      readiness_status: "all",
      expiration_window: "all",
    }),
    context,
  );

  assert.equal(equipmentResponse.ok, true);
  const equipmentPayload = equipmentResponse as Extract<ReportRunResponse, { ok: true }>;
  assert.equal(equipmentPayload.rows.length, 1);
  assert.equal(equipmentPayload.rows[0].record_type, "Equipment");
  assert.equal(equipmentPayload.rows[0].item_name, "Cardiac Monitor");
});
