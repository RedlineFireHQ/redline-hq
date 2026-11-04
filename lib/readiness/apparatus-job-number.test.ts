import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static validation for the optional apparatus job_number migration and its
 * field plumbing. No SQL is executed; these assert structure and conventions
 * (mirrors the repo's existing migration-assertion tests).
 */

const ADD_FORM = readFileSync(
  join(__dirname, "../../components/apparatus/AddApparatusButton.tsx"),
  "utf8",
);

const CREATE_ROUTE = readFileSync(
  join(__dirname, "../../app/api/apparatus/route.ts"),
  "utf8",
);

const EDIT_ROUTE = readFileSync(
  join(__dirname, "../../app/api/apparatus/[id]/route.ts"),
  "utf8",
);

const QUICK_FACTS = readFileSync(
  join(__dirname, "../../components/apparatus/QuickFactsCard.tsx"),
  "utf8",
);

const INFO_PAGE = readFileSync(
  join(__dirname, "../../app/apparatus/[id]/information/page.tsx"),
  "utf8",
);

test("J3. add-apparatus form collects Job Number and submits it", () => {
  assert.match(ADD_FORM, /jobNumber: string;/);
  assert.match(ADD_FORM, /jobNumber: ""/);
  assert.match(ADD_FORM, /jobNumber: formState\.jobNumber/);
  assert.match(ADD_FORM, /Job Number/);
});

test("J4. create route persists job_number (null when blank)", () => {
  assert.match(CREATE_ROUTE, /jobNumber\?: unknown/);
  assert.match(CREATE_ROUTE, /const jobNumber = normalizeText\(payload\.jobNumber\)/);
  assert.match(CREATE_ROUTE, /job_number: jobNumber \|\| null/);
});

test("J5. edit route accepts and persists job_number", () => {
  assert.match(EDIT_ROUTE, /job_number\?: unknown/);
  assert.match(EDIT_ROUTE, /job_number: normalizeText\(payload\.job_number\)/);
});

test("J6. information screen surfaces Job Number as a labeled quick fact", () => {
  assert.match(QUICK_FACTS, /\{ key: "job_number", label: "Job Number" \}/);
  assert.match(QUICK_FACTS, /job_number: normalizeStringValue\(draft\.job_number\)/);
});

test("J7. information page maps job_number from the apparatus record", () => {
  assert.match(INFO_PAGE, /job_number: typeof truck\.job_number === "string" \? truck\.job_number : null/);
});
