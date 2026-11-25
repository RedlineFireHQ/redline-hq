export const ISO_TRAINING_CLASSIFICATIONS = [
  { value: "training_facilities", label: "Training Facilities" },
  { value: "company_training", label: "Company Training" },
  { value: "officer_training", label: "Officer Training" },
  { value: "driver_operator", label: "Driver/Operator" },
  { value: "hazmat", label: "HazMat" },
  { value: "recruit", label: "Recruit" },
  { value: "building_familiarization", label: "Building Familiarization / Pre-Incident Planning" },
] as const;

export type IsoTrainingClassification = (typeof ISO_TRAINING_CLASSIFICATIONS)[number]["value"];

export const ISO_FACILITY_TYPES = [
  { value: "drill_tower", label: "Qualifying Drill Tower" },
  { value: "live_fire_burn_building", label: "Live-Fire / Burn Building" },
  { value: "training_yard", label: "Dedicated Training Yard (2+ acres)" },
  { value: "regional_academy", label: "Regional Academy / External Facility" },
  { value: "other", label: "Other Qualifying Facility" },
] as const;

export type IsoFacilityType = (typeof ISO_FACILITY_TYPES)[number]["value"];

export function suggestIsoTrainingClassification(categoryName: string | null | undefined): IsoTrainingClassification | "" {
  const name = (categoryName ?? "").trim().toLowerCase();
  if (!name || name === "ems" || name.includes("administrative") || name.includes("public education")) return "";
  if (name.includes("driver") || name.includes("operator") || name.includes("pump")) return "driver_operator";
  if (name.includes("hazmat") || name.includes("hazardous")) return "hazmat";
  if (name.includes("officer") || name.includes("leadership") || name.includes("command")) return "officer_training";
  if (name.includes("recruit") || name.includes("academy")) return "recruit";
  if (name.includes("pre-plan") || name.includes("preplan") || name.includes("site visit") || name.includes("building familiarization")) return "building_familiarization";
  return "company_training";
}

export function isoClassificationLabel(value: string | null | undefined): string {
  return ISO_TRAINING_CLASSIFICATIONS.find((item) => item.value === value)?.label ?? "Not classified";
}
