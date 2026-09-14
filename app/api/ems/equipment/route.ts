import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

type CreateEquipmentPayload = {
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

function mapCreateEquipmentErrorMessage(error: { code?: string; message?: string; details?: string | null } | null) {
  if (!error) {
    return "Unable to create EMS equipment.";
  }

  const message = typeof error.message === "string" ? error.message : "";
  const details = typeof error.details === "string" ? error.details : "";
  const combined = `${message} ${details}`.toLowerCase();

  if (
    error.code === "23505"
    && (combined.includes("ems_equipment_department_equipment_number_unique_idx")
      || combined.includes("equipment_number"))
  ) {
    return "Equipment Number is already in use. Please enter a different number.";
  }

  return message || "Unable to create EMS equipment.";
}

async function uploadEquipmentPhoto({
  supabase,
  departmentId,
  parentId,
  upload,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  departmentId: string;
  parentId: string;
  upload: UploadPayload;
}): Promise<string> {
  if (!upload.mimeType.toLowerCase().startsWith("image/")) {
    throw new Error("Photo must be an image file.");
  }

  const sanitizedFileName = upload.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${departmentId}/inventory/ems-equipment/${parentId}/${Date.now()}-${sanitizedFileName}`;
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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("ems_equipment")
      .select(
        "id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .order("status", { ascending: true })
      .order("equipment_name", { ascending: true });

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to load EMS equipment." }, 400);
    }

    return jsonResponse({ ok: true, rows: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load EMS equipment.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as CreateEquipmentPayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasInventoryPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "ems_equipment_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const equipmentName = asTrimmedString(payload.equipmentName);
    const manufacturer = asTrimmedString(payload.manufacturer) || null;
    const model = asTrimmedString(payload.model) || null;
    const serialNumber = asTrimmedString(payload.serialNumber) || null;
    const assetId = asTrimmedString(payload.assetId) || null;
    const placedInServiceDate = parseOptionalDate(payload.placedInServiceDate);
    const location = asTrimmedString(payload.location) || null;
    const rawStatus = asTrimmedString(payload.status);
    const status = rawStatus || "Active";
    const notes = asTrimmedString(payload.notes) || null;
    const photoUpload = parseUpload(payload.photoUpload);

    if (!equipmentName) {
      return jsonResponse({ ok: false, error: "Equipment name is required." }, 400);
    }

    if (!ALLOWED_STATUS_VALUES.has(status)) {
      return jsonResponse({ ok: false, error: "Status must be Active, Inactive, or Out of Service." }, 400);
    }

    const parentId = crypto.randomUUID();
    let photoPath: string | null = null;
    const { data: createdItem, error: createError } = await supabase
      .from("ems_equipment")
      .insert({
        id: parentId,
        department_id: currentMember.departmentId,
        equipment_name: equipmentName,
        manufacturer,
        model,
        serial_number: serialNumber,
        equipment_number: assetId,
        placed_in_service_date: placedInServiceDate,
        location,
        status,
        notes,
        photo_path: null,
      })
      .select(
        "id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at",
      )
      .single();

    if (createError || !createdItem) {
      return jsonResponse({ ok: false, error: mapCreateEquipmentErrorMessage(createError) }, 400);
    }
    if (!photoUpload) return jsonResponse({ ok: true, item: createdItem });

    try {
      photoPath = await uploadEquipmentPhoto({ supabase, departmentId: currentMember.departmentId, parentId, upload: photoUpload });
      const { data, error } = await supabase
        .from("ems_equipment")
        .update({ photo_path: photoPath })
        .eq("id", parentId)
        .eq("department_id", currentMember.departmentId)
        .select("id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at")
        .single();
      if (error || !data) throw new Error(error?.message || "Unable to attach equipment photo.");
      return jsonResponse({ ok: true, item: data });
    } catch (error) {
      await supabase.from("ems_equipment").delete().eq("id", parentId).eq("department_id", currentMember.departmentId);
      if (photoPath) await supabase.storage.from("department-documents").remove([photoPath]);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create EMS equipment.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
