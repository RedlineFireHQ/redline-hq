import GasMonitorWorkspace from "@/components/inventory/GasMonitorWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type GasMonitorRecord = {
	id: string;
	department_id: string;
	monitor_number: string;
	serial_number: string;
	manufacturer: string | null;
	model: string | null;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string | null;
	created_at: string;
	updated_at: string;
};

function compareMonitorNumbers(left: string | null | undefined, right: string | null | undefined) {
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

export default async function GasMonitorsInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canDeleteMonitor = currentMember?.role === "administrator";

	let departmentName: string | null = null;
	let rows: GasMonitorRecord[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", departmentId)
			.maybeSingle();

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		const { data, error } = await supabase
			.from("gas_monitors")
			.select("id, department_id, monitor_number, serial_number, manufacturer, model, status, notes, created_at, updated_at")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[gas-monitors] initial load failed", error);
			initialError = error.message || "Unable to load gas monitors.";
		}

		rows = [...((data ?? []) as GasMonitorRecord[])].sort((left, right) =>
			compareMonitorNumbers(left.monitor_number, right.monitor_number),
		);
	}

	return (
		
			<GasMonitorWorkspace
				departmentId={departmentId}
				departmentName={departmentName}
				initialRows={rows}
				initialError={initialError}
				canDeleteMonitor={canDeleteMonitor}
			/>
		
	);
}
