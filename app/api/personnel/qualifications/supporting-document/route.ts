import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
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
    const memberId = String(formData.get("memberId") ?? "").trim();
    const qualificationId = String(formData.get("qualificationId") ?? "").trim();
    const earnedAt = String(formData.get("earnedAt") ?? "").trim();
    const file = formData.get("file");
    if (!memberId || !qualificationId || !earnedAt || !(file instanceof File) || file.size === 0) {
      return jsonResponse({ ok: false, error: "Member, qualification, earned date, and file are required." }, 400);
    }

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    if (!(await hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "certification_management"))) {
      return jsonResponse({ ok: false, error: "Certification management permission is required." }, 403);
    }

    const [{ data: targetMember }, { data: qualification }] = await Promise.all([
      supabase.from("members").select("id").eq("id", memberId).eq("department_id", currentMember.departmentId).eq("active", true).maybeSingle(),
      supabase.from("qualification_types").select("id, name").eq("id", qualificationId).eq("department_id", currentMember.departmentId).maybeSingle(),
    ]);
    if (!targetMember || !qualification) {
      return jsonResponse({ ok: false, error: "The target member or qualification is not valid for this department." }, 400);
    }

    const admin = createSupabaseAdminClient();
    documentId = crypto.randomUUID();
    const sanitizedName = file.name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "qualification-document";
    storagePath = `${currentMember.departmentId}/qualifications/${Date.now()}-${sanitizedName}`;
    const { error: uploadError } = await admin.storage.from("department-documents").upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message || "Unable to upload qualification document.");

    const title = `${qualification.name} Qualification Document`;
    const { error: documentError } = await admin.from("documents").insert({
      id: documentId,
      department_id: currentMember.departmentId,
      category: "Department Documents",
      source_kind: "personnel_qualification",
      title,
      description: null,
      document_number: null,
      effective_date: earnedAt,
      status: "Active",
      uploaded_by: currentMember.id,
      current_revision_id: null,
    });
    if (documentError) throw new Error(documentError.message || "Unable to create qualification document.");

    const { error: qualificationError } = await admin.from("member_qualifications").insert({
      department_id: currentMember.departmentId,
      member_id: memberId,
      qualification_id: qualificationId,
      earned_at: earnedAt,
      supporting_document_id: documentId,
      created_by: currentMember.id,
      updated_by: currentMember.id,
    });
    if (qualificationError) throw new Error(qualificationError.message || "Unable to attach qualification document.");

    const { data: revision, error: revisionError } = await admin.from("document_revisions").insert({
      department_id: currentMember.departmentId,
      document_id: documentId,
      revision_number: 1,
      file_name: file.name,
      file_path: storagePath,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      uploaded_by: currentMember.id,
      effective_date: earnedAt,
      revision_date: earnedAt,
      notes: "Uploaded from member qualification entry.",
      status: "Active",
      content_text: null,
    }).select("id").single();
    if (revisionError || !revision) throw new Error(revisionError?.message || "Unable to create qualification document revision.");

    const { error: currentRevisionError } = await admin.from("documents").update({ current_revision_id: revision.id }).eq("id", documentId).eq("department_id", currentMember.departmentId);
    if (currentRevisionError) throw new Error(currentRevisionError.message || "Unable to attach qualification document revision.");

    const { data: qualificationRow } = await admin.from("member_qualifications").select("id, member_id, qualification_id, earned_at, certificate_number, notes, supporting_document_id, created_by, updated_by, created_at, updated_at").eq("department_id", currentMember.departmentId).eq("member_id", memberId).eq("qualification_id", qualificationId).eq("supporting_document_id", documentId).single();
    return jsonResponse({ ok: true, document: { id: documentId, title, category: "Department Documents", document_number: null, status: "Active" }, qualification: qualificationRow });
  } catch (error) {
    const admin = createSupabaseAdminClient();
    if (documentId) await admin.from("member_qualifications").delete().eq("supporting_document_id", documentId);
    if (documentId) await admin.from("documents").delete().eq("id", documentId);
    if (storagePath) await admin.storage.from("department-documents").remove([storagePath]);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to add qualification." }, 400);
  }
}
