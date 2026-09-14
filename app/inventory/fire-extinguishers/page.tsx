import FireExtinguisherWorkspace, { type FireExtinguisherRow } from "@/components/inventory/FireExtinguisherWorkspace";
import type { FireExtinguisherApparatusOption } from "@/components/inventory/FireExtinguisherFormModal";
import { getActiveApparatusOptions } from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

function compareByName(left: string | null | undefined, right: string | null | undefined) {
	const leftValue = typeof left === "string" ? left.trim() : "";
	const rightValue = typeof right === "string" ? right.trim() : "";

	if (!leftValue && !rightValue) {
		return 0;
	}

	if (!leftValue) {
		return 1;
	}

	if (!rightValue) {
		return -1;
	}

	return leftValue.localeCompare(rightValue, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function normalizeDisplayName(value: unknown, fallback: string) {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default async function FireExtinguishersInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canManageFireExtinguishers = Boolean(departmentId);

	let departmentName: string | null = null;
	let initialRows: FireExtinguisherRow[] = [];
	let apparatusOptions: FireExtinguisherApparatusOption[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const [
			{ data: departmentData },
			{ data: extinguisherData, error },
			apparatusData,
		] = await Promise.all([
			supabase.from("departments").select("name").eq("id", departmentId).maybeSingle(),
			supabase
				.from("fire_extinguishers")
				.select("id, extinguisher_number, extinguisher_type, location_type, apparatus_id, other_location, status, notes, photo_path, created_at, updated_at")
				.eq("department_id", departmentId)
				.order("status", { ascending: true })
				.order("extinguisher_number", { ascending: true }),
			getActiveApparatusOptions({ client: supabase, departmentId }),
		]);

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		if (error) {
			console.error("[fire-extinguishers] initial load failed", error);
			initialError = error.message || "Unable to load fire extinguisher inventory.";
		}

		apparatusOptions = apparatusData
			.map((row) => ({
				id: row.id,
				name: normalizeDisplayName(row.name, row.id),
			}))
			.filter((row) => Boolean(row.id));

		const apparatusById = new Map(apparatusOptions.map((row) => [row.id, row.name]));

		const extinguisherIds = ((extinguisherData ?? []) as Array<Record<string, unknown>>)
			.map((row) => (typeof row.id === "string" ? row.id : ""))
			.filter(Boolean);

		const deficiencyData = extinguisherIds.length > 0
			? (
				await supabase
					.from("deficiencies")
					.select("fire_extinguisher_id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
					.in("fire_extinguisher_id", extinguisherIds)
			).data
			: [];

		const openDeficiencyCountByExtinguisherId = new Map<string, number>();
		for (const row of (deficiencyData ?? []) as Array<{ fire_extinguisher_id: string | null; status_info: { name: string | null } | Array<{ name: string | null }> | null }>) {
			if (typeof row.fire_extinguisher_id !== "string" || !row.fire_extinguisher_id) {
				continue;
			}

			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
			const isOpen = statusName !== "resolved" && statusName !== "closed";

			if (!isOpen) {
				continue;
			}

			openDeficiencyCountByExtinguisherId.set(
				row.fire_extinguisher_id,
				(openDeficiencyCountByExtinguisherId.get(row.fire_extinguisher_id) ?? 0) + 1,
			);
		}

		initialRows = [...((extinguisherData ?? []) as Array<Record<string, unknown>>)]
			.map((row) => ({
				id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
				extinguisher_number: typeof row.extinguisher_number === "string" ? row.extinguisher_number : "",
				extinguisher_type: typeof row.extinguisher_type === "string" ? row.extinguisher_type : "",
				location_type:
					typeof row.location_type === "string" &&
					(row.location_type === "Apparatus" || row.location_type === "Station Storage" || row.location_type === "Station/Building" || row.location_type === "Other")
						? (row.location_type as FireExtinguisherRow["location_type"])
						: "Station Storage",
				apparatus_id: typeof row.apparatus_id === "string" ? row.apparatus_id : null,
				apparatus_name: typeof row.apparatus_id === "string" ? apparatusById.get(row.apparatus_id) ?? null : null,
				other_location: typeof row.other_location === "string" ? row.other_location : null,
				status:
					typeof row.status === "string" && (row.status === "Active" || row.status === "Inactive" || row.status === "Out of Service")
						? (row.status as FireExtinguisherRow["status"])
						: "Active",
				notes: typeof row.notes === "string" ? row.notes : null,
				photo_path: typeof row.photo_path === "string" ? row.photo_path : null,
				created_at: typeof row.created_at === "string" ? row.created_at : "",
				updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
				open_deficiency_count: openDeficiencyCountByExtinguisherId.get(typeof row.id === "string" ? row.id : String(row.id ?? "")) ?? 0,
			}))
			.filter((row) => Boolean(row.id))
			.sort((left, right) => compareByName(left.extinguisher_number, right.extinguisher_number));
	}

	return (
		
			<FireExtinguisherWorkspace
				departmentName={departmentName}
				canManageFireExtinguishers={canManageFireExtinguishers}
				apparatusOptions={apparatusOptions}
				initialRows={initialRows}
				initialError={initialError}
			/>
		
	);
}
