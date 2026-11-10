// Canonical training-hours ledger.
//
// Single source of truth for how training hours are counted across
// Department Training, Command Center, My Readiness (desktop + mobile),
// and training reports. Rules:
//
// - Only approved work counts: outside submissions with status 'approved',
//   assignment completions with completion_status 'approved', and event
//   attendance with attendance_status 'attending'.
// - Every approved record counts toward the member's total hours regardless
//   of category; Fire/EMS/Other are compliance groupings, never exclusions.
// - Compliance grouping uses the explicit training_categories.compliance_bucket
//   mapping when present, with the legacy keyword matcher as fallback.
// - Calendar-year filtering compares the YYYY prefix of the record's date key
//   so screens labeled "This Year"/annual share identical boundaries.
// - Each record produces exactly one ledger entry per member, so hours are
//   never double-counted for the same person.

import { parseHours } from "@/lib/readiness/member-readiness";
import {
  getTrainingComplianceBucketByCategoryId,
  type TrainingComplianceBucket,
} from "@/lib/training/compliance-buckets";

export type TrainingCategoryClassificationRow = {
  id: string;
  name: string;
  compliance_bucket?: string | null;
};

export type LedgerAttendanceRow = {
  training_event_id: string;
};

export type LedgerEventRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
  starts_at: string | null;
};

export type LedgerOutsideSubmissionRow = {
  id: string;
  category_id: string | null;
  hours: number | string | null;
  training_date: string | null;
  status: string;
};

export type LedgerAssignmentRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
  status?: string | null;
};

export type LedgerAssignmentMemberRow = {
  id?: string;
  training_assignment_id: string;
  completion_status: string;
  completed_at: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  hours_earned: number | string | null;
};

export type TrainingHoursRecord = {
  id: string;
  source: "event" | "outside" | "assignment";
  categoryId: string | null;
  categoryName: string;
  bucket: TrainingComplianceBucket;
  hours: number;
  dateKey: string | null;
};

export type TrainingHoursSummary = {
  totalHours: number;
  fireHours: number;
  emsHours: number;
  otherHours: number;
  byCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    bucket: TrainingComplianceBucket;
    hours: number;
  }>;
};

export function toTrainingDateKey(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length < 10) {
    return null;
  }

  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function isDateKeyInCalendarYear(dateKey: string | null, year: number): boolean {
  return dateKey !== null && dateKey.startsWith(`${year}-`);
}

export function buildCategoryMaps(categories: TrainingCategoryClassificationRow[]): {
  categoryNameById: Map<string, string>;
  categoryBucketById: Map<string, string | null | undefined>;
} {
  return {
    categoryNameById: new Map(categories.map((row) => [row.id, row.name])),
    categoryBucketById: new Map(categories.map((row) => [row.id, row.compliance_bucket ?? null])),
  };
}

export type MemberTrainingHoursInput = {
  attendanceRows: LedgerAttendanceRow[];
  events: LedgerEventRow[];
  outsideSubmissions: LedgerOutsideSubmissionRow[];
  assignments: LedgerAssignmentRow[];
  assignmentMembers: LedgerAssignmentMemberRow[];
  categories: TrainingCategoryClassificationRow[];
  calendarYear?: number | null;
};

export function buildMemberTrainingHoursRecords(input: MemberTrainingHoursInput): TrainingHoursRecord[] {
  const { categoryNameById, categoryBucketById } = buildCategoryMaps(input.categories);
  const year = input.calendarYear ?? null;

  const categoryNameOf = (categoryId: string | null) =>
    categoryId ? categoryNameById.get(categoryId) ?? "Uncategorized" : "Uncategorized";
  const bucketOf = (categoryId: string | null) =>
    getTrainingComplianceBucketByCategoryId(categoryId, categoryNameById, categoryBucketById);
  const inRange = (dateKey: string | null) => (year === null ? true : isDateKeyInCalendarYear(dateKey, year));

  const records: TrainingHoursRecord[] = [];

  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const seenEventIds = new Set<string>();
  for (const attendance of input.attendanceRows) {
    const event = eventById.get(attendance.training_event_id);
    if (!event || seenEventIds.has(event.id)) {
      continue;
    }
    seenEventIds.add(event.id);

    const dateKey = toTrainingDateKey(event.starts_at);
    const hours = parseHours(event.hours_credit);
    if (hours <= 0 || !inRange(dateKey)) {
      continue;
    }

    records.push({
      id: `event-${event.id}`,
      source: "event",
      categoryId: event.category_id,
      categoryName: categoryNameOf(event.category_id),
      bucket: bucketOf(event.category_id),
      hours,
      dateKey,
    });
  }

  const seenSubmissionIds = new Set<string>();
  for (const submission of input.outsideSubmissions) {
    if (submission.status !== "approved" || seenSubmissionIds.has(submission.id)) {
      continue;
    }
    seenSubmissionIds.add(submission.id);

    const dateKey = toTrainingDateKey(submission.training_date);
    const hours = parseHours(submission.hours);
    if (hours <= 0 || !inRange(dateKey)) {
      continue;
    }

    records.push({
      id: `outside-${submission.id}`,
      source: "outside",
      categoryId: submission.category_id,
      categoryName: categoryNameOf(submission.category_id),
      bucket: bucketOf(submission.category_id),
      hours,
      dateKey,
    });
  }

  const assignmentById = new Map(input.assignments.map((assignment) => [assignment.id, assignment]));
  for (const assignmentMember of input.assignmentMembers) {
    if (assignmentMember.completion_status !== "approved") {
      continue;
    }

    const assignment = assignmentById.get(assignmentMember.training_assignment_id);
    if (!assignment || assignment.status === "archived") {
      continue;
    }

    const dateKey = toTrainingDateKey(
      assignmentMember.completed_at ?? assignmentMember.updated_at ?? assignmentMember.created_at,
    );
    const earnedHours = parseHours(assignmentMember.hours_earned);
    const hours = earnedHours > 0 ? earnedHours : parseHours(assignment.hours_credit);
    if (hours <= 0 || !inRange(dateKey)) {
      continue;
    }

    records.push({
      id: `assignment-${assignmentMember.id ?? assignmentMember.training_assignment_id}`,
      source: "assignment",
      categoryId: assignment.category_id,
      categoryName: categoryNameOf(assignment.category_id),
      bucket: bucketOf(assignment.category_id),
      hours,
      dateKey,
    });
  }

  return records;
}

export function summarizeTrainingHours(records: TrainingHoursRecord[]): TrainingHoursSummary {
  const summary: TrainingHoursSummary = {
    totalHours: 0,
    fireHours: 0,
    emsHours: 0,
    otherHours: 0,
    byCategory: [],
  };

  const byCategory = new Map<string, { categoryId: string | null; categoryName: string; bucket: TrainingComplianceBucket; hours: number }>();

  for (const record of records) {
    summary.totalHours += record.hours;

    if (record.bucket === "fire_annual") {
      summary.fireHours += record.hours;
    } else if (record.bucket === "ems_ce") {
      summary.emsHours += record.hours;
    } else {
      summary.otherHours += record.hours;
    }

    const key = record.categoryId ?? "uncategorized";
    const current = byCategory.get(key) ?? {
      categoryId: record.categoryId,
      categoryName: record.categoryName,
      bucket: record.bucket,
      hours: 0,
    };
    current.hours += record.hours;
    byCategory.set(key, current);
  }

  summary.byCategory = Array.from(byCategory.values()).sort((a, b) => b.hours - a.hours);
  return summary;
}

// Department totals are member-hours: an event credits its hours to every
// attending member, and an outside submission credits its hours to every
// distinct credited member (owner plus participants, deduplicated).
export type DepartmentTrainingHoursInput = {
  events: Array<{ id: string; starts_at: string | null; hours_credit: number | string | null }>;
  attendanceRows: Array<{ training_event_id: string; attendance_status: string }>;
  outsideSubmissions: Array<{
    id: string;
    member_id: string;
    training_date: string | null;
    hours: number | string | null;
    status: string;
  }>;
  outsideParticipants: Array<{ submission_id: string; member_id: string }>;
  assignments: Array<{ id: string; hours_credit: number | string | null }>;
  assignmentMembers: LedgerAssignmentMemberRow[];
  calendarYear: number;
};

export function calculateDepartmentTrainingMemberHours(input: DepartmentTrainingHoursInput): number {
  const year = input.calendarYear;

  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const attendanceHours = input.attendanceRows
    .filter((row) => row.attendance_status === "attending")
    .reduce((total, row) => {
      const event = eventById.get(row.training_event_id);
      if (!event) {
        return total;
      }
      const dateKey = toTrainingDateKey(event.starts_at);
      return isDateKeyInCalendarYear(dateKey, year) ? total + parseHours(event.hours_credit) : total;
    }, 0);

  const participantsBySubmission = new Map<string, Set<string>>();
  for (const participant of input.outsideParticipants) {
    const set = participantsBySubmission.get(participant.submission_id) ?? new Set<string>();
    set.add(participant.member_id);
    participantsBySubmission.set(participant.submission_id, set);
  }

  const outsideHours = input.outsideSubmissions
    .filter((row) => row.status === "approved" && isDateKeyInCalendarYear(toTrainingDateKey(row.training_date), year))
    .reduce((total, row) => {
      const creditedMembers = new Set<string>(participantsBySubmission.get(row.id) ?? []);
      creditedMembers.add(row.member_id);
      return total + parseHours(row.hours) * creditedMembers.size;
    }, 0);

  const assignmentById = new Map(input.assignments.map((assignment) => [assignment.id, assignment]));
  const assignmentHours = input.assignmentMembers
    .filter((row) => row.completion_status === "approved")
    .filter((row) => isDateKeyInCalendarYear(toTrainingDateKey(row.completed_at ?? row.updated_at ?? row.created_at), year))
    .reduce((total, row) => {
      const assignment = assignmentById.get(row.training_assignment_id);
      const earnedHours = parseHours(row.hours_earned);
      return total + (earnedHours > 0 ? earnedHours : parseHours(assignment?.hours_credit ?? null));
    }, 0);

  return attendanceHours + outsideHours + assignmentHours;
}
