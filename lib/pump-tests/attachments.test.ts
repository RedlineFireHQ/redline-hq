import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPumpTestStoragePath,
  contentTypesMatch,
  detectContentType,
  isPumpTestStoragePath,
  PUMP_TEST_MAX_FILE_BYTES,
  PUMP_TEST_MAX_FILES,
  resolveDeclaredContentType,
  sanitizeDisplayFileName,
  validateDeclaredFiles,
} from "@/lib/pump-tests/attachments";

const DEPT = "aaaaaaaa-0000-4000-8000-000000000001";
const TEST_ID = "bbbbbbbb-0000-4000-8000-000000000002";

test("detects real file types from their first bytes", () => {
  assert.equal(detectContentType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), "application/pdf");
  assert.equal(detectContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectContentType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
  assert.equal(detectContentType(new TextEncoder().encode("\0\0\0\x18ftypheic")), "image/heic");
  assert.equal(detectContentType(new TextEncoder().encode("MZ\x90\0 executable")), null);
  assert.equal(detectContentType(new TextEncoder().encode("<html><script>")), null);
});

test("HEIC and HEIF are treated as the same family but nothing else is", () => {
  assert.equal(contentTypesMatch("image/heif", "image/heic"), true);
  assert.equal(contentTypesMatch("application/pdf", "image/png"), false);
});

test("declared type falls back to the extension and rejects unknown types", () => {
  assert.equal(resolveDeclaredContentType("scan.HEIC", ""), "image/heic");
  assert.equal(resolveDeclaredContentType("report.pdf", "application/octet-stream"), "application/pdf");
  assert.equal(resolveDeclaredContentType("malware.exe", "application/x-msdownload"), null);
  assert.equal(resolveDeclaredContentType("page.html", "text/html"), null);
});

test("declared file validation enforces type, size and count limits", () => {
  const ok = validateDeclaredFiles([{ name: "cert.pdf", type: "application/pdf", size: 1000 }]);
  assert.equal(ok.ok, true);

  assert.equal(validateDeclaredFiles([{ name: "a.exe", type: "application/x-msdownload", size: 10 }]).ok, false);
  assert.equal(validateDeclaredFiles([{ name: "a.pdf", type: "application/pdf", size: PUMP_TEST_MAX_FILE_BYTES + 1 }]).ok, false);
  assert.equal(validateDeclaredFiles([{ name: "a.pdf", type: "application/pdf", size: 0 }]).ok, false);
  assert.equal(
    validateDeclaredFiles(Array.from({ length: PUMP_TEST_MAX_FILES + 1 }, () => ({ name: "a.png", type: "image/png", size: 5 }))).ok,
    false,
  );
  assert.deepEqual(validateDeclaredFiles(undefined), { ok: true, files: [] });
});

test("display names drop paths and control characters", () => {
  assert.equal(sanitizeDisplayFileName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeDisplayFileName("C:\\temp\\scan.pdf"), "scan.pdf");
  assert.equal(sanitizeDisplayFileName("   "), "attachment");
});

test("storage paths are generated and only this test's folder is accepted", () => {
  const path = buildPumpTestStoragePath(DEPT, TEST_ID, "pdf");
  assert.match(path, new RegExp(`^${DEPT}/pump-tests/${TEST_ID}/[0-9a-f-]{36}\\.pdf$`));
  assert.equal(isPumpTestStoragePath(path, DEPT, TEST_ID), true);

  const otherDept = "cccccccc-0000-4000-8000-000000000003";
  assert.equal(isPumpTestStoragePath(path, otherDept, TEST_ID), false);
  assert.equal(isPumpTestStoragePath(`${DEPT}/pump-tests/${TEST_ID}/../x.pdf`, DEPT, TEST_ID), false);
  assert.equal(isPumpTestStoragePath(`${DEPT}/maintenance/${TEST_ID}/photos/x.png`, DEPT, TEST_ID), false);
  assert.equal(isPumpTestStoragePath(undefined, DEPT, TEST_ID), false);
});
