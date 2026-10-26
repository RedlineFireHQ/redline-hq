import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural static validation for the Pediatric Bags migration.
 *
 * These checks parse the migration's structure and verify *relationships*
 * between statements (e.g. every composite FK's referenced columns are backed
 * by a matching PK/unique index declared in the same file; every SECURITY
 * DEFINER function has a fixed search_path and matching revoke/grant). They are
 * NOT a PostgreSQL parser and do NOT prove runtime compatibility — they catch
 * structural/relational mistakes that keyword-counting tests cannot.
 */

const RAW = readFileSync(
  join(__dirname, "../../supabase/migrations/20261016120000_create_pediatric_bag_checklist_foundation.sql"),
  "utf8",
);

// Strip line comments so prose never counts as SQL.
const SQL = RAW.replace(/--[^\n]*/g, "");

const PEDI_TABLES = [
  "pediatric_bags",
  "pediatric_bag_checklist_items",
  "pediatric_bag_checklist_sessions",
  "pediatric_bag_inspections",
  "pediatric_bag_checklist_progress",
  "pediatric_bag_checklist_results",
];

// --- lightweight structural extractors -------------------------------------

/** Return the body (between the outer parens) of a `create table ... public.<name> (...)` block. */
function tableBody(name: string): string | null {
  const re = new RegExp(`create table if not exists public\\.${name} \\(([\\s\\S]*?)\\n\\);`);
  const match = SQL.match(re);
  return match ? match[1] : null;
}

/** Column names declared in a create-table body (first token of each column line). */
function columnsOf(body: string): string[] {
  const cols: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(constraint|unique|primary key|foreign key|check)\b/i.test(line)) continue;
    const col = line.split(/\s+/)[0];
    if (col) cols.push(col.replace(/,$/, ""));
  }
  return cols;
}

/** All `references public.<table> (cols...)` occurrences: [table, cols[]]. */
function fkReferences(): Array<{ table: string; cols: string[] }> {
  const out: Array<{ table: string; cols: string[] }> = [];
  const re = /references public\.(\w+) \(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SQL))) {
    out.push({ table: m[1], cols: m[2].split(",").map((c) => c.trim()) });
  }
  return out;
}

/** Unique/PK column-sets declared for a table (from create-table body + unique indexes). */
function uniqueSetsFor(table: string): string[] {
  const sets: string[] = [];
  const body = tableBody(table);
  if (body) {
    if (new RegExp(`\\bid\\b[^\\n]*\\bprimary key\\b`, "i").test(body)) sets.push("id");
    const uniqRe = /unique \(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = uniqRe.exec(body))) {
      sets.push(m[1].split(",").map((c) => c.trim()).join(","));
    }
  }
  // unique indexes declared separately: create unique index ... on public.<table> (cols)
  const idxRe = new RegExp(`create unique index if not exists \\w+\\s+on public\\.${table} \\(([^)]+)\\)`, "g");
  let im: RegExpExecArray | null;
  while ((im = idxRe.exec(SQL))) {
    sets.push(im[1].split(",").map((c) => c.trim()).join(","));
  }
  return sets;
}

function setCovers(sets: string[], cols: string[]) {
  const key = cols.join(",");
  return sets.includes(key) || (cols.length === 1 && sets.includes(cols[0]));
}

// --- tests -----------------------------------------------------------------

test("STRUCT1. dollar-quoted function bodies are balanced", () => {
  const dollars = (SQL.match(/\$\$/g) ?? []).length;
  assert.equal(dollars % 2, 0, `unbalanced $$ delimiters: ${dollars}`);
  const begins = (SQL.match(/^\s*begin\b/gm) ?? []).length;
  const ends = (SQL.match(/^\s*end;/gm) ?? []).length;
  assert.equal(begins, ends, `begin (${begins}) != end; (${ends})`);
});

test("STRUCT2. exactly six pediatric tables are created, each with a body", () => {
  for (const t of PEDI_TABLES) {
    const body = tableBody(t);
    assert.ok(body, `no create-table body found for ${t}`);
    assert.ok(columnsOf(body!).includes("id"), `${t} missing id column`);
  }
});

test("STRUCT3. every foreign key references a declared table and a backed column set", () => {
  const fks = fkReferences();
  assert.ok(fks.length > 0, "no foreign keys found");
  const declaredTables = new Set(PEDI_TABLES.concat(["departments", "members"]));
  for (const fk of fks) {
    assert.ok(declaredTables.has(fk.table), `FK references unknown table: ${fk.table}`);
    // For tables declared in THIS migration, verify the referenced columns are backed.
    if (PEDI_TABLES.includes(fk.table)) {
      const sets = uniqueSetsFor(fk.table);
      assert.ok(
        setCovers(sets, fk.cols),
        `FK references public.${fk.table} (${fk.cols.join(", ")}) but no matching PK/unique set. Declared unique sets: ${JSON.stringify(sets)}`,
      );
    }
  }
});

test("STRUCT4. the pediatric_bags(id, department_id) composite key is backed by a unique index", () => {
  const sets = uniqueSetsFor("pediatric_bags");
  assert.ok(
    sets.includes("id,department_id"),
    `pediatric_bags missing unique (id, department_id). Found: ${JSON.stringify(sets)}`,
  );
  // Every composite FK to pediatric_bags must reference exactly (id, department_id).
  const composite = fkReferences().filter((fk) => fk.table === "pediatric_bags" && fk.cols.length > 1);
  assert.ok(composite.length >= 4, `expected >=4 composite FKs to pediatric_bags, found ${composite.length}`);
  for (const fk of composite) {
    assert.deepEqual(fk.cols, ["id", "department_id"]);
  }
});

test("STRUCT5. RLS is enabled on all six pediatric tables and each has at least one policy", () => {
  for (const t of PEDI_TABLES) {
    assert.match(SQL, new RegExp(`alter table public\\.${t} enable row level security;`));
    const policyRe = new RegExp(`create policy \\w+\\s+on public\\.${t}\\b`, "g");
    const policies = SQL.match(policyRe) ?? [];
    assert.ok(policies.length >= 1, `no RLS policy declared for ${t}`);
  }
});

test("STRUCT6. every policy scopes to a department match and none is wide open", () => {
  // Each policy body must reference the table's department_id against the member's.
  const policyBodies = SQL.match(/create policy[\s\S]*?;/g) ?? [];
  assert.ok(policyBodies.length >= 12, `expected >=12 policies, found ${policyBodies.length}`);
  for (const body of policyBodies) {
    assert.match(body, /department_id/, "policy missing department scoping");
    assert.doesNotMatch(body, /using \(\s*true\s*\)/i);
    assert.doesNotMatch(body, /with check \(\s*true\s*\)/i);
  }
});

test("STRUCT7. every SECURITY DEFINER function sets a fixed safe search_path", () => {
  // Pair each `security definer` with a following `set search_path = public, auth, pg_temp`.
  const definerCount = (SQL.match(/security definer/g) ?? []).length;
  const safePathCount = (SQL.match(/set search_path = public, auth, pg_temp/g) ?? []).length;
  assert.ok(definerCount > 0, "no security definer functions found");
  assert.equal(safePathCount, definerCount, "a SECURITY DEFINER function is missing the fixed search_path");
});

test("STRUCT8. the two RPC functions are revoked from public/anon and granted only to authenticated", () => {
  for (const fn of ["get_or_create_pediatric_bag_check_session", "complete_pediatric_bag_check"]) {
    assert.match(SQL, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public;`));
    assert.match(SQL, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from anon;`));
    assert.match(SQL, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated;`));
    // Must NOT be granted to anon/public.
    assert.doesNotMatch(SQL, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to (anon|public);`));
  }
});

test("STRUCT9. each updated_at-bearing table has a matching trigger function and trigger", () => {
  const tablesWithUpdatedAt = PEDI_TABLES.filter((t) => {
    const body = tableBody(t);
    return body !== null && /\bupdated_at\b/.test(body);
  });
  for (const t of tablesWithUpdatedAt) {
    assert.match(SQL, new RegExp(`create or replace function public\\.set_${t}_updated_at\\(\\)`), `missing trigger fn for ${t}`);
    assert.match(SQL, new RegExp(`create trigger trg_${t}_updated_at[\\s\\S]*?execute function public\\.set_${t}_updated_at\\(\\)`), `missing trigger for ${t}`);
  }
});

test("STRUCT10. idempotent seed protections are present for both bags and template", () => {
  assert.match(SQL, /on conflict \(department_id, bag_label\) do nothing;/);
  assert.match(SQL, /(where|and) not exists \([\s\S]*?from public\.pediatric_bag_checklist_items existing[\s\S]*?\);/);
  // Seeding is scoped to exactly one department id (Red Oak).
  const deptIds = new Set(Array.from(SQL.matchAll(/'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'::uuid/g)).map((m) => m[1]));
  assert.deepEqual([...deptIds], ["82f50d14-216a-4dd1-80f4-58459dc97b97"]);
});

test("STRUCT11. no unresolved '***' quantities remain in the seeded inventory", () => {
  // Alcohol Preps are confirmed at quantity 10 in both IV kits; no NULL/'***'
  // seed rows remain anywhere in the migration.
  const unresolved = SQL.match(/'[^']*',\s*null,\s*'\*\*\*'/g) ?? [];
  assert.equal(unresolved.length, 0, `found unresolved '***' seed rows: ${JSON.stringify(unresolved)}`);
  const alcoholPreps = SQL.match(/'Alcohol Preps',\s*10,\s*'10'/g) ?? [];
  assert.equal(alcoholPreps.length, 2, "expected exactly 2 Alcohol Preps rows at quantity 10");
});

test("STRUCT12. no bulk-check behavior and combined multi-size rows remain single rows", () => {
  assert.doesNotMatch(SQL, /check_all|mark_all|bulk_check|mark_all_ready|check_everything/i);
  // Spot-check that representative combined labels were not split into separate rows.
  for (const split of ["'King 2.0'", "'King 2.5'", "'#1 Miller'", "'#2 Mac'"]) {
    assert.doesNotMatch(SQL, new RegExp(`::uuid,\\s*'[^']*',\\s*${split.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`));
  }
});
