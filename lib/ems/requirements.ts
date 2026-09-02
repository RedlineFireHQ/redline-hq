export type EmsTrack = "iowa" | "nremt";
export type EmsCertificationLevel = "emr" | "emt" | "aemt" | "paramedic";

export type EmsCoreTopicCode =
  | "airway_respirations_ventilations"
  | "cardiology"
  | "trauma"
  | "medical"
  | "operations"
  | "other";

export const EMS_CORE_TOPICS: Array<{ code: EmsCoreTopicCode; label: string }> = [
  { code: "airway_respirations_ventilations", label: "Airway, Respirations, Ventilations" },
  { code: "cardiology", label: "Cardiology" },
  { code: "trauma", label: "Trauma" },
  { code: "medical", label: "Medical" },
  { code: "operations", label: "Operations" },
  { code: "other", label: "Other" },
];

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
};

export const NREMT_REQUIREMENTS: Record<EmsCertificationLevel, NremtRequirement> = {
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
    totalNccpRequiredHours: 60,
    nationalComponentRequiredHours: 30,
    nationalTopicRequirements: [
      { topic: "airway_respirations_ventilations", requiredHours: 6 },
      { topic: "cardiology", requiredHours: 7 },
      { topic: "trauma", requiredHours: 5 },
      { topic: "medical", requiredHours: 8 },
      { topic: "operations", requiredHours: 4 },
    ],
    localStateComponentRequiredHours: null,
    individualComponentRequiredHours: null,
    pediatricRequirement: {
      required: true,
      ruleStatus: "needs_authoritative_verification",
      note: "National Registry pediatric-content requirement exists in supplied material, but exact quantitative rule NEEDS AUTHORITATIVE VERIFICATION.",
    },
  },
};

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
