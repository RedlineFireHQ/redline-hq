import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

type UpdatePpePayload = {
  itemName?: unknown;
  assignmentType?: unknown;
  assignedMemberId?: unknown;
  apparatusId?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  serialNumber?: unknown;
  assetId?: unknown;
  size?: unknown;
  dateManufactured?: unknown;
  placedInServiceDate?: unknown;
  expirationDate?: unknown;
  status?: unknown;
  notes?: unknown;
  photoUpload?: unknown;
  removePhoto?: unknown;
};

type PpeAssignmentType = "Station Supply" | "Department Member" | "Apparatus";

const APPARATUS_LOCATION_PREFIX = "Apparatus:";
const STATION_SUPPLY_LOCATION = "Station Supply";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
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

function normalizeAssignmentType(value: unknown): PpeAssignmentType {
  const normalized = asTrimmedString(value);
  if (normalized === "Station Supply" || normalized === "Apparatus") {
    return normalized;
  }

  return "Department Member";
}

function normalizeStatus(value: unknown): "Active" | "Inactive" | "Out of Service" {
  const normalized = asTrimmedString(value);
  if (normalized === "Inactive" || normalized === "Out of Service") {
    return normalized;
  }

  return "Active";
}

function normalizeMemberName(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const relation = value as Record<string, unknown>;
  const firstName = typeof relation.first_name === "string" ? relation.first_name.trim() : "";
  const lastName = typeof relation.last_name === "string" ? relation.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || null;
}

async function uploadPpePhoto({
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
  const storagePath = `${departmentId}/inventory/ppe/${parentId}/${Date.now()}-${sanitizedFileName}`;
  const binary = Buffer.from(upload.base64Data, "base64");

  const { error } = await supabase.storage
    .from("department-documents")
    .upload(storagePath, binary, {
      contentType: upload.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Unable to upload PPE photo.");
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

async function validateAssignedMember({
  supabase,
  departmentId,
  memberId,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  departmentId: string;
  memberId: string;
}) {
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("department_id", departmentId)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function validateActiveApparatus({
  supabase,
  departmentId,
  apparatusId,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  departmentId: string;
  apparatusId: string;
}) {
  const { data, error } = await supabase
    .from("apparatus")
    .select("id")
    .eq("id", apparatusId)
    .eq("department_id", departmentId)
    .eq("lifecycle_status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
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
      .from("ppe_items")
      .select(
        "id, item_name, assigned_member_id, manufacturer, model, serial_number, asset_number, size, date_manufactured, placed_in_service_date, expiration_date, location, status, notes, photo_path, created_at, updated_at, assigned_member:assigned_member_id(first_name, last_name)",
      )
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to load PPE item." }, 400);
    }

    if (!item) {
      return jsonResponse({ ok: false, error: "PPE item not found." }, 404);
    }

    const photoUrl = await resolvePhotoUrl(supabase, item.photo_path ?? null);

    return jsonResponse({
      ok: true,
      item: {
        ...item,
        assigned_member_name: normalizeMemberName(item.assigned_member),
      },
      photoUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load PPE item.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as UpdatePpePayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasInventoryPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "ppe_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("ppe_items")
      .select("id, photo_path")
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ ok: false, error: existingError.message || "Unable to update PPE item." }, 400);
    }

    if (!existingItem) {
      return jsonResponse({ ok: false, error: "PPE item not found." }, 404);
    }

    const itemName = asTrimmedString(payload.itemName);
    const assignmentType = normalizeAssignmentType(payload.assignmentType);
    const assignedMemberIdInput = asTrimmedString(payload.assignedMemberId);
    const apparatusIdInput = asTrimmedString(payload.apparatusId);
    const manufacturer = asTrimmedString(payload.manufacturer) || null;
    const model = asTrimmedString(payload.model) || null;
    const serialNumber = asTrimmedString(payload.serialNumber) || null;
    const assetId = asTrimmedString(payload.assetId) || null;
    const size = asTrimmedString(payload.size) || null;
    const dateManufactured = parseOptionalDate(payload.dateManufactured);
    const placedInServiceDate = parseOptionalDate(payload.placedInServiceDate);
    const expirationDate = parseOptionalDate(payload.expirationDate);
    const status = normalizeStatus(payload.status);
    const notes = asTrimmedString(payload.notes) || null;
    const photoUpload = parseUpload(payload.photoUpload);
    const removePhoto = payload.removePhoto === true;

    if (!itemName) {
      return jsonResponse({ ok: false, error: "PPE item name is required." }, 400);
    }

    let assignedMemberId: string | null = null;
    let location: string | null = null;

    if (assignmentType === "Department Member") {
      if (!assignedMemberIdInput) {
        return jsonResponse({ ok: false, error: "Department member is required." }, 400);
      }

      const assignedMember = await validateAssignedMember({
        supabase,
        departmentId: currentMember.departmentId,
        memberId: assignedMemberIdInput,
      });

      if (!assignedMember) {
        return jsonResponse({ ok: false, error: "Assigned member is invalid for this department." }, 400);
      }

      assignedMemberId = assignedMemberIdInput;
      location = null;
    } else if (assignmentType === "Apparatus") {
      if (!apparatusIdInput) {
        return jsonResponse({ ok: false, error: "Apparatus is required." }, 400);
      }

      const apparatus = await validateActiveApparatus({
        supabase,
        departmentId: currentMember.departmentId,
        apparatusId: apparatusIdInput,
      });

      if (!apparatus) {
        return jsonResponse({ ok: false, error: "Apparatus is invalid for this department." }, 400);
      }

      assignedMemberId = null;
      location = `${APPARATUS_LOCATION_PREFIX}${apparatusIdInput}`;
    } else {
      assignedMemberId = null;
      location = STATION_SUPPLY_LOCATION;
    }

    let nextPhotoPath: string | null = existingItem.photo_path;

    if (photoUpload) {
      const uploadedPath = await uploadPpePhoto({
        supabase,
        departmentId: currentMember.departmentId,
        parentId: id,
        upload: photoUpload,
      });
      nextPhotoPath = uploadedPath;
    } else if (removePhoto) {
      nextPhotoPath = null;
    }

    const { data, error } = await supabase
      .from("ppe_items")
      .update({
        item_name: itemName,
        assigned_member_id: assignedMemberId,
        manufacturer,
        model,
        serial_number: serialNumber,
        asset_number: assetId,
        size,
        date_manufactured: dateManufactured,
        placed_in_service_date: placedInServiceDate,
        expiration_date: expirationDate,
        location,
        status,
        notes,
        photo_path: nextPhotoPath,
      })
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .select(
        "id, item_name, assigned_member_id, manufacturer, model, serial_number, asset_number, size, date_manufactured, placed_in_service_date, expiration_date, location, status, notes, photo_path, created_at, updated_at, assigned_member:assigned_member_id(first_name, last_name)",
      )
      .single();

    if (error || !data) {
      if (photoUpload && nextPhotoPath && nextPhotoPath !== existingItem.photo_path) {
        await supabase.storage.from("department-documents").remove([nextPhotoPath]);
      }

      return jsonResponse({ ok: false, error: error?.message || "Unable to update PPE item." }, 400);
    }

    if (existingItem.photo_path && existingItem.photo_path !== nextPhotoPath) {
      await supabase.storage.from("department-documents").remove([existingItem.photo_path]);
    }

    return jsonResponse({
      ok: true,
      item: {
        ...data,
        assigned_member_name: normalizeMemberName(data.assigned_member),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update PPE item.";
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

    const canManageInventory = await hasInventoryPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "ppe_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("ppe_items")
      .select("id, photo_path")
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ ok: false, error: existingError.message || "Unable to delete PPE item." }, 400);
    }

    if (!existingItem) {
      return jsonResponse({ ok: false, error: "PPE item not found." }, 404);
    }

    const { error: deleteError } = await supabase
      .from("ppe_items")
      .delete()
      .eq("id", id)
      .eq("department_id", currentMember.departmentId);

    if (deleteError) {
      return jsonResponse({ ok: false, error: deleteError.message || "Unable to delete PPE item." }, 400);
    }

    if (existingItem.photo_path) {
      await supabase.storage.from("department-documents").remove([existingItem.photo_path]);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete PPE item.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
