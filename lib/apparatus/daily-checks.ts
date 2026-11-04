import type { ApparatusChecklistResultStatus } from "@/lib/apparatus/checklist";
import { apparatusCalendarDay } from "@/lib/calendar-day";

/**
 * Saturday-only checklist section for the Red Oak "Daily Apparatus Checks"
 * administrative assignment. Hidden on non-Saturday Central calendar days so the optional
 * radio/fuel items are never stamped automatically by All Pass.
 */
export const DAILY_CHECKS_SATURDAY_SECTION = "Saturday Only";

/** Evaluate the department's calendar day, not the server/browser timezone. */
export function isSaturday(date: Date = new Date()): boolean {
  return apparatusCalendarDay(date).getUTCDay() === 6;
}

/**
 * Labels shown for the special administrative "Daily Apparatus Checks"
 * checklist (PASS / FAIL / N/A) versus the normal inventory-style checklist
 * (PRESENT / MISSING / N/A). Underlying persisted statuses are unchanged:
 * checked / deficiency / not_applicable.
 */
export function statusLabelsFor(specialMode: boolean): {
  checked: string;
  deficiency: string;
  notApplicable: string;
} {
  return specialMode
    ? { checked: "PASS", deficiency: "FAIL", notApplicable: "N/A" }
    : { checked: "PRESENT", deficiency: "MISSING", notApplicable: "N/A" };
}

/** Text shown while an apparatus item is still unmarked. */
export function unmarkedActionLabel(specialMode: boolean): string {
  return specialMode ? "Tap to mark Pass / Fail / N/A" : "Tap to mark";
}

/** Filter out Saturday-only sections when the department day is not Saturday. */
export function visibleSectionNames(sectionNames: string[], saturday: boolean): string[] {
  if (saturday) {
    return sectionNames;
  }
  return sectionNames.filter((name) => name !== DAILY_CHECKS_SATURDAY_SECTION);
}

/**
 * Items eligible for the bulk All Pass operation. On non-Saturday days the
 * Saturday-only section is excluded so optional radio/fuel items are not
 * stamped as passed on weekdays.
 */
export function bulkPassTargets<T extends { sectionName: string }>(
  items: T[],
  saturday: boolean,
): T[] {
  if (saturday) {
    return items;
  }
  return items.filter((item) => item.sectionName !== DAILY_CHECKS_SATURDAY_SECTION);
}

/** Prefill used when a daily-checks apparatus item is flagged as a deficiency. */
export function deficiencyPrefill(itemLabel: string, specialMode: boolean): string {
  return specialMode ? `Unit ${itemLabel} — ` : "";
}

/** A bulk All Pass action requires explicit confirmation before writing. */
export function needsAllPassConfirmation(snapshotActive: boolean): boolean {
  return !snapshotActive;
}

export function isScheduledChecklistItemRequired(
  item: { isRequired: boolean; sectionName: string },
  specialMode: boolean,
  saturday: boolean,
): boolean {
  return item.isRequired || (specialMode && saturday && item.sectionName === DAILY_CHECKS_SATURDAY_SECTION);
}

export type { ApparatusChecklistResultStatus };
