import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePpeReadiness, type PpeReadinessItem } from "@/lib/inventory/ppe-readiness";

function buildItems(count: number, hasOpenDeficiency: boolean): PpeReadinessItem[] {
  return Array.from({ length: count }, () => ({
    isActive: true,
    hasOpenDeficiency,
  }));
}

test("five active PPE, all clear equals 100 percent", () => {
  const result = calculatePpeReadiness(buildItems(5, false));
  assert.equal(result.isRated, true);
  assert.equal(result.readinessPercent, 100);
});

test("five active PPE, one open deficiency equals 90 percent", () => {
  const items: PpeReadinessItem[] = [
    { isActive: true, hasOpenDeficiency: true },
    ...buildItems(4, false),
  ];

  const result = calculatePpeReadiness(items);
  assert.equal(result.readinessPercent, 90);
});

test("five active PPE, two open deficiencies equals 80 percent", () => {
  const items: PpeReadinessItem[] = [
    { isActive: true, hasOpenDeficiency: true },
    { isActive: true, hasOpenDeficiency: true },
    ...buildItems(3, false),
  ];

  const result = calculatePpeReadiness(items);
  assert.equal(result.readinessPercent, 80);
});

test("five active PPE, all open deficiencies equals 50 percent", () => {
  const result = calculatePpeReadiness(buildItems(5, true));
  assert.equal(result.readinessPercent, 50);
});

test("ten active PPE, one open deficiency equals 95 percent", () => {
  const items: PpeReadinessItem[] = [
    { isActive: true, hasOpenDeficiency: true },
    ...buildItems(9, false),
  ];

  const result = calculatePpeReadiness(items);
  assert.equal(result.readinessPercent, 95);
});

test("resolved deficiencies do not reduce readiness", () => {
  const result = calculatePpeReadiness([
    { isActive: true, hasOpenDeficiency: false },
    { isActive: true, hasOpenDeficiency: false },
  ]);

  assert.equal(result.readinessPercent, 100);
});

test("multiple open deficiencies on one PPE item still count once", () => {
  const result = calculatePpeReadiness([
    { isActive: true, hasOpenDeficiency: true },
    { isActive: true, hasOpenDeficiency: false },
  ]);

  assert.equal(result.readinessPercent, 75);
});

test("inactive PPE is excluded from denominator", () => {
  const result = calculatePpeReadiness([
    { isActive: true, hasOpenDeficiency: false },
    { isActive: false, hasOpenDeficiency: true },
  ]);

  assert.equal(result.readinessPercent, 100);
  assert.equal(result.activePpeCount, 1);
});

test("zero active PPE returns not rated", () => {
  const result = calculatePpeReadiness([
    { isActive: false, hasOpenDeficiency: true },
    { isActive: false, hasOpenDeficiency: false },
  ]);

  assert.equal(result.isRated, false);
  assert.equal(result.readinessPercent, null);
});

test("mixed active and inactive PPE produces correct score", () => {
  const result = calculatePpeReadiness([
    { isActive: true, hasOpenDeficiency: true },
    { isActive: true, hasOpenDeficiency: false },
    { isActive: false, hasOpenDeficiency: true },
    { isActive: false, hasOpenDeficiency: false },
  ]);

  assert.equal(result.readinessPercent, 75);
  assert.equal(result.activePpeCount, 2);
});
