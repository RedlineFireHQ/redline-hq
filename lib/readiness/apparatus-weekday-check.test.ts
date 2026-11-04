import test from "node:test";
import assert from "node:assert/strict";
import { apparatusCalendarDay } from "@/lib/calendar-day";

import {
  calculateApparatusChecksBucketScore,
  calculateWeekdayAnchoredCheckScore,
  getWeekdayAnchorDueDay,
} from "@/lib/readiness/apparatus-readiness";

/**
 * Weekday-anchored (bay-assigned) apparatus check cycle tests.
 *
 * Approved semantics:
 * - The configured weekday is a recurring calendar anchor; completing a check
 *   never shifts it.
 * - currentDueDay = most recent occurrence of the weekday (today counts).
 * - A check satisfies the current cycle when its calendar day is strictly
 *   after the previous due day (currentDueDay - 7). Early, on-time, and late
 *   completion all count.
 * - Unsatisfied scoring: due today 15, 1 day overdue 10, 2 days 5, 3+ days 0.
 *
 * Calendar references (verified): 2026-10-19 is a Monday.
 *   Mon 10/12, Mon 10/19, Mon 10/26 are consecutive Monday anchors.
 */

const MONDAY = 1;

function at(year: number, monthIndex: number, day: number, hour = 12): Date {
  return new Date(Date.UTC(year, monthIndex, day, hour + 6));
}

function iso(year: number, monthIndex: number, day: number, hour = 9): string {
  return at(year, monthIndex, day, hour).toISOString();
}

// 2026-10-19 (Mon), 2026-10-20 (Tue), 2026-10-26 (Mon) etc.
const MON_OCT_12 = at(2026, 9, 12);
const FRI_OCT_16 = at(2026, 9, 16);
const SUN_OCT_18 = at(2026, 9, 18);
const MON_OCT_19 = at(2026, 9, 19);
const TUE_OCT_20 = at(2026, 9, 20);
const WED_OCT_21 = at(2026, 9, 21);
const THU_OCT_22 = at(2026, 9, 22);
const SUN_OCT_25 = at(2026, 9, 25);
const MON_OCT_26 = at(2026, 9, 26);

test("W1. anchor is the most recent occurrence of the weekday, including today", () => {
  const day = (value: Date) => apparatusCalendarDay(value).getTime();
  assert.equal(getWeekdayAnchorDueDay(MON_OCT_19, MONDAY).getTime(), day(MON_OCT_19));
  assert.equal(getWeekdayAnchorDueDay(TUE_OCT_20, MONDAY).getTime(), day(MON_OCT_19));
  assert.equal(getWeekdayAnchorDueDay(SUN_OCT_25, MONDAY).getTime(), day(MON_OCT_19));
  assert.equal(getWeekdayAnchorDueDay(MON_OCT_26, MONDAY).getTime(), day(MON_OCT_26));
  // Sunday anchor evaluated on a Monday rolls back one day, not forward six.
  assert.equal(getWeekdayAnchorDueDay(MON_OCT_19, 0).getTime(), day(SUN_OCT_18));
});

test("W2. first scheduled check: never checked on the due day is due today (15)", () => {
  const result = calculateWeekdayAnchoredCheckScore(null, MONDAY, MON_OCT_19);
  assert.equal(result.score, 15);
  assert.equal(result.blockingGap, null);
});

test("W3. on-time completion on the scheduled day is current (20)", () => {
  const result = calculateWeekdayAnchoredCheckScore(iso(2026, 9, 19), MONDAY, MON_OCT_19);
  assert.equal(result.score, 20);
});

test("W4. early completion before the assigned weekday satisfies the upcoming cycle", () => {
  // Checked Friday for the Monday cycle: current when Monday arrives.
  const checkedFriday = iso(2026, 9, 16);
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedFriday, MONDAY, MON_OCT_19).score, 20);
  // Checked the day before (Sunday) also satisfies Monday's cycle.
  const checkedSunday = iso(2026, 9, 18);
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedSunday, MONDAY, MON_OCT_19).score, 20);
});

test("W5. late completion satisfies the upcoming cycle (completion never shifts the anchor)", () => {
  // Due Mon 10/19, completed late Wed 10/21. Next Monday 10/26 must be current.
  const checkedLateWednesday = iso(2026, 9, 21);
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedLateWednesday, MONDAY, WED_OCT_21).score, 20);
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedLateWednesday, MONDAY, MON_OCT_26).score, 20);
});

test("W6. a check on the previous due day does NOT roll forward into the next cycle", () => {
  // Checked exactly on Mon 10/12. When Mon 10/19 arrives, that check covered
  // the 10/12 cycle only; the unit is due again.
  const checkedPreviousDueDay = iso(2026, 9, 12);
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedPreviousDueDay, MONDAY, MON_OCT_19).score, 15);
});

test("W7. missed check decays through the approved scale", () => {
  assert.equal(calculateWeekdayAnchoredCheckScore(null, MONDAY, MON_OCT_19).score, 15); // due today
  assert.equal(calculateWeekdayAnchoredCheckScore(null, MONDAY, TUE_OCT_20).score, 10); // 1 day
  assert.equal(calculateWeekdayAnchoredCheckScore(null, MONDAY, WED_OCT_21).score, 5); // 2 days
  assert.equal(calculateWeekdayAnchoredCheckScore(null, MONDAY, THU_OCT_22).score, 0); // 3 days
  assert.equal(calculateWeekdayAnchoredCheckScore(null, MONDAY, SUN_OCT_25).score, 0); // still 3+ days
});

test("W8. week boundary: overdue resets to due-today on the next scheduled weekday", () => {
  // Missed the 10/19 cycle entirely; when the next Monday arrives the unit is
  // due that day rather than remaining permanently at 0.
  assert.equal(calculateWeekdayAnchoredCheckScore(null, MONDAY, MON_OCT_26).score, 15);
});

test("W9. Sunday-to-Monday transition keeps a satisfied cycle current through Sunday, due again Monday", () => {
  const checkedOnDueDay = iso(2026, 9, 19);
  // Sunday 10/25: still within the cycle satisfied by the 10/19 check.
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedOnDueDay, MONDAY, SUN_OCT_25).score, 20);
  // Monday 10/26: new cycle begins; the old check no longer covers it.
  assert.equal(calculateWeekdayAnchoredCheckScore(checkedOnDueDay, MONDAY, MON_OCT_26).score, 15);
});

test("W10. completing a check early in the week does not mark the unit overdue mid-cycle", () => {
  // Due Mon 10/19; checked early Fri 10/16. Every day of that cycle is current.
  const checkedEarly = iso(2026, 9, 16);
  for (const day of [FRI_OCT_16, SUN_OCT_18, MON_OCT_19, TUE_OCT_20, SUN_OCT_25]) {
    assert.equal(calculateWeekdayAnchoredCheckScore(checkedEarly, MONDAY, day).score, 20);
  }
});

test("W11. invalid weekday configuration is a blocking gap, not a score", () => {
  for (const bad of [-1, 7, 1.5, Number.NaN]) {
    const result = calculateWeekdayAnchoredCheckScore(null, bad, MON_OCT_19);
    assert.equal(result.score, null);
    assert.match(result.blockingGap ?? "", /weekday/i);
  }
});

test("W12. invalid completion timestamp is a blocking gap", () => {
  const result = calculateWeekdayAnchoredCheckScore("not-a-date", MONDAY, MON_OCT_19);
  assert.equal(result.score, null);
  assert.match(result.blockingGap ?? "", /timestamp/i);
});

test("W13. bucket score routes to the weekday branch only when scheduledWeekday is set", () => {
  // With a weekday, interval fields are irrelevant to the check bucket.
  const withWeekday = calculateApparatusChecksBucketScore(
    { lastCompletedAt: null, intervalDays: 30, scoreProfile: "monthly", scheduledWeekday: MONDAY },
    MON_OCT_19,
  );
  assert.equal(withWeekday.score, 15);

  // Null weekday preserves the locked interval behavior (weekly interval,
  // checked 7 days ago -> due today -> scaled-custom due-today score).
  const sevenDaysAgo = new Date(MON_OCT_19.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const intervalPath = calculateApparatusChecksBucketScore(
    { lastCompletedAt: sevenDaysAgo, intervalDays: 7, scoreProfile: null, scheduledWeekday: null },
    MON_OCT_19,
  );
  assert.equal(intervalPath.score, 15);

  // Undefined weekday also preserves interval behavior.
  const intervalPathUndefined = calculateApparatusChecksBucketScore(
    { lastCompletedAt: sevenDaysAgo, intervalDays: 7, scoreProfile: null },
    MON_OCT_19,
  );
  assert.equal(intervalPathUndefined.score, 15);
});

test("W14. interval path unchanged: missing interval without a weekday is still a config gap", () => {
  const result = calculateApparatusChecksBucketScore(
    { lastCompletedAt: null, intervalDays: null, scoreProfile: null, scheduledWeekday: null },
    MON_OCT_19,
  );
  assert.equal(result.score, null);
  assert.match(result.blockingGap ?? "", /configuration/i);
});

// Silence unused-variable warnings for documented anchors used across cases.
void MON_OCT_12;
