import PageLayout from "@/components/layout/PageLayout";
import MiscFireEquipmentWorkspace, { type MiscFireEquipmentRow } from "@/components/inventory/MiscFireEquipmentWorkspace";
import type { MiscFireEquipmentApparatusOption } from "@/components/inventory/MiscFireEquipmentFormModal";
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

export default async function MiscFireEquipmentInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canManageMiscFireEquipment = currentMember?.role === "administrator" || currentMember?.role === "officer";

	let departmentName: string | null = null;
	let initialRows: MiscFireEquipmentRow[] = [];
	let apparatusOptions: MiscFireEquipmentApparatusOption[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const [
			{ data: departmentData },
			{ data: equipmentData, error },
			{ data: apparatusData },
		] = await Promise.all([
			supabase.from("departments").select("name").eq("id", departmentId).maybeSingle(),
			supabase
				.from("misc_fire_equipment")
				.select("id, equipment_name, asset_number, location_type, apparatus_id, other_location, status, date_placed_in_service, manufacturer, model, notes, photo_path, created_at, updated_at")
				.eq("department_id", departmentId)
				.order("equipment_name", { ascending: true }),
			supabase.from("apparatus").select("id, name").eq("department_id", departmentId).order("name", { ascending: true }),
		]);

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		if (error) {
			console.error("[misc-fire-equipment] initial load failed", error);
			initialError = error.message || "Unable to load miscellaneous fire equipment.";
		}

		apparatusOptions = ((apparatusData ?? []) as Array<Record<string, unknown>>)
			.map((row) => ({
				id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
				name: normalizeDisplayName(row.name, typeof row.id === "string" ? row.id : String(row.id ?? "")),
			}))
			.filter((row) => Boolean(row.id));

		const apparatusById = new Map(apparatusOptions.map((row) => [row.id, row.name]));

		const equipmentIds = ((equipmentData ?? []) as Array<Record<string, unknown>>)
			.map((row) => (typeof row.id === "string" ? row.id : ""))
			.filter(Boolean);

		const deficiencyData = equipmentIds.length > 0
			? (
				await supabase
					.from("deficiencies")
					.select("misc_fire_equipment_id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
					.in("misc_fire_equipment_id", equipmentIds)
			).data
			: [];

		const openDeficiencyCountByEquipmentId = new Map<string, number>();
		for (const row of (deficiencyData ?? []) as Array<{ misc_fire_equipment_id: string | null; status_info: { name: string | null } | Array<{ name: string | null }> | null }>) {
			if (typeof row.misc_fire_equipment_id !== "string" || !row.misc_fire_equipment_id) {
				continue;
			}

			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
			const isOpen = statusName !== "resolved" && statusName !== "closed";

			if (!isOpen) {
				continue;
			}

			openDeficiencyCountByEquipmentId.set(
				row.misc_fire_equipment_id,
				(openDeficiencyCountByEquipmentId.get(row.misc_fire_equipment_id) ?? 0) + 1,
			);
		}

		initialRows = [...((equipmentData ?? []) as Array<Record<string, unknown>>)]
			.map((row) => ({
				id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
				equipment_name: typeof row.equipment_name === "string" ? row.equipment_name : "",
				asset_number: typeof row.asset_number === "string" ? row.asset_number : null,
				location_type:
					typeof row.location_type === "string" &&
					(row.location_type === "Apparatus" || row.location_type === "Station Storage" || row.location_type === "Other")
						? (row.location_type as MiscFireEquipmentRow["location_type"])
						: "Station Storage",
				apparatus_id: typeof row.apparatus_id === "string" ? row.apparatus_id : null,
				apparatus_name: typeof row.apparatus_id === "string" ? apparatusById.get(row.apparatus_id) ?? null : null,
				other_location: typeof row.other_location === "string" ? row.other_location : null,
				status:
					typeof row.status === "string" && (row.status === "Active" || row.status === "Inactive" || row.status === "Out of Service")
						? (row.status as MiscFireEquipmentRow["status"])
						: "Active",
				date_placed_in_service: typeof row.date_placed_in_service === "string" ? row.date_placed_in_service : null,
				manufacturer: typeof row.manufacturer === "string" ? row.manufacturer : null,
				model: typeof row.model === "string" ? row.model : null,
				notes: typeof row.notes === "string" ? row.notes : null,
				photo_path: typeof row.photo_path === "string" ? row.photo_path : null,
				created_at: typeof row.created_at === "string" ? row.created_at : "",
				updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
				open_deficiency_count: openDeficiencyCountByEquipmentId.get(typeof row.id === "string" ? row.id : String(row.id ?? "")) ?? 0,
			}))
			.filter((row) => Boolean(row.id))
			.sort((left, right) => compareByName(left.equipment_name, right.equipment_name));
	}

	return (
		<PageLayout>
			<MiscFireEquipmentWorkspace
				departmentName={departmentName}
				canManageMiscFireEquipment={canManageMiscFireEquipment}
				apparatusOptions={apparatusOptions}
				initialRows={initialRows}
				initialError={initialError}
			/>
		</PageLayout>
	);
}
