import { findPumpTestInDepartment, jsonResponse, resolvePumpTestActor } from "@/lib/pump-tests/access";
import { isUuid } from "@/lib/pump-tests/attachments";
import { createUploadSlots } from "@/lib/pump-tests/upload-slots";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const actor = await resolvePumpTestActor();
  if (!actor) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!isUuid(id) || !(await findPumpTestInDepartment(actor, id))) {
    return jsonResponse({ ok: false, error: "Pump test not found." }, 404);
  }

  const body = (await request.json().catch(() => null)) as { files?: unknown } | null;
  if (!Array.isArray(body?.files) || body.files.length === 0) {
    return jsonResponse({ ok: false, error: "No files to upload." }, 400);
  }
  const slots = await createUploadSlots(actor, id, body?.files);
  if (!slots.ok) return jsonResponse({ ok: false, error: slots.error }, 400);

  return jsonResponse({ ok: true, uploads: slots.slots });
}
