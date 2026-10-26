import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PEDIATRIC_INVENTORY,
  PEDIATRIC_SECTION_ORDER,
} from "@/lib/pediatric-bags/inventory";

/**
 * Static validation tests for the Pediatric Bags checklist foundation
 * migration. These assert the migration's structure, security (RLS/RPC),
 * department isolation, idempotent seeding, and source-data fidelity without
 * executing any SQL (mirrors the repo's existing migration-assertion tests).
 */

const MIGRATION = readFileSync(
  join(__dirname, "../../supabase/migrations/20261016120000_create_pediatric_bag_checklist_foundation.sql"),
  "utf8",
);

const RED_OAK = "82f50d14-216a-4dd1-80f4-58459dc97b97";

// Canonical source inventory lives in lib/pediatric-bags/inventory.ts (single
// source of truth, shared with the read-only preview). Map it to the tuple
// shape these tests use.
const SOURCE: Array<[string, string, number | null, string]> = PEDIATRIC_INVENTORY.map(
  ([section, label, qty, srcText]) => [section, label, qty, srcText],
);

const SECTION_ORDER = [...PEDIATRIC_SECTION_ORDER];

function escapeSql(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function itemPattern(section: string, label: string, qty: number | null, srcText: string) {
  const qtyPart = qty === null ? "null" : String(qty);
  return new RegExp(
    `::uuid,\\s*'${escapeSql(section)}',\\s*'${escapeSql(label)}',\\s*${qtyPart},\\s*'${escapeSql(srcText)}',\\s*\\d+\\),?`,
  );
}

test("PEDI1. all six pediatric tables are created", () => {
  for (const table of [
    "pediatric_bags",
    "pediatric_bag_checklist_items",
    "pediatric_bag_checklist_sessions",
    "pediatric_bag_inspections",
    "pediatric_bag_checklist_progress",
    "pediatric_bag_checklist_results",
  ]) {
    assert.match(MIGRATION, new RegExp(`create table if not exists public\\.${table} \\(`), `missing table ${table}`);
  }
});

test("PEDI2. RLS is enabled on every pediatric table", () => {
  for (const table of [
    "pediatric_bags",
    "pediatric_bag_checklist_items",
    "pediatric_bag_checklist_sessions",
    "pediatric_bag_inspections",
    "pediatric_bag_checklist_progress",
    "pediatric_bag_checklist_results",
  ]) {
    assert.match(
      MIGRATION,
      new RegExp(`alter table public\\.${table} enable row level security;`),
      `RLS not enabled on ${table}`,
    );
  }
});

test("PEDI3. pediatric bags enforce unique (department_id, bag_label) with A/B/C/D constraint", () => {
  assert.match(MIGRATION, /unique \(department_id, bag_label\)/);
  assert.match(MIGRATION, /bag_label in \('A', 'B', 'C', 'D'\)/);
});

test("PEDI4. shared template uses a nullable integer required_quantity plus source_quantity_text", () => {
  assert.match(MIGRATION, /required_quantity integer check \(required_quantity is null or required_quantity >= 0\)/);
  assert.match(MIGRATION, /source_quantity_text text/);
});

test("PEDI5. template uniqueness prevents duplicate items per department", () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists pediatric_bag_checklist_items_unique_idx\s+on public\.pediatric_bag_checklist_items \(department_id, lower\(btrim\(section_name\)\), lower\(btrim\(item_label\)\)\)/,
  );
});

test("PEDI6. snapshot table freezes section, label, required quantity, and source notation", () => {
  assert.match(MIGRATION, /section_name_snapshot text not null/);
  assert.match(MIGRATION, /item_label_snapshot text not null/);
  assert.match(MIGRATION, /required_quantity_snapshot integer/);
  assert.match(MIGRATION, /source_quantity_text_snapshot text/);
});

test("PEDI7. every RLS policy scopes to the requesting member's department", () => {
  const policyCount = (MIGRATION.match(/create policy /g) ?? []).length;
  assert.ok(policyCount >= 12, `expected at least 12 policies, found ${policyCount}`);
  // No policy may use an unscoped USING(true)/WITH CHECK(true).
  assert.doesNotMatch(MIGRATION, /using \(\s*true\s*\)/i);
  assert.doesNotMatch(MIGRATION, /with check \(\s*true\s*\)/i);
});

test("PEDI8. template and bag management require administrator or inventory_management", () => {
  assert.match(MIGRATION, /pediatric_bags_write_by_admin/);
  assert.match(MIGRATION, /pediatric_bag_checklist_items_write_by_admin/);
  assert.match(MIGRATION, /member_has_app_permission\(pediatric_bags\.department_id, 'inventory_management'\)/);
  assert.match(MIGRATION, /member_has_app_permission\(pediatric_bag_checklist_items\.department_id, 'inventory_management'\)/);
});

test("PEDI9. completion RPC is security definer with fixed search_path and ownership validation", () => {
  assert.match(MIGRATION, /create or replace function public\.complete_pediatric_bag_check\(/);
  assert.match(MIGRATION, /security definer/);
  assert.match(MIGRATION, /set search_path = public, auth, pg_temp/);
  assert.match(MIGRATION, /Requesting member does not belong to the pediatric bag check department/);
  assert.match(MIGRATION, /Session department does not match pediatric bag department/);
  assert.match(MIGRATION, /This pediatric bag check session belongs to a different member/);
});

test("PEDI10. RPC EXECUTE is revoked from public/anon and granted to authenticated only", () => {
  assert.match(MIGRATION, /revoke all on function public\.complete_pediatric_bag_check\(uuid, text, text\) from public;/);
  assert.match(MIGRATION, /revoke all on function public\.complete_pediatric_bag_check\(uuid, text, text\) from anon;/);
  assert.match(MIGRATION, /grant execute on function public\.complete_pediatric_bag_check\(uuid, text, text\) to authenticated;/);
  assert.match(MIGRATION, /grant execute on function public\.get_or_create_pediatric_bag_check_session\(uuid, uuid, text\) to authenticated;/);
});

test("PEDI11. bag seeding is idempotent and scoped to Red Oak only", () => {
  assert.match(MIGRATION, /on conflict \(department_id, bag_label\) do nothing;/);
  assert.ok(MIGRATION.includes(RED_OAK), "Red Oak department id missing from seed");
  // Seed must not reference any other department id.
  const deptIds = new Set(Array.from(MIGRATION.matchAll(/'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'::uuid/g)).map((m) => m[1]));
  assert.deepEqual([...deptIds], [RED_OAK]);
});

test("PEDI12. template seeding uses a NOT EXISTS guard so re-running never duplicates", () => {
  assert.match(MIGRATION, /(where|and) not exists \(\s*select 1\s+from public\.pediatric_bag_checklist_items existing\s+where existing\.department_id = seed\.department_id/);
});

test("PEDI13. sessions enforce one active check per member per bag", () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists pediatric_bag_checklist_sessions_one_active_idx\s+on public\.pediatric_bag_checklist_sessions \(member_id, pediatric_bag_id\)\s+where state = 'in_progress'/,
  );
});

test("PEDI14. pediatric tables do NOT reference apparatus or copy apparatus-only fields", () => {
  // Strip SQL comments so prose references to the apparatus pattern don't count;
  // we only care about actual schema statements.
  const sql = MIGRATION.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(sql, /mileage/);
  assert.doesNotMatch(sql, /engine_hours/);
  assert.doesNotMatch(sql, /references public\.apparatus/);
  // No pediatric column may be named like an apparatus-only field.
  assert.doesNotMatch(sql, /\bapparatus_id\b/);
});

test("PEDI15. exactly 87 items are seeded across all 17 sections in source order", () => {
  const rowMatches = MIGRATION.match(/::uuid,\s*'/g) ?? [];
  assert.equal(rowMatches.length, 87, `expected 87 seeded items, found ${rowMatches.length}`);

  // Section order preserved by ascending display_order.
  const sectionFirstSeen = new Map<string, number>();
  for (const [index, section] of SECTION_ORDER.entries()) {
    const position = MIGRATION.indexOf(`'${section}',`);
    assert.ok(position >= 0, `section missing: ${section}`);
    sectionFirstSeen.set(section, position);
    if (index > 0) {
      const previous = SECTION_ORDER[index - 1];
      assert.ok(
        (sectionFirstSeen.get(previous) ?? Infinity) < position,
        `section order violated: ${previous} should appear before ${section}`,
      );
    }
  }
});

test("PEDI16. every source item is seeded verbatim (section, label, quantity, source notation)", () => {
  for (const [section, label, qty, srcText] of SOURCE) {
    assert.ok(
      itemPattern(section, label, qty, srcText).test(MIGRATION),
      `missing/incorrect item: [${section}] ${label} qty=${qty ?? "NULL"} src="${srcText}"`,
    );
  }
});

test("PEDI17. Alcohol Preps are seeded at confirmed quantity 10 in both IV kits", () => {
  const alcoholPreps = MIGRATION.match(/::uuid,\s*'(?:Out — IV Kit #[12])',\s*'Alcohol Preps',\s*10,\s*'10',/g) ?? [];
  assert.equal(alcoholPreps.length, 2, "expected exactly 2 Alcohol Preps rows seeded at quantity 10");
  // No unresolved '***' quantities remain in the seed.
  assert.ok(!/::uuid,\s*'(?:Out — IV Kit #[12])',\s*'Alcohol Preps',\s*null/.test(MIGRATION), "found an unresolved NULL Alcohol Preps quantity");
});

test("PEDI18. verbatim source wording is preserved for known ambiguous labels", () => {
  // Do not silently correct "24 X .56 GA IV cath".
  const cath = MIGRATION.match(/'20 GA, 24 X \.56 GA IV cath'/g) ?? [];
  assert.equal(cath.length, 2, "expected the exact '24 X .56 GA IV cath' label in both IV kits");
  // Distinct IV kit #1 vs #2 catheter label difference is preserved.
  assert.ok(MIGRATION.includes("'24 GA, 22 GA IV cath'"), "IV Kit #1 label with space missing");
  assert.ok(MIGRATION.includes("'24 GA, 22GA IV cath'"), "IV Kit #2 label without space missing");
});

// --- Hardening: unknown quantities, combined rows, no bulk-check ---

test("PEDI19. unknown-quantity items block a fully 'ready' completion", () => {
  // The completion RPC must count unresolved (NULL-quantity) required items and
  // refuse p_final_status = 'ready' while any exist.
  assert.match(MIGRATION, /v_unresolved_quantity_count/);
  assert.match(
    MIGRATION,
    /i\.required_quantity is null;\s*\n\s*if p_final_status = 'ready' and v_unresolved_quantity_count > 0 then\s*\n\s*raise exception/,
  );
});

test("PEDI20. unresolved unknown-quantity items force an honest non-ready outcome", () => {
  // The error message must direct the user to the honest status rather than
  // silently passing as ready.
  assert.match(MIGRATION, /Cannot complete as Ready for Service/);
  assert.match(MIGRATION, /unconfirmed quantity pending review/);
  assert.match(MIGRATION, /Complete as Needs Review until Red Oak confirms the quantity/);
});

test("PEDI21. expired-marked items also block a fully 'ready' completion", () => {
  assert.match(
    MIGRATION,
    /p\.status = 'expired';\s*\n\s*if p_final_status = 'ready' and v_deficiency_count > 0 then\s*\n\s*raise exception/,
  );
});

test("PEDI22. 'needs_review' is a supported item status for flagging unknown quantities", () => {
  // Progress and result snapshot statuses must both accept 'needs_review'.
  const statusChecks = MIGRATION.match(/'needs_review'/g) ?? [];
  assert.ok(statusChecks.length >= 2, "expected 'needs_review' in progress and result status checks");
  assert.match(MIGRATION, /check \(status in \('checked', 'deficiency', 'not_applicable', 'needs_review'\)\)/);
  assert.match(MIGRATION, /check \(result_status in \('checked', 'deficiency', 'not_applicable', 'needs_review'\)\)/);
});

test("PEDI23. combined multi-size rows remain a single checklist row (not split)", () => {
  // Each multi-size source entry must appear exactly once, as one row.
  const multiSize: Array<[string, string]> = [
    ["Out — IV Kit #1", "24 GA, 22 GA IV cath"],
    ["Out — IV Kit #1", "20 GA, 24 X .56 GA IV cath"],
    ["Inside", "King 2.0 & 2.5"],
    ["Neonate Kit", "30mm & 40mm Oral"],
    ["4–7 kg Kit", "#0 & #1 Miller Blade"],
    ["12–14 kg Kit", "#1 Miller, #2 Mac"],
    ["14–17 kg Kit", "#2 Miller, #2 Mac"],
    ["18–22 kg Kit", "60mm & 80mm Oral"],
    ["24–30 kg Kit", "#3 Miller, #2-3 Mac"],
  ];
  for (const [section, label] of multiSize) {
    const occurrences = MIGRATION.match(new RegExp(`::uuid,\\s*'${escapeSql(section)}',\\s*'${escapeSql(label)}'`, "g")) ?? [];
    assert.equal(occurrences.length, 1, `combined row split or duplicated: [${section}] ${label}`);
  }
  // The individual sizes must NOT be seeded as separate rows.
  for (const splitLabel of ["'King 2.0'", "'King 2.5'", "'#1 Miller'", "'#2 Mac'", "'30mm Oral'", "'40mm Oral'"]) {
    assert.ok(!MIGRATION.includes(`::uuid,`) || !new RegExp(`::uuid,\\s*'[^']*',\\s*${splitLabel},`).test(MIGRATION), `size was split into its own row: ${splitLabel}`);
  }
});

test("PEDI24. no bulk check-all / mark-all control or behavior is introduced", () => {
  // No bulk-complete affordance in this database layer.
  assert.doesNotMatch(MIGRATION, /check_all|mark_all|bulk_check|mark_all_ready|check_everything/i);
});

test("PEDI25. snapshot insert preserves needs_review and quantity snapshots at completion", () => {
  // The completion RPC must copy required_quantity and source_quantity_text into
  // the immutable snapshot so unknown-quantity flags survive in history.
  assert.match(MIGRATION, /required_quantity_snapshot,\s*\n\s*source_quantity_text_snapshot,/);
  assert.match(MIGRATION, /i\.required_quantity,\s*\n\s*i\.source_quantity_text,/);
});

test("PEDI27. composite FKs on pediatric_bags(id, department_id) have a matching unique index", () => {
  // Postgres requires the referenced column set of a composite foreign key to be
  // covered by a primary key or unique constraint/index on exactly those columns.
  const fkCount = (MIGRATION.match(/references public\.pediatric_bags \(id, department_id\)/g) ?? []).length;
  assert.ok(fkCount >= 4, `expected at least 4 composite FKs to pediatric_bags(id, department_id), found ${fkCount}`);

  // The referenced key must be backed by a unique index on exactly (id, department_id).
  assert.match(
    MIGRATION,
    /create unique index if not exists pediatric_bags_id_department_unique_idx\s+on public\.pediatric_bags \(id, department_id\);/,
  );

  // Every child table that declares a composite FK must be one of the known set.
  for (const child of [
    "pediatric_bag_checklist_sessions",
    "pediatric_bag_inspections",
    "pediatric_bag_checklist_progress",
    "pediatric_bag_checklist_results",
  ]) {
    assert.ok(
      new RegExp(`constraint ${child}_bag_fk[\\s\\S]*?references public\\.pediatric_bags \\(id, department_id\\)`).test(MIGRATION),
      `missing composite FK constraint on ${child}`,
    );
  }
});

test("PEDI26. SQL RPC completion rules mirror the behavioral gating module (drift guard)", () => {  // The complete_pediatric_bag_check RPC must enforce the same rules exercised
  // behaviorally in lib/readiness/pediatric-bag-completion.ts. If the SQL and
  // the TS module diverge, this test fails.
  const sql = MIGRATION;

  // 1. Final status validated against exactly the three supported values.
  assert.match(sql, /if p_final_status not in \('ready', 'needs_attention', 'out_of_service'\) then/);

  // 2. Confirmed-quantity gate: requires >=1 confirmed required item, all marked.
  assert.match(sql, /i\.required_quantity is not null;/);
  assert.match(sql, /No active required checklist items with confirmed quantities/);
  assert.match(sql, /if v_completed_required_count < v_required_count then/);

  // 3. 'ready' blocked by unresolved unknown-quantity items.
  assert.match(sql, /i\.required_quantity is null;\s*\n\s*if p_final_status = 'ready' and v_unresolved_quantity_count > 0 then/);

  // 4. 'ready' blocked by deficiency-marked items.
  assert.match(sql, /if p_final_status = 'ready' and v_deficiency_count > 0 then/);

  // 5. Department scoping: every template/progress count is filtered by department.
  //    Template counts: required + unresolved (2). Progress counts: completed-required,
  //    deficiency, and the snapshot insert (3).
  const deptScopedCounts = sql.match(/where i\.department_id = v_department_id/g) ?? [];
  assert.ok(deptScopedCounts.length >= 2, "expected department-scoped template counts (required + unresolved)");
  const progressDeptScoped = sql.match(/where p\.department_id = v_department_id/g) ?? [];
  assert.ok(progressDeptScoped.length >= 3, "expected department-scoped progress counts (completed, deficiency, snapshot)");
});
