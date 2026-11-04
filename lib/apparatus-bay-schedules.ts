/**
 * Shared helpers for department bay schedules (bay -> recurring check weekday).
 * Weekday numbering follows JavaScript Date.getDay(): 0 = Sunday ... 6 = Saturday.
 */

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type BayScheduleSummary = {
  id: string;
  bayLabel: string;
  checkWeekday: number;
};

export function isValidCheckWeekday(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

export function weekdayName(checkWeekday: number | null | undefined): string | null {
  return isValidCheckWeekday(checkWeekday) ? WEEKDAY_NAMES[checkWeekday] : null;
}

/** "Mondays", "Tuesdays", ... for recurring-schedule labels. */
export function weekdayPluralName(checkWeekday: number | null | undefined): string | null {
  const name = weekdayName(checkWeekday);
  return name ? `${name}s` : null;
}

export function bayScheduleLabel(bay: Pick<BayScheduleSummary, "bayLabel" | "checkWeekday">): string {
  const day = weekdayPluralName(bay.checkWeekday);
  return day ? `${bay.bayLabel} — Checks due ${day}` : bay.bayLabel;
}
