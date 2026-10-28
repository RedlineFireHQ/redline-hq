import { calculateEmsReadiness, type EmsReadinessResult, type EmsTrackProfileInput, type EmsTrainingRecord } from "@/lib/ems/calculation";
import type { EmsCertificationLevel, EmsCoreTopicCode } from "@/lib/ems/requirements";
import { parseHours } from "@/lib/readiness/member-readiness";

export type EmsProfileForProgress = {
  certification_level: string;
  track_status: string;
  expiration_date: string | null;
  maintain_track: boolean;
};

export type EmsEventForProgress = {
  id: string;
  starts_at: string;
  hours_credit: number | string | null;
  is_ems_training?: boolean | null;
  ems_core_topic?: string | null;
  ems_needs_review?: boolean | null;
};

export type EmsOutsideSubmissionForProgress = {
  id: string;
  training_date: string;
  hours: number | string | null;
  is_ems_training?: boolean | null;
  ems_core_topic?: string | null;
  ems_needs_review?: boolean | null;
};

export type MemberEmsProgress = {
  emsReadiness: EmsReadinessResult;
  emsTrainingRecords: EmsTrainingRecord[];
  visibleWarnings: string[];
  unclassifiedRecordIds: string[];
};

export function normalizeEmsTopic(value: string | null | undefined): EmsCoreTopicCode | null {
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

export function normalizeEmsLevel(value: string): EmsCertificationLevel {
  if (value === "emr" || value === "emt" || value === "aemt" || value === "paramedic") {
    return value;
  }

  return "emt";
}

export function normalizeEmsStatus(value: string): EmsTrackProfileInput["status"] {
  if (value === "active" || value === "inactive" || value === "expired" || value === "not_maintained" || value === "needs_review") {
    return value;
  }

  return "needs_review";
}

export function buildEmsTrainingRecords(
  events: EmsEventForProgress[],
  outsideSubmissions: EmsOutsideSubmissionForProgress[],
): EmsTrainingRecord[] {
  return [
    ...events.map((event) => ({
      id: `event-${event.id}`,
      occurredAt: event.starts_at,
      hours: parseHours(event.hours_credit),
      coreTopic: normalizeEmsTopic(event.ems_core_topic),
      needsReview: event.ems_needs_review === true,
      eligibleForIowa: event.is_ems_training === true,
      eligibleForNremt: event.is_ems_training === true,
      pediatricTagged: false,
    })),
    ...outsideSubmissions.map((submission) => ({
      id: `outside-${submission.id}`,
      occurredAt: submission.training_date,
      hours: parseHours(submission.hours),
      coreTopic: normalizeEmsTopic(submission.ems_core_topic),
      needsReview: submission.ems_needs_review === true,
      eligibleForIowa: submission.is_ems_training === true,
      eligibleForNremt: submission.is_ems_training === true,
      pediatricTagged: false,
    })),
  ].filter((record) => record.eligibleForIowa || record.eligibleForNremt);
}

// Pure and read-only: the one place that turns a member's profiles and EMS records into the displayed progress.
export function buildMemberEmsProgress(input: {
  iowaProfile: EmsProfileForProgress | null;
  nremtProfile: EmsProfileForProgress | null;
  events: EmsEventForProgress[];
  outsideSubmissions: EmsOutsideSubmissionForProgress[];
}): MemberEmsProgress {
  const iowaProfileInput: EmsTrackProfileInput | null = input.iowaProfile
    ? {
        level: normalizeEmsLevel(input.iowaProfile.certification_level),
        status: normalizeEmsStatus(input.iowaProfile.track_status),
        expirationDate: input.iowaProfile.expiration_date,
        maintainTrack: true,
      }
    : null;

  const nremtProfileInput: EmsTrackProfileInput | null = input.nremtProfile
    ? {
        level: normalizeEmsLevel(input.nremtProfile.certification_level),
        status: normalizeEmsStatus(input.nremtProfile.track_status),
        expirationDate: input.nremtProfile.expiration_date,
        maintainTrack: input.nremtProfile.maintain_track === true,
      }
    : null;

  const emsTrainingRecords = buildEmsTrainingRecords(input.events, input.outsideSubmissions);

  const emsReadiness = calculateEmsReadiness({
    iowaProfile: iowaProfileInput,
    nremtProfile: nremtProfileInput,
    trainingRecords: emsTrainingRecords,
  });

  return {
    emsReadiness,
    emsTrainingRecords,
    visibleWarnings: emsReadiness.warnings.filter((warning) => !warning.includes("NEEDS AUTHORITATIVE VERIFICATION")),
    // Shows truly unclassified topic data, not stale review flags.
    unclassifiedRecordIds: emsTrainingRecords
      .filter((record) => record.coreTopic === null || record.coreTopic === "other")
      .map((record) => record.id),
  };
}
