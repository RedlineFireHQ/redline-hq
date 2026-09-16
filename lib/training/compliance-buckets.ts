import { parseHours } from "@/lib/readiness/member-readiness";

export type TrainingComplianceBucket = "fire_annual" | "ems_ce" | "other";

type HoursBucketTotals = {
  fireAnnualHours: number;
  emsContinuingEducationHours: number;
  otherHours: number;
  totalHours: number;
};

type TrainingHoursInput = {
  categoryId: string | null;
  hours: number | string | null | undefined;
};

// Keywords, not exact names: a category matches if it contains one of these
// tokens (or vice versa), so department-specific naming like "Wildland
// Firefighting" still matches the "wildland" fire-annual keyword instead of
// silently falling through to "other".
const FIRE_ANNUAL_CATEGORY_KEYWORDS = [
  "communications",
  "dive training",
  "driver/operator",
  "fire suppression",
  "hazmat",
  "ice rescue",
  "incident command/leadership",
  "pre-plans / site visits",
  "safety/ppe",
  "swift water",
  "technical rescue",
  "wildland",
];

function normalizeCategoryName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function getTrainingComplianceBucketByCategoryName(categoryName: string | null | undefined): TrainingComplianceBucket {
  const normalized = normalizeCategoryName(categoryName);

  if (!normalized) {
    return "other";
  }

  if (normalized === "ems") {
    return "ems_ce";
  }

  if (
    normalized === "other" ||
    normalized.includes("public education") ||
    normalized.includes("administrative") ||
    normalized.includes("meeting")
  ) {
    return "other";
  }

  const matchesFireAnnual = FIRE_ANNUAL_CATEGORY_KEYWORDS.some(
    (keyword) => normalized.includes(keyword) || keyword.includes(normalized),
  );

  if (matchesFireAnnual) {
    return "fire_annual";
  }

  return "other";
}

export function getTrainingComplianceBucketByCategoryId(
  categoryId: string | null,
  categoryNameById: Map<string, string>,
): TrainingComplianceBucket {
  const categoryName = categoryId ? categoryNameById.get(categoryId) ?? null : null;
  return getTrainingComplianceBucketByCategoryName(categoryName);
}

export function calculateComplianceBucketHours(
  rows: TrainingHoursInput[],
  categoryNameById: Map<string, string>,
): HoursBucketTotals {
  const totals: HoursBucketTotals = {
    fireAnnualHours: 0,
    emsContinuingEducationHours: 0,
    otherHours: 0,
    totalHours: 0,
  };

  for (const row of rows) {
    const hours = parseHours(row.hours);
    if (hours <= 0) {
      continue;
    }

    totals.totalHours += hours;

    const bucket = getTrainingComplianceBucketByCategoryId(row.categoryId, categoryNameById);
    if (bucket === "fire_annual") {
      totals.fireAnnualHours += hours;
      continue;
    }

    if (bucket === "ems_ce") {
      totals.emsContinuingEducationHours += hours;
      continue;
    }

    totals.otherHours += hours;
  }

  return totals;
}