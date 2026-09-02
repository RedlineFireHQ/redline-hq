import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveApparatusOptions } from "@/lib/database";

export type ApparatusOption = {
	id: string;
	name: string | null;
};

export type GroundLadderRecord = {
	id: string;
	department_id: string;
	ladder_number: string;
	ladder_type: string | null;
	ladder_length_ft: number | null;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
	status: string;
	in_service_date: string | null;
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type GroundLadderAssignmentRecord = {
	id: string;
	department_id: string;
	ground_ladder_id: string;
	assignment_type: "Apparatus" | "Station" | "Unassigned" | string;
	apparatus_id: string | null;
	station_name: string | null;
	equipment_reference: string | null;
	assigned_at: string;
	ended_at: string | null;
	assigned_by: string | null;
	notes: string | null;
	created_at: string;
};

export type GroundLadderServiceTestRecord = {
	id: string;
	department_id: string;
	ground_ladder_id: string;
	test_date: string;
	tester_type: string;
	member_id: string | null;
	external_tester_name: string | null;
	company_name: string | null;
	result: string;
	notes: string | null;
	next_test_due_date: string | null;
	created_at: string;
	updated_at: string;
};

export type GroundLadderMaintenanceSettingsRecord = {
	id: string;
	department_id: string;
	maintenance_interval_months: number | null;
	created_at: string;
	updated_at: string;
};

export type GroundLadderMaintenanceRecord = {
	id: string;
	department_id: string;
	ground_ladder_id: string;
	maintenance_date: string;
	performed_by_member_id: string | null;
	performed_by_name: string | null;
	result: string;
	notes: string | null;
	next_maintenance_due: string | null;
	maintenance_interval_months: number | null;
	created_at: string;
	updated_at: string;
};

export type GroundLadderMaintenanceItemRecord = {
	id: string;
	department_id: string;
	maintenance_id: string;
	check_order: number;
	check_name: string;
	result: string;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

function normalizeText(value: unknown) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function normalizeDate(value: unknown) {
	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	return null;
}

export function normalizeGroundLadderRecord(row: Record<string, unknown>): GroundLadderRecord {
	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		ladder_number: typeof row.ladder_number === "string" ? row.ladder_number : "",
		ladder_type: normalizeText(row.ladder_type),
		ladder_length_ft: normalizeNumber(row.ladder_length_ft),
		manufacturer: normalizeText(row.manufacturer),
		model: normalizeText(row.model),
		serial_number: normalizeText(row.serial_number),
		status: typeof row.status === "string" ? row.status : "Unassigned",
		in_service_date: normalizeDate(row.in_service_date),
		notes: normalizeText(row.notes),
		created_at: normalizeDate(row.created_at),
		updated_at: normalizeDate(row.updated_at),
	};
}

export function normalizeGroundLadderAssignmentRecord(
	row: Record<string, unknown>,
): GroundLadderAssignmentRecord {
	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		ground_ladder_id: typeof row.ground_ladder_id === "string" ? row.ground_ladder_id : "",
		assignment_type:
			typeof row.assignment_type === "string"
				? row.assignment_type
				: "Unassigned",
		apparatus_id: normalizeText(row.apparatus_id),
		station_name: normalizeText(row.station_name),
		equipment_reference: normalizeText(row.equipment_reference),
		assigned_at: typeof row.assigned_at === "string" ? row.assigned_at : "",
		ended_at: normalizeDate(row.ended_at),
		assigned_by: normalizeText(row.assigned_by),
		notes: normalizeText(row.notes),
		created_at: typeof row.created_at === "string" ? row.created_at : "",
	};
}

export function normalizeGroundLadderServiceTestRecord(
	row: Record<string, unknown>,
): GroundLadderServiceTestRecord {
	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		ground_ladder_id: typeof row.ground_ladder_id === "string" ? row.ground_ladder_id : "",
		test_date: typeof row.test_date === "string" ? row.test_date : "",
		tester_type: typeof row.tester_type === "string" ? row.tester_type : "",
		member_id: normalizeText(row.member_id),
		external_tester_name: normalizeText(row.external_tester_name),
		company_name: normalizeText(row.company_name),
		result: typeof row.result === "string" ? row.result : "",
		notes: normalizeText(row.notes),
		next_test_due_date: normalizeDate(row.next_test_due_date),
		created_at: typeof row.created_at === "string" ? row.created_at : "",
		updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
	};
}

export function normalizeGroundLadderMaintenanceSettingsRecord(
	row: Record<string, unknown>,
): GroundLadderMaintenanceSettingsRecord {
	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		maintenance_interval_months: normalizeNumber(row.maintenance_interval_months),
		created_at: typeof row.created_at === "string" ? row.created_at : "",
		updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
	};
}

export function normalizeGroundLadderMaintenanceRecord(
	row: Record<string, unknown>,
): GroundLadderMaintenanceRecord {
	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		ground_ladder_id: typeof row.ground_ladder_id === "string" ? row.ground_ladder_id : "",
		maintenance_date: typeof row.maintenance_date === "string" ? row.maintenance_date : "",
		performed_by_member_id: normalizeText(row.performed_by_member_id),
		performed_by_name: normalizeText(row.performed_by_name),
		result: typeof row.result === "string" ? row.result : "",
		notes: normalizeText(row.notes),
		next_maintenance_due: normalizeDate(row.next_maintenance_due),
		maintenance_interval_months: normalizeNumber(row.maintenance_interval_months),
		created_at: typeof row.created_at === "string" ? row.created_at : "",
		updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
	};
}

export function normalizeGroundLadderMaintenanceItemRecord(
	row: Record<string, unknown>,
): GroundLadderMaintenanceItemRecord {
	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		department_id: typeof row.department_id === "string" ? row.department_id : "",
		maintenance_id: typeof row.maintenance_id === "string" ? row.maintenance_id : "",
		check_order: normalizeNumber(row.check_order) ?? 0,
		check_name: typeof row.check_name === "string" ? row.check_name : "",
		result: typeof row.result === "string" ? row.result : "",
		notes: normalizeText(row.notes),
		created_at: typeof row.created_at === "string" ? row.created_at : "",
		updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
	};
}

export async function loadGroundLadderInventoryData(
	supabase: SupabaseClient,
	departmentId: string,
) {
	const [
		laddersResult,
		assignmentsResult,
		serviceTestsResult,
		maintenanceSettingsResult,
		maintenanceResult,
		maintenanceItemsResult,
		apparatusData,
	] = await Promise.all([
		supabase
			.from("ground_ladders")
			.select("*")
			.eq("department_id", departmentId)
			.order("ladder_number", { ascending: true }),
		supabase
			.from("ground_ladder_assignments")
			.select(
				"id, department_id, ground_ladder_id, assignment_type, apparatus_id, station_name, equipment_reference, assigned_at, ended_at, assigned_by, notes, created_at",
			)
			.eq("department_id", departmentId)
			.order("assigned_at", { ascending: false }),
		supabase
			.from("ground_ladder_service_tests")
			.select("*")
			.eq("department_id", departmentId)
			.order("test_date", { ascending: false })
			.order("created_at", { ascending: false }),
		supabase
			.from("ground_ladder_maintenance_settings")
			.select("*")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle(),
		supabase
			.from("ground_ladder_maintenance")
			.select("*")
			.eq("department_id", departmentId)
			.order("maintenance_date", { ascending: false })
			.order("created_at", { ascending: false }),
		supabase
			.from("ground_ladder_maintenance_items")
			.select("*")
			.eq("department_id", departmentId)
			.order("check_order", { ascending: true })
			.order("created_at", { ascending: false }),
		getActiveApparatusOptions({ client: supabase, departmentId }),
	]);

	return {
		ladders: (laddersResult.data ?? []).map((row) => normalizeGroundLadderRecord(row as Record<string, unknown>)),
		assignments: (assignmentsResult.data ?? []).map((row) =>
			normalizeGroundLadderAssignmentRecord(row as Record<string, unknown>),
		),
		serviceTests: (serviceTestsResult.data ?? []).map((row) =>
			normalizeGroundLadderServiceTestRecord(row as Record<string, unknown>),
		),
		maintenanceSettings: maintenanceSettingsResult.data
			? normalizeGroundLadderMaintenanceSettingsRecord(
				maintenanceSettingsResult.data as Record<string, unknown>,
			  )
			: null,
		maintenanceRecords: (maintenanceResult.data ?? []).map((row) =>
			normalizeGroundLadderMaintenanceRecord(row as Record<string, unknown>),
		),
		maintenanceItems: (maintenanceItemsResult.data ?? []).map((row) =>
			normalizeGroundLadderMaintenanceItemRecord(row as Record<string, unknown>),
		),
		apparatusOptions: apparatusData.map((row) => ({
			id: row.id,
			name: typeof row.name === "string" ? row.name : null,
		})),
	};
}
