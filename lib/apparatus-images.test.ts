import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { getApparatusImagePath } from "./apparatus-images";

const ROOT = path.resolve(import.meta.dirname, "..");
const RED_OAK = "82f50d14-216a-4dd1-80f4-58459dc97b97";
const ELLIOTT = "4d811b72-1857-4cf4-93b5-9cbbd889153f";
const ELLIOTT_FIRE = "339028ba-a3d9-4f16-9ee4-80be662fb9ee";
const CEDAR_BLUFF = "44a25960-7d46-45c4-94e9-115833072da8";

const RED_OAK_FILES = [
  ["114", "114.jpg"],
  ["115", "115.jpg"],
  ["116", "116.jpg"],
  ["117", "117.jpg"],
  ["120", "120.jpg"],
  ["121", "121.jpg"],
  ["130", "130.jpg"],
  ["131", "131.jpg"],
  ["135", "135Fire Truck, Flag, and Fireworks.png"],
  ["140", "140.jpg"],
  ["141", "141.jpg"],
  ["142", "142.PNG"],
  ["145", "145.jpg"],
  ["ROFD Ranger", "Ranger.PNG"],
  ["Special Operations Trailer", "Specialops.PNG"],
  ["Daily Apparatus Checks", "Daily Apparatus Checks at Red Oak Firehouse.png"],
  ["Station Generator", "station-generator.jpg"],
] as const;

const ELLIOTT_FILES = [
  ["Engine 430", "pumper-430.jpg"],
  ["Engine 432", "pumper-432.jpg"],
  ["Grass Truck 420", "brush-420.jpg"],
  ["Grass Truck 421", "brush-421.jpg"],
  ["Tanker 445", "tanker-445.jpg"],
] as const;

const CEDAR_BLUFF_FILES = [
  ["Engine 1", "engine-1.jpg"],
  ["Engine 2", "engine-2.jpg"],
  ["Tanker 1", "tanker-1.jpg"],
  ["Brush 1", "brush-1.jpg"],
  ["Rescue 1", "rescue-1.jpg"],
  ["Medic 1", "medic-1.jpg"],
] as const;

function resolve(name: string | null, departmentId: string | null | undefined) {
  return getApparatusImagePath({ name, department_id: departmentId ?? null }, departmentId);
}

for (const [name, filename] of RED_OAK_FILES) {
  test(`Red Oak ${name} resolves to its exact existing image file`, () => {
    const url = resolve(name, RED_OAK);
    assert.ok(url);
    assert.equal(decodeURIComponent(url), `/apparatus/redoak/${filename}`);
    const bytes = readFileSync(path.join(ROOT, "public", decodeURIComponent(url)));
    const signature = bytes.subarray(0, filename.toLowerCase().endsWith(".png") ? 8 : 3).toString("hex");
    assert.equal(signature, filename.toLowerCase().endsWith(".png") ? "89504e470d0a1a0a" : "ffd8ff");
    assert.equal(resolve(`  ${name.toUpperCase()}  `, RED_OAK), url);
  });
}

test("the Red Oak directory contains exactly the 17 approved images and no other files", () => {
  assert.deepEqual(
    readdirSync(path.join(ROOT, "public/apparatus/redoak")).sort(),
    RED_OAK_FILES.map(([, filename]) => filename).sort(),
  );
});

for (const departmentId of [ELLIOTT, ELLIOTT_FIRE]) {
  test(`existing Elliott images and unit aliases remain intact for ${departmentId}`, () => {
    for (const [name, filename] of ELLIOTT_FILES) {
      const url = resolve(name, departmentId);
      assert.equal(url, `/apparatus/elliott/${filename}`);
      assert.ok(readFileSync(path.join(ROOT, "public", url)).length);
      const number = name.match(/\d+/)?.[0];
      assert.equal(resolve(number ?? "", departmentId), url);
      assert.equal(resolve(`Unit ${number}`, departmentId), url);
    }
    assert.equal(resolve("Pumper-430", departmentId), "/apparatus/elliott/pumper-430.jpg");
    assert.equal(resolve("Brush 421", departmentId), "/apparatus/elliott/brush-421.jpg");
  });
}

test("all existing Cedar Bluff mappings remain intact", () => {
  for (const [name, filename] of CEDAR_BLUFF_FILES) {
    const url = resolve(name, CEDAR_BLUFF);
    assert.equal(url, `/apparatus/cedarbluff/${filename}`);
    assert.ok(readFileSync(path.join(ROOT, "public", url)).length);
  }
});

test("overlapping names never select a different department's photos", () => {
  const departments = [
    { id: RED_OAK, names: RED_OAK_FILES },
    { id: ELLIOTT, names: ELLIOTT_FILES },
    { id: CEDAR_BLUFF, names: CEDAR_BLUFF_FILES },
  ];
  for (const owner of departments) {
    for (const other of departments.filter((department) => department.id !== owner.id)) {
      for (const [name] of other.names) {
        assert.equal(resolve(name, owner.id), null, `${owner.id} must not borrow ${other.id}'s ${name}`);
        assert.equal(
          getApparatusImagePath({ name, department_id: other.id }, owner.id),
          null,
          "record ownership must agree with the authenticated department",
        );
      }
    }
  }
  for (const departmentId of [RED_OAK, CEDAR_BLUFF]) {
    for (const name of ["430", "Pumper 432", "Truck 420", "421", "445"]) {
      assert.equal(resolve(name, departmentId), null, "Elliott number aliases must not escape Elliott");
    }
  }
});

test("missing identity, unknown departments, and unmapped names use the no-image fallback", () => {
  for (const departmentId of [undefined, null, "", "unknown", "__proto__", "constructor"]) {
    for (const name of ["114", "Engine 430", "Engine 1"]) {
      assert.equal(resolve(name, departmentId), null);
    }
  }
  for (const departmentId of [RED_OAK, ELLIOTT, ELLIOTT_FIRE, CEDAR_BLUFF]) {
    for (const name of [null, "", "  ", "Unmapped apparatus", "__proto__", "constructor", "toString"]) {
      assert.equal(resolve(name, departmentId), null);
    }
    assert.equal(getApparatusImagePath(null, departmentId), null);
    assert.equal(getApparatusImagePath(undefined, departmentId), null);
    assert.equal(getApparatusImagePath({ name: "114", department_id: null }, departmentId), null);
  }
});

test("every application caller passes a record and authenticated current-member department", () => {
  const expectedCallers = new Map([
    ["app/apparatus/page.tsx", "unit"],
    ["app/apparatus/archived/page.tsx", "unit"],
    ["app/apparatus/[id]/page.tsx", "truck"],
    ["app/apparatus/[id]/information/page.tsx", "truck"],
    ["components/command-center-v3/ApparatusPanel.tsx", "apparatus"],
    ["app/apparatus/[id]/daily-check/checklist/page.tsx", "apparatus"],
    ["app/mobile/apparatus-checks/[id]/page.tsx", "apparatus"],
  ]);
  const actualCallers: string[] = [];
  for (const folder of ["app", "components"]) {
    for (const file of readdirSync(path.join(ROOT, folder), { recursive: true })) {
      if (typeof file !== "string" || !/\.tsx?$/.test(file)) continue;
      const relative = `${folder}/${file}`;
      const source = readFileSync(path.join(ROOT, relative), "utf8");
      if (!source.includes("getApparatusImagePath(")) continue;
      const tree = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const calls: ts.CallExpression[] = [];
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && node.expression.getText(tree) === "getApparatusImagePath") calls.push(node);
        ts.forEachChild(node, visit);
      }
      visit(tree);
      assert.match(source, /const currentMember = await getCurrentMember\(supabase\);/);
      assert.equal(calls.length, 1, relative);
      assert.equal(calls[0].arguments.length, 2, relative);
      assert.equal(calls[0].arguments[0].getText(tree), expectedCallers.get(relative), relative);
      assert.match(calls[0].arguments[1].getText(tree), /^currentMember\??\.departmentId$/, relative);
      actualCallers.push(relative);
    }
  }
  assert.deepEqual(actualCallers.sort(), [...expectedCallers.keys()].sort());
});
