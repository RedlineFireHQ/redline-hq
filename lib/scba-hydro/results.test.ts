import test from "node:test";
import assert from "node:assert/strict";
import { setAllHydroResults, setHydroResult } from "./results";

test("bulk results can be individually overridden or cleared", () => {
  const passed = setAllHydroResults(["a", "b"], "Pass");
  assert.deepEqual(passed, { a: "Pass", b: "Pass" });
  assert.deepEqual(setHydroResult(passed, "b", "Fail", true), { a: "Pass", b: "Fail" });
  assert.deepEqual(setHydroResult(passed, "a", "Pass", true), { a: "", b: "Pass" });
  assert.deepEqual(setAllHydroResults(["a", "b"], "Fail"), { a: "Fail", b: "Fail" });
  assert.deepEqual(setHydroResult(passed, "a", "Pass", false), passed);
});
