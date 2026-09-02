import { getCurrentMember } from "@/lib/current-member";
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

function isElevatedRole(role: unknown): boolean {
  return role === "administrator" || role === "officer";
}

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

    if (!isElevatedRole(currentMember.role)) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const equipmentName = asTrimmedString(payload.equipmentName);
    const manufacturer = asTrimmedString(payload.manufacturer) || null;
    const model = asTrimmedString(payload.model) || null;
    const serialNumber = asTrimmedString(payload.serialNumber) || null;
    const assetId = asTrimmedString(payload.assetId) || null;
    const placedInServiceDate = parseOptionalDate(payload.placedInServiceDate);
    const location = asTrimmedString(payload.location) || null;
    const status = asTrimmedString(payload.status) === "Inactive" ? "Inactive" : "Active";
    const notes = asTrimmedString(payload.notes) || null;
    const photoUpload = parseUpload(payload.photoUpload);

    if (!equipmentName) {
      return jsonResponse({ ok: false, error: "Equipment name is required." }, 400);
    }

    let photoPath: string | null = null;
    if (photoUpload) {
      photoPath = await uploadEquipmentPhoto({
        supabase,
        departmentId: currentMember.departmentId,
        upload: photoUpload,
      });
    }

    const { data, error } = await supabase
      .from("ems_equipment")
      .insert({
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
        photo_path: photoPath,
      })
      .select(
        "id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      if (photoPath) {
        await supabase.storage.from("department-documents").remove([photoPath]);
      }

      return jsonResponse({ ok: false, error: error?.message || "Unable to create EMS equipment." }, 400);
    }

    return jsonResponse({ ok: true, item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create EMS equipment.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
