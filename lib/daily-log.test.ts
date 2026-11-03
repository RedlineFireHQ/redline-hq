import assert from "node:assert/strict";
import test from "node:test";
import { canEditDailyLog, dailyLogDate, dailyLogDefaults, dailyLogTime, type DailyLogEntry } from "./daily-log";

test("date and time default to the local current minute, with exactly five optional fields", () => {
  assert.deepEqual(dailyLogDefaults(new Date(2026, 10, 3, 9, 7)), {
    entry_date: "2026-11-03", entry_time: "09:07", location: "", activity: "", unit: "",
  });
});

test("blank dates and times remain blank and date display never shifts across time zones", () => {
  assert.equal(dailyLogDate(null), "Not entered");
  assert.equal(dailyLogTime(null), "Not entered");
  assert.equal(dailyLogDate("2026-11-03"), "11/03/2026");
  assert.equal(dailyLogTime("00:05:00"), "12:05 AM");
  assert.equal(dailyLogTime("12:30:00"), "12:30 PM");
  assert.equal(dailyLogTime("23:55:00"), "11:55 PM");
});

test("only the creator or an Administrator gets the edit control", () => {
  const entry: DailyLogEntry = {
    id: "entry", department_id: "dept", entry_date: null, entry_time: null,
    location: null, activity: null, unit: null, created_by: "creator",
    created_at: "2026-11-03T12:00:00Z", edited_by: null, edited_at: null,
  };
  assert.equal(canEditDailyLog(entry, "creator", false), true);
  assert.equal(canEditDailyLog(entry, "other", false), false);
  assert.equal(canEditDailyLog(entry, "admin", true), true);
});
