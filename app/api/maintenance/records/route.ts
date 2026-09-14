import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type MaintenancePayload = {
  apparatus_id: string;
  deficiency_id: string | null;
  maintenance_type: string;
  completed_by: string | null;
  service_date: string;
  description: string;
  parts_used: string | null;
  labor_hours: number | null;
  mileage: number | null;
  engine_hours: number | null;
  cost: number | null;
  notes: string | null;
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_");
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  let recordId: string | null = null;

  try {
    const formData = await request.formData();
    const payloadValue = formData.get("payload");
    const payload = JSON.parse(String(payloadValue ?? "{}")) as MaintenancePayload;
    const photoFiles = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    const attachmentFiles = formData.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: activeMember } = await supabase
      .from("members")
      .select("id")
      .eq("id", currentMember.id)
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .maybeSingle();
    if (!activeMember) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    if (!(await hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "maintenance_management"))) {
      return jsonResponse({ ok: false, error: "Maintenance management permission is required." }, 403);
    }

    const { data: apparatus } = await supabase
      .from("apparatus")
      .select("id")
      .eq("id", payload.apparatus_id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();
    if (!apparatus) return jsonResponse({ ok: false, error: "Apparatus is invalid for this department." }, 400);

    if (payload.deficiency_id) {
      const { data: deficiency } = await supabase
        .from("deficiencies")
        .select("id")
        .eq("id", payload.deficiency_id)
        .eq("department_id", currentMember.departmentId)
        .maybeSingle();
      if (!deficiency) return jsonResponse({ ok: false, error: "Deficiency is invalid for this department." }, 400);
    }

    const admin = createSupabaseAdminClient();
    recordId = crypto.randomUUID();
    const basePath = `${currentMember.departmentId}/maintenance/${recordId}`;
    const uploadFiles = async (files: File[], folder: "photos" | "attachments") => {
      const paths: string[] = [];
      for (const [index, file] of files.entries()) {
        const path = `${basePath}/${folder}/${Date.now()}-${index}-${sanitizeFileName(file.name || `${folder}-${index + 1}`)}`;
        const { error } = await admin.storage.from("deficiency-photos").upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw new Error(error.message || `Unable to upload ${folder}.`);
        paths.push(path);
        uploadedPaths.push(path);
      }
      return paths;
    };

    const { error: insertError } = await admin.from("maintenance_records").insert({
      id: recordId,
      department_id: currentMember.departmentId,
      ...payload,
      photos: [],
      attachments: [],
    });
    if (insertError) throw new Error(insertError.message || "Unable to create maintenance record.");

    const photos = await uploadFiles(photoFiles, "photos");
    const attachments = await uploadFiles(attachmentFiles, "attachments");
    const { data: record, error: updateError } = await admin
      .from("maintenance_records")
      .update({ photos, attachments })
      .eq("id", recordId)
      .eq("department_id", currentMember.departmentId)
      .select("id, maintenance_number, deficiency_id")
      .single();
    if (updateError || !record) throw new Error(updateError?.message || "Unable to attach maintenance files.");

    return jsonResponse({ ok: true, record });
  } catch (error) {
    const admin = createSupabaseAdminClient();
    if (recordId) await admin.from("maintenance_records").delete().eq("id", recordId);
    if (uploadedPaths.length > 0) await admin.storage.from("deficiency-photos").remove(uploadedPaths);
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to create maintenance record." }, 400);
  }
}
