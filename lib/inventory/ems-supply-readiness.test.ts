import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEmsSupplyReadiness,
  type EmsSupplyReadinessItem,
} from "@/lib/inventory/ems-supply-readiness";

function buildItems(count: number, stockStatus: EmsSupplyReadinessItem["stockStatus"]) {
  return Array.from({ length: count }, () => ({
    isActive: true,
    stockStatus,
  })) satisfies EmsSupplyReadinessItem[];
}

test("five normal active items equals 100 percent", () => {
  const items = buildItems(5, "Normal");

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.isRated, true);
  assert.equal(result.totalActive, 5);
  assert.equal(result.readinessPercent, 100);
});

test("four normal and one low equals 90 percent", () => {
  const items: EmsSupplyReadinessItem[] = [
    ...buildItems(4, "Normal"),
    ...buildItems(1, "Low"),
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.readinessPercent, 90);
});

test("four normal and one critical equals 80 percent", () => {
  const items: EmsSupplyReadinessItem[] = [
    ...buildItems(4, "Normal"),
    ...buildItems(1, "Critical"),
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.readinessPercent, 80);
});

test("two normal two low and one out of stock equals 60 percent", () => {
  const items: EmsSupplyReadinessItem[] = [
    { isActive: true, stockStatus: "Normal" },
    { isActive: true, stockStatus: "Normal" },
    { isActive: true, stockStatus: "Low" },
    { isActive: true, stockStatus: "Low" },
    { isActive: true, stockStatus: "Out of Stock" },
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.readinessPercent, 60);
});

test("returns not-rated when no active supplies are configured", () => {
  const items: EmsSupplyReadinessItem[] = [
    { isActive: false, stockStatus: "Normal" },
    { isActive: false, stockStatus: "Out of Stock" },
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.isRated, false);
  assert.equal(result.readinessPercent, null);
  assert.equal(result.totalActive, 0);
});

test("inactive items are excluded from the denominator", () => {
  const items: EmsSupplyReadinessItem[] = [
    { isActive: true, stockStatus: "Normal" },
    { isActive: true, stockStatus: "Low" },
    { isActive: true, stockStatus: "Out of Stock" },
    { isActive: false, stockStatus: "Normal" },
    { isActive: false, stockStatus: "Low" },
    { isActive: false, stockStatus: "Critical" },
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.isRated, true);
  assert.equal(result.totalActive, 3);
  assert.equal(result.readinessPercent, 50);
});

test("two hundred normal active items equals 100 percent", () => {
  const items = buildItems(200, "Normal");

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.totalActive, 200);
  assert.equal(result.readinessPercent, 100);
});

test("one low among two hundred reduces readiness by 0.25 points", () => {
  const items: EmsSupplyReadinessItem[] = [
    ...buildItems(199, "Normal"),
    ...buildItems(1, "Low"),
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.totalActive, 200);
  assert.equal(result.readinessPercent, 99.75);
});

test("one critical among two hundred reduces readiness by 0.5 points", () => {
  const items: EmsSupplyReadinessItem[] = [
    ...buildItems(199, "Normal"),
    ...buildItems(1, "Critical"),
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.totalActive, 200);
  assert.equal(result.readinessPercent, 99.5);
});

test("one out of stock among two hundred reduces readiness by 0.5 points", () => {
  const items: EmsSupplyReadinessItem[] = [
    ...buildItems(199, "Normal"),
    ...buildItems(1, "Out of Stock"),
  ];

  const result = calculateEmsSupplyReadiness(items);

  assert.equal(result.totalActive, 200);
  assert.equal(result.readinessPercent, 99.5);
});
