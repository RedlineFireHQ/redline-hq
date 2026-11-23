import { hydroActor, hydroJson } from "@/lib/scba-hydro/access";
import { isUuid, PUMP_TEST_SIGNED_URL_SECONDS } from "@/lib/pump-tests/attachments";

async function findAttachment(id: string, attachmentId: string) {
  if (!isUuid(id) || !isUuid(attachmentId)) return null;
  const actor = await hydroActor(id);
  if (!actor) return null;
  const { data, error } = await actor.admin.from("scba_hydro_attachments")
    .select("id, storage_path, original_filename").eq("id", attachmentId)
    .eq("session_id", id).eq("department_id", actor.departmentId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { actor, data } : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await context.params;
  const found = await findAttachment(id, attachmentId);
  if (!found) return hydroJson({ error: "Attachment not found." }, 404);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const signed = await found.actor.admin.storage.from("scba-hydro-attachments")
    .createSignedUrl(found.data.storage_path, PUMP_TEST_SIGNED_URL_SECONDS, download ? { download: found.data.original_filename } : undefined);
  if (signed.error || !signed.data?.signedUrl) return hydroJson({ error: signed.error?.message || "Unable to open attachment." }, 500);
  return new Response(null, { status: 302, headers: { location: signed.data.signedUrl, "cache-control": "no-store" } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await context.params;
  const found = await findAttachment(id, attachmentId);
  if (!found) return hydroJson({ error: "Attachment not found or not authorized." }, 404);
  const removed = await found.actor.admin.storage.from("scba-hydro-attachments").remove([found.data.storage_path]);
  if (removed.error) return hydroJson({ error: removed.error.message }, 500);
  const deleted = await found.actor.admin.from("scba_hydro_attachments").delete()
    .eq("id", attachmentId).eq("session_id", id).eq("department_id", found.actor.departmentId);
  if (deleted.error) return hydroJson({ error: deleted.error.message }, 500);
  return hydroJson({ ok: true });
}
