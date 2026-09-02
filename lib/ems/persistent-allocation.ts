import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  findCurrentTrackProfile,
  resolveAuthoritativeEmsCertificationsForMember,
} from "@/lib/ems/authoritative-certifications";
import { calculateEmsReadiness, type EmsTrackProfileInput, type EmsTrainingRecord } from "@/lib/ems/calculation";
import {
  NREMT_REQUIREMENTS,
  type EmsCertificationLevel,
  type EmsCoreTopicCode,
} from "@/lib/ems/requirements";

type EmsTrack = "iowa" | "nremt";
type EmsTrackStatus = "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
type SourceType = "training_event_attendance" | "training_outside_submission";
type NremtComponentCode = "national_component" | "local_state_component" | "individual_component";

type PersistedSourcePayload = {
  source_type: SourceType;
  source_record_id: string;
  source_occurred_at: string;
  source_title: string;
  source_hours: number;
  training_category_id: string | null;
  ems_core_topic: EmsCoreTopicCode | null;
  provider_name: string | null;
  course_definition_id: string | null;
  approval_state: "approved" | "needs_review";
  metadata_json: Record<string, unknown>;
};

type PersistedAllocationPayload = {
  source_type: SourceType;
  source_record_id: string;
  member_cycle_id: string | null;
  requirement_set_id: string;
  requirement_component_id: string | null;
  requirement_topic_id: string | null;
  allocated_hours: number;
  allocation_status: "allocated";
  allocation_reason: string | null;
  rule_trace_json: Record<string, unknown>;
};

type RequirementSetRef = {
  id: string;
  authority: EmsTrack;
  certification_level: EmsCertificationLevel;
  version_label: string;
};

type RequirementComponentRef = {
  id: string;
  requirement_set_id: string;
  component_code: string;
};

type RequirementTopicRef = {
  id: string;
  requirement_component_id: string;
  topic_code: string;
};

type TrackProfileRow = {
  id: string;
  track: EmsTrack;
  certification_level: EmsCertificationLevel;
  track_status: EmsTrackStatus;
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
};

type TrainingEventAttendanceRow = {
  id: string;
  training_event_id: string;
};

type TrainingEventRow = {
  id: string;
  title: string;
  starts_at: string;
  hours_credit: number | string | null;
  category_id: string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  ems_course_definition_id: string | null;
};

type OutsideSubmissionRow = {
  id: string;
  title: string;
  training_date: string;
  hours: number | string | null;
  category_id: string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  ems_course_definition_id: string | null;
};

type AllocationSource = {
  sourceType: SourceType;
  sourceRecordId: string;
  occurredAt: string;
  title: string;
  hours: number;
  categoryId: string | null;
  coreTopic: EmsCoreTopicCode | null;
  needsReview: boolean;
  providerName: string | null;
  courseDefinitionId: string | null;
  metadata: Record<string, unknown>;
};

type AutoCreditableSource = AllocationSource & {
  coreTopic: Exclude<EmsCoreTopicCode, "other">;
};

type TrackRequirementRefs = {
  requirementSetId: string;
  versionLabel: string;
  componentByCode: Map<string, string>;
  topicIdByCode: Map<string, string>;
  cycleId: string | null;
};

export type EmsPersistentRecalcResult = {
  sourceCount: number;
  allocationCount: number;
  warnings: string[];
  iowaStatus: string;
  nremtStatus: string;
};

export type BuildAllocationPlanInput = {
  sources: AllocationSource[];
  iowaProfile: EmsTrackProfileInput | null;
  nremtProfile: EmsTrackProfileInput | null;
  iowaRefs: TrackRequirementRefs | null;
  nremtRefs: TrackRequirementRefs | null;
  allocatorVersion: string;
};

export type BuildAllocationPlanResult = {
  readiness: ReturnType<typeof calculateEmsReadiness>;
  persistedSources: PersistedSourcePayload[];
  persistedAllocations: PersistedAllocationPayload[];
};

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function parseHours(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeTopic(value: string | null): EmsCoreTopicCode | null {
  if (
    value === "airway_respirations_ventilations" ||
    value === "cardiology" ||
    value === "trauma" ||
    value === "medical" ||
    value === "operations" ||
    value === "other"
  ) {
    return value;
  }

  return null;
}

function isCoreTopic(topic: EmsCoreTopicCode | null): topic is Exclude<EmsCoreTopicCode, "other"> {
  return (
    topic === "airway_respirations_ventilations" ||
    topic === "cardiology" ||
    topic === "trauma" ||
    topic === "medical" ||
    topic === "operations"
  );
}

function getDateKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

function toTrackProfileInput(
  row: Pick<TrackProfileRow, "track" | "certification_level" | "track_status" | "expiration_date" | "maintain_track"> | null,
): EmsTrackProfileInput | null {
  if (!row) {
    return null;
  }

  return {
    level: row.certification_level,
    status: row.track_status,
    expirationDate: row.expiration_date,
    maintainTrack: row.track === "iowa" ? true : row.maintain_track === true,
  };
}

function makeSourceKey(sourceType: SourceType, sourceRecordId: string) {
  return `${sourceType}:${sourceRecordId}`;
}

function makeTrainingRecordId(source: AllocationSource) {
  return makeSourceKey(source.sourceType, source.sourceRecordId);
}

function toPersistedSource(source: AllocationSource): PersistedSourcePayload {
  return {
    source_type: source.sourceType,
    source_record_id: source.sourceRecordId,
    source_occurred_at: source.occurredAt,
    source_title: source.title,
    source_hours: roundHours(source.hours),
    training_category_id: source.categoryId,
    ems_core_topic: source.coreTopic,
    provider_name: source.providerName,
    course_definition_id: source.courseDefinitionId,
    approval_state: source.needsReview ? "needs_review" : "approved",
    metadata_json: source.metadata,
  };
}

function isAutoCreditableSource(source: AllocationSource): source is AutoCreditableSource {
  return !source.needsReview && isCoreTopic(source.coreTopic) && source.hours > 0;
}

export function buildEmsAutoAllocationPlan(input: BuildAllocationPlanInput): BuildAllocationPlanResult {
  const trainingRecords: EmsTrainingRecord[] = input.sources.map((source) => ({
    id: makeTrainingRecordId(source),
    occurredAt: source.occurredAt,
    hours: roundHours(source.hours),
    coreTopic: source.coreTopic,
    needsReview: source.needsReview,
    eligibleForIowa: true,
    eligibleForNremt: true,
    pediatricTagged: false,
  }));

  const readiness = calculateEmsReadiness({
    iowaProfile: input.iowaProfile,
    nremtProfile: input.nremtProfile,
    trainingRecords,
  });

  const persistedSources = input.sources.map(toPersistedSource);
  const persistedAllocations: PersistedAllocationPayload[] = [];

  const iowaActive = input.iowaProfile?.status === "active";
  if (iowaActive && input.iowaRefs) {
    const iowaComponentId = input.iowaRefs.componentByCode.get("core") ?? null;

    for (const source of input.sources) {
      if (source.needsReview || !isCoreTopic(source.coreTopic) || source.hours <= 0) {
        continue;
      }

      const topicId = input.iowaRefs.topicIdByCode.get(source.coreTopic) ?? null;
      persistedAllocations.push({
        source_type: source.sourceType,
        source_record_id: source.sourceRecordId,
        member_cycle_id: input.iowaRefs.cycleId,
        requirement_set_id: input.iowaRefs.requirementSetId,
        requirement_component_id: iowaComponentId,
        requirement_topic_id: topicId,
        allocated_hours: roundHours(source.hours),
        allocation_status: "allocated",
        allocation_reason: "auto_iowa_core_topic",
        rule_trace_json: {
          allocator_version: input.allocatorVersion,
          track: "iowa",
          requirement_version_label: input.iowaRefs.versionLabel,
          topic_code: source.coreTopic,
          source: "auto",
        },
      });
    }
  }

  const nremtActive = input.nremtProfile?.maintainTrack === true && input.nremtProfile?.status !== "not_maintained";
  if (nremtActive && input.nremtRefs && input.nremtProfile) {
    const nationalComponentId = input.nremtRefs.componentByCode.get("national_component") ?? null;
    const individualComponentId = input.nremtRefs.componentByCode.get("individual_component") ?? null;

    const autoCreditableSources = input.sources
      .filter(isAutoCreditableSource)
      .sort((left, right) => {
        const leftKey = `${left.occurredAt}-${left.sourceType}-${left.sourceRecordId}`;
        const rightKey = `${right.occurredAt}-${right.sourceType}-${right.sourceRecordId}`;
        return leftKey.localeCompare(rightKey);
      });

    for (const source of autoCreditableSources) {
      const topicCode = source.coreTopic;
      const topicId = input.nremtRefs.topicIdByCode.get(topicCode) ?? null;

      persistedAllocations.push({
        source_type: source.sourceType,
        source_record_id: source.sourceRecordId,
        member_cycle_id: input.nremtRefs.cycleId,
        requirement_set_id: input.nremtRefs.requirementSetId,
        requirement_component_id: nationalComponentId,
        requirement_topic_id: topicId,
        allocated_hours: roundHours(source.hours),
        allocation_status: "allocated",
        allocation_reason: "auto_nremt_national_topic",
        rule_trace_json: {
          allocator_version: input.allocatorVersion,
          track: "nremt",
          component: "national_component",
          requirement_version_label: input.nremtRefs.versionLabel,
          topic_code: topicCode,
          source: "auto",
        },
      });
    }

    const nremtTopicRequirements = new Map(
      NREMT_REQUIREMENTS[input.nremtProfile.level].nationalTopicRequirements.map((row) => [row.topic, row.requiredHours]),
    );

    const remainingBySourceKey = new Map<string, number>();
    for (const source of autoCreditableSources) {
      remainingBySourceKey.set(makeSourceKey(source.sourceType, source.sourceRecordId), roundHours(source.hours));
    }

    const byTopic = new Map<Exclude<EmsCoreTopicCode, "other">, AllocationSource[]>();
    for (const source of autoCreditableSources) {
      const topicCode = source.coreTopic;
      const current = byTopic.get(topicCode) ?? [];
      current.push(source);
      byTopic.set(topicCode, current);
    }

    for (const [topicCode, topicSources] of byTopic.entries()) {
      let remainingRequired = nremtTopicRequirements.get(topicCode) ?? 0;

      for (const source of topicSources) {
        const key = makeSourceKey(source.sourceType, source.sourceRecordId);
        const remainingSourceHours = remainingBySourceKey.get(key) ?? 0;
        if (remainingSourceHours <= 0) {
          continue;
        }

        const consumed = Math.min(remainingSourceHours, Math.max(remainingRequired, 0));
        remainingRequired = roundHours(remainingRequired - consumed);
        remainingBySourceKey.set(key, roundHours(remainingSourceHours - consumed));
      }
    }

    if (individualComponentId) {
      for (const source of autoCreditableSources) {
        const key = makeSourceKey(source.sourceType, source.sourceRecordId);
        const leftover = roundHours(remainingBySourceKey.get(key) ?? 0);
        if (leftover <= 0) {
          continue;
        }

        persistedAllocations.push({
          source_type: source.sourceType,
          source_record_id: source.sourceRecordId,
          member_cycle_id: input.nremtRefs.cycleId,
          requirement_set_id: input.nremtRefs.requirementSetId,
          requirement_component_id: individualComponentId,
          requirement_topic_id: null,
          allocated_hours: leftover,
          allocation_status: "allocated",
          allocation_reason: "auto_nremt_individual_excess",
          rule_trace_json: {
            allocator_version: input.allocatorVersion,
            track: "nremt",
            component: "individual_component",
            requirement_version_label: input.nremtRefs.versionLabel,
            source: "auto",
          },
        });
      }
    }
  }

  return {
    readiness,
    persistedSources,
    persistedAllocations,
  };
}

async function loadRequirementSetForTrack(
  supabase: SupabaseClient,
  departmentId: string,
  authority: EmsTrack,
  level: EmsCertificationLevel,
) {
  const { data, error } = await supabase
    .from("ems_requirement_sets")
    .select("id, authority, certification_level, version_label, publication_status, effective_start_date, effective_end_date")
    .eq("department_id", departmentId)
    .eq("authority", authority)
    .eq("certification_level", level)
    .eq("publication_status", "published")
    .order("effective_start_date", { ascending: false });

  if (error) {
    throw new Error(error.message || `Unable to load ${authority} requirement set.`);
  }

  const today = new Date();
  const chosen = (data ?? []).find((row) => {
    const start = typeof row.effective_start_date === "string" ? new Date(row.effective_start_date) : null;
    const end = typeof row.effective_end_date === "string" ? new Date(row.effective_end_date) : null;

    if (!start || Number.isNaN(start.getTime())) {
      return false;
    }

    if (start.getTime() > today.getTime()) {
      return false;
    }

    if (end && !Number.isNaN(end.getTime()) && end.getTime() < today.getTime()) {
      return false;
    }

    return true;
  }) ?? (data ?? [])[0];

  if (!chosen) {
    return null;
  }

  return {
    id: String(chosen.id),
    authority: chosen.authority === "nremt" ? "nremt" : "iowa",
    certification_level: (chosen.certification_level as EmsCertificationLevel) ?? level,
    version_label: typeof chosen.version_label === "string" ? chosen.version_label : "unknown",
  } satisfies RequirementSetRef;
}

async function loadTrackRequirementRefs(
  supabase: SupabaseClient,
  requirementSet: RequirementSetRef,
  cycleId: string | null,
): Promise<TrackRequirementRefs> {
  const { data: componentsData, error: componentsError } = await supabase
    .from("ems_requirement_components")
    .select("id, requirement_set_id, component_code")
    .eq("requirement_set_id", requirementSet.id);

  if (componentsError) {
    throw new Error(componentsError.message || "Unable to load EMS requirement components.");
  }

  const components = (componentsData ?? []).map((row) => ({
    id: String(row.id),
    requirement_set_id: String(row.requirement_set_id),
    component_code: typeof row.component_code === "string" ? row.component_code : "",
  })) satisfies RequirementComponentRef[];

  const componentIds = components.map((row) => row.id);
  const topicIdByCode = new Map<string, string>();

  if (componentIds.length > 0) {
    const { data: topicsData, error: topicsError } = await supabase
      .from("ems_requirement_topics")
      .select("id, requirement_component_id, topic_code")
      .in("requirement_component_id", componentIds);

    if (topicsError) {
      throw new Error(topicsError.message || "Unable to load EMS requirement topics.");
    }

    const topics = (topicsData ?? []).map((row) => ({
      id: String(row.id),
      requirement_component_id: String(row.requirement_component_id),
      topic_code: typeof row.topic_code === "string" ? row.topic_code : "",
    })) satisfies RequirementTopicRef[];

    for (const topic of topics) {
      if (topic.topic_code.length > 0) {
        topicIdByCode.set(topic.topic_code, topic.id);
      }
    }
  }

  return {
    requirementSetId: requirementSet.id,
    versionLabel: requirementSet.version_label,
    componentByCode: new Map(components.map((row) => [row.component_code, row.id])),
    topicIdByCode,
    cycleId,
  };
}

async function resolveTrackCycle(
  supabase: SupabaseClient,
  departmentId: string,
  profile: TrackProfileRow | null,
) {
  if (!profile) {
    return null;
  }

  const { data, error } = await supabase
    .from("ems_member_ce_cycles")
    .select("id, cycle_start_date, cycle_end_date")
    .eq("department_id", departmentId)
    .eq("member_track_profile_id", profile.id)
    .order("cycle_end_date", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load EMS cycle.");
  }

  if (!data || data.length === 0) {
    return null;
  }

  if (!profile.expiration_date) {
    return String(data[0]?.id ?? "");
  }

  const exactMatch = data.find((row) => row.cycle_end_date === profile.expiration_date);
  if (exactMatch) {
    return String(exactMatch.id);
  }

  return String(data[0]?.id ?? "");
}

async function loadMemberEmsSources(
  supabase: SupabaseClient,
  departmentId: string,
  memberId: string,
) {
  const { data: attendanceData, error: attendanceError } = await supabase
    .from("training_event_attendance")
    .select("id, training_event_id")
    .eq("department_id", departmentId)
    .eq("member_id", memberId)
    .eq("attendance_status", "attending");

  if (attendanceError) {
    throw new Error(attendanceError.message || "Unable to load EMS attendance sources.");
  }

  const attendanceRows = (attendanceData ?? []).map((row) => ({
    id: String(row.id),
    training_event_id: String(row.training_event_id),
  })) satisfies TrainingEventAttendanceRow[];

  const eventIds = Array.from(new Set(attendanceRows.map((row) => row.training_event_id).filter((value) => value.length > 0)));

  let eventRows: TrainingEventRow[] = [];
  if (eventIds.length > 0) {
    const { data: eventsData, error: eventsError } = await supabase
      .from("training_events")
      .select(
        "id, title, starts_at, hours_credit, category_id, is_ems_training, ems_core_topic, ems_needs_review, ems_provider_name, ems_course_definition_id",
      )
      .eq("department_id", departmentId)
      .in("id", eventIds);

    if (eventsError) {
      throw new Error(eventsError.message || "Unable to load EMS training events.");
    }

    eventRows = (eventsData ?? []).map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : "Untitled Training",
      starts_at: typeof row.starts_at === "string" ? row.starts_at : "",
      hours_credit: typeof row.hours_credit === "number" || typeof row.hours_credit === "string" ? row.hours_credit : null,
      category_id: typeof row.category_id === "string" ? row.category_id : null,
      is_ems_training: row.is_ems_training === true,
      ems_core_topic: typeof row.ems_core_topic === "string" ? row.ems_core_topic : null,
      ems_needs_review: row.ems_needs_review === true,
      ems_provider_name: typeof row.ems_provider_name === "string" ? row.ems_provider_name : null,
      ems_course_definition_id:
        typeof row.ems_course_definition_id === "string" ? row.ems_course_definition_id : null,
    }));
  }

  const eventById = new Map(eventRows.map((row) => [row.id, row]));

  const attendanceSources: AllocationSource[] = [];
  for (const attendance of attendanceRows) {
    const event = eventById.get(attendance.training_event_id);
    if (!event || event.is_ems_training !== true) {
      continue;
    }

    const hours = roundHours(parseHours(event.hours_credit));
    if (hours <= 0) {
      continue;
    }

    const occurredAt = getDateKey(event.starts_at);
    if (!occurredAt) {
      continue;
    }

    attendanceSources.push({
      sourceType: "training_event_attendance",
      sourceRecordId: attendance.id,
      occurredAt,
      title: event.title,
      hours,
      categoryId: event.category_id,
      coreTopic: normalizeTopic(event.ems_core_topic),
      needsReview: event.ems_needs_review === true,
      providerName: event.ems_provider_name,
      courseDefinitionId: event.ems_course_definition_id,
      metadata: {
        training_event_id: event.id,
      },
    });
  }

  const { data: outsideData, error: outsideError } = await supabase
    .from("training_outside_submissions")
    .select(
      "id, title, training_date, hours, category_id, is_ems_training, ems_core_topic, ems_needs_review, ems_provider_name, ems_course_definition_id",
    )
    .eq("department_id", departmentId)
    .eq("member_id", memberId)
    .eq("status", "approved")
    .eq("is_ems_training", true);

  if (outsideError) {
    throw new Error(outsideError.message || "Unable to load approved outside EMS training.");
  }

  const outsideRows = (outsideData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Self-Reported Training",
    training_date: typeof row.training_date === "string" ? row.training_date : "",
    hours: typeof row.hours === "number" || typeof row.hours === "string" ? row.hours : null,
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    is_ems_training: row.is_ems_training === true,
    ems_core_topic: typeof row.ems_core_topic === "string" ? row.ems_core_topic : null,
    ems_needs_review: row.ems_needs_review === true,
    ems_provider_name: typeof row.ems_provider_name === "string" ? row.ems_provider_name : null,
    ems_course_definition_id: typeof row.ems_course_definition_id === "string" ? row.ems_course_definition_id : null,
  })) satisfies OutsideSubmissionRow[];

  const outsideSources: AllocationSource[] = outsideRows
    .filter((row) => row.is_ems_training === true)
    .map((row) => {
      const hours = roundHours(parseHours(row.hours));
      return {
        sourceType: "training_outside_submission" as const,
        sourceRecordId: row.id,
        occurredAt: row.training_date,
        title: row.title,
        hours,
        categoryId: row.category_id,
        coreTopic: normalizeTopic(row.ems_core_topic),
        needsReview: row.ems_needs_review === true,
        providerName: row.ems_provider_name,
        courseDefinitionId: row.ems_course_definition_id,
        metadata: {},
      };
    })
    .filter((row) => row.hours > 0);

  return [...attendanceSources, ...outsideSources];
}

export async function recalculateMemberEmsCreditAccounting(input: {
  supabase: SupabaseClient;
  departmentId: string;
  memberId: string;
  requestedByMemberId: string;
  allocatorVersion?: string;
}): Promise<EmsPersistentRecalcResult> {
  const allocatorVersion = input.allocatorVersion ?? "ems-persistent-v1";

  const [profileRowsResult, memberCertificationsResult] = await Promise.all([
    input.supabase
      .from("ems_member_track_profiles")
      .select("id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
      .eq("department_id", input.departmentId)
      .eq("member_id", input.memberId)
      .order("effective_start_date", { ascending: false }),
    input.supabase
      .from("member_certifications")
      .select("member_id, certification_id, certificate_number, expires_at, issued_at")
      .eq("department_id", input.departmentId)
      .eq("member_id", input.memberId),
  ]);

  if (profileRowsResult.error) {
    throw new Error(profileRowsResult.error.message || "Unable to load EMS track profiles for recalculation.");
  }

  if (memberCertificationsResult.error) {
    throw new Error(memberCertificationsResult.error.message || "Unable to load member certifications for EMS recalculation.");
  }

  const profileRows = (profileRowsResult.data ?? []).map((row) => ({
    id: String(row.id),
    track: row.track === "nremt" ? "nremt" : "iowa",
    certification_level:
      row.certification_level === "emr" ||
      row.certification_level === "emt" ||
      row.certification_level === "aemt" ||
      row.certification_level === "paramedic"
        ? row.certification_level
        : "emt",
    track_status:
      row.track_status === "active" ||
      row.track_status === "inactive" ||
      row.track_status === "expired" ||
      row.track_status === "not_maintained" ||
      row.track_status === "needs_review"
        ? row.track_status
        : "needs_review",
    maintain_track: row.maintain_track === true,
    certification_number: typeof row.certification_number === "string" ? row.certification_number : null,
    expiration_date: typeof row.expiration_date === "string" ? row.expiration_date : null,
    effective_start_date: typeof row.effective_start_date === "string" ? row.effective_start_date : "",
    effective_end_date: typeof row.effective_end_date === "string" ? row.effective_end_date : null,
  })) satisfies TrackProfileRow[];

  const certificationIds = Array.from(
    new Set(
      ((memberCertificationsResult.data ?? []) as Array<{ certification_id: string }>).map((row) => row.certification_id),
    ),
  );

  const certificationCatalogResult = certificationIds.length
    ? await input.supabase
        .from("certifications")
        .select("id, ems_authority, ems_certification_level")
        .eq("department_id", input.departmentId)
        .in("id", certificationIds)
    : { data: [] as unknown[], error: null };

  if (certificationCatalogResult.error) {
    throw new Error(certificationCatalogResult.error.message || "Unable to load certification metadata for EMS recalculation.");
  }

  const certificationTypeById = buildCertificationTypeMetaById(
    ((certificationCatalogResult.data ?? []) as Array<{ id: string; ems_authority: string | null; ems_certification_level: string | null }>).map((row) => ({
      id: String(row.id),
      ems_authority: row.ems_authority,
      ems_certification_level: row.ems_certification_level,
    })),
  );

  const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
    memberCertifications: (memberCertificationsResult.data ?? []).map((row) => ({
      member_id: typeof row.member_id === "string" ? row.member_id : input.memberId,
      certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
      certificate_number: typeof row.certificate_number === "string" ? row.certificate_number : null,
      expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      issued_at: typeof row.issued_at === "string" ? row.issued_at : "",
    })),
    certificationTypeById,
  });

  const iowaBaseProfileRow =
    profileRows.find((row) => row.track === "iowa" && row.effective_end_date === null) ??
    profileRows.find((row) => row.track === "iowa") ??
    null;
  const nremtBaseProfileRow =
    profileRows.find((row) => row.track === "nremt" && row.effective_end_date === null) ??
    profileRows.find((row) => row.track === "nremt") ??
    null;

  const effectiveIowaProfile = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: findCurrentTrackProfile(profileRows, "iowa"),
    authoritativeCertification: authoritativeEmsCertifications.iowa,
  });
  const effectiveNremtProfile = applyAuthoritativeCertificationToTrackProfile({
    track: "nremt",
    profile: findCurrentTrackProfile(profileRows, "nremt"),
    authoritativeCertification: authoritativeEmsCertifications.nremt,
  });

  const iowaProfile = toTrackProfileInput(effectiveIowaProfile);
  const nremtProfile = toTrackProfileInput(effectiveNremtProfile);

  const iowaCycleId = await resolveTrackCycle(input.supabase, input.departmentId, iowaBaseProfileRow);
  const nremtCycleId = await resolveTrackCycle(input.supabase, input.departmentId, nremtBaseProfileRow);

  const iowaRequirementSet = iowaProfile
    ? await loadRequirementSetForTrack(input.supabase, input.departmentId, "iowa", iowaProfile.level)
    : null;
  const nremtRequirementSet = nremtProfile
    ? await loadRequirementSetForTrack(input.supabase, input.departmentId, "nremt", nremtProfile.level)
    : null;

  const iowaRefs = iowaRequirementSet
    ? await loadTrackRequirementRefs(input.supabase, iowaRequirementSet, iowaCycleId)
    : null;
  const nremtRefs = nremtRequirementSet
    ? await loadTrackRequirementRefs(input.supabase, nremtRequirementSet, nremtCycleId)
    : null;

  const sources = await loadMemberEmsSources(input.supabase, input.departmentId, input.memberId);

  const plan = buildEmsAutoAllocationPlan({
    sources,
    iowaProfile,
    nremtProfile,
    iowaRefs,
    nremtRefs,
    allocatorVersion,
  });

  const { data: replaceData, error: replaceError } = await input.supabase.rpc("replace_ems_auto_credit_accounting", {
    p_department_id: input.departmentId,
    p_member_id: input.memberId,
    p_requested_by: input.requestedByMemberId,
    p_sources: plan.persistedSources,
    p_allocations: plan.persistedAllocations,
    p_allocator_version: allocatorVersion,
  });

  if (replaceError) {
    throw new Error(replaceError.message || "Unable to persist EMS credit accounting.");
  }

  const replaceResult = Array.isArray(replaceData) ? replaceData[0] : replaceData;

  return {
    sourceCount: Number(replaceResult?.source_count ?? plan.persistedSources.length),
    allocationCount: Number(replaceResult?.allocation_count ?? plan.persistedAllocations.length),
    warnings: plan.readiness.warnings,
    iowaStatus: plan.readiness.iowa.status,
    nremtStatus: plan.readiness.nremt.status,
  };
}

export function buildEmsAllocationPlanForTests(input: BuildAllocationPlanInput) {
  return buildEmsAutoAllocationPlan(input);
}
