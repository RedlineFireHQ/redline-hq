import { isEmsCoreTopic, type EmsCoreTopicCode } from "@/lib/ems/requirements";

export type TrainingEventDraft = {
  department_id: string;
  created_by: string;
  title: string;
  category_id: string;
  starts_at: string;
  hours_credit: number;
  training_type: string | null;
  is_ems_training: boolean;
  ems_core_topic: EmsCoreTopicCode | null;
  ems_course_definition_id: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  description: string | null;
  location: string | null;
  instructor_name: string | null;
};

export type TrainingSaveRecovery = {
  eventId: string;
  memberIds: string[];
  draft?: { scopeKey: string; eventId: string; event: TrainingEventDraft };
};

export function isTrainingRecoveryId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function trainingRecoveryKey(userId: string, departmentId: string, memberId: string): string {
  if (![userId, departmentId, memberId].every(isTrainingRecoveryId)) {
    throw new Error("Unable to establish the training recovery user and department.");
  }
  return `redline:training-save:v1:${userId}:${departmentId}:${memberId}`;
}

export function readTrainingRecovery(storage: Pick<Storage, "getItem">, key: string): TrainingSaveRecovery | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== "object" || value === null ||
    !("eventId" in value) || !isTrainingRecoveryId(value.eventId) ||
    !("memberIds" in value) || !Array.isArray(value.memberIds) ||
    !value.memberIds.every(isTrainingRecoveryId) ||
    new Set(value.memberIds).size !== value.memberIds.length
  ) {
    throw new Error("Invalid pending training recovery data. No training or attendance changes were made.");
  }
  const recovery: TrainingSaveRecovery = { eventId: value.eventId, memberIds: value.memberIds };
  if ("draft" in value) {
    const draft = value.draft;
    if (typeof draft !== "object" || draft === null ||
      !("scopeKey" in draft) || draft.scopeKey !== key ||
      !("eventId" in draft) || draft.eventId !== value.eventId ||
      !("event" in draft) || !isTrainingEventDraft(draft.event)) {
      throw new Error("Invalid or mismatched pending training draft. No event will be inserted.");
    }
    const scope = key.split(":");
    if (draft.event.department_id !== scope[scope.length - 2] ||
      draft.event.created_by !== scope[scope.length - 1]) {
      throw new Error("Pending training draft does not match this department and creator.");
    }
    recovery.draft = { scopeKey: key, eventId: value.eventId, event: draft.event };
  }
  return recovery;
}

function isTrainingEventDraft(value: unknown): value is TrainingEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const fields: Record<string, unknown> = { ...value };
  const expected = [
    "department_id", "created_by", "title", "category_id", "starts_at", "hours_credit",
    "training_type", "is_ems_training", "ems_core_topic", "ems_course_definition_id",
    "ems_needs_review", "ems_provider_name", "description", "location", "instructor_name",
  ];
  return Object.keys(fields).length === expected.length &&
    expected.every(name => Object.hasOwn(fields, name)) &&
    [fields.department_id, fields.created_by, fields.category_id].every(isTrainingRecoveryId) &&
    typeof fields.title === "string" && fields.title.trim().length > 0 &&
    typeof fields.starts_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(fields.starts_at) &&
    Number.isFinite(Date.parse(fields.starts_at)) &&
    typeof fields.hours_credit === "number" && Number.isFinite(fields.hours_credit) &&
    fields.hours_credit > 0 &&
    ["training_type", "ems_provider_name", "description", "location", "instructor_name"]
      .every(name => fields[name] === null || typeof fields[name] === "string") &&
    typeof fields.is_ems_training === "boolean" &&
    typeof fields.ems_needs_review === "boolean" &&
    (fields.ems_core_topic === null || isEmsCoreTopic(fields.ems_core_topic)) &&
    (fields.ems_course_definition_id === null || isTrainingRecoveryId(fields.ems_course_definition_id)) &&
    (fields.is_ems_training ||
      (fields.ems_core_topic === null && fields.ems_course_definition_id === null && fields.ems_needs_review === false));
}

export function trainingEventInsert(recovery: TrainingSaveRecovery) {
  if (!recovery.draft) throw new Error("This older pending attempt has no saved event draft. Administrator reconciliation is required.");
  return {
    ...recovery.draft.event,
    id: recovery.eventId,
    topic: recovery.draft.event.ems_core_topic,
    updated_by: recovery.draft.event.created_by,
    ends_at: null,
    duration_minutes: null,
    status: "scheduled",
    supporting_document_id: null,
  };
}

export function writeTrainingRecovery(storage: Pick<Storage, "setItem">, key: string, recovery: TrainingSaveRecovery) {
  storage.setItem(key, JSON.stringify(recovery));
}
