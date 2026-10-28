import { findPumpTestInDepartment, jsonResponse, resolvePumpTestActor } from "@/lib/pump-tests/access";
import {
  contentTypesMatch,
  detectContentType,
  getPumpTestFileType,
  isPumpTestStoragePath,
  isUuid,
  PUMP_TEST_ATTACHMENTS_BUCKET,
  PUMP_TEST_MAX_ATTACHMENTS_PER_TEST,
  PUMP_TEST_MAX_FILE_BYTES,
  PUMP_TEST_MAX_FILES,
  resolveDeclaredContentType,
  sanitizeDisplayFileName,
} from "@/lib/pump-tests/attachments";

type FinalizeItem = { path?: unknown; name?: unknown; type?: unknown };

// Registers files the browser uploaded to a server-issued slot, after checking the stored bytes.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const actor = await resolvePumpTestActor();
  if (!actor) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!isUuid(id) || !(await findPumpTestInDepartment(actor, id))) {
    return jsonResponse({ ok: false, error: "Pump test not found." }, 404);
  }

  const body = (await request.json().catch(() => null)) as { files?: FinalizeItem[] } | null;
  const items = Array.isArray(body?.files) ? body.files : [];
  if (items.length === 0 || items.length > PUMP_TEST_MAX_FILES) {
    return jsonResponse({ ok: false, error: "No files to attach." }, 400);
  }

  const { count: existingCount } = await actor.admin
    .from("apparatus_pump_test_attachments")
    .select("id", { count: "exact", head: true })
    .eq("pump_test_id", id)
    .eq("department_id", actor.departmentId);
  if ((existingCount ?? 0) + items.length > PUMP_TEST_MAX_ATTACHMENTS_PER_TEST) {
    return jsonResponse({ ok: false, error: `A pump test can have at most ${PUMP_TEST_MAX_ATTACHMENTS_PER_TEST} attachments.` }, 400);
  }

  const storage = actor.admin.storage.from(PUMP_TEST_ATTACHMENTS_BUCKET);
  const attached: Array<{ id: string; name: string }> = [];
  const failed: Array<{ name: string; path: string | null; error: string }> = [];

  for (const item of items) {
    const name = sanitizeDisplayFileName(typeof item.name === "string" ? item.name : "");
    const path = item.path;

    // Never touch or delete an object outside this test's own folder.
    if (!isPumpTestStoragePath(path, actor.departmentId, id)) {
      failed.push({ name, path: typeof path === "string" ? path : null, error: "Invalid file location." });
      continue;
    }

    const reject = async (error: string) => {
      await storage.remove([path]);
      failed.push({ name, path, error });
    };

    // A retried request must not delete a file that is already registered.
    const { data: alreadyRegistered } = await actor.admin
      .from("apparatus_pump_test_attachments")
      .select("id")
      .eq("storage_path", path)
      .eq("pump_test_id", id)
      .eq("department_id", actor.departmentId)
      .maybeSingle();
    if (alreadyRegistered) {
      attached.push({ id: (alreadyRegistered as { id: string }).id, name });
      continue;
    }

    const download = await storage.download(path);
    if (download.error || !download.data) {
      failed.push({ name, path, error: "The file was not uploaded." });
      continue;
    }

    const size = download.data.size;
    if (size <= 0 || size > PUMP_TEST_MAX_FILE_BYTES) {
      await reject(`File must be between 1 byte and ${PUMP_TEST_MAX_FILE_BYTES / (1024 * 1024)} MB.`);
      continue;
    }

    const head = new Uint8Array(await download.data.slice(0, 16).arrayBuffer());
    const detectedType = detectContentType(head);
    const declaredType = resolveDeclaredContentType(name, typeof item.type === "string" ? item.type : "");
    const fileType = detectedType ? getPumpTestFileType(detectedType) : null;
    if (!detectedType || !fileType || !declaredType || !contentTypesMatch(declaredType, detectedType)) {
      await reject("The file contents do not match an allowed PDF or image type.");
      continue;
    }

    const { data: row, error: insertError } = await actor.admin
      .from("apparatus_pump_test_attachments")
      .insert({
        department_id: actor.departmentId,
        pump_test_id: id,
        storage_path: path,
        original_filename: name,
        content_type: detectedType,
        file_size_bytes: size,
        kind: fileType.kind,
        uploaded_by_member_id: actor.memberId,
      })
      .select("id")
      .single();
    if (insertError?.code === "23505") {
      // Registered by a parallel request; keep the stored file.
      failed.push({ name, path, error: "This file was already attached." });
      continue;
    }
    if (insertError || !row) {
      await reject("Unable to save the attachment.");
      continue;
    }

    attached.push({ id: (row as { id: string }).id, name });
  }

  return jsonResponse({ ok: failed.length === 0, attached, failed }, failed.length === 0 ? 200 : 207);
}
