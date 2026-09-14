import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UploadPayload = {
	fileName: string;
	mimeType: string;
	base64Data: string;
};

type CreateFireExtinguisherPayload = {
	extinguisherNumber?: unknown;
	extinguisherType?: unknown;
	customExtinguisherType?: unknown;
	locationType?: unknown;
	apparatusId?: unknown;
	otherLocation?: unknown;
	status?: unknown;
	notes?: unknown;
	photoUpload?: unknown;
};

const ALLOWED_LOCATION_TYPES = new Set(["Apparatus", "Station Storage", "Station/Building", "Other"]);
const ALLOWED_STATUS_VALUES = new Set(["Active", "Inactive", "Out of Service"]);
const ALLOWED_TYPE_VALUES = new Set(["Water", "Foam", "Carbon Dioxide", "Dry Chemical", "Wet Chemical", "Clean Agent", "Other"]);

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
	const storagePath = `${departmentId}/inventory/fire-extinguishers/${parentId}/${Date.now()}-${sanitizedFileName}`;
	const binary = Buffer.from(upload.base64Data, "base64");

	const { error } = await supabase.storage.from("department-documents").upload(storagePath, binary, {
		contentType: upload.mimeType,
		upsert: false,
	});

	if (error) {
		throw new Error(error.message || "Unable to upload fire extinguisher photo.");
	}

	return storagePath;
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

function resolveTypeValue(typeValue: string, customTypeValue: string): string | null {
	if (!typeValue) {
		return null;
	}

	if (!ALLOWED_TYPE_VALUES.has(typeValue)) {
		return null;
	}

	if (typeValue !== "Other") {
		return typeValue;
	}

	return customTypeValue || null;
}

export async function GET() {
	try {
		const supabase = await createSupabaseServerClient();
		const currentMember = await getCurrentMember(supabase);

		if (!currentMember?.departmentId) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const { data, error } = await supabase
			.from("fire_extinguishers")
			.select("id, extinguisher_number, extinguisher_type, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, notes, photo_path, created_at, updated_at")
			.eq("department_id", currentMember.departmentId)
			.order("status", { ascending: true })
			.order("extinguisher_number", { ascending: true });

		if (error) {
			return jsonResponse({ ok: false, error: error.message || "Unable to load fire extinguisher inventory." }, 400);
		}

		const rows = (data ?? []).map((row) => ({
			...row,
			apparatus_name: normalizeRelatedName((row as Record<string, unknown>).apparatus),
		}));

		return jsonResponse({ ok: true, rows });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to load fire extinguisher inventory.";
		return jsonResponse({ ok: false, error: message }, 400);
	}
}

export async function POST(request: Request) {
	try {
		const payload = (await request.json().catch(() => ({}))) as CreateFireExtinguisherPayload;
		const supabase = await createSupabaseServerClient();
		const currentMember = await getCurrentMember(supabase);

		if (!currentMember?.departmentId) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const extinguisherNumber = asTrimmedString(payload.extinguisherNumber);
		const extinguisherTypeInput = asTrimmedString(payload.extinguisherType);
		const customExtinguisherType = asTrimmedString(payload.customExtinguisherType);
		const locationType = asTrimmedString(payload.locationType);
		const apparatusId = asTrimmedString(payload.apparatusId);
		const otherLocation = asTrimmedString(payload.otherLocation);
		const status = asTrimmedString(payload.status);
		const notes = asTrimmedString(payload.notes) || null;
		const photoUpload = parseUpload(payload.photoUpload);
		const extinguisherType = resolveTypeValue(extinguisherTypeInput, customExtinguisherType);

		if (!extinguisherNumber) {
			return jsonResponse({ ok: false, error: "Extinguisher number is required." }, 400);
		}

		if (!extinguisherType) {
			return jsonResponse({ ok: false, error: "Extinguisher type is required." }, 400);
		}

		if (!ALLOWED_LOCATION_TYPES.has(locationType)) {
			return jsonResponse({ ok: false, error: "Location type is required." }, 400);
		}

		if (!ALLOWED_STATUS_VALUES.has(status)) {
			return jsonResponse({ ok: false, error: "Status is required." }, 400);
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

		const parentId = crypto.randomUUID();
		let photoPath: string | null = null;
		const { data: createdItem, error: createError } = await supabase
			.from("fire_extinguishers")
			.insert({
				id: parentId,
				department_id: currentMember.departmentId,
				extinguisher_number: extinguisherNumber,
				extinguisher_type: extinguisherType,
				location_type: locationType,
				apparatus_id: locationType === "Apparatus" ? apparatusId : null,
				other_location: locationType === "Other" ? otherLocation : null,
				status,
				notes,
				photo_path: null,
			})
			.select("id, extinguisher_number, extinguisher_type, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, notes, photo_path, created_at, updated_at")
			.single();

		if (createError || !createdItem) {
			return jsonResponse({ ok: false, error: createError?.message || "Unable to create fire extinguisher." }, 400);
		}
		if (!photoUpload) return jsonResponse({ ok: true, item: { ...createdItem, apparatus_name: normalizeRelatedName((createdItem as Record<string, unknown>).apparatus) } });

		try {
			photoPath = await uploadPhoto({ supabase, departmentId: currentMember.departmentId, parentId, upload: photoUpload });
			const { data, error } = await supabase
				.from("fire_extinguishers")
				.update({ photo_path: photoPath })
				.eq("id", parentId)
				.eq("department_id", currentMember.departmentId)
				.select("id, extinguisher_number, extinguisher_type, location_type, apparatus_id, apparatus:apparatus_id(name), other_location, status, notes, photo_path, created_at, updated_at")
				.single();
			if (error || !data) throw new Error(error?.message || "Unable to attach fire extinguisher photo.");
			return jsonResponse({ ok: true, item: { ...data, apparatus_name: normalizeRelatedName((data as Record<string, unknown>).apparatus) } });
		} catch (error) {
			await supabase.from("fire_extinguishers").delete().eq("id", parentId).eq("department_id", currentMember.departmentId);
			if (photoPath) await supabase.storage.from("department-documents").remove([photoPath]);
			throw error;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to create fire extinguisher.";
		return jsonResponse({ ok: false, error: message }, 400);
	}
}
