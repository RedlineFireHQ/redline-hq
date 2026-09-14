import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UploadPayload = {
	fileName: string;
	mimeType: string;
	base64Data: string;
};

type UpdateMiscFireEquipmentPayload = {
	equipmentName?: unknown;
	assetNumber?: unknown;
	locationType?: unknown;
	apparatusId?: unknown;
	otherLocation?: unknown;
	status?: unknown;
	datePlacedInService?: unknown;
	manufacturer?: unknown;
	model?: unknown;
	notes?: unknown;
	photoUpload?: unknown;
	removePhoto?: unknown;
};

type RouteContext = {
	params: Promise<{
		id: string;
	}>;
};

const ALLOWED_LOCATION_TYPES = new Set(["Apparatus", "Station Storage", "Other"]);
const ALLOWED_STATUS_VALUES = new Set(["Active", "Inactive", "Out of Service"]);

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

function normalizeOptionalText(value: unknown): string | null {
	const normalized = asTrimmedString(value);
	return normalized ? normalized : null;
}

function normalizeDateValue(value: unknown): string | null {
	const normalized = asTrimmedString(value);
	if (!normalized) {
		return null;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		return null;
	}

	const parsed = new Date(`${normalized}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return normalized;
}

async function uploadPhoto({
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
	const storagePath = `${departmentId}/inventory/misc-fire-equipment/${parentId}/${Date.now()}-${sanitizedFileName}`;
	const binary = Buffer.from(upload.base64Data, "base64");

	const { error } = await supabase.storage.from("department-documents").upload(storagePath, binary, {
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

	const { data, error } = await supabase.storage.from("department-documents").createSignedUrl(path, 60 * 60);
	if (error || !data?.signedUrl) {
		return null;
	}

	return data.signedUrl;
}

function normalizeRelatedName(value: unknown): string | null {
	if (!value) {
		return null;
	}

	const relation = Array.isArray(value) ? value[0] : value;
	if (!relation || typeof relation !== "object") {
		return null;
	}

	const row = relation as Record<string, unknown>;
	const name = typeof row.name === "string" ? row.name.trim() : "";
	return name || null;
}

async function validateApparatus({
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
			.from("misc_fire_equipment")
			.select("id, equipment_name, asset_number, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, date_placed_in_service, manufacturer, model, notes, photo_path, created_at, updated_at")
			.eq("id", id)
			.eq("department_id", currentMember.departmentId)
			.maybeSingle();

		if (error) {
			return jsonResponse({ ok: false, error: error.message || "Unable to load equipment detail." }, 400);
		}

		if (!item) {
			return jsonResponse({ ok: false, error: "Miscellaneous fire equipment not found." }, 404);
		}

		const photoUrl = await resolvePhotoUrl(supabase, item.photo_path ?? null);

		return jsonResponse({
			ok: true,
			item: {
				...item,
				apparatus_name: normalizeRelatedName((item as Record<string, unknown>).apparatus),
			},
			photoUrl,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to load equipment detail.";
		return jsonResponse({ ok: false, error: message }, 400);
	}
}

export async function PATCH(request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const payload = (await request.json().catch(() => ({}))) as UpdateMiscFireEquipmentPayload;
		const supabase = await createSupabaseServerClient();
		const currentMember = await getCurrentMember(supabase);

		if (!currentMember?.departmentId) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		if (!isElevatedRole(currentMember.role)) {
			return jsonResponse({ ok: false, error: "Forbidden" }, 403);
		}

		const { data: existingItem, error: existingError } = await supabase
			.from("misc_fire_equipment")
			.select("id, photo_path")
			.eq("id", id)
			.eq("department_id", currentMember.departmentId)
			.maybeSingle();

		if (existingError) {
			return jsonResponse({ ok: false, error: existingError.message || "Unable to update equipment." }, 400);
		}

		if (!existingItem) {
			return jsonResponse({ ok: false, error: "Miscellaneous fire equipment not found." }, 404);
		}

		const equipmentName = asTrimmedString(payload.equipmentName);
		const assetNumber = normalizeOptionalText(payload.assetNumber);
		const locationType = asTrimmedString(payload.locationType);
		const apparatusId = asTrimmedString(payload.apparatusId);
		const otherLocation = asTrimmedString(payload.otherLocation);
		const status = asTrimmedString(payload.status);
		const datePlacedInServiceRaw = asTrimmedString(payload.datePlacedInService);
		const datePlacedInService = datePlacedInServiceRaw ? normalizeDateValue(datePlacedInServiceRaw) : null;
		const manufacturer = normalizeOptionalText(payload.manufacturer);
		const model = normalizeOptionalText(payload.model);
		const notes = normalizeOptionalText(payload.notes);
		const photoUpload = parseUpload(payload.photoUpload);
		const removePhoto = payload.removePhoto === true;

		if (!equipmentName) {
			return jsonResponse({ ok: false, error: "Equipment Name is required." }, 400);
		}

		if (!ALLOWED_LOCATION_TYPES.has(locationType)) {
			return jsonResponse({ ok: false, error: "Location type is required." }, 400);
		}

		if (!ALLOWED_STATUS_VALUES.has(status)) {
			return jsonResponse({ ok: false, error: "Status is required." }, 400);
		}

		if (datePlacedInServiceRaw && !datePlacedInService) {
			return jsonResponse({ ok: false, error: "Date Placed in Service must be a valid date." }, 400);
		}

		if (locationType === "Apparatus") {
			if (!apparatusId) {
				return jsonResponse({ ok: false, error: "Select an apparatus location." }, 400);
			}

			const apparatus = await validateApparatus({
				supabase,
				departmentId: currentMember.departmentId,
				apparatusId,
			});

			if (!apparatus) {
				return jsonResponse({ ok: false, error: "Apparatus is invalid for this department." }, 400);
			}
		} else if (locationType === "Other") {
			if (!otherLocation) {
				return jsonResponse({ ok: false, error: "Other location is required." }, 400);
			}
		} else if (apparatusId || otherLocation) {
			return jsonResponse({ ok: false, error: "Location details do not match the selected location type." }, 400);
		}

		let nextPhotoPath: string | null = existingItem.photo_path;

		if (photoUpload) {
			const uploadedPath = await uploadPhoto({
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
			.from("misc_fire_equipment")
			.update({
				equipment_name: equipmentName,
				asset_number: assetNumber,
				location_type: locationType,
				apparatus_id: locationType === "Apparatus" ? apparatusId : null,
				other_location: locationType === "Other" ? otherLocation : null,
				status,
				date_placed_in_service: datePlacedInService,
				manufacturer,
				model,
				notes,
				photo_path: nextPhotoPath,
			})
			.eq("id", id)
			.eq("department_id", currentMember.departmentId)
			.select("id, equipment_name, asset_number, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, date_placed_in_service, manufacturer, model, notes, photo_path, created_at, updated_at")
			.single();

		if (error || !data) {
			if (photoUpload && nextPhotoPath && nextPhotoPath !== existingItem.photo_path) {
				await supabase.storage.from("department-documents").remove([nextPhotoPath]);
			}

			return jsonResponse({ ok: false, error: error?.message || "Unable to update equipment." }, 400);
		}

		if (existingItem.photo_path && existingItem.photo_path !== nextPhotoPath) {
			await supabase.storage.from("department-documents").remove([existingItem.photo_path]);
		}

		return jsonResponse({
			ok: true,
			item: {
				...data,
				apparatus_name: normalizeRelatedName((data as Record<string, unknown>).apparatus),
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to update equipment.";
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

		if (!isElevatedRole(currentMember.role)) {
			return jsonResponse({ ok: false, error: "Forbidden" }, 403);
		}

		const { data: existingItem, error: existingError } = await supabase
			.from("misc_fire_equipment")
			.select("id, photo_path")
			.eq("id", id)
			.eq("department_id", currentMember.departmentId)
			.maybeSingle();

		if (existingError) {
			return jsonResponse({ ok: false, error: existingError.message || "Unable to delete equipment." }, 400);
		}

		if (!existingItem) {
			return jsonResponse({ ok: false, error: "Miscellaneous fire equipment not found." }, 404);
		}

		const { error: deleteError } = await supabase
			.from("misc_fire_equipment")
			.delete()
			.eq("id", id)
			.eq("department_id", currentMember.departmentId);

		if (deleteError) {
			return jsonResponse({ ok: false, error: deleteError.message || "Unable to delete equipment." }, 400);
		}

		if (existingItem.photo_path) {
			await supabase.storage.from("department-documents").remove([existingItem.photo_path]);
		}

		return jsonResponse({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to delete equipment.";
		return jsonResponse({ ok: false, error: message }, 400);
	}
}
