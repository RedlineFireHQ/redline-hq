export const APPARATUS_SCHEDULE_TIME_ZONE = "America/Chicago";

export function apparatusCalendarDay(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APPARATUS_SCHEDULE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}
