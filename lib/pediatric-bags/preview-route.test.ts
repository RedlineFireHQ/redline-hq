import test from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for the Pediatric Bags read-only preview route matcher used in
 * middleware.ts. The matcher must allow ONLY the preview index and the per-bag
 * (A–D) child route, and must NOT open up any other route.
 *
 * This mirrors the exact expression in middleware.ts:
 *   pathname === "/inventory/ems-pediatric-bags/preview" ||
 *   /^\/inventory\/ems-pediatric-bags\/preview\/[A-Da-d]\/?$/.test(pathname)
 */

function isPediatricPreviewRoute(pathname: string): boolean {
  return (
    pathname === "/inventory/ems-pediatric-bags/preview" ||
    /^\/inventory\/ems-pediatric-bags\/preview\/[A-Da-d]\/?$/.test(pathname)
  );
}

test("MWPREV1. the preview index route is allowed", () => {
  assert.equal(isPediatricPreviewRoute("/inventory/ems-pediatric-bags/preview"), true);
});

test("MWPREV2. each per-bag preview route (A–D) is allowed", () => {
  for (const label of ["A", "B", "C", "D", "a", "b", "c", "d"]) {
    assert.equal(isPediatricPreviewRoute(`/inventory/ems-pediatric-bags/preview/${label}`), true, label);
  }
});

test("MWPREV3. a trailing slash on a per-bag route is allowed", () => {
  assert.equal(isPediatricPreviewRoute("/inventory/ems-pediatric-bags/preview/A/"), true);
});

test("MWPREV4. other inventory routes are NOT opened up", () => {
  const blocked = [
    "/inventory/ems-pediatric-bags",            // real bag list (auth required)
    "/inventory/ems-pediatric-bags/some-bag-id", // real bag detail (auth required)
    "/inventory/ems-supplies",
    "/inventory/ems-equipment",
    "/inventory/ems-drug-box",
    "/inventory",
  ];
  for (const path of blocked) {
    assert.equal(isPediatricPreviewRoute(path), false, path);
  }
});

test("MWPREV5. deeper or invalid preview paths are NOT allowed", () => {
  const blocked = [
    "/inventory/ems-pediatric-bags/preview/A/extra",
    "/inventory/ems-pediatric-bags/preview/AA",
    "/inventory/ems-pediatric-bags/preview/1",
    "/inventory/ems-pediatric-bags/preview/",
    "/inventory/ems-pediatric-bags/previewx",
  ];
  for (const path of blocked) {
    assert.equal(isPediatricPreviewRoute(path), false, path);
  }
});

test("MWPREV6. unrelated top-level routes stay protected", () => {
  const blocked = ["/", "/login", "/apparatus", "/deficiencies", "/reports", "/settings"];
  for (const path of blocked) {
    assert.equal(isPediatricPreviewRoute(path), false, path);
  }
});
