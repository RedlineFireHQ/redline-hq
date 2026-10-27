import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseMobileInterface } from "./mobile-device";

test("native app uses the mobile interface", () => {
  assert.equal(
    shouldUseMobileInterface({ isNative: true, userAgent: "", platform: "MacIntel", maxTouchPoints: 0 }),
    true,
  );
});

test("mobile browser user agents use the mobile interface", () => {
  assert.equal(
    shouldUseMobileInterface({ isNative: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 }),
    true,
  );
  assert.equal(
    shouldUseMobileInterface({ isNative: false, userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel)", platform: "Linux armv8l", maxTouchPoints: 5 }),
    true,
  );
});

test("desktop-style iPadOS Safari is detected by its touch-capable Mac platform", () => {
  assert.equal(
    shouldUseMobileInterface({ isNative: false, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 5 }),
    true,
  );
});

test("Mac Safari remains desktop regardless of browser window width", () => {
  assert.equal(
    shouldUseMobileInterface({ isNative: false, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 0 }),
    false,
  );
});