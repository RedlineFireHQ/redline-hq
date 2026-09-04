import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

type UpdateEquipmentPayload = {
  equipmentName?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  assetId?: unknown;
  placedInServiceDate?: unknown;
  location?: unknown;
  status?: unknown;
  notes?: unknown;
  photoUpload?: unknown;
  removePhoto?: unknown;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const ALLOWED_STATUS_VALUES = new Set(["Active", "Inactive", "Out of Service"]);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(value: unknown): string | null {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return normalized;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseUpload(value: unknown): UploadPayload | null {
  const item = asObject(value);
  if (!item) {
    return null;
  }

  const fileName = asTrimmedString(item.fileName);
  const mimeType = asTrimmedString(item.mimeType) || "application/octet-stream";
  const base64Data = asTrimmedString(item.base64Data);

  if (!fileName || !base64Data) {
    return null;
  }

  return {
    fileName,
    mimeType,
    base64Data,
  };
}

async function uploadEquipmentPhoto({
  supabase,
  departmentId,
  upload,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  departmentId: string;
  upload: UploadPayload;
}): Promise<string> {
  if (!upload.mimeType.toLowerCase().startsWith("image/")) {
    throw new Error("Photo must be an image file.");
  }

  const sanitizedFileName = upload.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${departmentId}/ems-equipment/${Date.now()}-${sanitizedFileName}`;
  const binary = Buffer.from(upload.base64Data, "base64");

  const { error } = await supabase.storage
    .from("department-documents")
    .upload(storagePath, binary, {
      contentType: upload.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Unable to upload equipment photo.");
  }

  return storagePath;
}

async function resolvePhotoUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string | null,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from("department-documents")
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: item, error } = await supabase
      .from("ems_equipment")
      .select(
        "id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at",
      )
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to load EMS equipment." }, 400);
    }

    if (!item) {
      return jsonResponse({ ok: false, error: "EMS equipment not found." }, 404);
    }

    const photoUrl = await resolvePhotoUrl(supabase, item.photo_path ?? null);

    return jsonResponse({
      ok: true,
      item,
      photoUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load EMS equipment.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as UpdateEquipmentPayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasDepartmentPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "inventory_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("ems_equipment")
      .select("id, photo_path, status")
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ ok: false, error: existingError.message || "Unable to update EMS equipment." }, 400);
    }

    if (!existingItem) {
      return jsonResponse({ ok: false, error: "EMS equipment not found." }, 404);
    }

    const equipmentName = asTrimmedString(payload.equipmentName);
    const manufacturer = asTrimmedString(payload.manufacturer) || null;
    const model = asTrimmedString(payload.model) || null;
    const serialNumber = asTrimmedString(payload.serialNumber) || null;
    const assetId = asTrimmedString(payload.assetId) || null;
    const placedInServiceDate = parseOptionalDate(payload.placedInServiceDate);
    const location = asTrimmedString(payload.location) || null;
    const rawStatus = asTrimmedString(payload.status);
    const existingStatus = asTrimmedString(existingItem.status);
    const status = rawStatus || existingStatus || "Active";
    const notes = asTrimmedString(payload.notes) || null;
    const photoUpload = parseUpload(payload.photoUpload);
    const removePhoto = payload.removePhoto === true;

    if (!equipmentName) {
      return jsonResponse({ ok: false, error: "Equipment name is required." }, 400);
    }

    if (!ALLOWED_STATUS_VALUES.has(status)) {
      return jsonResponse({ ok: false, error: "Status must be Active, Inactive, or Out of Service." }, 400);
    }

    let nextPhotoPath: string | null = existingItem.photo_path;

    if (photoUpload) {
      const uploadedPath = await uploadEquipmentPhoto({
        supabase,
        departmentId: currentMember.departmentId,
        upload: photoUpload,
      });
      nextPhotoPath = uploadedPath;
    } else if (removePhoto) {
      nextPhotoPath = null;
    }

    const { data, error } = await supabase
      .from("ems_equipment")
      .update({
        equipment_name: equipmentName,
        manufacturer,
        model,
        serial_number: serialNumber,
        equipment_number: assetId,
        placed_in_service_date: placedInServiceDate,
        location,
        status,
        notes,
        photo_path: nextPhotoPath,
      })
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .select(
        "id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      if (photoUpload && nextPhotoPath && nextPhotoPath !== existingItem.photo_path) {
        await supabase.storage.from("department-documents").remove([nextPhotoPath]);
      }

      return jsonResponse({ ok: false, error: error?.message || "Unable to update EMS equipment." }, 400);
    }

    if (existingItem.photo_path && existingItem.photo_path !== nextPhotoPath) {
      await supabase.storage.from("department-documents").remove([existingItem.photo_path]);
    }

    return jsonResponse({ ok: true, item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update EMS equipment.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasDepartmentPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "inventory_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("ems_equipment")
      .select("id, photo_path")
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ ok: false, error: existingError.message || "Unable to delete EMS equipment." }, 400);
    }

    if (!existingItem) {
      return jsonResponse({ ok: false, error: "EMS equipment not found." }, 404);
    }

    const { error: deleteError } = await supabase
      .from("ems_equipment")
      .delete()
      .eq("id", id)
      .eq("department_id", currentMember.departmentId);

    if (deleteError) {
      return jsonResponse({ ok: false, error: deleteError.message || "Unable to delete EMS equipment." }, 400);
    }

    if (existingItem.photo_path) {
      await supabase.storage.from("department-documents").remove([existingItem.photo_path]);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete EMS equipment.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
