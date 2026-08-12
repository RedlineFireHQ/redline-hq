import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import BatteryWorkspace, {
	BatteryAssignmentRecord,
	BatteryRecord,
} from "@/components/inventory/BatteryWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type ApparatusOption = {
	id: string;
	name: string | null;
};

function normalizeBatteryRecord(row: Record<string, unknown>): BatteryRecord {
	const inServiceDateRaw = row.in_service_date;
	const inServiceDate =
		typeof inServiceDateRaw === "string"
			? inServiceDateRaw
			: inServiceDateRaw instanceof Date
				? inServiceDateRaw.toISOString().slice(0, 10)
				: typeof inServiceDateRaw === "number"
					? new Date(inServiceDateRaw).toISOString().slice(0, 10)
					: null;

	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		battery_number: typeof row.battery_number === "string" ? row.battery_number : "",
		serial_number: typeof row.serial_number === "string" ? row.serial_number : null,
		manufacturer: typeof row.manufacturer === "string" ? row.manufacturer : null,
		model: typeof row.model === "string" ? row.model : null,
		battery_type: typeof row.battery_type === "string" ? row.battery_type : null,
		compatible_equipment:
			typeof row.compatible_equipment === "string" ? row.compatible_equipment : null,
		in_service_date: inServiceDate,
		status: typeof row.status === "string" ? row.status : "Unassigned",
		notes: typeof row.notes === "string" ? row.notes : null,
		created_at: typeof row.created_at === "string" ? row.created_at : null,
		updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
	};
}

function normalizeAssignmentRecord(row: Record<string, unknown>): BatteryAssignmentRecord {
	const assignmentTypeValue =
		row.assignment_type === "Station" ||
		row.assignment_type === "Equipment" ||
		row.assignment_type === "Apparatus" ||
		row.assignment_type === "Unassigned"
			? row.assignment_type
			: "Unassigned";

	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id:
			typeof row.department_id === "string" ? row.department_id : "",
		battery_id: typeof row.battery_id === "string" ? row.battery_id : "",
		assignment_type: assignmentTypeValue,
		apparatus_id: typeof row.apparatus_id === "string" ? row.apparatus_id : null,
		station_name: typeof row.station_name === "string" ? row.station_name : null,
		equipment_reference:
			typeof row.equipment_reference === "string" ? row.equipment_reference : null,
		notes: typeof row.notes === "string" ? row.notes : null,
		assigned_at: typeof row.assigned_at === "string" ? row.assigned_at : "",
		ended_at: typeof row.ended_at === "string" ? row.ended_at : null,
		created_at: typeof row.created_at === "string" ? row.created_at : "",
	};
}

export default async function BatteriesPage() {
	const supabase = await createSupabaseServerClient();
	const member = await getCurrentMember(supabase);

	if (!member) {
		redirect("/login");
	}

	const departmentId = member.departmentId ?? null;
	if (!departmentId) {
		redirect("/login");
	}

	const [{ data: batteriesData }, { data: assignmentsData }, { data: apparatusData, error: apparatusError }] =
		await Promise.all([
			supabase
				.from("batteries")
				.select("*")
				.eq("department_id", departmentId)
				.order("battery_number", { ascending: true }),
			supabase
				.from("battery_assignments")
				.select(
					"id, department_id, battery_id, assignment_type, apparatus_id, station_name, equipment_reference, notes, assigned_at, ended_at, created_at",
				)
				.eq("department_id", departmentId)
				.order("assigned_at", { ascending: false }),
			supabase
				.from("apparatus")
				.select("id, name")
				.eq("department_id", departmentId)
				.order("name", { ascending: true }),
		]);

	if (process.env.NODE_ENV !== "production") {
		console.info("[batteries] apparatus load", {
			departmentId,
			apparatusCount: apparatusData?.length ?? 0,
			apparatusError: apparatusError?.message ?? null,
		});
	}

	const batteries = (batteriesData ?? []).map((row) =>
		normalizeBatteryRecord(row as Record<string, unknown>),
	);

	const assignments = (assignmentsData ?? []).map((row) =>
		normalizeAssignmentRecord(row as Record<string, unknown>),
	);

	const apparatusOptions = ((apparatusData ?? []) as Record<string, unknown>[]).map(
		(row) => ({
			id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
			name: typeof row.name === "string" ? row.name : null,
		}) as ApparatusOption,
	);

	return (
		<PageLayout>
			<BatteryWorkspace
				departmentId={departmentId}
				initialBatteries={batteries}
				initialAssignments={assignments}
				apparatusOptions={apparatusOptions}
			/>
		</PageLayout>
	);
}
