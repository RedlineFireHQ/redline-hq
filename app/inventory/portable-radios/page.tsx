import PortableRadioWorkspace from "@/components/inventory/PortableRadioWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";

type PortableRadioRecord = {
	id: string;
	department_id: string;
	radio_number: string;
	serial_number: string;
	manufacturer: string | null;
	model: string | null;
	radio_unit_id: string | null;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string | null;
	created_at: string;
	updated_at: string;
};

function compareRadioNumbers(left: string | null | undefined, right: string | null | undefined) {
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

export default async function PortableRadiosInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canManageRadios = departmentId
		? await hasDepartmentPermission(
			supabase,
			departmentId,
			currentMember?.role,
			"inventory_management",
		)
		: false;

	let departmentName: string | null = null;
	let rows: PortableRadioRecord[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", departmentId)
			.maybeSingle();

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		const { data, error } = await supabase
			.from("portable_radios")
			.select(
				"id, department_id, radio_number, serial_number, manufacturer, model, radio_unit_id, status, notes, created_at, updated_at",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[portable-radios] initial load failed", error);
			initialError = error.message || "Unable to load portable radios.";
		}

		rows = [...((data ?? []) as PortableRadioRecord[])].sort((left, right) =>
			compareRadioNumbers(left.radio_number, right.radio_number),
		);
	}

	return (
		
			<PortableRadioWorkspace
				departmentId={departmentId}
				departmentName={departmentName}
				initialRows={rows}
				initialError={initialError}
				canManageRadios={canManageRadios}
			/>
		
	);
}
