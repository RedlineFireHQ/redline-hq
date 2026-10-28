import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { calculateEmsReadiness } from "@/lib/ems/calculation";
import { buildEmsTrainingRecords, buildMemberEmsProgress } from "@/lib/ems/member-ems-progress";

const activeEmt = { certification_level: "emt", track_status: "active", expiration_date: "2099-01-01", maintain_track: true };

test("only EMS-flagged events and outside submissions become EMS records", () => {
  const records = buildEmsTrainingRecords(
    [
      { id: "e1", starts_at: "2026-01-01", hours_credit: "2.5", is_ems_training: true, ems_core_topic: "trauma", ems_needs_review: false },
      { id: "e2", starts_at: "2026-01-02", hours_credit: 4, is_ems_training: false, ems_core_topic: "trauma", ems_needs_review: false },
    ],
    [{ id: "o1", training_date: "2026-01-03", hours: 1, is_ems_training: true, ems_core_topic: "medical", ems_needs_review: false }],
  );

  assert.deepEqual(records.map((record) => [record.id, record.hours, record.coreTopic]), [
    ["event-e1", 2.5, "trauma"],
    ["outside-o1", 1, "medical"],
  ]);
});

test("records needing review or without a topic are not credited and are reported as unclassified", () => {
  const progress = buildMemberEmsProgress({
    iowaProfile: activeEmt,
    nremtProfile: null,
    events: [
      { id: "ok", starts_at: "2026-01-01", hours_credit: 1, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
      { id: "review", starts_at: "2026-01-02", hours_credit: 2, is_ems_training: true, ems_core_topic: "trauma", ems_needs_review: true },
      { id: "none", starts_at: "2026-01-03", hours_credit: 3, is_ems_training: true, ems_core_topic: null, ems_needs_review: false },
      { id: "other", starts_at: "2026-01-04", hours_credit: 4, is_ems_training: true, ems_core_topic: "other", ems_needs_review: false },
    ],
    outsideSubmissions: [],
  });

  assert.equal(progress.emsReadiness.iowa.totalCompleted, 1);
  assert.deepEqual(progress.unclassifiedRecordIds.sort(), ["event-none", "event-other"]);
});

test("the builder matches the existing calculation fed the same profiles and records", () => {
  const events = [{ id: "e1", starts_at: "2026-01-01", hours_credit: 3, is_ems_training: true, ems_core_topic: "medical", ems_needs_review: false }];
  const progress = buildMemberEmsProgress({ iowaProfile: activeEmt, nremtProfile: activeEmt, events, outsideSubmissions: [] });

  const direct = calculateEmsReadiness({
    iowaProfile: { level: "emt", status: "active", expirationDate: "2099-01-01", maintainTrack: true },
    nremtProfile: { level: "emt", status: "active", expirationDate: "2099-01-01", maintainTrack: true },
    trainingRecords: buildEmsTrainingRecords(events, []),
  });

  assert.deepEqual(progress.emsReadiness, direct);
});

test("warnings that need authoritative verification stay hidden, as in My Readiness", () => {
  const progress = buildMemberEmsProgress({ iowaProfile: activeEmt, nremtProfile: activeEmt, events: [], outsideSubmissions: [] });

  assert.ok(progress.emsReadiness.warnings.some((warning) => warning.includes("NEEDS AUTHORITATIVE VERIFICATION")));
  assert.ok(progress.visibleWarnings.every((warning) => !warning.includes("NEEDS AUTHORITATIVE VERIFICATION")));
});

test("Iowa is always tracked while National Registry follows its own maintain flag", () => {
  const iowaOnly = buildMemberEmsProgress({ iowaProfile: activeEmt, nremtProfile: null, events: [], outsideSubmissions: [] });
  assert.equal(iowaOnly.emsReadiness.nremt.status, "not_maintained");
  assert.notEqual(iowaOnly.emsReadiness.iowa.status, "not_configured");

  const nremtNotMaintained = buildMemberEmsProgress({
    iowaProfile: activeEmt,
    nremtProfile: { ...activeEmt, maintain_track: false },
    events: [],
    outsideSubmissions: [],
  });
  assert.equal(nremtNotMaintained.emsReadiness.nremt.status, "not_maintained");
});

test("My Readiness uses the shared builder and display and still refreshes its own saved EMS accounting", () => {
  const source = readFileSync(resolve(process.cwd(), "app/my-readiness/page.tsx"), "utf8");

  assert.match(source, /buildMemberEmsProgress/);
  assert.match(source, /<EmsContinuingEducationSection/);
  assert.match(source, /recalculateMemberEmsCreditAccounting/);
  assert.doesNotMatch(source, /calculateEmsReadiness\(/);
});

test("the Personnel profile never writes EMS data from this section", () => {
  const section = readFileSync(resolve(process.cwd(), "components/ems/EmsContinuingEducationSection.tsx"), "utf8");
  const builder = readFileSync(resolve(process.cwd(), "lib/ems/member-ems-progress.ts"), "utf8");

  for (const source of [section, builder]) {
    assert.doesNotMatch(source, /supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(|fetch\(|"use client"/);
  }
});
