export type EmsTrack = "iowa" | "nremt";
export type EmsCertificationLevel = "emr" | "emt" | "aemt" | "paramedic" | "ccp";

export const EMS_CERTIFICATION_LEVELS: Array<{ code: EmsCertificationLevel; label: string }> = [
  { code: "emr", label: "EMR" },
  { code: "emt", label: "EMT" },
  { code: "aemt", label: "AEMT" },
  { code: "paramedic", label: "Paramedic" },
  { code: "ccp", label: "Critical Care Paramedic (CCP)" },
];

export type EmsCoreTopicCode =
  | "airway_respirations_ventilations"
  | "cardiology"
  | "trauma"
  | "medical"
  | "operations"
  | "pediatric"
  | "critical_care_paramedic"
  | "other";

export const EMS_CORE_TOPICS: Array<{ code: EmsCoreTopicCode; label: string }> = [
  { code: "airway_respirations_ventilations", label: "Airway, Respirations, Ventilations" },
  { code: "cardiology", label: "Cardiology" },
  { code: "trauma", label: "Trauma" },
  { code: "medical", label: "Medical" },
  { code: "operations", label: "Operations" },
  { code: "pediatric", label: "Pediatric" },
  { code: "critical_care_paramedic", label: "Critical Care Paramedic" },
  { code: "other", label: "Other" },
];

export function isEmsCertificationLevel(value: unknown): value is EmsCertificationLevel {
  return value === "emr" || value === "emt" || value === "aemt" || value === "paramedic" || value === "ccp";
}

export function getEmsCertificationLevels(track: EmsTrack) {
  return EMS_CERTIFICATION_LEVELS.filter((level) => track === "iowa" || level.code !== "ccp");
}

export function assertEmsLevelForTrack(track: EmsTrack, level: EmsCertificationLevel) {
  if (track === "nremt") getNremtRequirement(level);
}

export function isEmsCoreTopic(value: unknown): value is EmsCoreTopicCode {
  return EMS_CORE_TOPICS.some((topic) => topic.code === value);
}

export function formatEmsLevelLabel(level: string) {
  return level === "ccp" ? "Critical Care Paramedic (CCP)" : level.toUpperCase();
}

export function formatEmsTopicLabel(topic: string) {
  return EMS_CORE_TOPICS.find((item) => item.code === topic)?.label ?? "Other";
}

export type TopicRequirement = {
  topic: Exclude<EmsCoreTopicCode, "other">;
  requiredHours: number;
};

export type IowaRequirement = {
  totalRequiredHours: number;
  topicRequirements: TopicRequirement[];
};

export type NremtRequirement = {
  totalNccpRequiredHours: number;
  nationalComponentRequiredHours: number;
  nationalTopicRequirements: TopicRequirement[];
  localStateComponentRequiredHours: number | null;
  individualComponentRequiredHours: number | null;
  pediatricRequirement: {
    required: boolean;
    ruleStatus: "confirmed" | "needs_authoritative_verification";
    note: string;
  };
};

export const IOWA_REQUIREMENTS: Record<EmsCertificationLevel, IowaRequirement> = {
  emr: {
    totalRequiredHours: 8,
    topicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 1 },
      { topic: "cardiology", requiredHours: 2 },
      { topic: "trauma", requiredHours: 1 },
      { topic: "medical", requiredHours: 3 },
      { topic: "operations", requiredHours: 1 },
    ],
  },
  emt: {
    totalRequiredHours: 20,
    topicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 1 },
      { topic: "cardiology", requiredHours: 6 },
      { topic: "trauma", requiredHours: 2 },
      { topic: "medical", requiredHours: 6 },
      { topic: "operations", requiredHours: 5 },
    ],
  },
  aemt: {
    totalRequiredHours: 25,
    topicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 2 },
      { topic: "cardiology", requiredHours: 7 },
      { topic: "trauma", requiredHours: 3 },
      { topic: "medical", requiredHours: 8 },
      { topic: "operations", requiredHours: 5 },
    ],
  },
  paramedic: {
    totalRequiredHours: 30,
    topicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 3 },
      { topic: "cardiology", requiredHours: 9 },
      { topic: "trauma", requiredHours: 3 },
      { topic: "medical", requiredHours: 9 },
      { topic: "operations", requiredHours: 6 },
    ],
  },
  ccp: {
    totalRequiredHours: 46,
    topicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 6 },
      { topic: "cardiology", requiredHours: 7 },
      { topic: "trauma", requiredHours: 5 },
      { topic: "medical", requiredHours: 8 },
      { topic: "operations", requiredHours: 4 },
      { topic: "pediatric", requiredHours: 4 },
      { topic: "critical_care_paramedic", requiredHours: 12 },
    ],
  },
};

export function getIowaTopicRequirements(level: EmsCertificationLevel): TopicRequirement[] {
  const topics = IOWA_REQUIREMENTS[level].topicRequirements;
  // Phase 1 exposes Pediatric for legacy levels without assigning Phase 2 hours.
  return level === "ccp" ? topics : [...topics, { topic: "pediatric", requiredHours: 0 }];
}

export const NREMT_REQUIREMENTS: Record<Exclude<EmsCertificationLevel, "ccp">, NremtRequirement> = {
  emr: {
    totalNccpRequiredHours: 16,
    nationalComponentRequiredHours: 8,
    nationalTopicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 1.5 },
      { topic: "cardiology", requiredHours: 2 },
      { topic: "trauma", requiredHours: 1 },
      { topic: "medical", requiredHours: 2.5 },
      { topic: "operations", requiredHours: 1 },
    ],
    localStateComponentRequiredHours: null,
    individualComponentRequiredHours: null,
    pediatricRequirement: {
      required: true,
      ruleStatus: "needs_authoritative_verification",
      note: "National Registry pediatric-content requirement exists in supplied material, but exact quantitative rule NEEDS AUTHORITATIVE VERIFICATION.",
    },
  },
  emt: {
    totalNccpRequiredHours: 40,
    nationalComponentRequiredHours: 20,
    nationalTopicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 4 },
      { topic: "cardiology", requiredHours: 5 },
      { topic: "trauma", requiredHours: 3 },
      { topic: "medical", requiredHours: 6 },
      { topic: "operations", requiredHours: 2 },
    ],
    localStateComponentRequiredHours: null,
    individualComponentRequiredHours: null,
    pediatricRequirement: {
      required: true,
      ruleStatus: "needs_authoritative_verification",
      note: "National Registry pediatric-content requirement exists in supplied material, but exact quantitative rule NEEDS AUTHORITATIVE VERIFICATION.",
    },
  },
  aemt: {
    totalNccpRequiredHours: 50,
    nationalComponentRequiredHours: 25,
    nationalTopicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 5 },
      { topic: "cardiology", requiredHours: 6 },
      { topic: "trauma", requiredHours: 4 },
      { topic: "medical", requiredHours: 7 },
      { topic: "operations", requiredHours: 3 },
    ],
    localStateComponentRequiredHours: null,
    individualComponentRequiredHours: null,
    pediatricRequirement: {
      required: true,
      ruleStatus: "needs_authoritative_verification",
      note: "National Registry pediatric-content requirement exists in supplied material, but exact quantitative rule NEEDS AUTHORITATIVE VERIFICATION.",
    },
  },
  paramedic: {
    totalNccpRequiredHours: 30,
    nationalComponentRequiredHours: 30,
    nationalTopicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 6 },
      { topic: "cardiology", requiredHours: 7 },
      { topic: "trauma", requiredHours: 5 },
      { topic: "medical", requiredHours: 8 },
      { topic: "operations", requiredHours: 4 },
    ],
    localStateComponentRequiredHours: 0,
    individualComponentRequiredHours: 0,
    pediatricRequirement: {
      required: false,
      ruleStatus: "confirmed",
      note: "The simplified National Registry Paramedic requirement consists only of the five national categories.",
    },
  },
};

export function getNremtRequirement(level: EmsCertificationLevel): NremtRequirement {
  if (level === "ccp") {
    throw new Error("Critical Care Paramedic is an Iowa EMS level only. Select a supported National Registry level.");
  }
  return NREMT_REQUIREMENTS[level];
}

export function isNremtNationalOnly(level: EmsCertificationLevel) {
  const requirement = getNremtRequirement(level);
  return requirement.localStateComponentRequiredHours === 0 && requirement.individualComponentRequiredHours === 0;
}

export function isTopicApplicableToTrack(
  topic: EmsCoreTopicCode | null,
  track: EmsTrack,
  level: EmsCertificationLevel,
): topic is Exclude<EmsCoreTopicCode, "other"> {
  return topic !== null && topic !== "other" && (
    track === "iowa"
      ? getIowaTopicRequirements(level).some((requirement) => requirement.topic === topic)
      : getNremtRequirement(level).nationalTopicRequirements.some((requirement) => requirement.topic === topic)
  );
}

export const EMS_STANDARD_COURSE_NAMES = [
  "CPR-HCP",
  "ACLS",
  "PALS",
  "PEPP",
  "AMLS",
  "EMPACT",
  "ITLS",
  "PHTLS",
  "TECC",
  "ATLS",
  "EMS Safety",
  "EVOC/EVOS",
  "TIMS",
  "HAZMAT",
  "ICS Courses",
  "Other",
] as const;
