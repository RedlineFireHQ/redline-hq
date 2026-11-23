import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainingDepartmentMetrics } from "../../components/training/TrainingDepartmentOverview";

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("personnel history is sorted newest first and all rows remain in a bounded scroll region", () => {
  const source = readSource("app/personnel/[id]/page.tsx");
  assert.match(source, /new Date\(right\.completedAt\)\.getTime\(\) - new Date\(left\.completedAt\)\.getTime\(\)/);
  const section = source.slice(source.indexOf('id="training-history-heading"'), source.indexOf("<RoleRequirementsSection"));
  assert.match(section, /max-h-\[60vh\].*overflow-auto.*md:max-h-\[336px\]/);
  assert.match(section, /role="region"[\s\S]*aria-labelledby="training-history-heading"[\s\S]*tabIndex=\{0\}/);
  assert.match(section, /sticky top-0/);
  assert.equal((section.match(/trainingHistory\.map\(/g) ?? []).length, 2);
  assert.doesNotMatch(section, /trainingHistory\.slice\(/);
  for (const field of ["title", "categoryName", "completedAt", "hoursCredit", "trainingMethod", "instructorName", "location"]) {
    assert.ok(section.includes(`record.${field}`), `${field} remains visible`);
  }
});

test("member dashboard metrics retain values and precede assigned training and history", () => {
  const html = renderToStaticMarkup(createElement(TrainingDepartmentMetrics, {
    departmentTrainingHoursThisYear: 123.5,
    pendingReviews: 4,
    membersTrainedCount: 9,
    events: [{ id: "1", title: "Test", categoryName: "Fire", startsAt: "2026-01-01", hoursCredit: 2, instructorName: null, location: null, status: "completed", attendedCount: 1 }],
  }));
  for (const value of ["Department Training Hours", "123.50", "Training Events", "Members Trained", "Pending Reviews"]) assert.ok(html.includes(value));
  assert.match(html, /Training Events<\/p><p[^>]*>1<\/p>/);
  assert.match(html, /Members Trained<\/p><p[^>]*>9<\/p>/);
  assert.match(html, /Pending Reviews<\/p><p[^>]*>4<\/p>/);
  const workspace = readSource("components/training/TrainingWorkspace.tsx");
  assert.match(workspace, /\{departmentSummary\}\s*\{myAssignedTrainingSection\}\s*\{departmentHistory\}/);
  const page = readSource("app/training/page.tsx");
  assert.match(page, /departmentSummary=\{[\s\S]*?<TrainingDepartmentMetrics/);
  assert.match(page, /departmentHistory=\{[\s\S]*?<TrainingDepartmentOverview/);
});

test("management summary precedes assigned training with the existing calculations", () => {
  const workspace = readSource("components/training/TrainingWorkspace.tsx");
  const management = workspace.slice(workspace.indexOf('Training Workspace</h1>') >= 0
    ? workspace.indexOf('Training Workspace</h1>')
    : workspace.indexOf('Create and manage department training events, view attendance progress'));
  const summary = management.indexOf("Department Training Hours");
  const assigned = management.indexOf("{myAssignedTrainingSection}");
  assert.ok(summary >= 0 && assigned > summary);
  const metrics = management.slice(summary, assigned);
  assert.match(metrics, /departmentTrainingHoursThisYear\.toFixed\(2\)/);
  assert.match(metrics, /eventRows\.length/);
  assert.match(metrics, /membersTrainedCount/);
  assert.match(metrics, /pendingReviews/);
  assert.ok(metrics.indexOf("Training Events") < metrics.indexOf("Members Trained"));
  assert.ok(metrics.indexOf("Members Trained") < metrics.indexOf("Pending Reviews"));
});
