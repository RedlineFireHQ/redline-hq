import { findPumpTestInDepartment, jsonResponse, resolvePumpTestActor } from "@/lib/pump-tests/access";
import { isUuid, PUMP_TEST_ATTACHMENTS_BUCKET, PUMP_TEST_SIGNED_URL_SECONDS } from "@/lib/pump-tests/attachments";

// Authorizes the caller, then redirects to a short-lived signed link; the storage path is never exposed.
export async function GET(request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await context.params;
  const actor = await resolvePumpTestActor();
  if (!actor) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  if (!isUuid(id) || !isUuid(attachmentId) || !(await findPumpTestInDepartment(actor, id))) {
    return jsonResponse({ ok: false, error: "Not found." }, 404);
  }

  const { data: attachment } = await actor.admin
    .from("apparatus_pump_test_attachments")
    .select("storage_path, original_filename")
    .eq("id", attachmentId)
    .eq("pump_test_id", id)
    .eq("department_id", actor.departmentId)
    .maybeSingle();
  const row = attachment as { storage_path: string; original_filename: string } | null;
  if (!row) return jsonResponse({ ok: false, error: "Not found." }, 404);

  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await actor.admin.storage
    .from(PUMP_TEST_ATTACHMENTS_BUCKET)
    .createSignedUrl(row.storage_path, PUMP_TEST_SIGNED_URL_SECONDS, wantsDownload ? { download: row.original_filename } : undefined);
  if (error || !data?.signedUrl) return jsonResponse({ ok: false, error: "Unable to open file." }, 500);

  return new Response(null, { status: 302, headers: { location: data.signedUrl, "cache-control": "no-store" } });
}
