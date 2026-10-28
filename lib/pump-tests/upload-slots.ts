import {
  buildPumpTestStoragePath,
  PUMP_TEST_ATTACHMENTS_BUCKET,
  PUMP_TEST_MAX_ATTACHMENTS_PER_TEST,
  validateDeclaredFiles,
} from "@/lib/pump-tests/attachments";
import type { PumpTestActor } from "@/lib/pump-tests/access";

export type UploadSlot = { index: number; path: string; token: string };

// Counts both registered attachments and files already sitting in the test's folder, so repeated
// slot requests cannot pile up uploads that were never registered.
async function countExistingFiles(actor: PumpTestActor, pumpTestId: string) {
  const { count: registered } = await actor.admin
    .from("apparatus_pump_test_attachments")
    .select("id", { count: "exact", head: true })
    .eq("pump_test_id", pumpTestId)
    .eq("department_id", actor.departmentId);

  const { data: stored } = await actor.admin.storage
    .from(PUMP_TEST_ATTACHMENTS_BUCKET)
    .list(`${actor.departmentId}/pump-tests/${pumpTestId}`, { limit: PUMP_TEST_MAX_ATTACHMENTS_PER_TEST + 1 });

  return Math.max(registered ?? 0, stored?.length ?? 0);
}

// Hands out one-time signed upload slots with server-generated names; the browser never chooses a storage path.
export async function createUploadSlots(
  actor: PumpTestActor,
  pumpTestId: string,
  declaredFiles: unknown,
): Promise<{ ok: true; slots: UploadSlot[] } | { ok: false; error: string }> {
  const validation = validateDeclaredFiles(declaredFiles);
  if (!validation.ok) {
    return validation;
  }

  if (validation.files.length > 0) {
    const existing = await countExistingFiles(actor, pumpTestId);
    if (existing + validation.files.length > PUMP_TEST_MAX_ATTACHMENTS_PER_TEST) {
      return { ok: false, error: `A pump test can have at most ${PUMP_TEST_MAX_ATTACHMENTS_PER_TEST} attachments.` };
    }
  }

  const slots: UploadSlot[] = [];
  for (const [index, file] of validation.files.entries()) {
    const path = buildPumpTestStoragePath(actor.departmentId, pumpTestId, file.extension);
    const { data, error } = await actor.admin.storage.from(PUMP_TEST_ATTACHMENTS_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) {
      return { ok: false, error: "Unable to prepare file upload." };
    }
    slots.push({ index, path, token: data.token });
  }

  return { ok: true, slots };
}
