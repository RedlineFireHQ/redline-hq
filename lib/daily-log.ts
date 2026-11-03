export type DailyLogEntry = {
  id: string;
  department_id: string;
  entry_date: string | null;
  entry_time: string | null;
  location: string | null;
  activity: string | null;
  unit: string | null;
  created_by: string;
  created_at: string;
  edited_by: string | null;
  edited_at: string | null;
};

export type DailyLogFields = Pick<DailyLogEntry, "entry_date" | "entry_time" | "location" | "activity" | "unit">;

export function dailyLogDefaults(now = new Date()): DailyLogFields {
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    entry_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    entry_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    location: "", activity: "", unit: "",
  };
}

export function canEditDailyLog(entry: DailyLogEntry, memberId: string, isAdmin: boolean) {
  return isAdmin || entry.created_by === memberId;
}

export function dailyLogDate(value: string | null) {
  if (!value) return "Not entered";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

export function dailyLogTime(value: string | null) {
  if (!value) return "Not entered";
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
}
