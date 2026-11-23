import { hydroActor, hydroJson } from "@/lib/scba-hydro/access";
import { contentTypesMatch, detectContentType, getPumpTestFileType, isUuid, PUMP_TEST_MAX_FILE_BYTES, resolveDeclaredContentType, sanitizeDisplayFileName } from "@/lib/pump-tests/attachments";

const bucket = "scba-hydro-attachments";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return hydroJson({ error: "Invalid session." }, 400);
  const actor = await hydroActor(id);
  if (!actor) return hydroJson({ error: "Not authorized or session not found." }, 403);
  const body = await request.json().catch(() => null) as { path?: unknown; name?: unknown; type?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  const prefix = `${actor.departmentId}/sessions/${id}/`;
  const fileName = path.startsWith(prefix) ? path.slice(prefix.length) : "";
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic|heif)$/.test(fileName)) return hydroJson({ error: "Invalid upload location." }, 400);
  const name = typeof body?.name === "string" ? body.name : "";
  const declared = resolveDeclaredContentType(name, typeof body?.type === "string" ? body.type : "");
  const storage = actor.admin.storage.from(bucket);
  const existing = await actor.admin.from("scba_hydro_attachments").select("id").eq("session_id", id)
    .eq("department_id", actor.departmentId).eq("storage_path", path).maybeSingle();
  if (existing.error) return hydroJson({ error: existing.error.message }, 500);
  if (existing.data) return hydroJson({ id: existing.data.id });
  const uploaded = await storage.download(path);
  if (uploaded.error || !uploaded.data) return hydroJson({ error: "Uploaded file not found." }, 400);
  const file = uploaded.data;
  if (file.size < 1 || file.size > PUMP_TEST_MAX_FILE_BYTES) {
    return hydroJson({ error: "File must be between 1 byte and 15 MB." }, 400);
  }
  const detected = detectContentType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  const type = detected ? getPumpTestFileType(detected) : null;
  if (!declared || !detected || !type || !contentTypesMatch(declared, detected)) {
    return hydroJson({ error: "File contents must match an allowed PDF or image type." }, 400);
  }
  const record = await actor.admin.from("scba_hydro_attachments").insert({
    department_id: actor.departmentId, session_id: id, storage_path: path,
    original_filename: sanitizeDisplayFileName(name), content_type: detected, file_size_bytes: file.size,
  }).select("id").single();
  if (record.error || !record.data) {
    if (record.error?.code === "23505") return hydroJson({ error: "File already registered." }, 409);
    console.error("[scba-hydro] upload not registered; storage cleanup required", record.error);
    return hydroJson({ error: record.error?.message || "Unable to register attachment." }, 500);
  }
  return hydroJson({ id: record.data.id });
}
