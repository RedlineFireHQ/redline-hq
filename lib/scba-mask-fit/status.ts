export type FitResult = "Pass" | "Fail";
export type MaskSize = "S" | "M" | "L";
export type FitStatus = "No recorded test" | "Failed - action required" | "Overdue" | "Current";

export const FIT_TEST_TIME_ZONE = "America/Chicago";

export function fitTestLocalDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FIT_TEST_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing ${type} in local date`);
    return value;
  };
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function annualDueDate(testDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(testDate);
  if (!match) throw new Error("Invalid test date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Invalid test date");
  }
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return `${year + 1}-${match[2]}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function fitStatus(test: { date: string; result: FitResult } | null, today: string): FitStatus {
  if (!test) return "No recorded test";
  if (test.result === "Fail") return "Failed - action required";
  return annualDueDate(test.date) < today ? "Overdue" : "Current";
}

export type FitTest = {
  memberId: string;
  date: string;
  result: FitResult;
  maskSize: MaskSize;
  tester: string;
  sessionId: string;
  sessionName: string;
  createdAt: string;
};

export function latestTests(tests: FitTest[]): Map<string, FitTest> {
  const latest = new Map<string, FitTest>();
  for (const test of tests) {
    const previous = latest.get(test.memberId);
    if (!previous || test.date > previous.date ||
      (test.date === previous.date && (test.createdAt > previous.createdAt ||
        (test.createdAt === previous.createdAt && test.sessionId > previous.sessionId)))) {
      latest.set(test.memberId, test);
    }
  }
  return latest;
}
