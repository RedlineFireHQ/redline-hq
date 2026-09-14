import { getCurrentMember } from "@/lib/current-member";
import { normalizeRopeStatus } from "@/lib/inventory/rope-status";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

type CreateRopePayload = {
  ropeName?: unknown;
  ropeIdentifier?: unknown;
  ropeType?: unknown;
  serialNumber?: unknown;
  lengthFt?: unknown;
  diameterMm?: unknown;
  diameterIn?: unknown;
  placedInServiceDate?: unknown;
  locationType?: unknown;
  apparatusId?: unknown;
  otherLocation?: unknown;
  status?: unknown;
  notes?: unknown;
  photoUpload?: unknown;
};

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

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
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

function parseOptionalInteger(value: unknown): number | null {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDecimal(value: unknown): number | null {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseOptionalDate(value: unknown): string | null {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeRelatedName(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return normalizeRelatedName(value[0]);
  }

  if (typeof value !== "object") {
    return null;
  }

  const relation = value as Record<string, unknown>;
  return typeof relation.name === "string" ? relation.name : null;
}

function normalizeLocationType(value: unknown): "Apparatus" | "Station Storage" | "Other" {
  if (value === "Apparatus") {
    return "Apparatus";
  }

  if (value === "Other") {
    return "Other";
  }

  return "Station Storage";
}

async function uploadRopePhoto({
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
  const storagePath = `${departmentId}/inventory/rope/${parentId}/${Date.now()}-${sanitizedFileName}`;
  const binary = Buffer.from(upload.base64Data, "base64");

  const { error } = await supabase.storage.from("department-documents").upload(storagePath, binary, {
    contentType: upload.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Unable to upload rope photo.");
  }

  return storagePath;
}

function normalizeRopeRow(row: Record<string, unknown>) {
  return {
    id: typeof row.id === "string" ? row.id : "",
    rope_name: typeof row.rope_name === "string" ? row.rope_name : "",
    rope_identifier: typeof row.rope_identifier === "string" ? row.rope_identifier : "",
    rope_type: row.rope_type === "Utility" ? "Utility" : "Life Safety",
    serial_number: typeof row.serial_number === "string" ? row.serial_number : null,
    length_ft: asNullableNumber(row.length_ft),
    diameter_mm: asNullableNumber(row.diameter_mm),
    placed_in_service_date:
      typeof row.placed_in_service_date === "string" ? row.placed_in_service_date : null,
    location_type: normalizeLocationType(row.location_type),
    apparatus_id: typeof row.apparatus_id === "string" ? row.apparatus_id : null,
    apparatus_name: normalizeRelatedName(row.apparatus),
    other_location: typeof row.other_location === "string" ? row.other_location : null,
    status: normalizeRopeStatus(row.status),
    notes: typeof row.notes === "string" ? row.notes : null,
    photo_path: typeof row.photo_path === "string" ? row.photo_path : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("rope_items")
      .select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, diameter_mm, placed_in_service_date, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, notes, photo_path, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("rope_name", { ascending: true });

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to load rope inventory." }, 400);
    }

    return jsonResponse({ ok: true, rows: (data ?? []).map((row) => normalizeRopeRow(row as Record<string, unknown>)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load rope inventory.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as CreateRopePayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasInventoryPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "rope_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const ropeName = asTrimmedString(payload.ropeName);
    const ropeIdentifier = asTrimmedString(payload.ropeIdentifier);
    const ropeType = asTrimmedString(payload.ropeType) === "Utility" ? "Utility" : "Life Safety";
    const serialNumber = asTrimmedString(payload.serialNumber) || null;
    const lengthFt = parseOptionalInteger(payload.lengthFt);
    const diameterMm = parseOptionalDecimal(payload.diameterMm ?? payload.diameterIn);
    const placedInServiceDate = parseOptionalDate(payload.placedInServiceDate);
    const locationType = normalizeLocationType(payload.locationType);
    const apparatusId = asTrimmedString(payload.apparatusId) || null;
    const otherLocation = asTrimmedString(payload.otherLocation) || null;
    const status = normalizeRopeStatus(payload.status);
    const notes = asTrimmedString(payload.notes) || null;
    const photoUpload = parseUpload(payload.photoUpload);

    if (!ropeName) {
      return jsonResponse({ ok: false, error: "Rope name is required." }, 400);
    }

    if (!ropeIdentifier) {
      return jsonResponse({ ok: false, error: "Rope identifier is required." }, 400);
    }

    if (lengthFt === null) {
      return jsonResponse({ ok: false, error: "Length (ft) is required." }, 400);
    }

    if (diameterMm === null) {
      return jsonResponse({ ok: false, error: "Diameter (mm) is required." }, 400);
    }

    if (locationType === "Apparatus" && !apparatusId) {
      return jsonResponse({ ok: false, error: "Select an apparatus for apparatus location." }, 400);
    }

    if (locationType !== "Apparatus" && apparatusId) {
      return jsonResponse({ ok: false, error: "Apparatus may only be set when location is Apparatus." }, 400);
    }

    if (locationType === "Other" && !otherLocation) {
      return jsonResponse({ ok: false, error: "Other location is required when location is Other." }, 400);
    }

    if (locationType !== "Other" && otherLocation) {
      return jsonResponse({ ok: false, error: "Other location may only be set when location is Other." }, 400);
    }

    if (apparatusId) {
      const { data: apparatusRow } = await supabase
        .from("apparatus")
        .select("id")
        .eq("department_id", currentMember.departmentId)
        .eq("id", apparatusId)
        .maybeSingle();

      if (!apparatusRow) {
        return jsonResponse({ ok: false, error: "Selected apparatus was not found." }, 400);
      }
    }

    const parentId = crypto.randomUUID();
    let photoPath: string | null = null;
    const { data: createdItem, error: createError } = await supabase
      .from("rope_items")
      .insert({
        id: parentId,
        department_id: currentMember.departmentId,
        rope_name: ropeName,
        rope_identifier: ropeIdentifier,
        rope_type: ropeType,
        serial_number: serialNumber,
        length_ft: lengthFt,
        diameter_mm: diameterMm,
        placed_in_service_date: placedInServiceDate,
        location_type: locationType,
        apparatus_id: locationType === "Apparatus" ? apparatusId : null,
        other_location: locationType === "Other" ? otherLocation : null,
        status,
        notes,
        photo_path: null,
      })
      .select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, diameter_mm, placed_in_service_date, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, notes, photo_path, created_at, updated_at")
      .single();

    if (createError || !createdItem) {
      return jsonResponse({ ok: false, error: createError?.message || "Unable to create rope." }, 400);
    }

    if (!photoUpload) {
      return jsonResponse({ ok: true, item: normalizeRopeRow(createdItem as Record<string, unknown>) });
    }

    try {
      photoPath = await uploadRopePhoto({ supabase, departmentId: currentMember.departmentId, parentId, upload: photoUpload });
      const { data, error } = await supabase
        .from("rope_items")
        .update({ photo_path: photoPath })
        .eq("id", parentId)
        .eq("department_id", currentMember.departmentId)
        .select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, diameter_mm, placed_in_service_date, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, notes, photo_path, created_at, updated_at")
        .single();
      if (error || !data) throw new Error(error?.message || "Unable to attach rope photo.");
      return jsonResponse({ ok: true, item: normalizeRopeRow(data as Record<string, unknown>) });
    } catch (error) {
      await supabase.from("rope_items").delete().eq("id", parentId).eq("department_id", currentMember.departmentId);
      if (photoPath) await supabase.storage.from("department-documents").remove([photoPath]);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create rope.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}