export const ISO_TRAINING_CLASSIFICATIONS = [
  { code: "training_facilities", label: "Training Facilities", weight: 35, target: "18 hours per firefighter per year at a qualifying drill facility" },
  { code: "company_training", label: "Company Training", weight: 25, target: "16 hours per firefighter per month (192 per year)" },
  { code: "officer_training", label: "Officer Training", weight: 12, target: "12 hours per officer per year plus Fire Officer I or equivalent" },
  { code: "driver_operator", label: "Driver / Operator", weight: 13, target: "60 initial hours for new operators; 12 refresher hours per year for current operators" },
  { code: "hazmat", label: "Hazardous Materials", weight: 1, target: "6 hours per firefighter per year" },
  { code: "recruit", label: "Recruit Training", weight: 5, target: "240 hours during the recruit's first year when joining without Firefighter I" },
  { code: "building_familiarization", label: "Building Familiarization / Pre-Planning", weight: 9, target: "Visit and pre-plan each applicable property annually; high-hazard or large buildings twice per year" },
] as const;

export type IsoTrainingClassification = (typeof ISO_TRAINING_CLASSIFICATIONS)[number]["code"];

export type IsoFacilityQualificationInput = {
  facility_type: string;
  ownership_type: string;
  tower_stories: number | null;
  yard_acres: number | null;
  purpose_built_live_fire: boolean;
  formal_agreement: boolean;
  agreement_reference: string | null;
};

export function facilityQualifiesForIso(
  facility: IsoFacilityQualificationInput | null | undefined,
): boolean {
  if (!facility) return false;

  const agreementOkay =
    facility.ownership_type === "department_owned" ||
    (facility.formal_agreement === true && Boolean(facility.agreement_reference?.trim()));

  if (!agreementOkay) return false;

  switch (facility.facility_type) {
    case "drill_tower":
      return (facility.tower_stories ?? 0) >= 2;
    case "live_fire_burn_building":
      return facility.purpose_built_live_fire === true;
    case "training_yard":
      return (facility.yard_acres ?? 0) >= 2;
    case "regional_academy":
      return facility.formal_agreement === true && Boolean(facility.agreement_reference?.trim());
    default:
      return false;
  }
}

export function normalizeIsoClassifications(value: unknown): IsoTrainingClassification[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ISO_TRAINING_CLASSIFICATIONS.map((item) => item.code));
  return Array.from(new Set(value.filter((item): item is IsoTrainingClassification => typeof item === "string" && allowed.has(item))));
}

export function calculateIsoMemberHours(input: {
  events: Array<{
    id: string;
    status: string;
    starts_at: string;
    hours_credit: number | null;
    iso_classifications: string[] | null;
    iso_qualifying_facility: boolean;
    iso_driver_operator_training_type?: string | null;
  }>;
  attendance: Array<{
    training_event_id: string;
    member_id: string;
    attendance_status: string;
    hours_earned: number | null;
  }>;
  year: number;
}) {
  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const totals = new Map<string, Record<IsoTrainingClassification, number>>();

  for (const attendance of input.attendance) {
    if (attendance.attendance_status !== "attending") continue;
    const event = eventById.get(attendance.training_event_id);
    if (!event || event.status !== "completed") continue;
    const date = new Date(event.starts_at);
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== input.year) continue;
    const hours = Math.max(0, attendance.hours_earned ?? event.hours_credit ?? 0);
    if (hours <= 0) continue;

    const classifications = normalizeIsoClassifications(event.iso_classifications);
    if (classifications.length === 0) continue;

    let memberTotals = totals.get(attendance.member_id);
    if (!memberTotals) {
      memberTotals = {
        training_facilities: 0,
        company_training: 0,
        officer_training: 0,
        driver_operator: 0,
        hazmat: 0,
        recruit: 0,
        building_familiarization: 0,
      };
      totals.set(attendance.member_id, memberTotals);
    }

    for (const classification of classifications) {
      if (classification === "training_facilities" && event.iso_qualifying_facility !== true) continue;
      memberTotals[classification] += hours;
    }
  }

  return totals;
}
