import { annualDueDate, fitStatus, type FitResult, type MaskSize } from "./status";

export type ReportMember = { id: string; name: string };
export type ReportTest = {
  result_id: string;
  member_id: string;
  member_name: string;
  session_id: string;
  session_name: string;
  test_date: string;
  tester_name: string;
  result: FitResult;
  mask_size: MaskSize;
};
export type ReportLine = {
  member_name: string;
  test_date: string;
  result: string;
  mask_size: string;
  tester: string;
  session: string;
  due_date: string;
  status: string;
};

export function buildFitReport(
  members: ReportMember[],
  testsNewestFirst: ReportTest[],
  options: { mode: "latest" | "history"; memberId: string; search: string; from: string; to: string; today: string; allTime?: boolean },
): ReportLine[] {
  const search = options.search.trim().toLowerCase();
  const allowed = new Set(members.filter((member) =>
    (options.memberId === "all" || !options.memberId || member.id === options.memberId)
      && (!search || member.name.toLowerCase().includes(search)),
  ).map((member) => member.id));
  const latest = new Map<string, ReportTest>();
  for (const test of testsNewestFirst) {
    if (!latest.has(test.member_id)) latest.set(test.member_id, test);
  }
  const format = (test: ReportTest, name: string): ReportLine => ({
    member_name: name,
    test_date: test.test_date,
    result: test.result,
    mask_size: test.mask_size,
    tester: test.tester_name,
    session: `${test.session_name} (${test.session_id})`,
    due_date: annualDueDate(test.test_date),
    status: fitStatus({ date: test.test_date, result: test.result }, options.today),
  });
  const inPeriod = (date: string) => options.allTime || (date >= options.from && date <= options.to);
  if (options.mode === "history") {
    return testsNewestFirst.filter((test) => allowed.has(test.member_id)
      && inPeriod(test.test_date))
      .map((test) => ({ ...format(test, test.member_name), status: test.result === "Fail" ? "Failed" : "Historical result" }));
  }
  return members.filter((member) => allowed.has(member.id)).flatMap((member) => {
    const test = latest.get(member.id);
    if (!test) return [{
      member_name: member.name, test_date: "", result: "", mask_size: "", tester: "",
      session: "", due_date: "", status: "No recorded test",
    }];
    return inPeriod(test.test_date) ? [format(test, member.name)] : [];
  });
}
