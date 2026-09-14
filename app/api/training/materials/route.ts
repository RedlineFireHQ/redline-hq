import { getCurrentMember } from "@/lib/current-member";
import { hasTrainingAssignmentManagementPermission } from "@/lib/member-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request) {
  let storagePath: string | null = null;
  let documentId: string | null = null;
  try {
    const formData = await request.formData();
    const departmentId = String(formData.get("departmentId") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");
    if (!departmentId || !title || !(file instanceof File) || file.size === 0) {
      return jsonResponse({ ok: false, error: "Department, title, and file are required." }, 400);
    }

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    if (!currentMember?.departmentId || currentMember.departmentId !== departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    if (!(await hasTrainingAssignmentManagementPermission(supabase, departmentId, currentMember.role))) {
      return jsonResponse({ ok: false, error: "Training assignment permission is required." }, 403);
    }

    const admin = createSupabaseAdminClient();
    documentId = crypto.randomUUID();
    const sanitizedName = file.name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "training-material";
    storagePath = `${departmentId}/training/${Date.now()}-${sanitizedName}`;
    const today = new Date().toISOString().slice(0, 10);
    const { error: uploadError } = await admin.storage.from("department-documents").upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message || "Unable to upload training material.");

    const { error: documentError } = await admin.from("documents").insert({
      id: documentId,
      department_id: departmentId,
      category: "Department Documents",
      source_kind: "training",
      title,
      description: null,
      document_number: null,
      effective_date: today,
      status: "Active",
      uploaded_by: currentMember.id,
      current_revision_id: null,
    });
    if (documentError) throw new Error(documentError.message || "Unable to create training material document.");

    const { data: revision, error: revisionError } = await admin.from("document_revisions").insert({
      department_id: departmentId,
      document_id: documentId,
      revision_number: 1,
      file_name: file.name,
      file_path: storagePath,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      uploaded_by: currentMember.id,
      effective_date: today,
      revision_date: today,
      notes: "Uploaded from homework assignment.",
      status: "Active",
      content_text: null,
    }).select("id").single();
    if (revisionError || !revision) throw new Error(revisionError?.message || "Unable to create training material revision.");

    const { error: currentRevisionError } = await admin.from("documents").update({ current_revision_id: revision.id }).eq("id", documentId).eq("department_id", departmentId);
    if (currentRevisionError) throw new Error(currentRevisionError.message || "Unable to attach training material revision.");

    return jsonResponse({ ok: true, documentId });
  } catch (error) {
    const admin = createSupabaseAdminClient();
    if (documentId) await admin.from("document_revisions").delete().eq("document_id", documentId);
    if (documentId) await admin.from("documents").delete().eq("id", documentId);
    if (storagePath) await admin.storage.from("department-documents").remove([storagePath]);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to create training material." }, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { documentId?: unknown };
    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    if (!currentMember?.departmentId || !documentId) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    if (!(await hasTrainingAssignmentManagementPermission(supabase, currentMember.departmentId, currentMember.role))) {
      return jsonResponse({ ok: false, error: "Training assignment permission is required." }, 403);
    }

    const admin = createSupabaseAdminClient();
    const { data: document } = await admin.from("documents").select("id, department_id, source_kind, uploaded_by").eq("id", documentId).maybeSingle();
    if (!document || document.department_id !== currentMember.departmentId || document.source_kind !== "training" || document.uploaded_by !== currentMember.id) {
      return jsonResponse({ ok: false, error: "Training document cleanup is not authorized." }, 403);
    }
    const { data: revisions } = await admin.from("document_revisions").select("file_path").eq("document_id", documentId);
    await admin.from("document_revisions").delete().eq("document_id", documentId);
    await admin.from("documents").delete().eq("id", documentId);
    const paths = (revisions ?? []).map((row) => row.file_path).filter((path): path is string => typeof path === "string");
    if (paths.length) await admin.storage.from("department-documents").remove(paths);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to clean up training material." }, 400);
  }
}
