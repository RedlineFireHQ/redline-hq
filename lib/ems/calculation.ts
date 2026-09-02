import {
  IOWA_REQUIREMENTS,
  NREMT_REQUIREMENTS,
  type EmsCertificationLevel,
  type EmsCoreTopicCode,
} from "@/lib/ems/requirements";

type ComponentCode = "national_component" | "local_state_component" | "individual_component";

type EmsTrackStatus = "active" | "inactive" | "expired" | "not_maintained" | "needs_review";

export type EmsTrainingRecord = {
  id: string;
  occurredAt: string;
  hours: number;
  coreTopic: EmsCoreTopicCode | null;
  needsReview: boolean;
  eligibleForIowa: boolean;
  eligibleForNremt: boolean;
  nremtComponentHint?: ComponentCode | null;
  pediatricTagged?: boolean;
};

export type EmsManualAllocation = {
  recordId: string;
  track: "iowa" | "nremt";
  component: "core" | ComponentCode;
  topic: Exclude<EmsCoreTopicCode, "other"> | null;
  hours: number;
};

export type EmsTrackProfileInput = {
  level: EmsCertificationLevel;
  status: EmsTrackStatus;
  expirationDate: string | null;
  maintainTrack: boolean;
};

type TopicProgress = {
  topic: Exclude<EmsCoreTopicCode, "other">;
  required: number;
  completed: number;
  remaining: number;
  complete: boolean;
};

type IowaProgress = {
  status: "not_configured" | "not_maintained" | "needs_attention" | "on_track" | "complete";
  expirationDate: string | null;
  totalRequired: number;
  totalCompleted: number;
  totalRemaining: number;
  topics: TopicProgress[];
};

type NremtProgress = {
  status: "not_maintained" | "needs_attention" | "on_track" | "complete";
  expirationDate: string | null;
  totalRequired: number;
  totalCompleted: number;
  totalRemaining: number;
  nationalComponentRequired: number;
  nationalComponentCompleted: number;
  nationalComponentRemaining: number;
  localStateComponentRequired: number | null;
  localStateComponentCompleted: number;
  localStateComponentRemaining: number | null;
  individualComponentRequired: number | null;
  individualComponentCompleted: number;
  individualComponentRemaining: number | null;
  nationalTopics: TopicProgress[];
  pediatricRequirement: {
    required: boolean;
    status: "needs_authoritative_verification" | "complete" | "incomplete";
    note: string;
  };
};

export type EmsReadinessResult = {
  iowa: IowaProgress;
  nremt: NremtProgress;
  warnings: string[];
  unclassifiedRecordIds: string[];
};

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function clampNonNegative(value: number) {
  return Math.max(0, roundHours(value));
}

function sum(values: number[]) {
  return roundHours(values.reduce((total, value) => total + value, 0));
}

function normalizeHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }

  return roundHours(hours);
}

function isDateExpired(value: string | null) {
  if (!value) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < today.getTime();
}

function isKnownTopic(topic: EmsCoreTopicCode | null): topic is Exclude<EmsCoreTopicCode, "other"> {
  return topic === "airway_respirations_ventilations" || topic === "cardiology" || topic === "trauma" || topic === "medical" || topic === "operations";
}

function isAutoCreditableNremtRecord(record: EmsTrainingRecord) {
  return record.eligibleForNremt && !record.needsReview && isKnownTopic(record.coreTopic);
}

export function calculateEmsReadiness(input: {
  iowaProfile: EmsTrackProfileInput | null;
  nremtProfile: EmsTrackProfileInput | null;
  trainingRecords: EmsTrainingRecord[];
  manualAllocations?: EmsManualAllocation[];
}): EmsReadinessResult {
  const warnings: string[] = [];

  const manualAllocations = (input.manualAllocations ?? []).filter((row) => normalizeHours(row.hours) > 0);

  const unclassifiedRecordIds = input.trainingRecords
    .filter((record) => record.needsReview || record.coreTopic === null || record.coreTopic === "other")
    .map((record) => record.id);

  const applyIowa = input.iowaProfile?.status === "active";
  const applyNremt = input.nremtProfile?.maintainTrack === true && input.nremtProfile?.status !== "not_maintained";
  const iowaExpiredByDate = isDateExpired(input.iowaProfile?.expirationDate ?? null);
  const nremtExpiredByDate = isDateExpired(input.nremtProfile?.expirationDate ?? null);

  if (!input.nremtProfile || input.nremtProfile.maintainTrack !== true || input.nremtProfile.status === "not_maintained") {
    warnings.push("National Registry tracking is optional and currently not maintained for this member.");
  }

  if (iowaExpiredByDate) {
    warnings.push("Iowa EMS certification is expired based on track expiration date.");
  }

  if (nremtExpiredByDate && input.nremtProfile?.maintainTrack === true) {
    warnings.push("NREMT certification is expired based on track expiration date.");
  }

  const iowaRequirement = input.iowaProfile ? IOWA_REQUIREMENTS[input.iowaProfile.level] : null;
  const nremtRequirement = input.nremtProfile ? NREMT_REQUIREMENTS[input.nremtProfile.level] : null;

  const iowaTopicHours = new Map<Exclude<EmsCoreTopicCode, "other">, number>();
  const nremtNationalTopicHours = new Map<Exclude<EmsCoreTopicCode, "other">, number>();
  let nremtLocalStateHours = 0;
  let nremtIndividualHours = 0;

  const remainingByRecordForNremt = new Map<string, number>();

  for (const record of input.trainingRecords) {
    const normalizedHours = normalizeHours(record.hours);
    if (normalizedHours <= 0) {
      continue;
    }

    if (isAutoCreditableNremtRecord(record)) {
      remainingByRecordForNremt.set(record.id, normalizedHours);
    }

    if (!record.needsReview && isKnownTopic(record.coreTopic)) {
      if (applyIowa && record.eligibleForIowa) {
        iowaTopicHours.set(record.coreTopic, roundHours((iowaTopicHours.get(record.coreTopic) ?? 0) + normalizedHours));
      }

      if (applyNremt && record.eligibleForNremt) {
        nremtNationalTopicHours.set(record.coreTopic, roundHours((nremtNationalTopicHours.get(record.coreTopic) ?? 0) + normalizedHours));
      }
    }
  }

  if (applyNremt && nremtRequirement) {
    for (const topicRequirement of nremtRequirement.nationalTopicRequirements) {
      const completed = nremtNationalTopicHours.get(topicRequirement.topic) ?? 0;
      const consumed = Math.min(completed, topicRequirement.requiredHours);

      if (consumed <= 0) {
        continue;
      }

      for (const record of input.trainingRecords) {
        if (!isAutoCreditableNremtRecord(record) || record.coreTopic !== topicRequirement.topic) {
          continue;
        }

        const remaining = remainingByRecordForNremt.get(record.id) ?? 0;
        if (remaining <= 0) {
          continue;
        }

        const delta = Math.min(remaining, consumed);
        remainingByRecordForNremt.set(record.id, roundHours(remaining - delta));
      }
    }

    const leftoverNationalEligible = sum(Array.from(remainingByRecordForNremt.values()));

    nremtIndividualHours = roundHours(nremtIndividualHours + leftoverNationalEligible);
  }

  for (const allocation of manualAllocations) {
    const hours = normalizeHours(allocation.hours);
    if (hours <= 0) {
      continue;
    }

    if (allocation.track === "iowa" && applyIowa && isKnownTopic(allocation.topic)) {
      iowaTopicHours.set(allocation.topic, roundHours((iowaTopicHours.get(allocation.topic) ?? 0) + hours));
    }

    if (allocation.track === "nremt" && applyNremt) {
      if (allocation.component === "local_state_component") {
        nremtLocalStateHours = roundHours(nremtLocalStateHours + hours);
      } else if (allocation.component === "individual_component") {
        nremtIndividualHours = roundHours(nremtIndividualHours + hours);
      } else if (allocation.component === "national_component" && isKnownTopic(allocation.topic)) {
        nremtNationalTopicHours.set(allocation.topic, roundHours((nremtNationalTopicHours.get(allocation.topic) ?? 0) + hours));
      }
    }
  }

  const iowaTopics: TopicProgress[] = (iowaRequirement?.topicRequirements ?? []).map((requirement) => {
    const completed = roundHours(iowaTopicHours.get(requirement.topic) ?? 0);
    const remaining = clampNonNegative(requirement.requiredHours - completed);
    return {
      topic: requirement.topic,
      required: requirement.requiredHours,
      completed,
      remaining,
      complete: remaining <= 0,
    };
  });

  const iowaTotalCompleted = sum(iowaTopics.map((topic) => topic.completed));
  const iowaTotalRequired = iowaRequirement?.totalRequiredHours ?? 0;
  const iowaTotalRemaining = clampNonNegative(iowaTotalRequired - iowaTotalCompleted);

  let iowaStatus: IowaProgress["status"] = "not_configured";
  if (!input.iowaProfile || input.iowaProfile.status === "not_maintained") {
    iowaStatus = "not_maintained";
  } else if (input.iowaProfile.status === "inactive" || input.iowaProfile.status === "expired" || iowaExpiredByDate) {
    iowaStatus = "needs_attention";
  } else if (iowaTotalRemaining <= 0 && iowaTopics.every((topic) => topic.complete)) {
    iowaStatus = "complete";
  } else if (iowaTotalCompleted > 0) {
    iowaStatus = "on_track";
  } else {
    iowaStatus = "needs_attention";
  }

  const nremtNationalTopics: TopicProgress[] = (nremtRequirement?.nationalTopicRequirements ?? []).map((requirement) => {
    const completed = roundHours(nremtNationalTopicHours.get(requirement.topic) ?? 0);
    const remaining = clampNonNegative(requirement.requiredHours - completed);
    return {
      topic: requirement.topic,
      required: requirement.requiredHours,
      completed,
      remaining,
      complete: remaining <= 0,
    };
  });

  const nremtNationalComponentRequired = nremtRequirement?.nationalComponentRequiredHours ?? 0;
  const nremtNationalComponentCompleted = sum(nremtNationalTopics.map((topic) => topic.completed));
  const nremtNationalComponentRemaining = clampNonNegative(nremtNationalComponentRequired - nremtNationalComponentCompleted);

  const nremtLocalRequired = nremtRequirement?.localStateComponentRequiredHours ?? null;
  const nremtIndividualRequired = nremtRequirement?.individualComponentRequiredHours ?? null;

  const nremtLocalRemaining = nremtLocalRequired === null ? null : clampNonNegative(nremtLocalRequired - nremtLocalStateHours);
  const nremtIndividualRemaining = nremtIndividualRequired === null ? null : clampNonNegative(nremtIndividualRequired - nremtIndividualHours);

  const nremtTotalCompleted = sum([
    nremtNationalComponentCompleted,
    nremtLocalStateHours,
    nremtIndividualHours,
  ]);

  const nremtTotalRequired = nremtRequirement?.totalNccpRequiredHours ?? 0;
  const nremtTotalRemaining = clampNonNegative(nremtTotalRequired - nremtTotalCompleted);

  let nremtStatus: NremtProgress["status"] = "not_maintained";
  if (applyNremt) {
    if (input.nremtProfile?.status === "inactive" || input.nremtProfile?.status === "expired" || nremtExpiredByDate) {
      nremtStatus = "needs_attention";
    }

    const componentQuantified = nremtLocalRequired !== null && nremtIndividualRequired !== null;
    const componentsComplete =
      nremtNationalComponentRemaining <= 0 &&
      (nremtLocalRemaining ?? 0) <= 0 &&
      (nremtIndividualRemaining ?? 0) <= 0;

    if (nremtStatus !== "needs_attention" && componentQuantified && componentsComplete && nremtTotalRemaining <= 0) {
      nremtStatus = "complete";
    } else if (nremtStatus !== "needs_attention" && nremtTotalCompleted > 0) {
      nremtStatus = "on_track";
    } else if (nremtStatus !== "needs_attention") {
      nremtStatus = "needs_attention";
    }

    if (!componentQuantified) {
      warnings.push("NREMT Local/State and Individual component required-hour split NEEDS AUTHORITATIVE VERIFICATION.");
    }
  }

  const pediatricRequirement = nremtRequirement?.pediatricRequirement ?? {
    required: false,
    ruleStatus: "needs_authoritative_verification" as const,
    note: "Pediatric requirement NEEDS AUTHORITATIVE VERIFICATION.",
  };

  const pediatricStatus = pediatricRequirement.ruleStatus === "needs_authoritative_verification"
    ? "needs_authoritative_verification"
    : input.trainingRecords.some((record) => record.pediatricTagged)
      ? "complete"
      : "incomplete";

  if (pediatricRequirement.ruleStatus === "needs_authoritative_verification") {
    warnings.push(pediatricRequirement.note);
  }

  return {
    iowa: {
      status: iowaStatus,
      expirationDate: input.iowaProfile?.expirationDate ?? null,
      totalRequired: iowaTotalRequired,
      totalCompleted: iowaTotalCompleted,
      totalRemaining: iowaTotalRemaining,
      topics: iowaTopics,
    },
    nremt: {
      status: nremtStatus,
      expirationDate: input.nremtProfile?.expirationDate ?? null,
      totalRequired: nremtTotalRequired,
      totalCompleted: nremtTotalCompleted,
      totalRemaining: nremtTotalRemaining,
      nationalComponentRequired: nremtNationalComponentRequired,
      nationalComponentCompleted: nremtNationalComponentCompleted,
      nationalComponentRemaining: nremtNationalComponentRemaining,
      localStateComponentRequired: nremtLocalRequired,
      localStateComponentCompleted: nremtLocalStateHours,
      localStateComponentRemaining: nremtLocalRemaining,
      individualComponentRequired: nremtIndividualRequired,
      individualComponentCompleted: nremtIndividualHours,
      individualComponentRemaining: nremtIndividualRemaining,
      nationalTopics: nremtNationalTopics,
      pediatricRequirement: {
        required: pediatricRequirement.required,
        status: pediatricStatus,
        note: pediatricRequirement.note,
      },
    },
    warnings,
    unclassifiedRecordIds,
  };
}
