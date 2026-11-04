import assert from "node:assert/strict";
import test from "node:test";
import { apparatusCalendarDay } from "./calendar-day";
import { calculateWeekdayAnchoredCheckScore } from "./readiness/apparatus-readiness";

test("Central midnight, not UTC midnight, determines the schedule day", () => {
  assert.equal(apparatusCalendarDay(new Date("2026-10-18T04:59:59Z")).toISOString(), "2026-10-17T00:00:00.000Z");
  assert.equal(apparatusCalendarDay(new Date("2026-10-18T05:00:00Z")).toISOString(), "2026-10-18T00:00:00.000Z");
});

test("spring DST short day still counts as one overdue calendar day", () => {
  assert.deepEqual(calculateWeekdayAnchoredCheckScore(null, 0, new Date("2026-03-09T06:00:00Z")), { score: 10, blockingGap: null });
});

test("fall DST long day still counts as one overdue calendar day", () => {
  assert.deepEqual(calculateWeekdayAnchoredCheckScore(null, 0, new Date("2026-11-02T07:00:00Z")), { score: 10, blockingGap: null });
});

test("future completion timestamps cannot satisfy readiness", () => {
  const result = calculateWeekdayAnchoredCheckScore("2026-11-03T18:00:01Z", 2, new Date("2026-11-03T18:00:00Z"));
  assert.equal(result.score, null);
  assert.match(result.blockingGap ?? "", /future/);
});
