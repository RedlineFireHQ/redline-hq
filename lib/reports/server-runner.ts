import type { SupabaseClient } from "@supabase/supabase-js";
import { department } from "@/lib/department";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
	calculateEmsReadiness,
	type EmsManualAllocation,
	type EmsTrackProfileInput,
	type EmsTrainingRecord,
} from "@/lib/ems/calculation";
import {
	applyAuthoritativeCertificationToTrackProfile,
	buildCertificationTypeMetaById,
	findCurrentTrackProfile,
	resolveAuthoritativeEmsCertificationsForMember,
	type MemberCertificationAuthorityRow,
} from "@/lib/ems/authoritative-certifications";
import { getCertificationStatus } from "@/lib/readiness/member-readiness";
import { buildDateRangeFromPreset, buildUtcBoundsForDateRange, formatReportPeriodLabel, parseDateOnly } from "@/lib/reports/date-range";
import { runInventoryReport } from "@/lib/reports/inventory-report";
import { getReportSourceConfig } from "@/lib/reports/registry";
import type {
	AppliedReportFilter,
	ReportErrorPayload,
	ReportRow,
	ReportRunRequest,
	ReportRunResponse,
	ReportSourceConfig,
} from "@/lib/reports/types";

type ReportContext = {
	supabase: SupabaseClient;
	departmentId: string;
	departmentName: string | null;
	memberRole: string;
};

type DeficiencyRow = {
	id: string;
	department_id: string | null;
	deficiency_number: string | null;
	description: string | null;
	reported_at: string | null;
	resolved_at: string | null;
	reported_by: string | null;
	assigned_to: string | null;
	resolved_by: string | null;
	apparatus_id: string | null;
	fire_hose_id: string | null;
	scba_cylinder_id: string | null;
	scba_pack_id: string | null;
	pie_equipment_id: string | null;
	ems_equipment_id: string | null;
	ppe_item_id: string | null;
	rope_item_id: string | null;
	fire_extinguisher_id: string | null;
	misc_fire_equipment_id: string | null;
	portable_radio_id: string | null;
	portable_radio_mic_id: string | null;
	thermal_imaging_camera_id: string | null;
	gas_monitor_id: string | null;
	battery_id: string | null;
	ground_ladder_id: string | null;
	status_info: { name: string | null } | Array<{ name: string | null }> | null;
	priority_info: { name: string | null } | Array<{ name: string | null }> | null;
	category_info: { name: string | null } | Array<{ name: string | null }> | null;
	apparatus_info: { name: string | null } | Array<{ name: string | null }> | null;
	fire_hose: { inventory_number: string | null } | Array<{ inventory_number: string | null }> | null;
	scba_cylinder: { cylinder_number: string | null } | Array<{ cylinder_number: string | null }> | null;
	scba_pack: { pack_number: string | null } | Array<{ pack_number: string | null }> | null;
	pie_equipment: { equipment_number: string | null } | Array<{ equipment_number: string | null }> | null;
	ems_equipment: { equipment_name: string | null } | Array<{ equipment_name: string | null }> | null;
	ppe_item: { item_name: string | null } | Array<{ item_name: string | null }> | null;
	rope_item: { rope_name: string | null; rope_identifier: string | null } | Array<{ rope_name: string | null; rope_identifier: string | null }> | null;
	fire_extinguisher: { extinguisher_number: string | null; extinguisher_type: string | null } | Array<{ extinguisher_number: string | null; extinguisher_type: string | null }> | null;
	misc_fire_equipment: { equipment_name: string | null; asset_number: string | null } | Array<{ equipment_name: string | null; asset_number: string | null }> | null;
};

type MemberNameRow = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

type TrainingEventAttendanceRow = {
	id: string;
	training_event_id: string;
	member_id: string;
	attendance_status: string | null;
	completion_status: string | null;
};

type TrainingEventRow = {
	id: string;
	title: string | null;
	category_id: string | null;
	training_type: string | null;
	location: string | null;
	instructor_name: string | null;
	starts_at: string | null;
	hours_credit: number | string | null;
	status: string | null;
};

type TrainingOutsideSubmissionRow = {
	id: string;
	member_id: string;
	title: string | null;
	category_id: string | null;
	training_date: string | null;
	hours: number | string | null;
	description: string | null;
	notes: string | null;
	status: string | null;
};

type TrainingAssignmentMemberRow = {
	id: string;
	training_assignment_id: string;
	member_id: string;
	completion_status: string | null;
	hours_earned: number | string | null;
	completed_at: string | null;
	updated_at: string | null;
	created_at: string | null;
};

type TrainingAssignmentRow = {
	id: string;
	title: string | null;
	category_id: string | null;
	hours_credit: number | string | null;
	description: string | null;
};

type TrainingCategoryRow = {
	id: string;
	name: string | null;
};

type TrainingRecord = {
	id: string;
	sourceType: "Department Event" | "Outside Submission" | "Assigned Training";
	trainingDateRaw: string;
	memberId: string;
	memberName: string;
	trainingName: string;
	categoryId: string | null;
	categoryName: string;
	hours: number;
	instructorName: string;
	trainingType: string;
	location: string;
	searchableDescription: string;
};

type MemberCertificationRow = {
	id: string;
	member_id: string;
	certification_id: string;
	certificate_number: string | null;
	issued_at: string;
	expires_at: string | null;
	supporting_document_id: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

type CertificationCatalogRow = {
	id: string;
	name: string;
	active: boolean | null;
	description: string | null;
};

type DocumentLookupRow = {
	id: string;
	title: string | null;
	document_number: string | null;
};

type MaintenanceRecordRow = {
	id: string;
	maintenance_number: string | null;
	apparatus_id: string;
	deficiency_id: string | null;
	maintenance_type: string;
	completed_by: string | null;
	service_date: string;
	description: string;
	parts_used: string | null;
	labor_hours: number | string | null;
	mileage: number | null;
	engine_hours: number | string | null;
	cost: number | string | null;
	notes: string | null;
	photos: string[];
	attachments: string[];
	created_at: string;
	updated_at: string;
};

type MaintenanceApparatusRow = {
	id: string;
	name: string | null;
	type: string | null;
	radio_number: string | null;
};

type MaintenanceDeficiencyRow = {
	id: string;
	deficiency_number: string | null;
};

type ApparatusReportApparatusRow = {
	id: string;
	name: string;
	type: string | null;
	radio_number: string | null;
	status: string;
	active: boolean | null;
	last_inspection_at: string | null;
	mileage: number | null;
	engine_hours: number | string | null;
	created_at: string | null;
	out_of_service_source: string | null;
};

type ApparatusInspectionRow = {
	id: string;
	apparatus_id: string;
	member_id: string | null;
	status: string;
	notes: string | null;
	created_at: string;
	mileage: number | null;
	engine_hours: number | string | null;
};

type InspectionChecklistResultRow = {
	inspection_id: string;
	result_status: string | null;
};

type InspectionSessionRow = {
	id: string;
	completed_inspection_id: string | null;
	apparatus_id: string;
};

type InspectionSessionMemberRow = {
	session_id: string;
	member_id: string;
};

type InspectionDeficiencyRow = {
	id: string;
	inspection_id: string | null;
	check_session_id: string | null;
	apparatus_id: string | null;
	status_info: { name: string | null } | Array<{ name: string | null }> | null;
};

type InspectionRequirementRow = {
	apparatus_id: string;
	interval_days: number;
	effective_start_at: string | null;
	effective_end_at: string | null;
};

type InspectionDepartmentDefaultRow = {
	interval_days: number;
	effective_start_at: string | null;
	effective_end_at: string | null;
};

type ApparatusDeficiencyRow = {
	id: string;
	apparatus_id: string | null;
	deficiency_number: string | null;
	description: string | null;
	reported_at: string | null;
	resolved_at: string | null;
	reported_by: string | null;
	status_info: { name: string | null } | Array<{ name: string | null }> | null;
	priority_info: { name: string | null } | Array<{ name: string | null }> | null;
};

type PrePlanRow = {
	id: string;
	department_id: string | null;
	business_name: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	occupancy_id_number: string | null;
	primary_contact_name: string | null;
	primary_contact_phone: string | null;
	normal_occupant_load: number | string | null;
	critical_information: string | null;
	last_verified_at: string | null;
	updated_at: string | null;
	created_at: string | null;
};

type PrePlanCountRow = {
	pre_plan_id: string;
	count: number;
};

type CalendarActivityRow = {
	id: string;
	title: string | null;
	activity_type: string | null;
	status: string | null;
	start_at: string | null;
	created_at: string;
	updated_at: string;
	created_by: string | null;
};

type ActivityDeficiencyRow = {
	id: string;
	deficiency_number: string | null;
	description: string | null;
	reported_at: string | null;
	resolved_at: string | null;
	reported_by: string | null;
	resolved_by: string | null;
	status_info: { name: string | null } | Array<{ name: string | null }> | null;
};

type ActivityApparatusInspectionRow = {
	id: string;
	member_id: string | null;
	status: string | null;
	notes: string | null;
	created_at: string;
	apparatus: { name: string | null } | Array<{ name: string | null }> | null;
};

type ActivityTrainingEventRow = {
	id: string;
	title: string | null;
	status: string | null;
	starts_at: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
};

type ActivityTrainingOutsideSubmissionRow = {
	id: string;
	title: string | null;
	status: string | null;
	member_id: string;
	reviewed_by: string | null;
	reviewed_at: string | null;
	created_at: string;
};

type ActivityMemberCertificationRow = {
	id: string;
	member_id: string;
	created_by: string | null;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
	certification: { name: string | null } | Array<{ name: string | null }> | null;
};

type ActivityPrePlanRow = {
	id: string;
	business_name: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type OwnershipLookupConfig = {
	field: keyof DeficiencyRow;
	table: string;
	labelPrefix: string;
};

const OWNERSHIP_LINKS: OwnershipLookupConfig[] = [
	{ field: "apparatus_id", table: "apparatus", labelPrefix: "Apparatus" },
	{ field: "fire_hose_id", table: "fire_hose", labelPrefix: "Fire Hose" },
	{ field: "scba_cylinder_id", table: "scba_cylinders", labelPrefix: "SCBA Cylinder" },
	{ field: "scba_pack_id", table: "scba_packs", labelPrefix: "SCBA Pack" },
	{ field: "portable_radio_id", table: "portable_radios", labelPrefix: "Portable Radio" },
	{ field: "portable_radio_mic_id", table: "portable_radio_mics", labelPrefix: "Portable Radio Mic" },
	{ field: "thermal_imaging_camera_id", table: "thermal_imaging_cameras", labelPrefix: "Thermal Imaging Camera" },
	{ field: "gas_monitor_id", table: "gas_monitors", labelPrefix: "Gas Monitor" },
	{ field: "battery_id", table: "batteries", labelPrefix: "Battery" },
	{ field: "pie_equipment_id", table: "pie_equipment", labelPrefix: "PIE Equipment" },
	{ field: "ground_ladder_id", table: "ground_ladders", labelPrefix: "Ground Ladder" },
	{ field: "ems_equipment_id", table: "ems_equipment", labelPrefix: "EMS Equipment" },
	{ field: "ppe_item_id", table: "ppe_items", labelPrefix: "PPE" },
	{ field: "rope_item_id", table: "rope_items", labelPrefix: "Rope" },
	{ field: "fire_extinguisher_id", table: "fire_extinguishers", labelPrefix: "Fire Extinguisher" },
	{ field: "misc_fire_equipment_id", table: "misc_fire_equipment", labelPrefix: "Misc Fire Equipment" },
];

function isTimestampWithinRange(
	timestampValue: string | null,
	fromIso: string,
	toExclusiveIso: string,
) {
	if (!timestampValue) {
		return false;
	}

	const timestampMs = new Date(timestampValue).getTime();
	const fromMs = new Date(fromIso).getTime();
	const toExclusiveMs = new Date(toExclusiveIso).getTime();

	if (Number.isNaN(timestampMs) || Number.isNaN(fromMs) || Number.isNaN(toExclusiveMs)) {
		return false;
	}

	return timestampMs >= fromMs && timestampMs < toExclusiveMs;
}

function normalizeDeficiencyStatus(value: string | null | undefined) {
	return normalizeText(value).toLowerCase();
}

function getDeficiencyPeriodBasisLabel(statusFilter: string) {
	if (statusFilter === "resolved" || statusFilter === "closed") {
		return "Resolution Date (fallback to Reported Date when unresolved timestamp is missing)";
	}

	if (statusFilter === "open" || statusFilter === "in progress") {
		return "Reported Date";
	}

	return "Activity Date (Resolved/Closed use Resolution Date; others use Reported Date)";
}

function passesStatusAwareDateWindow(
	row: DeficiencyRow,
	statusName: string,
	statusFilter: string,
	fromIso: string,
	toExclusiveIso: string,
) {
	const isResolvedLike = statusName === "resolved" || statusName === "closed";

	if (statusFilter === "resolved" || statusFilter === "closed") {
		if (isTimestampWithinRange(row.resolved_at, fromIso, toExclusiveIso)) {
			return true;
		}

		return isTimestampWithinRange(row.reported_at, fromIso, toExclusiveIso);
	}

	if (statusFilter === "open" || statusFilter === "in progress") {
		return isTimestampWithinRange(row.reported_at, fromIso, toExclusiveIso);
	}

	if (isResolvedLike) {
		if (isTimestampWithinRange(row.resolved_at, fromIso, toExclusiveIso)) {
			return true;
		}

		return isTimestampWithinRange(row.reported_at, fromIso, toExclusiveIso);
	}

	return isTimestampWithinRange(row.reported_at, fromIso, toExclusiveIso);
}

function collectLinkedIds(rows: DeficiencyRow[], field: keyof DeficiencyRow) {
	return Array.from(
		new Set(
			rows
				.map((row) => row[field])
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);
}

async function resolveOwnedResourceIdSet(
	context: ReportContext,
	rows: DeficiencyRow[],
): Promise<Record<keyof DeficiencyRow, Set<string>>> {
	const result = {} as Record<keyof DeficiencyRow, Set<string>>;

	for (const link of OWNERSHIP_LINKS) {
		const ids = collectLinkedIds(rows, link.field);
		if (ids.length === 0) {
			result[link.field] = new Set();
			continue;
		}

		const query = await context.supabase
			.from(link.table)
			.select("id")
			.in("id", ids)
			.eq("department_id", context.departmentId);

		if (query.error) {
			throw new Error(query.error.message || `Unable to resolve ${link.labelPrefix} ownership.`);
		}

		result[link.field] = new Set(
			(query.data ?? [])
				.map((item) => (typeof (item as Record<string, unknown>).id === "string" ? ((item as Record<string, unknown>).id as string) : ""))
				.filter(Boolean),
		);
	}

	return result;
}

function deficiencyBelongsToDepartment(
	row: DeficiencyRow,
	departmentId: string,
	ownedResourceIdsByField: Record<keyof DeficiencyRow, Set<string>>,
	ownedMemberIds: Set<string>,
) {
	if (row.department_id === departmentId) {
		return true;
	}

	for (const link of OWNERSHIP_LINKS) {
		const value = row[link.field];
		if (typeof value !== "string" || !value) {
			continue;
		}

		if (ownedResourceIdsByField[link.field]?.has(value)) {
			return true;
		}
	}

	if (typeof row.reported_by === "string" && ownedMemberIds.has(row.reported_by)) {
		return true;
	}

	if (typeof row.assigned_to === "string" && ownedMemberIds.has(row.assigned_to)) {
		return true;
	}

	if (typeof row.resolved_by === "string" && ownedMemberIds.has(row.resolved_by)) {
		return true;
	}

	return false;
}

function normalizeText(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeRelation<T extends Record<string, unknown>>(value: unknown): T | null {
	if (!value) {
		return null;
	}

	const relationValue = Array.isArray(value) ? value[0] : value;
	if (!relationValue || typeof relationValue !== "object") {
		return null;
	}

	return relationValue as T;
}

function formatDateTimeLabel(value: string | null) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function parseHoursValue(value: number | string | null | undefined) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return 0;
}

function formatHoursValue(value: number) {
	return value.toFixed(2);
}

function formatMileageValue(value: number) {
	return new Intl.NumberFormat("en-US").format(value);
}

function parseNullableNumber(value: number | string | null | undefined) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return null;
}

function formatDateOnlyLabel(value: string | null | undefined) {
	if (!value) {
		return "-";
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		const localDate = new Date(`${value}T00:00:00`);
		if (!Number.isNaN(localDate.getTime())) {
			return localDate.toLocaleDateString("en-US", {
				month: "short",
				day: "2-digit",
				year: "numeric",
			});
		}
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
}

function formatMemberName(member: MemberNameRow) {
	const firstName = normalizeText(member.first_name);
	const lastName = normalizeText(member.last_name);
	return `${firstName} ${lastName}`.trim() || member.id;
}

function getComparableTimestamp(value: string | null) {
	if (!value) {
		return null;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		const [yearText, monthText, dayText] = value.split("-");
		const year = Number.parseInt(yearText, 10);
		const month = Number.parseInt(monthText, 10);
		const day = Number.parseInt(dayText, 10);
		if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
			return null;
		}

		return Date.UTC(year, month - 1, day);
	}

	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? null : parsed;
}

function isWithinUtcRange(value: string | null, fromIso: string, toExclusiveIso: string) {
	const candidate = getComparableTimestamp(value);
	if (candidate === null) {
		return false;
	}

	const from = new Date(fromIso).getTime();
	const toExclusive = new Date(toExclusiveIso).getTime();
	if (Number.isNaN(from) || Number.isNaN(toExclusive)) {
		return false;
	}

	return candidate >= from && candidate < toExclusive;
}

function buildAppliedFilters(
	source: ReportSourceConfig,
	filters: Record<string, string>,
	searchTerm: string,
): AppliedReportFilter[] {
	const items: AppliedReportFilter[] = [];

	for (const definition of source.filters) {
		const rawValue = normalizeText(filters[definition.key]);
		if (!rawValue || rawValue.toLowerCase() === "all") {
			continue;
		}

		if (definition.type === "select" && definition.options) {
			const option = definition.options.find((item) => item.value === rawValue);
			items.push({
				label: definition.label,
				value: option?.label ?? rawValue,
			});
			continue;
		}

		items.push({
			label: definition.label,
			value: rawValue,
		});
	}

	if (searchTerm) {
		items.push({
			label: "Search",
			value: searchTerm,
		});
	}

	return items;
}

function buildError(errorCode: ReportErrorPayload["errorCode"], error: string): ReportErrorPayload {
	return {
		ok: false,
		errorCode,
		error,
	};
}

async function runDeficiencyReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const statusFilter = normalizeText(request.filters.status).toLowerCase();
	const priorityFilter = normalizeText(request.filters.priority).toLowerCase();

	const queryResult = await context.supabase
		.from("deficiencies")
		.select(
			"id, department_id, deficiency_number, description, reported_at, resolved_at, reported_by, assigned_to, resolved_by, apparatus_id, fire_hose_id, scba_cylinder_id, scba_pack_id, portable_radio_id, portable_radio_mic_id, thermal_imaging_camera_id, gas_monitor_id, battery_id, pie_equipment_id, ground_ladder_id, ems_equipment_id, ppe_item_id, rope_item_id, fire_extinguisher_id, misc_fire_equipment_id, status_info:deficiency_statuses!fk_deficiencies_status(name), priority_info:deficiency_priorities!fk_deficiencies_priority(name), category_info:deficiency_categories!fk_deficiencies_category(name), apparatus_info:apparatus!fk_deficiencies_apparatus(name), fire_hose:fire_hose_id(inventory_number), scba_cylinder:scba_cylinder_id(cylinder_number), scba_pack:scba_pack_id(pack_number), pie_equipment:pie_equipment_id(equipment_number), ems_equipment:ems_equipment_id(equipment_name), ppe_item:ppe_item_id(item_name), rope_item:rope_item_id(rope_name, rope_identifier), fire_extinguisher:fire_extinguisher_id(extinguisher_number, extinguisher_type), misc_fire_equipment:misc_fire_equipment_id(equipment_name, asset_number)",
		)
		.order("reported_at", { ascending: false });

	if (queryResult.error) {
		return buildError("QUERY_ERROR", queryResult.error.message || "Unable to run the selected report.");
	}

	const deficiencyRows = (queryResult.data ?? []) as DeficiencyRow[];
	const reporterIds = Array.from(
		new Set(
			deficiencyRows
				.flatMap((row) => [row.reported_by, row.assigned_to, row.resolved_by])
				.filter((memberId): memberId is string => typeof memberId === "string" && memberId.length > 0),
		),
	);

	let reporterNameById: Record<string, string> = {};
	if (reporterIds.length > 0) {
		const reporterQuery = await context.supabase
			.from("members")
			.select("id, first_name, last_name, department_id")
			.in("id", reporterIds)
			.eq("department_id", context.departmentId);

		if (reporterQuery.error) {
			return buildError("QUERY_ERROR", reporterQuery.error.message || "Unable to resolve deficiency reporter names.");
		}

		reporterNameById = ((reporterQuery.data ?? []) as MemberNameRow[]).reduce<Record<string, string>>(
			(accumulator, member) => {
				const firstName = normalizeText(member.first_name);
				const lastName = normalizeText(member.last_name);
				const fullName = `${firstName} ${lastName}`.trim() || member.id;
				accumulator[member.id] = fullName;
				return accumulator;
			},
			{},
		);
	}

	const ownedMemberIds = new Set(Object.keys(reporterNameById));

	let ownedResourceIdsByField: Record<keyof DeficiencyRow, Set<string>>;
	try {
		ownedResourceIdsByField = await resolveOwnedResourceIdSet(context, deficiencyRows);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to resolve ownership for linked deficiency resources.";
		return buildError("QUERY_ERROR", message);
	}

	function resolveRelatedItemLabel(row: DeficiencyRow): string {
		if (row.fire_hose_id) {
			const hose = normalizeText(normalizeRelation<{ inventory_number: string | null }>(row.fire_hose)?.inventory_number);
			return hose ? `Fire Hose ${hose}` : "Fire Hose";
		}

		if (row.scba_cylinder_id) {
			const cylinder = normalizeText(normalizeRelation<{ cylinder_number: string | null }>(row.scba_cylinder)?.cylinder_number);
			return cylinder ? `SCBA Cylinder ${cylinder}` : "SCBA Cylinder";
		}

		if (row.scba_pack_id) {
			const pack = normalizeText(normalizeRelation<{ pack_number: string | null }>(row.scba_pack)?.pack_number);
			return pack ? `SCBA Pack ${pack}` : "SCBA Pack";
		}

		if (row.pie_equipment_id) {
			const pie = normalizeText(normalizeRelation<{ equipment_number: string | null }>(row.pie_equipment)?.equipment_number);
			return pie ? `PIE ${pie}` : "PIE Equipment";
		}

		if (row.ems_equipment_id) {
			const ems = normalizeText(normalizeRelation<{ equipment_name: string | null }>(row.ems_equipment)?.equipment_name);
			return ems ? `EMS ${ems}` : "EMS Equipment";
		}

		if (row.ppe_item_id) {
			const ppe = normalizeText(normalizeRelation<{ item_name: string | null }>(row.ppe_item)?.item_name);
			return ppe ? `PPE ${ppe}` : "PPE";
		}

		if (row.rope_item_id) {
			const rope = normalizeRelation<{ rope_name: string | null; rope_identifier: string | null }>(row.rope_item);
			const ropeLabel = normalizeText(rope?.rope_name) || normalizeText(rope?.rope_identifier);
			return ropeLabel ? `Rope ${ropeLabel}` : "Rope";
		}

		if (row.fire_extinguisher_id) {
			const extinguisher = normalizeRelation<{ extinguisher_number: string | null; extinguisher_type: string | null }>(row.fire_extinguisher);
			const extinguisherLabel = normalizeText(extinguisher?.extinguisher_number) || normalizeText(extinguisher?.extinguisher_type);
			return extinguisherLabel ? `Fire Extinguisher ${extinguisherLabel}` : "Fire Extinguisher";
		}

		if (row.misc_fire_equipment_id) {
			const misc = normalizeRelation<{ equipment_name: string | null; asset_number: string | null }>(row.misc_fire_equipment);
			const miscLabel = normalizeText(misc?.equipment_name) || normalizeText(misc?.asset_number);
			return miscLabel ? `Misc Fire Equipment ${miscLabel}` : "Misc Fire Equipment";
		}

		return "-";
	}

	const rows = deficiencyRows
		.filter((row) => {
			if (!deficiencyBelongsToDepartment(row, context.departmentId, ownedResourceIdsByField, ownedMemberIds)) {
				return false;
			}

			const status = normalizeDeficiencyStatus(normalizeRelation<{ name: string | null }>(row.status_info)?.name);
			const priority = normalizeText(normalizeRelation<{ name: string | null }>(row.priority_info)?.name).toLowerCase();

			if (statusFilter && statusFilter !== "all" && status !== statusFilter) {
				return false;
			}

			if (priorityFilter && priorityFilter !== "all" && priority !== priorityFilter) {
				return false;
			}

			if (!passesStatusAwareDateWindow(row, status, statusFilter, fromIso, toExclusiveIso)) {
				return false;
			}

			if (!searchTerm) {
				return true;
			}

			const reporterName = row.reported_by ? (reporterNameById[row.reported_by] ?? row.reported_by) : "";
			const relatedItemLabel = resolveRelatedItemLabel(row);

			const searchable = [
				row.deficiency_number,
				row.description,
				normalizeRelation<{ name: string | null }>(row.status_info)?.name,
				normalizeRelation<{ name: string | null }>(row.priority_info)?.name,
				normalizeRelation<{ name: string | null }>(row.category_info)?.name,
				normalizeRelation<{ name: string | null }>(row.apparatus_info)?.name,
				reporterName,
				relatedItemLabel,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			return searchable.includes(searchTerm);
		})
		.map((row): ReportRow => {
			const status = normalizeText(normalizeRelation<{ name: string | null }>(row.status_info)?.name) || "Unknown";
			const priority = normalizeText(normalizeRelation<{ name: string | null }>(row.priority_info)?.name) || "Unknown";
			const category = normalizeText(normalizeRelation<{ name: string | null }>(row.category_info)?.name) || "Uncategorized";
			const apparatus = normalizeText(normalizeRelation<{ name: string | null }>(row.apparatus_info)?.name) || "Unassigned";
			const reporterName = row.reported_by
				? (reporterNameById[row.reported_by] ?? row.reported_by)
				: "Unknown";

			return {
				deficiency_number: normalizeText(row.deficiency_number) || "Unassigned",
				reported_at: formatDateTimeLabel(row.reported_at),
				resolved_at: formatDateTimeLabel(row.resolved_at),
				status_name: status,
				priority_name: priority,
				apparatus_name: apparatus,
				related_item: resolveRelatedItemLabel(row),
				category_name: category,
				reported_by: reporterName,
				description: normalizeText(row.description) || "-",
			};
		});

	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = rows.slice(offset, offset + pageSize);

	const period = {
		from: request.dateRange.from,
		to: request.dateRange.to,
		label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
		basisLabel: getDeficiencyPeriodBasisLabel(statusFilter),
	};

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period,
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		columns: source.columns,
		rows: pagedRows,
		totalRows: rows.length,
		page,
		pageSize,
	};
}

function getTrainingPeriodBasisLabel() {
	return "Training Date";
}

function getMaintenancePeriodBasisLabel() {
	return "Service Date";
}

function normalizeApparatusStatusLabel(value: string | null | undefined) {
	const normalized = normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
	if (normalized === "out_of_service") {
		return "Out of Service";
	}

	if (normalized === "needs_attention" || normalized === "deficiency") {
		return "Needs Attention";
	}

	if (normalized === "ready") {
		return "Ready";
	}

	return normalizeText(value) || "Unknown";
}

function isOpenDeficiencyStatus(statusName: string) {
	const normalized = normalizeText(statusName).toLowerCase();
	return normalized !== "resolved" && normalized !== "closed";
}

function getCertificationPeriodBasisLabel(dateBasisFilter: string) {
	if (dateBasisFilter === "issued-date") {
		return "Issued Date";
	}

	if (dateBasisFilter === "expiration-date") {
		return "Expiration Date";
	}

	return "No Date Filter (status and expiration filters use Expiration Date)";
}

function mapCertificationStatusLabel(status: "current" | "expiring_soon" | "expired") {
	if (status === "expiring_soon") {
		return "Expiring";
	}

	if (status === "expired") {
		return "Expired";
	}

	return "Current";
}

function parseLocalDateOnly(value: string) {
	const parsed = new Date(`${value}T00:00:00`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTodayLocalDateOnly() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return parseLocalDateOnly(`${year}-${month}-${day}`);
}

function getDaysUntilExpiration(expiresAt: string | null) {
	if (!expiresAt) {
		return null;
	}

	const expirationDate = parseLocalDateOnly(expiresAt);
	const today = getTodayLocalDateOnly();
	if (!expirationDate || !today) {
		return null;
	}

	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	return Math.floor((expirationDate.getTime() - today.getTime()) / millisecondsPerDay);
}

async function runCertificationReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const memberFilter = normalizeText(request.filters.member_id);
	const certificationFilter = normalizeText(request.filters.certification_id);
	const statusFilter = normalizeText(request.filters.status).toLowerCase();
	const expirationWindowFilter = normalizeText(request.filters.expiration_window).toLowerCase();
	const dateBasisFilter = normalizeText(request.filters.date_basis).toLowerCase() || "all-dates";
	const warningDays = department.settings.certificationWarningDays;

	const certificationQuery = await context.supabase
		.from("member_certifications")
		.select("id, member_id, certification_id, certificate_number, issued_at, expires_at, supporting_document_id, notes, created_at, updated_at")
		.eq("department_id", context.departmentId)
		.order("issued_at", { ascending: false });

	if (certificationQuery.error) {
		return buildError("QUERY_ERROR", certificationQuery.error.message || "Unable to load certification records.");
	}

	const memberCertificationRows = (certificationQuery.data ?? []) as MemberCertificationRow[];

	const memberIds = Array.from(new Set(memberCertificationRows.map((row) => row.member_id).filter(Boolean)));
	const certificationIds = Array.from(new Set(memberCertificationRows.map((row) => row.certification_id).filter(Boolean)));
	const documentIds = Array.from(
		new Set(
			memberCertificationRows
				.map((row) => row.supporting_document_id)
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);

	const [membersQuery, certificationsQuery, documentsQuery] = await Promise.all([
		memberIds.length > 0
			? context.supabase
					.from("members")
					.select("id, first_name, last_name")
					.eq("department_id", context.departmentId)
					.in("id", memberIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		certificationIds.length > 0
			? context.supabase
					.from("certifications")
					.select("id, name, active, description")
					.eq("department_id", context.departmentId)
					.in("id", certificationIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		documentIds.length > 0
			? context.supabase
					.from("documents")
					.select("id, title, document_number")
					.eq("department_id", context.departmentId)
					.in("id", documentIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
	]);

	if (membersQuery.error || certificationsQuery.error || documentsQuery.error) {
		return buildError(
			"QUERY_ERROR",
			membersQuery.error?.message || certificationsQuery.error?.message || documentsQuery.error?.message || "Unable to resolve certification labels.",
		);
	}

	const memberNameById = new Map(
		((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
	);
	const certificationById = new Map(
		((certificationsQuery.data ?? []) as CertificationCatalogRow[]).map((row) => [
			row.id,
			{ name: normalizeText(row.name) || "Unknown Certification", description: normalizeText(row.description) },
		]),
	);
	const documentById = new Map(
		((documentsQuery.data ?? []) as DocumentLookupRow[]).map((row) => [
			row.id,
			{
				title: normalizeText(row.title),
				documentNumber: normalizeText(row.document_number),
			},
		]),
	);

	const filtered = memberCertificationRows
		.map((row) => {
			const status = getCertificationStatus(row.expires_at, warningDays);
			const daysUntilExpiration = getDaysUntilExpiration(row.expires_at);
			const memberName = memberNameById.get(row.member_id) ?? row.member_id;
			const certificationInfo = certificationById.get(row.certification_id);
			const certificationName = certificationInfo?.name ?? "Unknown Certification";
			const supportingDocument = row.supporting_document_id ? documentById.get(row.supporting_document_id) : null;

			return {
				row,
				status,
				daysUntilExpiration,
				memberName,
				certificationName,
				certificationDescription: certificationInfo?.description ?? "",
				supportingDocumentLabel: supportingDocument
					? supportingDocument.title || supportingDocument.documentNumber || "Document"
					: "-",
			};
		})
		.filter((item) => {
			if (memberFilter && memberFilter !== "all" && item.row.member_id !== memberFilter) {
				return false;
			}

			if (certificationFilter && certificationFilter !== "all" && item.row.certification_id !== certificationFilter) {
				return false;
			}

			if (statusFilter && statusFilter !== "all") {
				const normalizedStatus = statusFilter === "expiring" ? "expiring_soon" : statusFilter;
				if (item.status !== normalizedStatus) {
					return false;
				}
			}

			if (expirationWindowFilter && expirationWindowFilter !== "all") {
				const expirationLimit = expirationWindowFilter === "next-30"
					? 30
					: expirationWindowFilter === "next-60"
						? 60
						: expirationWindowFilter === "next-90"
							? 90
							: null;

				if (expirationLimit === null) {
					return false;
				}

				if (item.daysUntilExpiration === null || item.daysUntilExpiration < 0 || item.daysUntilExpiration > expirationLimit) {
					return false;
				}
			}

			if (dateBasisFilter === "issued-date" && !isWithinUtcRange(item.row.issued_at, fromIso, toExclusiveIso)) {
				return false;
			}

			if (dateBasisFilter === "expiration-date" && !isWithinUtcRange(item.row.expires_at, fromIso, toExclusiveIso)) {
				return false;
			}

			if (!searchTerm) {
				return true;
			}

			const searchable = [
				item.memberName,
				item.certificationName,
				item.row.certificate_number,
				item.row.notes,
				item.certificationDescription,
				item.supportingDocumentLabel,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			return searchable.includes(searchTerm);
		})
		.sort((left, right) => {
			const leftValue = left.row.expires_at ?? left.row.issued_at;
			const rightValue = right.row.expires_at ?? right.row.issued_at;
			const leftTime = getComparableTimestamp(leftValue) ?? 0;
			const rightTime = getComparableTimestamp(rightValue) ?? 0;
			return leftTime - rightTime;
		});

	const currentCount = filtered.filter((item) => item.status === "current").length;
	const expiringCount = filtered.filter((item) => item.status === "expiring_soon").length;
	const expiredCount = filtered.filter((item) => item.status === "expired").length;

	const summary = [
		{ label: "Certification Records", value: String(filtered.length) },
		{ label: "Current", value: String(currentCount) },
		{ label: "Expiring", value: String(expiringCount) },
		{ label: "Expired", value: String(expiredCount) },
	];

	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = filtered.slice(offset, offset + pageSize).map((item): ReportRow => ({
		member_name: item.memberName,
		certification_name: item.certificationName,
		certificate_number: normalizeText(item.row.certificate_number) || "-",
		issued_at: formatDateOnlyLabel(item.row.issued_at),
		expires_at: item.row.expires_at ? formatDateOnlyLabel(item.row.expires_at) : "No Expiration",
		status: mapCertificationStatusLabel(item.status),
		days_until_expiration: item.daysUntilExpiration === null ? "No Expiration" : String(item.daysUntilExpiration),
		supporting_document: item.supportingDocumentLabel,
	}));

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: getCertificationPeriodBasisLabel(dateBasisFilter),
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: source.columns,
		rows: pagedRows,
		totalRows: filtered.length,
		page,
		pageSize,
	};
}

function isEmsLikeValue(value: string | null | undefined): boolean {
	const candidate = normalizeText(value).toLowerCase();
	if (!candidate) {
		return false;
	}

	return /(ems|emt|aemt|paramedic|emergency medical|advanced life support|nremt)/.test(candidate);
}

function classifySupplyStockLevel(params: {
	quantityOnHand: number;
	reorderThreshold: number;
	criticalThreshold: number | null;
}): "normal" | "low" | "critical" | "out_of_stock" {
	if (params.quantityOnHand <= 0) {
		return "out_of_stock";
	}

	if (params.criticalThreshold !== null && params.quantityOnHand <= params.criticalThreshold) {
		return "critical";
	}

	if (params.quantityOnHand <= params.reorderThreshold) {
		return "low";
	}

	return "normal";
}

function formatQuantity(value: number | null) {
	if (value === null || !Number.isFinite(value)) {
		return "-";
	}

	const rounded = Math.round(value * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function matchesSupplyStockLevelFilter(
	stockLevel: "normal" | "low" | "critical" | "out_of_stock",
	filter: string,
) {
	if (!filter || filter === "all") {
		return true;
	}

	if (filter === "low_or_worse") {
		return stockLevel === "low" || stockLevel === "critical" || stockLevel === "out_of_stock";
	}

	return stockLevel === filter;
}

function isEffectiveWindow(
	now: Date,
	effectiveStartAt: string | null,
	effectiveEndAt: string | null,
) {
	const start = effectiveStartAt ? new Date(effectiveStartAt) : null;
	const end = effectiveEndAt ? new Date(effectiveEndAt) : null;

	if (start && !Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
		return false;
	}

	if (end && !Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
		return false;
	}

	return true;
}

function getDayDifferenceFromNow(value: string | null) {
	if (!value) {
		return null;
	}

	const timestamp = getComparableTimestamp(value);
	if (timestamp === null) {
		return null;
	}

	const now = Date.now();
	const diffMs = now - timestamp;
	if (!Number.isFinite(diffMs)) {
		return null;
	}

	return Math.floor(diffMs / 86400000);
}

function classifyInspectionCurrency(intervalDays: number | null, lastInspectionAt: string | null) {
	if (intervalDays === null) {
		return "no-requirement" as const;
	}

	const daysSinceLastInspection = getDayDifferenceFromNow(lastInspectionAt);
	if (daysSinceLastInspection === null) {
		return "never-inspected" as const;
	}

	if (daysSinceLastInspection > intervalDays) {
		return "overdue" as const;
	}

	return "compliant" as const;
}

function formatInspectionCurrencyLabel(currency: "compliant" | "overdue" | "never-inspected" | "no-requirement") {
	if (currency === "compliant") {
		return "Compliant";
	}

	if (currency === "overdue") {
		return "Overdue";
	}

	if (currency === "never-inspected") {
		return "Never Inspected";
	}

	return "No Requirement Configured";
}

function formatChecklistOutcome(totalResults: number, deficiencyResults: number) {
	if (totalResults === 0) {
		return "No Checklist Results";
	}

	if (deficiencyResults > 0) {
		return "Checklist Deficiencies Found";
	}

	return "No Checklist Deficiencies";
}

function classifyDueStatus(dueDateValue: string | null) {
	if (!dueDateValue) {
		return "no_due_date" as const;
	}

	const dueTimestamp = getComparableTimestamp(dueDateValue);
	if (dueTimestamp === null) {
		return "no_due_date" as const;
	}

	const now = Date.now();
	const dayMs = 86400000;
	if (dueTimestamp < now) {
		return "overdue" as const;
	}

	if (dueTimestamp <= now + (30 * dayMs)) {
		return "due_soon" as const;
	}

	return "current" as const;
}

function normalizeInspectionResultValue(value: string | null | undefined) {
	const normalized = normalizeText(value).toLowerCase();
	if (normalized === "pass" || normalized === "passed") {
		return "pass" as const;
	}

	if (normalized === "fail" || normalized === "failed") {
		return "fail" as const;
	}

	return normalized;
}

function buildOpenDeficiencyCountMap(
	rows: Array<Record<string, unknown>>,
	foreignKey: string,
) {
	const counts = new Map<string, number>();
	for (const row of rows) {
		const itemId = normalizeText(row[foreignKey]);
		if (!itemId) {
			continue;
		}

		const statusName = normalizeText(normalizeRelation<{ name: string | null }>(row.status_info)?.name);
		const isOpen = statusName ? isOpenDeficiencyStatus(statusName) : true;
		if (!isOpen) {
			continue;
		}

		counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
	}

	return counts;
}

type EmsTrackProfileReportRow = {
	id: string;
	member_id: string;
	track: "iowa" | "nremt";
	certification_level: "emr" | "emt" | "aemt" | "paramedic";
	track_status: "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
	maintain_track: boolean;
	certification_number: string | null;
	expiration_date: string | null;
	effective_start_date: string;
	effective_end_date: string | null;
};

type EmsTrackProfileStatusInput = Pick<
	EmsTrackProfileReportRow,
	"track" | "certification_level" | "track_status" | "maintain_track" | "certification_number" | "expiration_date" | "effective_start_date" | "effective_end_date"
>;

type EmsCreditSourceReportRow = {
	id: string;
	member_id: string;
	source_type: string;
	source_record_id: string;
	source_occurred_at: string;
	source_hours: number | string | null;
	ems_core_topic: string | null;
	approval_state: string;
};

type EmsCreditAllocationReportRow = {
	member_id: string;
	credit_source_id: string;
	allocated_hours: number | string | null;
	allocation_status: string;
	is_manual_override: boolean;
	requirement_set: { authority: string | null } | Array<{ authority: string | null }> | null;
	requirement_component: { component_code: string | null } | Array<{ component_code: string | null }> | null;
	requirement_topic: { topic_code: string | null } | Array<{ topic_code: string | null }> | null;
};

function normalizeEmsLevel(value: string | null): EmsTrackProfileInput["level"] | null {
	if (value === "emr" || value === "emt" || value === "aemt" || value === "paramedic") {
		return value;
	}

	return null;
}

function normalizeEmsTrackStatus(value: string | null): EmsTrackProfileInput["status"] | null {
	if (
		value === "active" ||
		value === "inactive" ||
		value === "expired" ||
		value === "not_maintained" ||
		value === "needs_review"
	) {
		return value;
	}

	return null;
}

function normalizeEmsCoreTopic(value: string | null): EmsTrainingRecord["coreTopic"] {
	if (
		value === "airway_respirations_ventilations" ||
		value === "cardiology" ||
		value === "trauma" ||
		value === "medical" ||
		value === "operations" ||
		value === "other"
	) {
		return value;
	}

	return null;
}

function toEmsTrackProfileInput(row: EmsTrackProfileStatusInput | null): EmsTrackProfileInput | null {
	if (!row) {
		return null;
	}

	const level = normalizeEmsLevel(row.certification_level);
	const status = normalizeEmsTrackStatus(row.track_status);
	if (!level || !status) {
		return null;
	}

	return {
		level,
		status,
		expirationDate: normalizeText(row.expiration_date) || null,
		maintainTrack: row.track === "iowa" ? true : row.maintain_track === true,
	};
}

function makeEmsTrainingRecordId(sourceType: string, sourceRecordId: string) {
	return `${sourceType}:${sourceRecordId}`;
}

function toTitleCaseLabel(value: string) {
	return value
		.split("_")
		.map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
		.join(" ");
}

function formatEmsLevelLabel(level: string | null) {
	if (!level) {
		return "-";
	}

	if (level === "emr" || level === "emt" || level === "aemt") {
		return level.toUpperCase();
	}

	if (level === "paramedic") {
		return "Paramedic";
	}

	return toTitleCaseLabel(level);
}

function getUtcDayTimestamp(value: string | null) {
	if (!value) {
		return null;
	}

	const dateOnly = normalizeText(value).slice(0, 10);
	const parts = parseDateOnly(dateOnly);
	if (!parts) {
		return null;
	}

	return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function getDaysUntilUtcDate(value: string | null, nowUtcStart: number) {
	const expirationTs = getUtcDayTimestamp(value);
	if (expirationTs === null) {
		return null;
	}

	return Math.floor((expirationTs - nowUtcStart) / 86400000);
}

function classifyExpirationWindow(value: string | null, nowUtcStart: number) {
	const daysUntil = getDaysUntilUtcDate(value, nowUtcStart);
	if (daysUntil === null) {
		return "no-expiration" as const;
	}

	if (daysUntil < 0) {
		return "expired" as const;
	}

	if (daysUntil <= 30) {
		return "next-30" as const;
	}

	if (daysUntil <= 60) {
		return "next-60" as const;
	}

	if (daysUntil <= 90) {
		return "next-90" as const;
	}

	return "later" as const;
}

function isNremtMaintained(profile: EmsTrackProfileStatusInput | null) {
	if (!profile) {
		return false;
	}

	return profile.maintain_track === true && normalizeText(profile.track_status).toLowerCase() !== "not_maintained";
}

function resolveOverallEmsStatus(params: {
	hasAnyTrack: boolean;
	iowaStatus: string;
	nremtStatus: string;
	nremtMaintained: boolean;
}) {
	if (!params.hasAnyTrack || params.iowaStatus === "not_configured") {
		return "no_track" as const;
	}

	if (params.iowaStatus === "not_maintained") {
		return "not_maintained" as const;
	}

	if (params.iowaStatus === "needs_attention") {
		return "needs_attention" as const;
	}

	if (params.nremtMaintained) {
		if (params.nremtStatus === "needs_attention") {
			return "needs_attention" as const;
		}
		if (params.nremtStatus === "on_track" && params.iowaStatus === "complete") {
			return "on_track" as const;
		}
		if (params.nremtStatus === "complete" && params.iowaStatus === "complete") {
			return "complete" as const;
		}
	}

	if (params.iowaStatus === "complete") {
		return "complete" as const;
	}

	if (params.iowaStatus === "on_track") {
		return "on_track" as const;
	}

	return "needs_attention" as const;
}

function mapOverallEmsStatusLabel(status: ReturnType<typeof resolveOverallEmsStatus>) {
	if (status === "no_track") {
		return "No EMS Track Configured";
	}

	if (status === "on_track") {
		return "On Track";
	}

	if (status === "needs_attention") {
		return "Needs Attention";
	}

	if (status === "not_maintained") {
		return "Not Maintained";
	}

	return "Complete";
}

function getTopicProgressLabel(
	topics: Array<{ topic: string; completed: number; required: number }>,
	topicCode: string,
) {
	const topic = topics.find((item) => item.topic === topicCode);
	if (!topic) {
		return "-";
	}

	return `${formatHoursValue(topic.completed)} / ${formatHoursValue(topic.required)}`;
}

function getNremtComponentProgressLabel(completed: number, required: number | null) {
	if (required === null) {
		return "-";
	}

	return `${formatHoursValue(completed)} / ${formatHoursValue(required)}`;
}

async function runEmsReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const reportType = normalizeText(request.filters.report_type).toLowerCase() || "supplies";
	const memberFilter = normalizeText(request.filters.member_id);
	const trainingCategoryFilter = normalizeText(request.filters.training_category_id);
	const equipmentIdFilter = normalizeText(request.filters.equipment_id);
	const equipmentStatusFilter = normalizeText(request.filters.equipment_status).toLowerCase();
	const supplyIdFilter = normalizeText(request.filters.supply_id);
	const supplyStatusFilter = normalizeText(request.filters.supply_status).toLowerCase();
	const supplyStockLevelFilter = normalizeText(request.filters.supply_stock_level).toLowerCase();
	const certificationStatusFilter = normalizeText(request.filters.certification_status).toLowerCase();
	const reportScopeFilter = normalizeText(request.filters.report_scope).toLowerCase();
	const emsLevelFilter = normalizeText(request.filters.ems_level).toLowerCase();
	const iowaStatusFilter = normalizeText(request.filters.iowa_status).toLowerCase();
	const nremtMaintainedFilter = normalizeText(request.filters.nremt_maintained).toLowerCase();
	const readinessStatusFilter = normalizeText(request.filters.readiness_status).toLowerCase();
	const expirationWindowFilter = normalizeText(request.filters.expiration_window).toLowerCase();
	const warningDays = department.settings.certificationWarningDays;
	const includeCertificationStatus = reportType === "certification-status";
	const includeEquipment = reportType === "equipment";
	const includeSupplies = reportType === "supplies";
	const includeTraining = reportType === "training";
	const includeCertifications = reportType === "personnel-certifications";
	const reportScope = reportScopeFilter === "iowa" || reportScopeFilter === "nremt"
		? reportScopeFilter
		: "iowa-and-nremt";
	const includeIowaScopeColumns = reportScope !== "nremt";
	const includeNremtScopeColumns = reportScope !== "iowa";

	if (includeCertificationStatus) {
		const [membersQuery, profilesQuery, sourcesQuery, allocationsQuery, memberCertificationsQuery, certificationTypesQuery] = await Promise.all([
			context.supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", context.departmentId)
				.order("last_name", { ascending: true })
				.order("first_name", { ascending: true }),
			context.supabase
				.from("ems_member_track_profiles")
				.select("id, member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
				.eq("department_id", context.departmentId)
				.order("effective_start_date", { ascending: false }),
			context.supabase
				.from("ems_credit_sources")
				.select("id, member_id, source_type, source_record_id, source_occurred_at, source_hours, ems_core_topic, approval_state")
				.eq("department_id", context.departmentId),
			context.supabase
				.from("ems_credit_allocations")
				.select("member_id, credit_source_id, allocated_hours, allocation_status, is_manual_override, requirement_set:ems_requirement_sets(authority), requirement_component:ems_requirement_components(component_code), requirement_topic:ems_requirement_topics(topic_code)")
				.eq("department_id", context.departmentId),
			context.supabase
				.from("member_certifications")
				.select("member_id, certification_id, certificate_number, expires_at, issued_at")
				.eq("department_id", context.departmentId),
			context.supabase
				.from("certifications")
				.select("id, ems_authority, ems_certification_level")
				.eq("department_id", context.departmentId),
		]);

		if (membersQuery.error || profilesQuery.error || sourcesQuery.error || allocationsQuery.error || memberCertificationsQuery.error || certificationTypesQuery.error) {
			return buildError(
				"QUERY_ERROR",
				membersQuery.error?.message ||
					profilesQuery.error?.message ||
					sourcesQuery.error?.message ||
					memberCertificationsQuery.error?.message ||
					certificationTypesQuery.error?.message ||
					allocationsQuery.error?.message ||
					"Unable to load EMS certification status data.",
			);
		}

		const members = (membersQuery.data ?? []) as MemberNameRow[];
		const profileRows = (profilesQuery.data ?? []).map((row) => {
			const level = normalizeEmsLevel(normalizeText(row.certification_level));
			const status = normalizeEmsTrackStatus(normalizeText(row.track_status));
			if (!level || !status) {
				return null;
			}

			return {
				id: String(row.id),
				member_id: typeof row.member_id === "string" ? row.member_id : "",
				track: row.track === "nremt" ? "nremt" : "iowa",
				certification_level: level,
				track_status: status,
				maintain_track: row.maintain_track === true,
				certification_number: typeof row.certification_number === "string" ? row.certification_number : null,
				expiration_date: typeof row.expiration_date === "string" ? row.expiration_date : null,
				effective_start_date: typeof row.effective_start_date === "string" ? row.effective_start_date : "",
				effective_end_date: typeof row.effective_end_date === "string" ? row.effective_end_date : null,
			} satisfies EmsTrackProfileReportRow;
		}).filter((row): row is EmsTrackProfileReportRow => row !== null);
		const sourceRows = (sourcesQuery.data ?? []) as EmsCreditSourceReportRow[];
		const allocationRows = (allocationsQuery.data ?? []) as EmsCreditAllocationReportRow[];
		const memberCertificationRows = (memberCertificationsQuery.data ?? []) as MemberCertificationAuthorityRow[];
		const certificationTypeById = buildCertificationTypeMetaById(
			((certificationTypesQuery.data ?? []) as Array<{ id: string; ems_authority: string | null; ems_certification_level: string | null }>).map((row) => ({
				id: String(row.id),
				ems_authority: row.ems_authority,
				ems_certification_level: row.ems_certification_level,
			})),
		);

		const profilesByMember = new Map<string, EmsTrackProfileReportRow[]>();
		for (const row of profileRows) {
			const existing = profilesByMember.get(row.member_id) ?? [];
			existing.push(row);
			profilesByMember.set(row.member_id, existing);
		}

		const certificationsByMember = new Map<string, MemberCertificationAuthorityRow[]>();
		for (const row of memberCertificationRows) {
			const list = certificationsByMember.get(row.member_id) ?? [];
			list.push(row);
			certificationsByMember.set(row.member_id, list);
		}

		const sourceRecordIdByCreditSourceId = new Map<string, string>();
		const trainingRecordsByMember = new Map<string, EmsTrainingRecord[]>();
		for (const row of sourceRows) {
			const hours = parseHoursValue(row.source_hours);
			if (hours <= 0) {
				continue;
			}

			const recordId = makeEmsTrainingRecordId(row.source_type, row.source_record_id);
			sourceRecordIdByCreditSourceId.set(row.id, recordId);

			const records = trainingRecordsByMember.get(row.member_id) ?? [];
			records.push({
				id: recordId,
				occurredAt: normalizeText(row.source_occurred_at),
				hours,
				coreTopic: normalizeEmsCoreTopic(row.ems_core_topic),
				needsReview: normalizeText(row.approval_state).toLowerCase() !== "approved",
				eligibleForIowa: true,
				eligibleForNremt: true,
				pediatricTagged: false,
			});
			trainingRecordsByMember.set(row.member_id, records);
		}

		const manualAllocationsByMember = new Map<string, EmsManualAllocation[]>();
		for (const row of allocationRows) {
			if (row.is_manual_override !== true && normalizeText(row.allocation_status).toLowerCase() !== "manual_override") {
				continue;
			}

			const hours = parseHoursValue(row.allocated_hours);
			if (hours <= 0) {
				continue;
			}

			const recordId = sourceRecordIdByCreditSourceId.get(row.credit_source_id);
			if (!recordId) {
				continue;
			}

			const authority = normalizeText(normalizeRelation<{ authority: string | null }>(row.requirement_set)?.authority).toLowerCase();
			const componentCode = normalizeText(normalizeRelation<{ component_code: string | null }>(row.requirement_component)?.component_code).toLowerCase();
			const topicCode = normalizeText(normalizeRelation<{ topic_code: string | null }>(row.requirement_topic)?.topic_code).toLowerCase();

			if (authority !== "iowa" && authority !== "nremt") {
				continue;
			}

			if (authority === "iowa") {
				const topic = normalizeEmsCoreTopic(topicCode);
				if (!topic || topic === "other") {
					continue;
				}

				const manualItems = manualAllocationsByMember.get(row.member_id) ?? [];
				manualItems.push({
					recordId,
					track: "iowa",
					component: "core",
					topic,
					hours,
				});
				manualAllocationsByMember.set(row.member_id, manualItems);
				continue;
			}

			if (
				componentCode !== "national_component" &&
				componentCode !== "local_state_component" &&
				componentCode !== "individual_component"
			) {
				continue;
			}

			const manualItems = manualAllocationsByMember.get(row.member_id) ?? [];
			const normalizedTopic = normalizeEmsCoreTopic(topicCode);
			manualItems.push({
				recordId,
				track: "nremt",
				component: componentCode,
				topic: normalizedTopic === "other" ? null : normalizedTopic,
				hours,
			});
			manualAllocationsByMember.set(row.member_id, manualItems);
		}

		const now = new Date();
		const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		const statusPriority: Record<ReturnType<typeof resolveOverallEmsStatus>, number> = {
			needs_attention: 0,
			not_maintained: 1,
			on_track: 2,
			complete: 3,
			no_track: 4,
		};

		const rows: Array<ReportRow & { sortPriority: number; sortName: string; overall_status_key: string }> = [];

		for (const member of members) {
			const memberProfiles = profilesByMember.get(member.id) ?? [];
			const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
				memberCertifications: certificationsByMember.get(member.id) ?? [],
				certificationTypeById,
			});

			const iowaProfile = applyAuthoritativeCertificationToTrackProfile({
				track: "iowa",
				profile: findCurrentTrackProfile(memberProfiles, "iowa"),
				authoritativeCertification: authoritativeEmsCertifications.iowa,
			});
			const nremtProfile = applyAuthoritativeCertificationToTrackProfile({
				track: "nremt",
				profile: findCurrentTrackProfile(memberProfiles, "nremt"),
				authoritativeCertification: authoritativeEmsCertifications.nremt,
			});

			// EMS Certification Status is an EMS provider report, so members without any EMS track are excluded.
			if (!iowaProfile && !nremtProfile) {
				continue;
			}

			const iowaInput = toEmsTrackProfileInput(iowaProfile);
			const nremtInput = toEmsTrackProfileInput(nremtProfile);
			const trainingRecords = trainingRecordsByMember.get(member.id) ?? [];
			const manualAllocations = manualAllocationsByMember.get(member.id) ?? [];

			const readiness = calculateEmsReadiness({
				iowaProfile: iowaInput,
				nremtProfile: nremtInput,
				trainingRecords,
				manualAllocations,
			});

			const memberName = formatMemberName(member);
			const level = normalizeText(iowaProfile?.certification_level) || normalizeText(nremtProfile?.certification_level) || null;
			const normalizedIowaTrackStatus = normalizeText(iowaProfile?.track_status).toLowerCase();
			const nremtMaintained = isNremtMaintained(nremtProfile);
			const overallStatusKey = resolveOverallEmsStatus({
				hasAnyTrack: true,
				iowaStatus: readiness.iowa.status,
				nremtStatus: readiness.nremt.status,
				nremtMaintained,
			});

			const iowaExpiration = normalizeText(iowaProfile?.expiration_date) || null;
			const nremtExpiration = normalizeText(nremtProfile?.expiration_date) || null;
			const iowaExpirationTs = getUtcDayTimestamp(iowaExpiration);
			const nremtExpirationTs = nremtMaintained ? getUtcDayTimestamp(nremtExpiration) : null;
			const primaryExpiration = (() => {
				if (iowaExpirationTs === null && nremtExpirationTs === null) {
					return null;
				}
				if (iowaExpirationTs === null) {
					return nremtExpiration;
				}
				if (nremtExpirationTs === null) {
					return iowaExpiration;
				}
				return iowaExpirationTs <= nremtExpirationTs ? iowaExpiration : nremtExpiration;
			})();
			const expirationWindow = classifyExpirationWindow(primaryExpiration, todayUtcStart);

			if (memberFilter && memberFilter !== "all" && member.id !== memberFilter) {
				continue;
			}
			if (emsLevelFilter && emsLevelFilter !== "all" && level !== emsLevelFilter) {
				continue;
			}
			if (iowaStatusFilter && iowaStatusFilter !== "all" && normalizedIowaTrackStatus !== iowaStatusFilter) {
				continue;
			}
			if (nremtMaintainedFilter === "yes" && !nremtMaintained) {
				continue;
			}
			if (nremtMaintainedFilter === "no" && nremtMaintained) {
				continue;
			}
			if (readinessStatusFilter && readinessStatusFilter !== "all" && overallStatusKey !== readinessStatusFilter) {
				continue;
			}
			if (expirationWindowFilter && expirationWindowFilter !== "all") {
				if (expirationWindowFilter === "expired" && expirationWindow !== "expired") {
					continue;
				}
				if (expirationWindowFilter === "next-30" && expirationWindow !== "next-30") {
					continue;
				}
				if (expirationWindowFilter === "next-60" && expirationWindow !== "next-30" && expirationWindow !== "next-60") {
					continue;
				}
				if (expirationWindowFilter === "next-90" && expirationWindow !== "next-30" && expirationWindow !== "next-60" && expirationWindow !== "next-90") {
					continue;
				}
				if (expirationWindowFilter === "no-expiration" && expirationWindow !== "no-expiration") {
					continue;
				}
			}

			const searchableText = [
				memberName,
				level,
				iowaProfile?.certification_number,
				nremtProfile?.certification_number,
				normalizedIowaTrackStatus,
				overallStatusKey,
			].map((value) => normalizeText(value).toLowerCase());

			if (searchTerm && !searchableText.some((value) => value.includes(searchTerm))) {
				continue;
			}

			rows.push({
				member_name: memberName,
				ems_level: formatEmsLevelLabel(level),
				iowa_status: normalizedIowaTrackStatus ? toTitleCaseLabel(normalizedIowaTrackStatus) : "-",
				iowa_certification_number: normalizeText(iowaProfile?.certification_number) || "-",
				iowa_expires_at: iowaExpiration ? formatDateOnlyLabel(iowaExpiration) : "No Expiration",
				iowa_progress: `${formatHoursValue(readiness.iowa.totalCompleted)} / ${formatHoursValue(readiness.iowa.totalRequired)}`,
				iowa_airway_progress: getTopicProgressLabel(readiness.iowa.topics, "airway_respirations_ventilations"),
				iowa_cardiology_progress: getTopicProgressLabel(readiness.iowa.topics, "cardiology"),
				iowa_trauma_progress: getTopicProgressLabel(readiness.iowa.topics, "trauma"),
				iowa_medical_progress: getTopicProgressLabel(readiness.iowa.topics, "medical"),
				iowa_operations_progress: getTopicProgressLabel(readiness.iowa.topics, "operations"),
				nremt_maintained: nremtMaintained ? "Yes" : "No",
				nremt_status: nremtMaintained ? toTitleCaseLabel(readiness.nremt.status) : "Not Maintained",
				nremt_certification_number: normalizeText(nremtProfile?.certification_number) || "-",
				nremt_expires_at: nremtExpiration ? formatDateOnlyLabel(nremtExpiration) : "No Expiration",
				nremt_progress: nremtMaintained
					? `${formatHoursValue(readiness.nremt.totalCompleted)} / ${formatHoursValue(readiness.nremt.totalRequired)}`
					: "-",
				nremt_national_component_progress: nremtMaintained
					? getNremtComponentProgressLabel(readiness.nremt.nationalComponentCompleted, readiness.nremt.nationalComponentRequired)
					: "-",
				nremt_local_state_component_progress: nremtMaintained
					? getNremtComponentProgressLabel(readiness.nremt.localStateComponentCompleted, readiness.nremt.localStateComponentRequired)
					: "-",
				nremt_individual_component_progress: nremtMaintained
					? getNremtComponentProgressLabel(readiness.nremt.individualComponentCompleted, readiness.nremt.individualComponentRequired)
					: "-",
				nremt_airway_progress: nremtMaintained ? getTopicProgressLabel(readiness.nremt.nationalTopics, "airway_respirations_ventilations") : "-",
				nremt_cardiology_progress: nremtMaintained ? getTopicProgressLabel(readiness.nremt.nationalTopics, "cardiology") : "-",
				nremt_trauma_progress: nremtMaintained ? getTopicProgressLabel(readiness.nremt.nationalTopics, "trauma") : "-",
				nremt_medical_progress: nremtMaintained ? getTopicProgressLabel(readiness.nremt.nationalTopics, "medical") : "-",
				nremt_operations_progress: nremtMaintained ? getTopicProgressLabel(readiness.nremt.nationalTopics, "operations") : "-",
				overall_status: mapOverallEmsStatusLabel(overallStatusKey),
				overall_status_key: overallStatusKey,
				warnings: readiness.warnings.length > 0 ? String(readiness.warnings.length) : "0",
				sortPriority: statusPriority[overallStatusKey],
				sortName: memberName.toLowerCase(),
			});
		}

		const sortedRows = rows.sort((left, right) => {
			if (left.sortPriority !== right.sortPriority) {
				return left.sortPriority - right.sortPriority;
			}

			return String(left.sortName).localeCompare(String(right.sortName));
		});

		const completeCount = sortedRows.filter((row) => row.overall_status_key === "complete").length;
		const onTrackCount = sortedRows.filter((row) => row.overall_status_key === "on_track").length;
		const needsAttentionCount = sortedRows.filter((row) => row.overall_status_key === "needs_attention").length;
		const notMaintainedCount = sortedRows.filter((row) => row.overall_status_key === "not_maintained").length;
		const noTrackCount = sortedRows.filter((row) => row.overall_status_key === "no_track").length;

		const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
		const page = Math.max(1, Number(request.page) || 1);
		const offset = (page - 1) * pageSize;
		const pagedRows = sortedRows.slice(offset, offset + pageSize).map((row) => {
			const scopedRow: ReportRow = {
				member_name: row.member_name as string,
				ems_level: row.ems_level as string,
			};

			if (includeIowaScopeColumns) {
				scopedRow.iowa_certification_number = row.iowa_certification_number as string;
				scopedRow.iowa_expires_at = row.iowa_expires_at as string;
				scopedRow.iowa_progress = row.iowa_progress as string;
				scopedRow.iowa_status = row.iowa_status as string;
				scopedRow.iowa_airway_progress = row.iowa_airway_progress as string;
				scopedRow.iowa_cardiology_progress = row.iowa_cardiology_progress as string;
				scopedRow.iowa_trauma_progress = row.iowa_trauma_progress as string;
				scopedRow.iowa_medical_progress = row.iowa_medical_progress as string;
				scopedRow.iowa_operations_progress = row.iowa_operations_progress as string;
			}

			if (includeNremtScopeColumns) {
				scopedRow.nremt_maintained = row.nremt_maintained as string;
				scopedRow.nremt_certification_number = row.nremt_certification_number as string;
				scopedRow.nremt_expires_at = row.nremt_expires_at as string;
				scopedRow.nremt_progress = row.nremt_progress as string;
				scopedRow.nremt_status = row.nremt_status as string;
				scopedRow.nremt_national_component_progress = row.nremt_national_component_progress as string;
				scopedRow.nremt_local_state_component_progress = row.nremt_local_state_component_progress as string;
				scopedRow.nremt_individual_component_progress = row.nremt_individual_component_progress as string;
				scopedRow.nremt_airway_progress = row.nremt_airway_progress as string;
				scopedRow.nremt_cardiology_progress = row.nremt_cardiology_progress as string;
				scopedRow.nremt_trauma_progress = row.nremt_trauma_progress as string;
				scopedRow.nremt_medical_progress = row.nremt_medical_progress as string;
				scopedRow.nremt_operations_progress = row.nremt_operations_progress as string;
			}

			return scopedRow;
		});

		const columns: Array<{ key: string; label: string }> = [
			{ key: "member_name", label: "Member" },
			{ key: "ems_level", label: "EMS Level" },
		];

		if (includeIowaScopeColumns) {
			columns.push(
				{ key: "iowa_certification_number", label: "Iowa Number" },
				{ key: "iowa_expires_at", label: "Iowa Expires" },
				{ key: "iowa_progress", label: "Iowa Progress (Completed / Required)" },
				{ key: "iowa_status", label: "Iowa Status" },
				{ key: "iowa_airway_progress", label: "Iowa Airway / Respirations / Ventilations" },
				{ key: "iowa_cardiology_progress", label: "Iowa Cardiology" },
				{ key: "iowa_trauma_progress", label: "Iowa Trauma" },
				{ key: "iowa_medical_progress", label: "Iowa Medical" },
				{ key: "iowa_operations_progress", label: "Iowa Operations" },
			);
		}

		if (includeNremtScopeColumns) {
			columns.push(
				{ key: "nremt_maintained", label: "NREMT Maintained" },
				{ key: "nremt_certification_number", label: "NREMT Number" },
				{ key: "nremt_expires_at", label: "NREMT Expires" },
				{ key: "nremt_progress", label: "NREMT Progress (Completed / Required)" },
				{ key: "nremt_status", label: "NREMT Status" },
				{ key: "nremt_national_component_progress", label: "NREMT National Component" },
				{ key: "nremt_local_state_component_progress", label: "NREMT Local/State Component" },
				{ key: "nremt_individual_component_progress", label: "NREMT Individual Component" },
				{ key: "nremt_airway_progress", label: "NREMT Airway / Respirations / Ventilations" },
				{ key: "nremt_cardiology_progress", label: "NREMT Cardiology" },
				{ key: "nremt_trauma_progress", label: "NREMT Trauma" },
				{ key: "nremt_medical_progress", label: "NREMT Medical" },
				{ key: "nremt_operations_progress", label: "NREMT Operations" },
			);
		}

		return {
			ok: true,
			comingSoon: false,
			source: {
				key: source.key,
				name: source.name,
				description: source.description,
			},
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: {
				from: request.dateRange.from,
				to: request.dateRange.to,
				label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
				basisLabel: "Certification Snapshot Date",
			},
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [
				{ label: "Members", value: String(sortedRows.length) },
				{ label: "Complete", value: String(completeCount) },
				{ label: "On Track", value: String(onTrackCount) },
				{ label: "Needs Attention", value: String(needsAttentionCount) },
				{ label: "Not Maintained", value: String(notMaintainedCount) },
				{ label: "No Track", value: String(noTrackCount) },
			],
			columns,
			rows: pagedRows,
			totalRows: sortedRows.length,
			page,
			pageSize,
		};
	}

	const [equipmentQuery, suppliesQuery, supplyUsageQuery, certificationQuery, membersQuery, trainingCategoriesQuery, attendanceQuery, outsideQuery] = await Promise.all([
		context.supabase
			.from("ems_equipment")
			.select("id, equipment_name, equipment_type, manufacturer, model, serial_number, equipment_number, status, location, placed_in_service_date, notes, created_at, updated_at")
			.eq("department_id", context.departmentId)
			.order("equipment_name", { ascending: true }),
		context.supabase
			.from("ems_supply_items")
			.select("id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at")
			.eq("department_id", context.departmentId)
			.order("item_name", { ascending: true }),
		context.supabase
			.from("ems_supply_transaction_items")
			.select("supply_item_id, quantity_delta, transaction:ems_supply_transactions!inner(occurred_at, transaction_type)")
			.eq("department_id", context.departmentId)
			.gte("transaction.occurred_at", fromIso)
			.lt("transaction.occurred_at", toExclusiveIso),
		context.supabase
			.from("member_certifications")
			.select("id, member_id, certification_id, certificate_number, issued_at, expires_at, notes")
			.eq("department_id", context.departmentId)
			.order("issued_at", { ascending: false }),
		context.supabase
			.from("members")
			.select("id, first_name, last_name")
			.eq("department_id", context.departmentId)
			.order("last_name", { ascending: true })
			.order("first_name", { ascending: true }),
		context.supabase
			.from("training_categories")
			.select("id, name")
			.eq("department_id", context.departmentId)
			.order("name", { ascending: true }),
		context.supabase
			.from("training_event_attendance")
			.select("id, training_event_id, member_id, attendance_status")
			.eq("department_id", context.departmentId)
			.eq("attendance_status", "attending"),
		context.supabase
			.from("training_outside_submissions")
			.select("id, member_id, title, category_id, training_date, hours, status")
			.eq("department_id", context.departmentId)
			.eq("status", "approved"),
	]);

	if (equipmentQuery.error || suppliesQuery.error || supplyUsageQuery.error || certificationQuery.error || membersQuery.error || trainingCategoriesQuery.error || attendanceQuery.error || outsideQuery.error) {
		return buildError(
			"QUERY_ERROR",
			equipmentQuery.error?.message ||
				suppliesQuery.error?.message ||
				supplyUsageQuery.error?.message ||
				certificationQuery.error?.message ||
				membersQuery.error?.message ||
				trainingCategoriesQuery.error?.message ||
				attendanceQuery.error?.message ||
				outsideQuery.error?.message ||
				"Unable to load EMS report data.",
		);
	}

	const memberNameById = new Map(
		((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
	);
	const categoryNameById = new Map(
		((trainingCategoriesQuery.data ?? []) as TrainingCategoryRow[]).map((category) => [category.id, normalizeText(category.name) || "Uncategorized"]),
	);

	const certificationIds = Array.from(
		new Set((certificationQuery.data ?? []).map((row) => row.certification_id).filter((value): value is string => typeof value === "string" && value.length > 0)),
	);
	const certificationCatalogQuery = certificationIds.length > 0
		? await context.supabase
				.from("certifications")
				.select("id, name, description")
				.eq("department_id", context.departmentId)
				.in("id", certificationIds)
		: { data: [] as Array<{ id: string; name: string | null; description: string | null }>, error: null };

	if (certificationCatalogQuery.error) {
		return buildError("QUERY_ERROR", certificationCatalogQuery.error.message || "Unable to load EMS certification labels.");
	}

	const certificationNameById = new Map(
		(certificationCatalogQuery.data ?? []).map((item) => [item.id, normalizeText(item.name) || "Unknown Certification"]),
	);

	const eventIds = Array.from(
		new Set((attendanceQuery.data ?? []).map((row) => row.training_event_id).filter((value): value is string => typeof value === "string" && value.length > 0)),
	);
	const eventQuery = eventIds.length > 0
		? await context.supabase
				.from("training_events")
				.select("id, title, category_id, location, starts_at, hours_credit, training_type")
				.eq("department_id", context.departmentId)
				.in("id", eventIds)
		: { data: [] as Array<{ id: string; title: string | null; category_id: string | null; location: string | null; starts_at: string | null; hours_credit: number | string | null; training_type: string | null }>, error: null };

	if (eventQuery.error) {
		return buildError("QUERY_ERROR", eventQuery.error.message || "Unable to load EMS training events.");
	}

	const eventById = new Map((eventQuery.data ?? []).map((row) => [row.id, row]));

	const usageBySupplyId = new Map<string, {
		usedQuantity: number;
		checkoutEvents: number;
		restockQuantity: number;
		netDelta: number;
	}>();

	for (const usage of (supplyUsageQuery.data ?? []) as Array<{
		supply_item_id: string;
		quantity_delta: number | string | null;
		transaction: { occurred_at: string | null; transaction_type: string | null } | Array<{ occurred_at: string | null; transaction_type: string | null }> | null;
	}>) {
		const supplyItemId = normalizeText(usage.supply_item_id);
		if (!supplyItemId) {
			continue;
		}

		const transaction = normalizeRelation<{ occurred_at: string | null; transaction_type: string | null }>(usage.transaction);
		const transactionType = normalizeText(transaction?.transaction_type);
		const quantityDelta = parseNullableNumber(usage.quantity_delta) ?? 0;

		const aggregate = usageBySupplyId.get(supplyItemId) ?? {
			usedQuantity: 0,
			checkoutEvents: 0,
			restockQuantity: 0,
			netDelta: 0,
		};

		aggregate.netDelta += quantityDelta;

		if (transactionType === "Checkout" && quantityDelta < 0) {
			aggregate.usedQuantity += Math.abs(quantityDelta);
			aggregate.checkoutEvents += 1;
		}

		if ((transactionType === "Restock" || transactionType === "Return") && quantityDelta > 0) {
			aggregate.restockQuantity += quantityDelta;
		}

		usageBySupplyId.set(supplyItemId, aggregate);
	}

	const rows: Array<ReportRow & { sortKey?: number | string }> = [];

	for (const equipment of (equipmentQuery.data ?? []) as Array<{ id: string; equipment_name: string | null; equipment_type: string | null; manufacturer: string | null; model: string | null; serial_number: string | null; equipment_number: string | null; status: string | null; location: string | null; placed_in_service_date: string | null; notes: string | null; created_at: string | null; updated_at: string | null }>) {
		if (!includeEquipment) {
			continue;
		}
		const statusValue = normalizeText(equipment.status) || "Unknown";
		const normalizedStatus = statusValue.toLowerCase();
		if (equipmentIdFilter && equipmentIdFilter !== "all" && equipment.id !== equipmentIdFilter) {
			continue;
		}
		if (equipmentStatusFilter && equipmentStatusFilter !== "all" && normalizedStatus !== equipmentStatusFilter) {
			continue;
		}
		if (!searchTerm || [equipment.equipment_name, equipment.equipment_type, equipment.manufacturer, equipment.model, equipment.serial_number, equipment.equipment_number, equipment.location, equipment.notes].some((value) => normalizeText(value).toLowerCase().includes(searchTerm))) {
			rows.push({
				record_type: "Equipment",
				member_name: "-",
				item_name: normalizeText(equipment.equipment_name) || "Unknown Equipment",
				category_name: normalizeText(equipment.equipment_type) || "Equipment",
				status: statusValue,
				date: formatDateOnlyLabel(equipment.placed_in_service_date ?? equipment.created_at ?? null),
				location: normalizeText(equipment.location) || "-",
				hours: "-",
				expires_at: "-",
				sortKey: getComparableTimestamp(equipment.updated_at || equipment.created_at) ?? 0,
			});
		}
	}

	for (const supply of (suppliesQuery.data ?? []) as Array<{ id: string; item_name: string | null; item_category: string | null; unit_of_measure: string | null; custom_unit_of_measure: string | null; quantity_on_hand: number | string | null; reorder_threshold: number | string | null; critical_threshold: number | string | null; target_quantity: number | string | null; location: string | null; notes: string | null; status: string | null; qr_identifier: string | null; created_at: string | null; updated_at: string | null }>) {
		if (!includeSupplies) {
			continue;
		}
		const supplyStatusValue = normalizeText(supply.status) || "Unknown";
		const normalizedSupplyStatus = supplyStatusValue.toLowerCase();
		const categoryValue = normalizeText(supply.item_category) || "Supply";
		const quantityOnHand = parseNullableNumber(supply.quantity_on_hand) ?? 0;
		const reorderThreshold = parseNullableNumber(supply.reorder_threshold) ?? 0;
		const criticalThreshold = parseNullableNumber(supply.critical_threshold);
		const targetQuantity = parseNullableNumber(supply.target_quantity);
		const stockLevel = classifySupplyStockLevel({
			quantityOnHand,
			reorderThreshold,
			criticalThreshold,
		});
		const usageAggregate = usageBySupplyId.get(supply.id) ?? {
			usedQuantity: 0,
			checkoutEvents: 0,
			restockQuantity: 0,
			netDelta: 0,
		};
		const averageUsagePerDay = usageAggregate.usedQuantity > 0
			? usageAggregate.usedQuantity / Math.max(1, Math.ceil((new Date(toExclusiveIso).getTime() - new Date(fromIso).getTime()) / 86400000))
			: 0;
		const estimatedDaysRemaining = averageUsagePerDay > 0 ? quantityOnHand / averageUsagePerDay : null;
		if (supplyIdFilter && supplyIdFilter !== "all" && supply.id !== supplyIdFilter) {
			continue;
		}
		if (supplyStatusFilter && supplyStatusFilter !== "all" && normalizedSupplyStatus !== supplyStatusFilter) {
			continue;
		}
		if (!matchesSupplyStockLevelFilter(stockLevel, supplyStockLevelFilter)) {
			continue;
		}
		if (!searchTerm || [supply.item_name, supply.item_category, supply.location, supply.notes, supply.qr_identifier].some((value) => normalizeText(value).toLowerCase().includes(searchTerm))) {
			rows.push({
				record_type: "Supply",
				source_id: supply.id,
				used_in_period: usageAggregate.usedQuantity,
				checkout_events_in_period: usageAggregate.checkoutEvents,
				member_name: "-",
				item_name: normalizeText(supply.item_name) || "Unknown Supply",
				category_name: categoryValue,
				status: `${supplyStatusValue} (${stockLevel.replaceAll("_", " ")})`,
				date: formatDateOnlyLabel(supply.updated_at ?? supply.created_at ?? null),
				location: normalizeText(supply.location) || "-",
				hours: `${formatQuantity(quantityOnHand)} on hand | used ${formatQuantity(usageAggregate.usedQuantity)} in period`,
				expires_at: [
					`reorder ${formatQuantity(reorderThreshold)}`,
					`critical ${criticalThreshold === null ? "-" : formatQuantity(criticalThreshold)}`,
					targetQuantity === null ? null : `target ${formatQuantity(targetQuantity)}`,
					usageAggregate.checkoutEvents > 0 ? `avg/day ${formatQuantity(averageUsagePerDay)}` : null,
					estimatedDaysRemaining === null ? null : `est days left ${formatQuantity(estimatedDaysRemaining)}`,
				].filter(Boolean).join(" | "),
				sortKey: getComparableTimestamp(supply.updated_at || supply.created_at) ?? 0,
			});
		}
	}

	for (const row of (certificationQuery.data ?? []) as Array<{ id: string; member_id: string; certification_id: string; certificate_number: string | null; issued_at: string | null; expires_at: string | null; notes: string | null }>) {
		if (!includeCertifications) {
			continue;
		}
		const certificationName = certificationNameById.get(row.certification_id) || "Unknown Certification";
		if (!isEmsLikeValue(certificationName)) {
			continue;
		}
		const certStatus = getCertificationStatus(row.expires_at, warningDays);
		if (certificationStatusFilter && certificationStatusFilter !== "all" && certStatus !== certificationStatusFilter.replace("expiring", "expiring_soon")) {
			continue;
		}
		if (memberFilter && memberFilter !== "all" && row.member_id !== memberFilter) {
			continue;
		}
		if (!searchTerm || [memberNameById.get(row.member_id) ?? row.member_id, certificationName, row.certificate_number, row.notes].some((value) => normalizeText(value).toLowerCase().includes(searchTerm))) {
			rows.push({
				record_type: "Certification",
				member_name: memberNameById.get(row.member_id) ?? row.member_id,
				item_name: certificationName,
				category_name: certificationName,
				status: mapCertificationStatusLabel(certStatus),
				date: formatDateOnlyLabel(row.issued_at ?? row.expires_at ?? null),
				location: "-",
				hours: "-",
				expires_at: row.expires_at ? formatDateOnlyLabel(row.expires_at) : "No Expiration",
				sortKey: getComparableTimestamp(row.expires_at || row.issued_at) ?? 0,
			});
		}
	}

	for (const attendance of (attendanceQuery.data ?? []) as Array<{ id: string; training_event_id: string; member_id: string; attendance_status: string | null }>) {
		if (!includeTraining) {
			continue;
		}
		const event = eventById.get(attendance.training_event_id);
		if (!event) {
			continue;
		}
		const categoryId = normalizeText(event.category_id);
		const categoryName = categoryId ? (categoryNameById.get(categoryId) ?? "Uncategorized") : "Uncategorized";
		if (!isEmsLikeValue(categoryName) && !isEmsLikeValue(event.title) && !isEmsLikeValue(event.training_type)) {
			continue;
		}
		if (trainingCategoryFilter && trainingCategoryFilter !== "all" && categoryId !== trainingCategoryFilter) {
			continue;
		}
		if (memberFilter && memberFilter !== "all" && attendance.member_id !== memberFilter) {
			continue;
		}
		if (!searchTerm || [memberNameById.get(attendance.member_id) ?? attendance.member_id, event.title, categoryName, event.location, event.training_type].some((value) => normalizeText(value).toLowerCase().includes(searchTerm))) {
			rows.push({
				record_type: "Training",
				member_name: memberNameById.get(attendance.member_id) ?? attendance.member_id,
				item_name: normalizeText(event.title) || "Department Training",
				category_name: categoryName,
				status: normalizeText(event.training_type) || "Training",
				date: formatDateOnlyLabel(event.starts_at),
				location: normalizeText(event.location) || "-",
				hours: parseHoursValue(event.hours_credit) > 0 ? formatHoursValue(parseHoursValue(event.hours_credit)) : "-",
				expires_at: "-",
				sortKey: getComparableTimestamp(event.starts_at) ?? 0,
			});
		}
	}

	for (const submission of (outsideQuery.data ?? []) as Array<{ id: string; member_id: string; title: string | null; category_id: string | null; training_date: string | null; hours: number | string | null; status: string | null }>) {
		if (!includeTraining) {
			continue;
		}
		const categoryName = submission.category_id ? (categoryNameById.get(submission.category_id) ?? "Uncategorized") : "Uncategorized";
		if (!isEmsLikeValue(categoryName) && !isEmsLikeValue(submission.title)) {
			continue;
		}
		if (trainingCategoryFilter && trainingCategoryFilter !== "all" && submission.category_id !== trainingCategoryFilter) {
			continue;
		}
		if (memberFilter && memberFilter !== "all" && submission.member_id !== memberFilter) {
			continue;
		}
		if (!searchTerm || [memberNameById.get(submission.member_id) ?? submission.member_id, submission.title, categoryName].some((value) => normalizeText(value).toLowerCase().includes(searchTerm))) {
			rows.push({
				record_type: "Training",
				member_name: memberNameById.get(submission.member_id) ?? submission.member_id,
				item_name: normalizeText(submission.title) || "Outside Training",
				category_name: categoryName,
				status: "Approved",
				date: formatDateOnlyLabel(submission.training_date ?? null),
				location: "-",
				hours: parseHoursValue(submission.hours) > 0 ? formatHoursValue(parseHoursValue(submission.hours)) : "-",
				expires_at: "-",
				sortKey: getComparableTimestamp(submission.training_date) ?? 0,
			});
		}
	}

	const filteredRows = rows
		.filter((row) => {
			if (!isWithinUtcRange(String(row.date ?? ""), fromIso, toExclusiveIso) && row.date !== "-" && row.date !== "No Expiration") {
				return false;
			}
			return true;
		})
		.sort((left, right) => {
			const leftValue = left.sortKey ?? 0;
			const rightValue = right.sortKey ?? 0;
			return Number(rightValue) - Number(leftValue);
		});

	const totalHours = filteredRows.reduce((total, row) => {
		if (row.hours === "-" || typeof row.hours !== "string") {
			return total;
		}
		const numeric = Number.parseFloat(String(row.hours));
		return Number.isFinite(numeric) ? total + numeric : total;
	}, 0);

	const filteredSupplyRows = filteredRows.filter((row) => row.record_type === "Supply");
	const lowOrWorseSupplyCount = filteredSupplyRows.filter((row) => {
		const normalizedStatus = String(row.status ?? "").toLowerCase();
		return normalizedStatus.includes("low") || normalizedStatus.includes("critical") || normalizedStatus.includes("out of stock");
	}).length;
	const totalUsedInPeriod = filteredSupplyRows.reduce((total, row) => {
		if (typeof row.used_in_period === "number") {
			return total + row.used_in_period;
		}

		if (typeof row.hours !== "string") {
			return total;
		}
		const match = row.hours.match(/used\s+(-?\d+(?:\.\d+)?)/i);
		if (!match) {
			return total;
		}
		const parsed = Number.parseFloat(match[1]);
		return Number.isFinite(parsed) ? total + parsed : total;
	}, 0);
	const totalCheckoutEventsInPeriod = filteredSupplyRows.reduce((total, row) => {
		if (typeof row.checkout_events_in_period === "number") {
			return total + row.checkout_events_in_period;
		}

		return total;
	}, 0);

	const summary = [
		...(includeSupplies
			? [
				{ label: "Supply Items", value: String(filteredSupplyRows.length) },
				{ label: "Low/Critical/Out", value: String(lowOrWorseSupplyCount) },
				{ label: "Total Used In Period", value: formatQuantity(totalUsedInPeriod) },
				{ label: "Checkout Events In Period", value: String(totalCheckoutEventsInPeriod) },
			]
			: [
				{ label: "Records", value: String(filteredRows.length) },
				{ label: "Training Hours", value: `${formatHoursValue(totalHours)} hrs` },
			]
		),
	];

	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = filteredRows.slice(offset, offset + pageSize).map((row) => ({
		record_type: row.record_type,
		member_name: row.member_name,
		item_name: row.item_name,
		category_name: row.category_name,
		status: row.status,
		date: row.date,
		location: row.location,
		hours: row.hours,
		expires_at: row.expires_at,
	}));

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: includeSupplies
				? "Supply Usage Date (Checkout/Restock/Return Transaction Occurred At)"
				: "EMS Activity Date",
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: source.columns,
		rows: pagedRows,
		totalRows: filteredRows.length,
		page,
		pageSize,
	};
}

async function runInspectionsReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const reportType = normalizeText(request.filters.report_type).toLowerCase() || "all-inspections";
	const fireHoseFilter = normalizeText(request.filters.fire_hose_id);
	const scbaCylinderFilter = normalizeText(request.filters.scba_cylinder_id);
	const scbaPackFilter = normalizeText(request.filters.scba_pack_id);
	const gasMonitorFilter = normalizeText(request.filters.gas_monitor_id);
	const ropeItemFilter = normalizeText(request.filters.rope_item_id);
	const groundLadderFilter = normalizeText(request.filters.ground_ladder_id);
	const inspectionResultFilter = normalizeText(request.filters.inspection_result).toLowerCase();
	const dueStatusFilter = normalizeText(request.filters.due_status).toLowerCase();
	const includeAllInspectionTypes = reportType === "all-inspections";
	const includeFireHose = includeAllInspectionTypes || reportType === "fire-hose-testing";
	const includeScbaCylinderHydro = includeAllInspectionTypes || reportType === "scba-cylinder-hydrostatic-testing";
	const includeScbaPackFlow = includeAllInspectionTypes || reportType === "scba-pack-flow-testing";
	const includeGasMonitorCalibration = includeAllInspectionTypes || reportType === "gas-monitor-calibration";
	const includeRopeInspections = includeAllInspectionTypes || reportType === "rope-inspections";
	const includeGroundLadderServiceTesting = includeAllInspectionTypes || reportType === "ground-ladder-service-testing";
	const includeGroundLadderInspection = includeAllInspectionTypes || reportType === "ground-ladder-inspection";

	type CentralInspectionRow = {
		inspectionDateRaw: string | null;
		inspectionTypeKey:
			| "fire-hose-testing"
			| "scba-cylinder-hydrostatic-testing"
			| "scba-pack-flow-testing"
			| "gas-monitor-calibration"
			| "rope-inspections"
			| "ground-ladder-service-testing"
			| "ground-ladder-inspection";
		inspectionTypeLabel: string;
		itemId: string;
		itemName: string;
		itemIdentifier: string;
		result: string;
		inspectedBy: string;
		itemStatus: string;
		nextDueDateRaw: string | null;
		openDeficiencies: number;
		notes: string;
	};

	const [
		membersQuery,
		fireHoseQuery,
		fireHoseTestsQuery,
		scbaCylindersQuery,
		scbaPacksQuery,
		scbaPackTestsQuery,
		gasMonitorsQuery,
		gasMonitorCalibrationsQuery,
		gasMonitorCalibrationSettingsQuery,
		ropeItemsQuery,
		ropeInspectionsQuery,
		groundLaddersQuery,
		groundLadderServiceTestsQuery,
		deficienciesQuery,
	] = await Promise.all([
		context.supabase.from("members").select("id, first_name, last_name").eq("department_id", context.departmentId),
		includeFireHose
			? context.supabase.from("fire_hose").select("id, inventory_number, status, next_test_date").eq("department_id", context.departmentId)
			: Promise.resolve({
				data: [] as Array<{ id: string; inventory_number: string | null; status: string | null; next_test_date: string | null }>,
				error: null,
			}),
		includeFireHose
			? context.supabase
					.from("fire_hose_testing_results")
					.select("id, hose_id, test_date, result, tester, inventory_number, created_at")
					.eq("department_id", context.departmentId)
					.order("test_date", { ascending: false })
					.order("created_at", { ascending: false })
			: Promise.resolve({
				data: [] as Array<{ id: string; hose_id: string | null; test_date: string | null; result: string | null; tester: string | null; inventory_number: string | null; created_at: string | null }>,
				error: null,
			}),
		includeScbaCylinderHydro
			? context.supabase.from("scba_cylinders").select("id, cylinder_number, status, last_hydrostatic_test_date, next_hydrostatic_test_due_date").eq("department_id", context.departmentId)
			: Promise.resolve({
				data: [] as Array<{ id: string; cylinder_number: string | null; status: string | null; last_hydrostatic_test_date: string | null; next_hydrostatic_test_due_date: string | null }>,
				error: null,
			}),
		includeScbaPackFlow
			? context.supabase.from("scba_packs").select("id, pack_number, status, next_flow_test_due_date").eq("department_id", context.departmentId)
			: Promise.resolve({
				data: [] as Array<{ id: string; pack_number: string | null; status: string | null; next_flow_test_due_date: string | null }>,
				error: null,
			}),
		includeScbaPackFlow
			? context.supabase
					.from("scba_pack_flow_tests")
					.select("id, scba_pack_id, test_date, tester, result, notes, created_at")
					.eq("department_id", context.departmentId)
					.order("test_date", { ascending: false })
					.order("created_at", { ascending: false })
			: Promise.resolve({
				data: [] as Array<{ id: string; scba_pack_id: string | null; test_date: string | null; tester: string | null; result: string | null; notes: string | null; created_at: string | null }>,
				error: null,
			}),
		includeGasMonitorCalibration
			? context.supabase.from("gas_monitors").select("id, monitor_number, status").eq("department_id", context.departmentId)
			: Promise.resolve({
				data: [] as Array<{ id: string; monitor_number: string | null; status: string | null }>,
				error: null,
			}),
		includeGasMonitorCalibration
			? context.supabase
					.from("gas_monitor_calibrations")
					.select("id, gas_monitor_id, calibration_date, result, tester_mode, tester_member_id, external_tester_name, external_tester_company, notes, created_at")
					.eq("department_id", context.departmentId)
					.order("calibration_date", { ascending: false })
					.order("created_at", { ascending: false })
			: Promise.resolve({
				data: [] as Array<{ id: string; gas_monitor_id: string | null; calibration_date: string | null; result: string | null; tester_mode: string | null; tester_member_id: string | null; external_tester_name: string | null; external_tester_company: string | null; notes: string | null; created_at: string | null }>,
				error: null,
			}),
		includeGasMonitorCalibration
			? context.supabase.from("gas_monitor_calibration_settings").select("calibration_interval_months").eq("department_id", context.departmentId).maybeSingle()
			: Promise.resolve({
				data: null as { calibration_interval_months: number | null } | null,
				error: null,
			}),
		includeRopeInspections
			? context.supabase.from("rope_items").select("id, rope_name, rope_identifier, status").eq("department_id", context.departmentId)
			: Promise.resolve({
				data: [] as Array<{ id: string; rope_name: string | null; rope_identifier: string | null; status: string | null }>,
				error: null,
			}),
		includeRopeInspections
			? context.supabase
					.from("rope_inspections")
					.select("id, rope_item_id, inspection_date, result, primary_inspector_member_id, notes, created_at")
					.eq("department_id", context.departmentId)
					.order("inspection_date", { ascending: false })
					.order("created_at", { ascending: false })
			: Promise.resolve({
				data: [] as Array<{ id: string; rope_item_id: string | null; inspection_date: string | null; result: string | null; primary_inspector_member_id: string | null; notes: string | null; created_at: string | null }>,
				error: null,
			}),
		(includeGroundLadderServiceTesting || includeGroundLadderInspection)
			? context.supabase.from("ground_ladders").select("id, ladder_number, status, notes, updated_at").eq("department_id", context.departmentId)
			: Promise.resolve({
				data: [] as Array<{ id: string; ladder_number: string | null; status: string | null; notes: string | null; updated_at: string | null }>,
				error: null,
			}),
		includeGroundLadderServiceTesting
			? context.supabase
					.from("ground_ladder_service_tests")
					.select("id, ground_ladder_id, test_date, tester_type, member_id, external_tester_name, company_name, result, notes, next_test_due_date, created_at")
					.eq("department_id", context.departmentId)
					.order("test_date", { ascending: false })
					.order("created_at", { ascending: false })
			: Promise.resolve({
				data: [] as Array<{ id: string; ground_ladder_id: string | null; test_date: string | null; tester_type: string | null; member_id: string | null; external_tester_name: string | null; company_name: string | null; result: string | null; notes: string | null; next_test_due_date: string | null; created_at: string | null }>,
				error: null,
			}),
		context.supabase
			.from("deficiencies")
			.select("fire_hose_id, scba_cylinder_id, scba_pack_id, gas_monitor_id, rope_item_id, ground_ladder_id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
			.eq("department_id", context.departmentId),
	]);

	const queryErrors = [
		membersQuery.error,
		fireHoseQuery.error,
		fireHoseTestsQuery.error,
		scbaCylindersQuery.error,
		scbaPacksQuery.error,
		scbaPackTestsQuery.error,
		gasMonitorsQuery.error,
		gasMonitorCalibrationsQuery.error,
		gasMonitorCalibrationSettingsQuery.error,
		ropeItemsQuery.error,
		ropeInspectionsQuery.error,
		groundLaddersQuery.error,
		groundLadderServiceTestsQuery.error,
		deficienciesQuery.error,
	].filter(Boolean) as Array<{ message?: string | null }>;

	if (queryErrors.length > 0) {
		return buildError("QUERY_ERROR", queryErrors[0]?.message || "Unable to load inspection/testing records.");
	}

	const memberNameById = new Map(
		((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
	);

	const fireHoseById = new Map(
		((fireHoseQuery.data ?? []) as Array<{ id: string; inventory_number: string | null; status: string | null; next_test_date: string | null }>).map((row) => [row.id, row]),
	);
	const scbaCylinderById = new Map(
		((scbaCylindersQuery.data ?? []) as Array<{ id: string; cylinder_number: string | null; status: string | null; last_hydrostatic_test_date: string | null; next_hydrostatic_test_due_date: string | null }>).map((row) => [row.id, row]),
	);
	const scbaPackById = new Map(
		((scbaPacksQuery.data ?? []) as Array<{ id: string; pack_number: string | null; status: string | null; next_flow_test_due_date: string | null }>).map((row) => [row.id, row]),
	);
	const gasMonitorById = new Map(
		((gasMonitorsQuery.data ?? []) as Array<{ id: string; monitor_number: string | null; status: string | null }>).map((row) => [row.id, row]),
	);
	const ropeItemById = new Map(
		((ropeItemsQuery.data ?? []) as Array<{ id: string; rope_name: string | null; rope_identifier: string | null; status: string | null }>).map((row) => [row.id, row]),
	);
	const groundLadderById = new Map(
		((groundLaddersQuery.data ?? []) as Array<{ id: string; ladder_number: string | null; status: string | null }>).map((row) => [row.id, row]),
	);

	const deficiencyRows = (deficienciesQuery.data ?? []) as Array<Record<string, unknown>>;
	const fireHoseOpenCounts = buildOpenDeficiencyCountMap(deficiencyRows, "fire_hose_id");
	const scbaCylinderOpenCounts = buildOpenDeficiencyCountMap(deficiencyRows, "scba_cylinder_id");
	const scbaPackOpenCounts = buildOpenDeficiencyCountMap(deficiencyRows, "scba_pack_id");
	const gasMonitorOpenCounts = buildOpenDeficiencyCountMap(deficiencyRows, "gas_monitor_id");
	const ropeItemOpenCounts = buildOpenDeficiencyCountMap(deficiencyRows, "rope_item_id");
	const groundLadderOpenCounts = buildOpenDeficiencyCountMap(deficiencyRows, "ground_ladder_id");

	const gasCalibrationIntervalMonths =
		typeof gasMonitorCalibrationSettingsQuery.data?.calibration_interval_months === "number"
			? gasMonitorCalibrationSettingsQuery.data.calibration_interval_months
			: null;

	const rows: CentralInspectionRow[] = [];

	for (const row of (fireHoseTestsQuery.data ?? []) as Array<{
		id: string;
		hose_id: string | null;
		test_date: string | null;
		result: string | null;
		tester: string | null;
		inventory_number: string | null;
	}>) {
		const hoseId = normalizeText(row.hose_id);
		if (!hoseId) continue;
		const hose = fireHoseById.get(hoseId);
		rows.push({
			inspectionDateRaw: normalizeText(row.test_date) || null,
			inspectionTypeKey: "fire-hose-testing",
			inspectionTypeLabel: "Fire Hose Testing",
			itemId: hoseId,
			itemName: normalizeText(hose?.inventory_number) || normalizeText(row.inventory_number) || hoseId,
			itemIdentifier: normalizeText(hose?.inventory_number) || normalizeText(row.inventory_number) || "-",
			result: normalizeText(row.result) || "-",
			inspectedBy: normalizeText(row.tester) || "-",
			itemStatus: normalizeText(hose?.status) || "-",
			nextDueDateRaw: normalizeText(hose?.next_test_date) || null,
			openDeficiencies: fireHoseOpenCounts.get(hoseId) ?? 0,
			notes: "-",
		});
	}

	for (const row of (scbaCylindersQuery.data ?? []) as Array<{
		id: string;
		cylinder_number: string | null;
		status: string | null;
		last_hydrostatic_test_date: string | null;
		next_hydrostatic_test_due_date: string | null;
	}>) {
		if (!normalizeText(row.id)) continue;
		rows.push({
			inspectionDateRaw: normalizeText(row.last_hydrostatic_test_date) || null,
			inspectionTypeKey: "scba-cylinder-hydrostatic-testing",
			inspectionTypeLabel: "SCBA Cylinder Hydrostatic Testing",
			itemId: row.id,
			itemName: normalizeText(row.cylinder_number) || row.id,
			itemIdentifier: normalizeText(row.cylinder_number) || "-",
			result: "-",
			inspectedBy: "-",
			itemStatus: normalizeText(row.status) || "-",
			nextDueDateRaw: normalizeText(row.next_hydrostatic_test_due_date) || null,
			openDeficiencies: scbaCylinderOpenCounts.get(row.id) ?? 0,
			notes: "-",
		});
	}

	for (const row of (scbaPackTestsQuery.data ?? []) as Array<{
		id: string;
		scba_pack_id: string | null;
		test_date: string | null;
		tester: string | null;
		result: string | null;
		notes: string | null;
	}>) {
		const packId = normalizeText(row.scba_pack_id);
		if (!packId) continue;
		const pack = scbaPackById.get(packId);
		rows.push({
			inspectionDateRaw: normalizeText(row.test_date) || null,
			inspectionTypeKey: "scba-pack-flow-testing",
			inspectionTypeLabel: "SCBA Pack Flow Testing",
			itemId: packId,
			itemName: normalizeText(pack?.pack_number) || packId,
			itemIdentifier: normalizeText(pack?.pack_number) || "-",
			result: normalizeText(row.result) || "-",
			inspectedBy: normalizeText(row.tester) || "-",
			itemStatus: normalizeText(pack?.status) || "-",
			nextDueDateRaw: normalizeText(pack?.next_flow_test_due_date) || null,
			openDeficiencies: scbaPackOpenCounts.get(packId) ?? 0,
			notes: normalizeText(row.notes) || "-",
		});
	}

	for (const row of (gasMonitorCalibrationsQuery.data ?? []) as Array<{
		id: string;
		gas_monitor_id: string | null;
		calibration_date: string | null;
		result: string | null;
		tester_mode: string | null;
		tester_member_id: string | null;
		external_tester_name: string | null;
		external_tester_company: string | null;
		notes: string | null;
	}>) {
		const monitorId = normalizeText(row.gas_monitor_id);
		if (!monitorId) continue;
		const monitor = gasMonitorById.get(monitorId);
		const calibrationDate = normalizeText(row.calibration_date);
		let nextDueDateRaw: string | null = null;
		if (calibrationDate && gasCalibrationIntervalMonths !== null) {
			const date = new Date(`${calibrationDate}T00:00:00`);
			if (!Number.isNaN(date.getTime())) {
				date.setMonth(date.getMonth() + gasCalibrationIntervalMonths);
				nextDueDateRaw = date.toISOString().slice(0, 10);
			}
		}

		const testerByMember = normalizeText(row.tester_member_id)
			? (memberNameById.get(normalizeText(row.tester_member_id)) ?? normalizeText(row.tester_member_id))
			: "";
		const testerByExternal = [normalizeText(row.external_tester_name), normalizeText(row.external_tester_company)].filter(Boolean).join(" / ");
		rows.push({
			inspectionDateRaw: calibrationDate || null,
			inspectionTypeKey: "gas-monitor-calibration",
			inspectionTypeLabel: "Gas Monitor Calibration",
			itemId: monitorId,
			itemName: normalizeText(monitor?.monitor_number) || monitorId,
			itemIdentifier: normalizeText(monitor?.monitor_number) || "-",
			result: normalizeText(row.result) || "-",
			inspectedBy: testerByMember || testerByExternal || "-",
			itemStatus: normalizeText(monitor?.status) || "-",
			nextDueDateRaw,
			openDeficiencies: gasMonitorOpenCounts.get(monitorId) ?? 0,
			notes: normalizeText(row.notes) || "-",
		});
	}

	for (const row of (ropeInspectionsQuery.data ?? []) as Array<{
		id: string;
		rope_item_id: string | null;
		inspection_date: string | null;
		result: string | null;
		primary_inspector_member_id: string | null;
		notes: string | null;
	}>) {
		const ropeId = normalizeText(row.rope_item_id);
		if (!ropeId) continue;
		const rope = ropeItemById.get(ropeId);
		rows.push({
			inspectionDateRaw: normalizeText(row.inspection_date) || null,
			inspectionTypeKey: "rope-inspections",
			inspectionTypeLabel: "Rope Inspections",
			itemId: ropeId,
			itemName: normalizeText(rope?.rope_name) || normalizeText(rope?.rope_identifier) || ropeId,
			itemIdentifier: normalizeText(rope?.rope_identifier) || "-",
			result: normalizeText(row.result) || "-",
			inspectedBy: normalizeText(row.primary_inspector_member_id)
				? (memberNameById.get(normalizeText(row.primary_inspector_member_id)) ?? normalizeText(row.primary_inspector_member_id))
				: "-",
			itemStatus: normalizeText(rope?.status) || "-",
			nextDueDateRaw: null,
			openDeficiencies: ropeItemOpenCounts.get(ropeId) ?? 0,
			notes: normalizeText(row.notes) || "-",
		});
	}

	for (const row of (groundLadderServiceTestsQuery.data ?? []) as Array<{
		id: string;
		ground_ladder_id: string | null;
		test_date: string | null;
		tester_type: string | null;
		member_id: string | null;
		external_tester_name: string | null;
		company_name: string | null;
		result: string | null;
		notes: string | null;
		next_test_due_date: string | null;
	}>) {
		const ladderId = normalizeText(row.ground_ladder_id);
		if (!ladderId) continue;
		const ladder = groundLadderById.get(ladderId);
		const memberName = normalizeText(row.member_id)
			? (memberNameById.get(normalizeText(row.member_id)) ?? normalizeText(row.member_id))
			: "";
		const externalName = [normalizeText(row.external_tester_name), normalizeText(row.company_name)].filter(Boolean).join(" / ");
		rows.push({
			inspectionDateRaw: normalizeText(row.test_date) || null,
			inspectionTypeKey: "ground-ladder-service-testing",
			inspectionTypeLabel: "Ground Ladder Service Testing",
			itemId: ladderId,
			itemName: normalizeText(ladder?.ladder_number) || ladderId,
			itemIdentifier: normalizeText(ladder?.ladder_number) || "-",
			result: normalizeText(row.result) || "-",
			inspectedBy: memberName || externalName || normalizeText(row.tester_type) || "-",
			itemStatus: normalizeText(ladder?.status) || "-",
			nextDueDateRaw: normalizeText(row.next_test_due_date) || null,
			openDeficiencies: groundLadderOpenCounts.get(ladderId) ?? 0,
			notes: normalizeText(row.notes) || "-",
		});
	}

	if (includeGroundLadderInspection) {
		for (const row of (groundLaddersQuery.data ?? []) as Array<{
			id: string;
			ladder_number: string | null;
			status: string | null;
			notes: string | null;
			updated_at: string | null;
		}>) {
			const ladderId = normalizeText(row.id);
			if (!ladderId) continue;
			const notes = normalizeText(row.notes) ?? "";
			const match = notes.match(/Inspection\s*\(([^)]+)\):\s*(Ready for Duty|Out of Service)/i);
			if (!match) continue;
			const ladder = groundLadderById.get(ladderId);
			rows.push({
				inspectionDateRaw: normalizeText(match[1]) || normalizeText(row.updated_at) || null,
				inspectionTypeKey: "ground-ladder-inspection",
				inspectionTypeLabel: "Ground Ladder Inspection",
				itemId: ladderId,
				itemName: normalizeText(ladder?.ladder_number) || normalizeText(row.ladder_number) || ladderId,
				itemIdentifier: normalizeText(ladder?.ladder_number) || normalizeText(row.ladder_number) || "-",
				result: normalizeText(match[2]) || "-",
				inspectedBy: "-",
				itemStatus: normalizeText(ladder?.status) || normalizeText(row.status) || "-",
				nextDueDateRaw: null,
				openDeficiencies: groundLadderOpenCounts.get(ladderId) ?? 0,
				notes: normalizeText(row.notes) || "-",
			});
		}
	}

	const filteredRows = rows
		.filter((row) => {
			if (reportType !== "all-inspections" && row.inspectionTypeKey !== reportType) {
				return false;
			}

			if (row.inspectionTypeKey === "fire-hose-testing" && fireHoseFilter && fireHoseFilter !== "all" && row.itemId !== fireHoseFilter) {
				return false;
			}
			if (row.inspectionTypeKey === "scba-cylinder-hydrostatic-testing" && scbaCylinderFilter && scbaCylinderFilter !== "all" && row.itemId !== scbaCylinderFilter) {
				return false;
			}
			if (row.inspectionTypeKey === "scba-pack-flow-testing" && scbaPackFilter && scbaPackFilter !== "all" && row.itemId !== scbaPackFilter) {
				return false;
			}
			if (row.inspectionTypeKey === "gas-monitor-calibration" && gasMonitorFilter && gasMonitorFilter !== "all" && row.itemId !== gasMonitorFilter) {
				return false;
			}
			if (row.inspectionTypeKey === "rope-inspections" && ropeItemFilter && ropeItemFilter !== "all" && row.itemId !== ropeItemFilter) {
				return false;
			}
			if ((row.inspectionTypeKey === "ground-ladder-service-testing" || row.inspectionTypeKey === "ground-ladder-inspection") && groundLadderFilter && groundLadderFilter !== "all" && row.itemId !== groundLadderFilter) {
				return false;
			}

			if (inspectionResultFilter && inspectionResultFilter !== "all") {
				const normalized = normalizeInspectionResultValue(row.result);
				const filterNormalized = normalizeInspectionResultValue(inspectionResultFilter);
				if (normalized !== filterNormalized) {
					return false;
				}
			}

			if (dueStatusFilter && dueStatusFilter !== "all") {
				if (classifyDueStatus(row.nextDueDateRaw) !== dueStatusFilter) {
					return false;
				}
			}

			if (!isWithinUtcRange(row.inspectionDateRaw, fromIso, toExclusiveIso)) {
				return false;
			}

			if (!searchTerm) {
				return true;
			}

			const searchable = [
				row.inspectionTypeLabel,
				row.itemName,
				row.itemIdentifier,
				row.result,
				row.inspectedBy,
				row.itemStatus,
				row.notes,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			return searchable.includes(searchTerm);
		})
		.sort((left, right) => {
			const leftTime = getComparableTimestamp(left.inspectionDateRaw) ?? 0;
			const rightTime = getComparableTimestamp(right.inspectionDateRaw) ?? 0;
			return rightTime - leftTime;
		});

	const inspectionTypeCounts = filteredRows.reduce<Map<string, number>>((accumulator, row) => {
		accumulator.set(row.inspectionTypeLabel, (accumulator.get(row.inspectionTypeLabel) ?? 0) + 1);
		return accumulator;
	}, new Map());
	const overdueCount = filteredRows.filter((row) => classifyDueStatus(row.nextDueDateRaw) === "overdue").length;
	const dueSoonCount = filteredRows.filter((row) => classifyDueStatus(row.nextDueDateRaw) === "due_soon").length;
	const openDeficiencyCount = filteredRows.reduce((total, row) => total + row.openDeficiencies, 0);
	const itemCount = new Set(filteredRows.map((row) => `${row.inspectionTypeKey}:${row.itemId}`)).size;

	const summary = [
		{ label: "Inspection/Test Records", value: String(filteredRows.length) },
		{ label: "Items Represented", value: String(itemCount) },
		{ label: "Open Deficiencies", value: String(openDeficiencyCount) },
		{ label: "Overdue", value: String(overdueCount) },
		{ label: "Due Soon", value: String(dueSoonCount) },
		...Array.from(inspectionTypeCounts.entries()).map(([type, count]) => ({
			label: type,
			value: String(count),
		})),
	];

	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = filteredRows.slice(offset, offset + pageSize).map((row): ReportRow => {
		const dueStatus = classifyDueStatus(row.nextDueDateRaw);
		const dueStatusLabel = dueStatus === "overdue"
			? "Overdue"
			: dueStatus === "due_soon"
				? "Due Soon"
				: dueStatus === "current"
					? "Current"
					: "No Due Date";

		return {
			inspection_date: formatDateOnlyLabel(row.inspectionDateRaw),
			inspection_type: row.inspectionTypeLabel,
			item_name: row.itemName,
			item_identifier: row.itemIdentifier,
			result: row.result,
			inspected_by: row.inspectedBy,
			item_status: row.itemStatus,
			next_due_date: formatDateOnlyLabel(row.nextDueDateRaw),
			due_status: dueStatusLabel,
			open_deficiencies: String(row.openDeficiencies),
			notes: row.notes,
		};
	});

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: "Inspection/Test Date",
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: source.columns,
		rows: pagedRows,
		totalRows: filteredRows.length,
		page,
		pageSize,
	};
}

async function runApparatusReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const reportType = normalizeText(request.filters.report_type).toLowerCase() || "overview";
	const apparatusFilter = normalizeText(request.filters.apparatus_id);
	const apparatusStatusFilter = normalizeText(request.filters.apparatus_status).toLowerCase();
	const checkStatusFilter = normalizeText(request.filters.check_status).toLowerCase();
	const inspectedByFilter = normalizeText(request.filters.inspected_by);
	const checkActivityFilter = normalizeText(request.filters.check_activity).toLowerCase();
	const mileageHoursColumnKeys = new Set([
		"reading_date",
		"entry_source",
		"apparatus_name",
		"reading_mileage",
		"reading_engine_hours",
		"checked_by",
		"check_status",
		"check_notes",
	]);
	const overviewColumnKeys = new Set([
		"apparatus_name",
		"apparatus_type",
		"radio_number",
		"apparatus_status",
		"last_inspection_at",
		"current_mileage",
		"current_engine_hours",
		"checks_in_period",
		"ready_checks",
		"needs_attention_checks",
		"out_of_service_checks",
		"latest_check_at",
		"latest_check_by",
		"latest_check_status",
		"latest_check_mileage",
		"latest_check_engine_hours",
		"deficiencies_in_period",
		"open_deficiencies",
		"latest_deficiency_number",
		"latest_deficiency_status",
		"latest_deficiency_priority",
		"latest_deficiency_reported",
		"latest_deficiency_resolved",
		"latest_deficiency_description",
		"maintenance_in_period",
		"latest_maintenance_date",
		"latest_maintenance_number",
		"latest_maintenance_type",
		"latest_maintenance_performed_by",
		"latest_maintenance_mileage",
		"latest_maintenance_engine_hours",
		"latest_maintenance_labor_hours",
		"latest_maintenance_cost",
		"latest_maintenance_deficiency",
	]);
	const pumpTestingColumnKeys = new Set([
		"pump_test_date",
		"apparatus_name",
		"pump_tested_by",
		"pump_test_result",
		"pump_test_notes",
	]);
	const columnsForMode = reportType === "mileage-hours"
		? source.columns.filter((column) => mileageHoursColumnKeys.has(column.key))
		: reportType === "pump-testing"
			? source.columns.filter((column) => pumpTestingColumnKeys.has(column.key))
			: source.columns.filter((column) => overviewColumnKeys.has(column.key));

	const apparatusQuery = await context.supabase
		.from("apparatus")
		.select("id, name, type, radio_number, status, active, last_inspection_at, mileage, engine_hours, created_at, out_of_service_source")
		.eq("department_id", context.departmentId)
		.order("name", { ascending: true });

	if (apparatusQuery.error) {
		return buildError("QUERY_ERROR", apparatusQuery.error.message || "Unable to load apparatus records.");
	}

	const apparatusRows = (apparatusQuery.data ?? []) as ApparatusReportApparatusRow[];
	const apparatusIds = apparatusRows.map((row) => row.id);

	if (apparatusIds.length === 0) {
		if (reportType === "mileage-hours") {
			return {
				ok: true,
				comingSoon: false,
				source: {
					key: source.key,
					name: source.name,
					description: source.description,
				},
				departmentName: context.departmentName,
				generatedAt: new Date().toISOString(),
				period: {
					from: request.dateRange.from,
					to: request.dateRange.to,
					label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
					basisLabel: "Inspection Reading Date (Apparatus Inspection Created At)",
				},
				filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
				summary: [
					{ label: "Readings", value: "0" },
					{ label: "Apparatus With Readings", value: "0" },
				],
				columns: columnsForMode,
				rows: [],
				totalRows: 0,
				page: 1,
				pageSize: 0,
			};
		}

		return {
			ok: true,
			comingSoon: false,
			source: {
				key: source.key,
				name: source.name,
				description: source.description,
			},
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: {
				from: request.dateRange.from,
				to: request.dateRange.to,
				label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
				basisLabel: "Activity Date (Checks=Inspection Date, Deficiencies=Reported Date, Maintenance=Service Date)",
			},
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [
				{ label: "Total Apparatus", value: "0" },
				{ label: "Checks During Period", value: "0" },
				{ label: "Open Deficiencies", value: "0" },
				{ label: "Maintenance Records During Period", value: "0" },
			],
			columns: columnsForMode,
			rows: [],
			totalRows: 0,
			page: 1,
			pageSize: 0,
		};
	}

	if (reportType === "pump-testing") {
		const pumpTestsQuery = await context.supabase
			.from("apparatus_pump_tests")
			.select("id, apparatus_id, test_date, tester_type, tester_member_id, external_tester_name, external_tester_company, result, notes, created_at")
			.eq("department_id", context.departmentId)
			.in("apparatus_id", apparatusIds)
			.order("test_date", { ascending: false })
			.order("created_at", { ascending: false });

		if (pumpTestsQuery.error) {
			return buildError("QUERY_ERROR", pumpTestsQuery.error.message || "Unable to load apparatus pump tests.");
		}

		const pumpTestRows = (pumpTestsQuery.data ?? []) as Array<{
			id: string;
			apparatus_id: string;
			test_date: string | null;
			tester_type: string | null;
			tester_member_id: string | null;
			external_tester_name: string | null;
			external_tester_company: string | null;
			result: string | null;
			notes: string | null;
			created_at: string | null;
		}>;
		const memberIds = Array.from(
			new Set(
				pumpTestRows
					.map((row) => row.tester_member_id)
					.filter((value): value is string => typeof value === "string" && value.length > 0),
			),
		);

		let memberNameById = new Map<string, string>();
		if (memberIds.length > 0) {
			const membersQuery = await context.supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", context.departmentId)
				.in("id", memberIds);

			if (membersQuery.error) {
				return buildError("QUERY_ERROR", membersQuery.error.message || "Unable to resolve pump test members.");
			}

			memberNameById = new Map(
				((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
			);
		}

		const apparatusById = new Map(apparatusRows.map((row) => [row.id, row]));
		const filteredTests = pumpTestRows
			.filter((row) => {
				if (!row.test_date) {
					return false;
				}
				if (!isWithinUtcRange(row.test_date, fromIso, toExclusiveIso)) {
					return false;
				}
				if (apparatusFilter && apparatusFilter !== "all" && row.apparatus_id !== apparatusFilter) {
					return false;
				}
				if (!searchTerm) {
					return true;
				}
				const apparatus = apparatusById.get(row.apparatus_id);
				const testerName = row.tester_type === "External Tester"
					? [normalizeText(row.external_tester_name), normalizeText(row.external_tester_company)].filter(Boolean).join(" ")
					: row.tester_member_id
						? (memberNameById.get(row.tester_member_id) ?? row.tester_member_id)
						: "Unknown";
				const searchable = [
					apparatus?.name,
					row.result,
					testerName,
					row.notes,
					row.tester_type,
				].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
				return searchable.includes(searchTerm);
			})
			.sort((left, right) => {
				const leftTime = getComparableTimestamp(left.test_date ?? left.created_at ?? "") ?? 0;
				const rightTime = getComparableTimestamp(right.test_date ?? right.created_at ?? "") ?? 0;
				return rightTime - leftTime;
			});

		const summary = [
			{ label: "Pump Tests", value: String(filteredTests.length) },
			{ label: "Pass", value: String(filteredTests.filter((row) => normalizeText(row.result).toLowerCase() === "pass").length) },
			{ label: "Fail", value: String(filteredTests.filter((row) => normalizeText(row.result).toLowerCase() === "fail").length) },
		];

		const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
		const page = Math.max(1, Number(request.page) || 1);
		const offset = (page - 1) * pageSize;
		const pagedRows = filteredTests.slice(offset, offset + pageSize).map((row): ReportRow => {
			const apparatus = apparatusById.get(row.apparatus_id);
			const testerName = row.tester_type === "External Tester"
				? [normalizeText(row.external_tester_name), normalizeText(row.external_tester_company)].filter(Boolean).join(" / ") || "External Tester"
				: row.tester_member_id
					? (memberNameById.get(row.tester_member_id) ?? row.tester_member_id)
					: "Unknown";
			return {
				pump_test_date: row.test_date ? formatDateTimeLabel(row.test_date) : "-",
				apparatus_name: normalizeText(apparatus?.name) || row.apparatus_id,
				pump_tested_by: testerName,
				pump_test_result: normalizeText(row.result) || "-",
				pump_test_notes: normalizeText(row.notes) || "-",
			};
		});

		return {
			ok: true,
			comingSoon: false,
			source: {
				key: source.key,
				name: source.name,
				description: source.description,
			},
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: {
				from: request.dateRange.from,
				to: request.dateRange.to,
				label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
				basisLabel: "Pump Test Date",
			},
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary,
			columns: columnsForMode,
			rows: pagedRows,
			totalRows: filteredTests.length,
			page,
			pageSize,
		};
	}

	if (reportType === "mileage-hours") {
		const [inspectionsQuery, maintenanceQuery] = await Promise.all([
			context.supabase
				.from("apparatus_inspections")
				.select("id, apparatus_id, member_id, status, notes, created_at, mileage, engine_hours")
				.eq("department_id", context.departmentId)
				.in("apparatus_id", apparatusIds)
				.order("created_at", { ascending: false }),
			context.supabase
				.from("maintenance_records")
				.select("id, apparatus_id, completed_by, service_date, maintenance_number, maintenance_type, notes, mileage, engine_hours")
				.eq("department_id", context.departmentId)
				.in("apparatus_id", apparatusIds)
				.order("service_date", { ascending: false }),
		]);

		if (inspectionsQuery.error || maintenanceQuery.error) {
			return buildError(
				"QUERY_ERROR",
				inspectionsQuery.error?.message ||
					maintenanceQuery.error?.message ||
					"Unable to load apparatus mileage and hours history.",
			);
		}

		const inspectionRows = (inspectionsQuery.data ?? []) as ApparatusInspectionRow[];
		const maintenanceRows = (maintenanceQuery.data ?? []) as Array<{
			id: string;
			apparatus_id: string;
			completed_by: string | null;
			service_date: string;
			maintenance_number: string | null;
			maintenance_type: string | null;
			notes: string | null;
			mileage: number | null;
			engine_hours: number | string | null;
		}>;
		const memberIds = Array.from(
			new Set(
				[
					...inspectionRows.map((row) => row.member_id),
					...maintenanceRows.map((row) => row.completed_by),
				]
					.filter((value): value is string => typeof value === "string" && value.length > 0),
			),
		);

		const membersQuery = memberIds.length > 0
			? await context.supabase
					.from("members")
					.select("id, first_name, last_name")
					.eq("department_id", context.departmentId)
					.in("id", memberIds)
			: { data: [] as MemberNameRow[], error: null };

		if (membersQuery.error) {
			return buildError(
				"QUERY_ERROR",
				membersQuery.error.message || "Unable to resolve mileage and hours recorders.",
			);
		}

		const apparatusById = new Map(apparatusRows.map((row) => [row.id, row]));
		const memberNameById = new Map(
			((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
		);

		type MileageHoursEntry = {
			entrySource: "Inspection" | "Maintenance";
			apparatusId: string;
			recordedAt: string;
			mileage: number | null;
			engineHours: number | null;
			recordedBy: string | null;
			statusOrType: string | null;
			notes: string | null;
		};

		const rawEntries: MileageHoursEntry[] = [
			...inspectionRows.map((row) => ({
				entrySource: "Inspection" as const,
				apparatusId: row.apparatus_id,
				recordedAt: row.created_at,
				mileage: row.mileage,
				engineHours: parseNullableNumber(row.engine_hours),
				recordedBy: row.member_id,
				statusOrType: row.status,
				notes: row.notes,
			})),
			...maintenanceRows.map((row) => ({
				entrySource: "Maintenance" as const,
				apparatusId: row.apparatus_id,
				recordedAt: row.service_date,
				mileage: row.mileage,
				engineHours: parseNullableNumber(row.engine_hours),
				recordedBy: row.completed_by,
				statusOrType: normalizeText(row.maintenance_type) || null,
				notes: [normalizeText(row.maintenance_number), normalizeText(row.notes)].filter(Boolean).join(" | ") || null,
			})),
		];

		const filteredReadings = rawEntries
			.filter((row) => {
				if (!isWithinUtcRange(row.recordedAt, fromIso, toExclusiveIso)) {
					return false;
				}

				if (apparatusFilter && apparatusFilter !== "all" && row.apparatusId !== apparatusFilter) {
					return false;
				}

				if (inspectedByFilter && inspectedByFilter !== "all" && row.recordedBy !== inspectedByFilter) {
					return false;
				}

				if (row.mileage === null && row.engineHours === null) {
					return false;
				}

				if (!searchTerm) {
					return true;
				}

				const apparatus = apparatusById.get(row.apparatusId);
				const checkedBy = row.recordedBy ? (memberNameById.get(row.recordedBy) ?? row.recordedBy) : "Unknown";
				const searchable = [
					row.entrySource,
					apparatus?.name,
					apparatus?.type,
					checkedBy,
					row.statusOrType,
					row.notes,
					row.mileage === null ? "" : String(row.mileage),
					row.engineHours === null ? "" : String(row.engineHours),
				]
					.map((value) => normalizeText(value).toLowerCase())
					.filter(Boolean)
					.join(" ");

				return searchable.includes(searchTerm);
			})
			.sort((left, right) => {
				const leftTime = getComparableTimestamp(left.recordedAt) ?? 0;
				const rightTime = getComparableTimestamp(right.recordedAt) ?? 0;
				return rightTime - leftTime;
			});

		const readingsByApparatusId = new Map<string, MileageHoursEntry[]>();
		for (const row of filteredReadings) {
			const current = readingsByApparatusId.get(row.apparatusId) ?? [];
			current.push(row);
			readingsByApparatusId.set(row.apparatusId, current);
		}

		let apparatusWithMileageDelta = 0;
		let apparatusWithEngineHourDelta = 0;
		let totalMileageDelta = 0;
		let totalEngineHourDelta = 0;

		for (const apparatusReadings of readingsByApparatusId.values()) {
			const chronological = [...apparatusReadings].sort((left, right) => {
				const leftTime = getComparableTimestamp(left.recordedAt) ?? 0;
				const rightTime = getComparableTimestamp(right.recordedAt) ?? 0;
				return leftTime - rightTime;
			});

			const mileageEntries = chronological.filter((row): row is MileageHoursEntry & { mileage: number } => typeof row.mileage === "number");
			if (mileageEntries.length >= 2) {
				const firstMileage = mileageEntries[0].mileage;
				const lastMileage = mileageEntries[mileageEntries.length - 1].mileage;
				apparatusWithMileageDelta += 1;
				totalMileageDelta += (lastMileage - firstMileage);
			}

			const hourEntries = chronological
				.map((row) => ({
					timestamp: getComparableTimestamp(row.recordedAt) ?? 0,
					engineHours: row.engineHours,
				}))
				.filter((item): item is { timestamp: number; engineHours: number } => typeof item.engineHours === "number")
				.sort((left, right) => left.timestamp - right.timestamp);

			if (hourEntries.length >= 2) {
				const firstHours = hourEntries[0].engineHours;
				const lastHours = hourEntries[hourEntries.length - 1].engineHours;
				apparatusWithEngineHourDelta += 1;
				totalEngineHourDelta += (lastHours - firstHours);
			}
		}

		const mostRecentReading = filteredReadings[0] ?? null;
		const oldestReading = filteredReadings[filteredReadings.length - 1] ?? null;
		const summary = [
			{ label: "Readings", value: String(filteredReadings.length) },
			{ label: "Apparatus With Readings", value: String(readingsByApparatusId.size) },
			{ label: "Most Recent Reading", value: mostRecentReading ? formatDateTimeLabel(mostRecentReading.recordedAt) : "-" },
			{ label: "First Reading In Period", value: oldestReading ? formatDateTimeLabel(oldestReading.recordedAt) : "-" },
			{ label: "Mileage Change (Sum By Apparatus)", value: `${formatMileageValue(Math.round(totalMileageDelta))} mi across ${apparatusWithMileageDelta}` },
			{ label: "Engine Hours Change (Sum By Apparatus)", value: `${formatHoursValue(totalEngineHourDelta)} hrs across ${apparatusWithEngineHourDelta}` },
		];

		const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
		const page = Math.max(1, Number(request.page) || 1);
		const offset = (page - 1) * pageSize;
		const pagedRows = filteredReadings.slice(offset, offset + pageSize).map((row): ReportRow => {
			const apparatus = apparatusById.get(row.apparatusId);
			const checkedBy = row.recordedBy ? (memberNameById.get(row.recordedBy) ?? row.recordedBy) : "Unknown";
			const statusOrType = row.entrySource === "Inspection"
				? normalizeApparatusStatusLabel(row.statusOrType)
				: normalizeText(row.statusOrType) || "Maintenance";

			return {
				reading_date: formatDateTimeLabel(row.recordedAt),
				entry_source: row.entrySource,
				apparatus_name: normalizeText(apparatus?.name) || row.apparatusId,
				reading_mileage: typeof row.mileage === "number" ? `${formatMileageValue(row.mileage)} mi` : "-",
				reading_engine_hours: row.engineHours === null ? "-" : `${formatHoursValue(row.engineHours)} hrs`,
				checked_by: checkedBy,
				check_status: statusOrType,
				check_notes: normalizeText(row.notes) || "-",
			};
		});

		return {
			ok: true,
			comingSoon: false,
			source: {
				key: source.key,
				name: source.name,
				description: source.description,
			},
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: {
				from: request.dateRange.from,
				to: request.dateRange.to,
				label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
				basisLabel: "Inspection Reading Date (Apparatus Inspection Created At)",
			},
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary,
			columns: columnsForMode,
			rows: pagedRows,
			totalRows: filteredReadings.length,
			page,
			pageSize,
		};
	}

	const [inspectionsQuery, deficienciesQuery, maintenanceQuery] = await Promise.all([
		context.supabase
			.from("apparatus_inspections")
			.select("id, apparatus_id, member_id, status, notes, created_at, mileage, engine_hours")
			.eq("department_id", context.departmentId)
			.in("apparatus_id", apparatusIds)
			.order("created_at", { ascending: false }),
		context.supabase
			.from("deficiencies")
			.select(
				"id, apparatus_id, deficiency_number, description, reported_at, resolved_at, reported_by, status_info:deficiency_statuses!fk_deficiencies_status(name), priority_info:deficiency_priorities!fk_deficiencies_priority(name)",
			)
			.in("apparatus_id", apparatusIds)
			.order("reported_at", { ascending: false }),
		context.supabase
			.from("maintenance_records")
			.select("id, maintenance_number, apparatus_id, deficiency_id, maintenance_type, completed_by, service_date, description, parts_used, labor_hours, mileage, engine_hours, cost, notes, photos, attachments, created_at, updated_at")
			.eq("department_id", context.departmentId)
			.in("apparatus_id", apparatusIds)
			.order("service_date", { ascending: false }),
	]);

	if (inspectionsQuery.error || deficienciesQuery.error || maintenanceQuery.error) {
		return buildError(
			"QUERY_ERROR",
			inspectionsQuery.error?.message ||
				deficienciesQuery.error?.message ||
				maintenanceQuery.error?.message ||
				"Unable to load apparatus activity history.",
		);
	}

	const inspectionRows = (inspectionsQuery.data ?? []) as ApparatusInspectionRow[];
	const deficiencyRows = (deficienciesQuery.data ?? []) as ApparatusDeficiencyRow[];
	const maintenanceRows = (maintenanceQuery.data ?? []) as MaintenanceRecordRow[];

	const memberIds = Array.from(
		new Set(
			[
				...inspectionRows.map((row) => row.member_id),
				...deficiencyRows.map((row) => row.reported_by),
				...maintenanceRows.map((row) => row.completed_by),
			]
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);

	let memberNameById = new Map<string, string>();
	if (memberIds.length > 0) {
		const membersQuery = await context.supabase
			.from("members")
			.select("id, first_name, last_name")
			.eq("department_id", context.departmentId)
			.in("id", memberIds);

		if (membersQuery.error) {
			return buildError("QUERY_ERROR", membersQuery.error.message || "Unable to resolve apparatus activity members.");
		}

		memberNameById = new Map(
			((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
		);
	}

	const deficienciesByApparatus = new Map<string, ApparatusDeficiencyRow[]>();
	for (const row of deficiencyRows) {
		if (!row.apparatus_id) {
			continue;
		}

		const existing = deficienciesByApparatus.get(row.apparatus_id) ?? [];
		existing.push(row);
		deficienciesByApparatus.set(row.apparatus_id, existing);
	}

	const inspectionsByApparatus = new Map<string, ApparatusInspectionRow[]>();
	for (const row of inspectionRows) {
		const existing = inspectionsByApparatus.get(row.apparatus_id) ?? [];
		existing.push(row);
		inspectionsByApparatus.set(row.apparatus_id, existing);
	}

	const maintenanceByApparatus = new Map<string, MaintenanceRecordRow[]>();
	for (const row of maintenanceRows) {
		const existing = maintenanceByApparatus.get(row.apparatus_id) ?? [];
		existing.push(row);
		maintenanceByApparatus.set(row.apparatus_id, existing);
	}

	const apparatusEvaluations = apparatusRows
		.map((apparatus) => {
			const apparatusInspections = inspectionsByApparatus.get(apparatus.id) ?? [];
			const apparatusDeficiencies = deficienciesByApparatus.get(apparatus.id) ?? [];
			const apparatusMaintenance = maintenanceByApparatus.get(apparatus.id) ?? [];

			const checksInPeriod = apparatusInspections.filter((row) => isWithinUtcRange(row.created_at, fromIso, toExclusiveIso));
			const deficienciesInPeriod = apparatusDeficiencies.filter((row) => isWithinUtcRange(row.reported_at, fromIso, toExclusiveIso));
			const maintenanceInPeriod = apparatusMaintenance.filter((row) => isWithinUtcRange(row.service_date, fromIso, toExclusiveIso));

			const latestCheckInPeriod = checksInPeriod[0] ?? null;
			const latestDeficiencyInPeriod = deficienciesInPeriod[0] ?? null;
			const latestMaintenanceInPeriod = maintenanceInPeriod[0] ?? null;

			const readyChecks = checksInPeriod.filter((row) => normalizeText(row.status).toLowerCase() === "ready").length;
			const needsAttentionChecks = checksInPeriod.filter((row) => normalizeText(row.status).toLowerCase() === "needs_attention").length;
			const outOfServiceChecks = checksInPeriod.filter((row) => normalizeText(row.status).toLowerCase() === "out_of_service").length;

			const openDeficiencies = apparatusDeficiencies.filter((row) => {
				const statusName = normalizeText(normalizeRelation<{ name: string | null }>(row.status_info)?.name);
				return statusName ? isOpenDeficiencyStatus(statusName) : true;
			}).length;

			const latestDeficiencyStatus = normalizeText(normalizeRelation<{ name: string | null }>(latestDeficiencyInPeriod?.status_info)?.name) || "-";
			const latestDeficiencyPriority = normalizeText(normalizeRelation<{ name: string | null }>(latestDeficiencyInPeriod?.priority_info)?.name) || "-";

			const latestMaintenancePerformer = latestMaintenanceInPeriod?.completed_by
				? (memberNameById.get(latestMaintenanceInPeriod.completed_by) ?? latestMaintenanceInPeriod.completed_by)
				: "-";

			const latestCheckPerformer = latestCheckInPeriod?.member_id
				? (memberNameById.get(latestCheckInPeriod.member_id) ?? latestCheckInPeriod.member_id)
				: "-";

			const latestMaintenanceCost = parseNullableNumber(latestMaintenanceInPeriod?.cost);
			const latestMaintenanceEngineHours = parseNullableNumber(latestMaintenanceInPeriod?.engine_hours);
			const latestMaintenanceLaborHours = parseNullableNumber(latestMaintenanceInPeriod?.labor_hours);

			const latestMaintenanceDeficiency = latestMaintenanceInPeriod?.deficiency_id
				? (normalizeText(apparatusDeficiencies.find((row) => row.id === latestMaintenanceInPeriod.deficiency_id)?.deficiency_number) || latestMaintenanceInPeriod.deficiency_id)
				: "-";

			return {
				apparatus,
				checksInPeriod,
				deficienciesInPeriod,
				maintenanceInPeriod,
				readyChecks,
				needsAttentionChecks,
				outOfServiceChecks,
				openDeficiencies,
				latestCheckInPeriod,
				latestCheckPerformer,
				latestDeficiencyInPeriod,
				latestDeficiencyStatus,
				latestDeficiencyPriority,
				latestMaintenanceInPeriod,
				latestMaintenancePerformer,
				latestMaintenanceCost,
				latestMaintenanceEngineHours,
				latestMaintenanceLaborHours,
				latestMaintenanceDeficiency,
			};
		})
		.filter((item) => {
			if (apparatusFilter && apparatusFilter !== "all" && item.apparatus.id !== apparatusFilter) {
				return false;
			}

			if (apparatusStatusFilter && apparatusStatusFilter !== "all") {
				const normalizedStatus = normalizeText(item.apparatus.status).toLowerCase();
				if (normalizedStatus !== apparatusStatusFilter) {
					return false;
				}
			}

			if (checkStatusFilter && checkStatusFilter !== "all") {
				const hasMatchingCheck = item.checksInPeriod.some((row) => normalizeText(row.status).toLowerCase() === checkStatusFilter);
				if (!hasMatchingCheck) {
					return false;
				}
			}

			if (inspectedByFilter && inspectedByFilter !== "all") {
				const hasMatchingInspector = item.checksInPeriod.some((row) => row.member_id === inspectedByFilter);
				if (!hasMatchingInspector) {
					return false;
				}
			}

			if (checkActivityFilter === "with-checks" && item.checksInPeriod.length === 0) {
				return false;
			}

			if (checkActivityFilter === "without-checks" && item.checksInPeriod.length > 0) {
				return false;
			}

			if (!searchTerm) {
				return true;
			}

			const searchable = [
				item.apparatus.name,
				item.apparatus.type,
				item.apparatus.radio_number,
				item.apparatus.status,
				item.latestCheckPerformer,
				item.latestCheckInPeriod?.status,
				item.latestCheckInPeriod?.notes,
				item.latestDeficiencyInPeriod?.deficiency_number,
				item.latestDeficiencyStatus,
				item.latestDeficiencyPriority,
				item.latestDeficiencyInPeriod?.description,
				item.latestMaintenanceInPeriod?.maintenance_number,
				item.latestMaintenanceInPeriod?.maintenance_type,
				item.latestMaintenanceInPeriod?.description,
				item.latestMaintenanceInPeriod?.parts_used,
				item.latestMaintenanceInPeriod?.notes,
				item.latestMaintenancePerformer,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			return searchable.includes(searchTerm);
		});

	const summary = [
		{ label: "Total Apparatus", value: String(apparatusEvaluations.length) },
		{ label: "Current Ready", value: String(apparatusEvaluations.filter((item) => normalizeText(item.apparatus.status).toLowerCase() === "ready").length) },
		{ label: "Current Needs Attention", value: String(apparatusEvaluations.filter((item) => normalizeText(item.apparatus.status).toLowerCase() === "needs_attention").length) },
		{ label: "Current Out of Service", value: String(apparatusEvaluations.filter((item) => normalizeText(item.apparatus.status).toLowerCase() === "out_of_service").length) },
		{ label: "Checks During Period", value: String(apparatusEvaluations.reduce((total, item) => total + item.checksInPeriod.length, 0)) },
		{ label: "Ready Checks", value: String(apparatusEvaluations.reduce((total, item) => total + item.readyChecks, 0)) },
		{ label: "Needs Attention Checks", value: String(apparatusEvaluations.reduce((total, item) => total + item.needsAttentionChecks, 0)) },
		{ label: "Out of Service Checks", value: String(apparatusEvaluations.reduce((total, item) => total + item.outOfServiceChecks, 0)) },
		{ label: "Open Deficiencies", value: String(apparatusEvaluations.reduce((total, item) => total + item.openDeficiencies, 0)) },
		{ label: "Maintenance Records During Period", value: String(apparatusEvaluations.reduce((total, item) => total + item.maintenanceInPeriod.length, 0)) },
		{ label: "Apparatus With Mileage", value: String(apparatusEvaluations.filter((item) => typeof item.apparatus.mileage === "number").length) },
		{ label: "Apparatus With Engine Hours", value: String(apparatusEvaluations.filter((item) => parseNullableNumber(item.apparatus.engine_hours) !== null).length) },
	];

	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = apparatusEvaluations.slice(offset, offset + pageSize).map((item): ReportRow => {
		const currentEngineHours = parseNullableNumber(item.apparatus.engine_hours);
		const latestMaintenanceMileage = item.latestMaintenanceInPeriod?.mileage;

		return {
			apparatus_name: normalizeText(item.apparatus.name) || item.apparatus.id,
			apparatus_type: normalizeText(item.apparatus.type) || "-",
			radio_number: normalizeText(item.apparatus.radio_number) || "-",
			apparatus_status: normalizeApparatusStatusLabel(item.apparatus.status),
			last_inspection_at: formatDateTimeLabel(item.apparatus.last_inspection_at),
			current_mileage: typeof item.apparatus.mileage === "number" ? `${formatMileageValue(item.apparatus.mileage)} mi` : "-",
			current_engine_hours: currentEngineHours === null ? "-" : `${formatHoursValue(currentEngineHours)} hrs`,
			checks_in_period: String(item.checksInPeriod.length),
			ready_checks: String(item.readyChecks),
			needs_attention_checks: String(item.needsAttentionChecks),
			out_of_service_checks: String(item.outOfServiceChecks),
			latest_check_at: item.latestCheckInPeriod ? formatDateTimeLabel(item.latestCheckInPeriod.created_at) : "-",
			latest_check_by: item.latestCheckPerformer,
			latest_check_status: item.latestCheckInPeriod ? normalizeApparatusStatusLabel(item.latestCheckInPeriod.status) : "-",
			latest_check_mileage: item.latestCheckInPeriod?.mileage === null || item.latestCheckInPeriod?.mileage === undefined ? "-" : `${formatMileageValue(item.latestCheckInPeriod.mileage)} mi`,
			latest_check_engine_hours: item.latestCheckInPeriod?.engine_hours === null || item.latestCheckInPeriod?.engine_hours === undefined ? "-" : `${formatHoursValue(parseNullableNumber(item.latestCheckInPeriod.engine_hours) ?? 0)} hrs`,
			deficiencies_in_period: String(item.deficienciesInPeriod.length),
			open_deficiencies: String(item.openDeficiencies),
			latest_deficiency_number: normalizeText(item.latestDeficiencyInPeriod?.deficiency_number) || "-",
			latest_deficiency_status: item.latestDeficiencyStatus,
			latest_deficiency_priority: item.latestDeficiencyPriority,
			latest_deficiency_reported: item.latestDeficiencyInPeriod?.reported_at ? formatDateTimeLabel(item.latestDeficiencyInPeriod.reported_at) : "-",
			latest_deficiency_resolved: item.latestDeficiencyInPeriod?.resolved_at ? formatDateTimeLabel(item.latestDeficiencyInPeriod.resolved_at) : "-",
			latest_deficiency_description: normalizeText(item.latestDeficiencyInPeriod?.description) || "-",
			maintenance_in_period: String(item.maintenanceInPeriod.length),
			latest_maintenance_date: item.latestMaintenanceInPeriod ? formatDateTimeLabel(item.latestMaintenanceInPeriod.service_date) : "-",
			latest_maintenance_number: normalizeText(item.latestMaintenanceInPeriod?.maintenance_number) || "-",
			latest_maintenance_type: normalizeText(item.latestMaintenanceInPeriod?.maintenance_type) || "-",
			latest_maintenance_performed_by: item.latestMaintenancePerformer,
			latest_maintenance_mileage: typeof latestMaintenanceMileage === "number" ? `${formatMileageValue(latestMaintenanceMileage)} mi` : "-",
			latest_maintenance_engine_hours: item.latestMaintenanceEngineHours === null ? "-" : `${formatHoursValue(item.latestMaintenanceEngineHours)} hrs`,
			latest_maintenance_labor_hours: item.latestMaintenanceLaborHours === null ? "-" : `${formatHoursValue(item.latestMaintenanceLaborHours)} hrs`,
			latest_maintenance_cost: item.latestMaintenanceCost === null
				? "-"
				: new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}).format(item.latestMaintenanceCost),
			latest_maintenance_deficiency: item.latestMaintenanceDeficiency,
		};
	});

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: "Activity Date (Checks=Inspection Date, Deficiencies=Reported Date, Maintenance=Service Date)",
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: columnsForMode,
		rows: pagedRows,
		totalRows: apparatusEvaluations.length,
		page,
		pageSize,
	};
}

async function runMaintenanceReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const apparatusFilter = normalizeText(request.filters.apparatus_id);
	const maintenanceTypeFilter = normalizeText(request.filters.maintenance_type).toLowerCase();
	const completedByFilter = normalizeText(request.filters.completed_by);
	const linkedDeficiencyFilter = normalizeText(request.filters.linked_deficiency).toLowerCase();

	const maintenanceQuery = await context.supabase
		.from("maintenance_records")
		.select(
			"id, maintenance_number, apparatus_id, deficiency_id, maintenance_type, completed_by, service_date, description, parts_used, labor_hours, mileage, engine_hours, cost, notes, photos, attachments, created_at, updated_at",
		)
		.eq("department_id", context.departmentId)
		.order("service_date", { ascending: false });

	if (maintenanceQuery.error) {
		return buildError("QUERY_ERROR", maintenanceQuery.error.message || "Unable to load maintenance records.");
	}

	const maintenanceRows = (maintenanceQuery.data ?? []) as MaintenanceRecordRow[];
	const apparatusIds = Array.from(new Set(maintenanceRows.map((row) => row.apparatus_id).filter(Boolean)));
	const memberIds = Array.from(
		new Set(
			maintenanceRows
				.map((row) => row.completed_by)
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);
	const deficiencyIds = Array.from(
		new Set(
			maintenanceRows
				.map((row) => row.deficiency_id)
				.filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);

	const [apparatusQuery, membersQuery, deficienciesQuery] = await Promise.all([
		apparatusIds.length > 0
			? context.supabase
					.from("apparatus")
					.select("id, name, type, radio_number")
					.eq("department_id", context.departmentId)
					.in("id", apparatusIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		memberIds.length > 0
			? context.supabase
					.from("members")
					.select("id, first_name, last_name")
					.eq("department_id", context.departmentId)
					.in("id", memberIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		deficiencyIds.length > 0
			? context.supabase
					.from("deficiencies")
					.select("id, deficiency_number")
					.eq("department_id", context.departmentId)
					.in("id", deficiencyIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
	]);

	if (apparatusQuery.error || membersQuery.error || deficienciesQuery.error) {
		return buildError(
			"QUERY_ERROR",
			apparatusQuery.error?.message ||
				membersQuery.error?.message ||
				deficienciesQuery.error?.message ||
				"Unable to resolve maintenance relationships.",
		);
	}

	const apparatusById = new Map(
		((apparatusQuery.data ?? []) as MaintenanceApparatusRow[]).map((row) => [row.id, row]),
	);
	const allowedApparatusIds = new Set(apparatusById.keys());
	const memberNameById = new Map(
		((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
	);
	const deficiencyById = new Map(
		((deficienciesQuery.data ?? []) as MaintenanceDeficiencyRow[]).map((row) => [row.id, normalizeText(row.deficiency_number)]),
	);

	const filtered = maintenanceRows
		.filter((row) => {
			if (!allowedApparatusIds.has(row.apparatus_id)) {
				return false;
			}

			if (apparatusFilter && apparatusFilter !== "all" && row.apparatus_id !== apparatusFilter) {
				return false;
			}

			if (maintenanceTypeFilter && maintenanceTypeFilter !== "all") {
				if (normalizeText(row.maintenance_type).toLowerCase() !== maintenanceTypeFilter) {
					return false;
				}
			}

			if (completedByFilter && completedByFilter !== "all" && row.completed_by !== completedByFilter) {
				return false;
			}

			if (linkedDeficiencyFilter === "linked" && !row.deficiency_id) {
				return false;
			}

			if (linkedDeficiencyFilter === "unlinked" && row.deficiency_id) {
				return false;
			}

			if (!isWithinUtcRange(row.service_date, fromIso, toExclusiveIso)) {
				return false;
			}

			if (!searchTerm) {
				return true;
			}

			const apparatus = apparatusById.get(row.apparatus_id);
			const performedBy = row.completed_by
				? (memberNameById.get(row.completed_by) ?? row.completed_by)
				: "";
			const relatedDeficiency = row.deficiency_id
				? (deficiencyById.get(row.deficiency_id) ?? row.deficiency_id)
				: "";

			const searchable = [
				row.maintenance_number,
				apparatus?.name,
				apparatus?.type,
				apparatus?.radio_number,
				row.maintenance_type,
				row.description,
				row.parts_used,
				row.notes,
				performedBy,
				relatedDeficiency,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			return searchable.includes(searchTerm);
		})
		.sort((left, right) => {
			const leftTime = getComparableTimestamp(left.service_date) ?? 0;
			const rightTime = getComparableTimestamp(right.service_date) ?? 0;
			return rightTime - leftTime;
		});

	const linkedCount = filtered.filter((row) => Boolean(row.deficiency_id)).length;
	const unlinkedCount = filtered.length - linkedCount;
	const typeCountMap = filtered.reduce<Map<string, number>>((accumulator, row) => {
		const typeLabel = normalizeText(row.maintenance_type) || "Unspecified";
		accumulator.set(typeLabel, (accumulator.get(typeLabel) ?? 0) + 1);
		return accumulator;
	}, new Map());

	const summary = [
		{ label: "Maintenance Records", value: String(filtered.length) },
		{ label: "Linked to Deficiency", value: String(linkedCount) },
		{ label: "No Deficiency Link", value: String(unlinkedCount) },
		...Array.from(typeCountMap.entries())
			.sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: "base" }))
			.map(([typeLabel, count]) => ({ label: `Type: ${typeLabel}`, value: String(count) })),
	];

		const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = filtered.slice(offset, offset + pageSize).map((row): ReportRow => {
		const apparatus = apparatusById.get(row.apparatus_id);
		const relatedDeficiencyNumber = row.deficiency_id ? (deficiencyById.get(row.deficiency_id) ?? row.deficiency_id) : "-";
		const performedBy = row.completed_by
			? (memberNameById.get(row.completed_by) ?? row.completed_by)
			: "-";
		const laborHours = parseNullableNumber(row.labor_hours);
		const engineHours = parseNullableNumber(row.engine_hours);
		const cost = parseNullableNumber(row.cost);

		return {
			service_date: formatDateTimeLabel(row.service_date),
			maintenance_number: normalizeText(row.maintenance_number) || "Pending",
			apparatus_name: normalizeText(apparatus?.name) || row.apparatus_id,
			maintenance_type: normalizeText(row.maintenance_type) || "-",
			description: normalizeText(row.description) || "-",
			performed_by: performedBy,
			mileage: typeof row.mileage === "number" ? String(row.mileage) : "-",
			engine_hours: engineHours === null ? "-" : formatHoursValue(engineHours),
			labor_hours: laborHours === null ? "-" : formatHoursValue(laborHours),
			cost: cost === null
				? "-"
				: new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}).format(cost),
			related_deficiency: relatedDeficiencyNumber || "-",
			parts_used: normalizeText(row.parts_used) || "-",
			notes: normalizeText(row.notes) || "-",
			photo_count: Array.isArray(row.photos) ? String(row.photos.length) : "0",
			attachment_count: Array.isArray(row.attachments) ? String(row.attachments.length) : "0",
		};
	});

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: getMaintenancePeriodBasisLabel(),
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: source.columns,
		rows: pagedRows,
		totalRows: filtered.length,
		page,
		pageSize,
	};
}

async function runPrePlansReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const dateBasisFilter = normalizeText(request.filters.date_basis).toLowerCase() || "updated-date";

	const { data: prePlanRows, error: prePlanError } = await context.supabase
		.from("pre_plans")
		.select(
			"id, department_id, business_name, address, city, state, zip, occupancy_id_number, primary_contact_name, primary_contact_phone, normal_occupant_load, critical_information, last_verified_at, updated_at, created_at",
		)
		.eq("department_id", context.departmentId)
		.order("business_name", { ascending: true });

	if (prePlanError) {
		return buildError("QUERY_ERROR", prePlanError.message || "Unable to load pre-plans.");
	}

	const plans = (prePlanRows ?? []) as PrePlanRow[];
	const planIds = plans.map((row) => row.id);

	const [hydrantCountsQuery, hazardCountsQuery] = await Promise.all([
		planIds.length > 0
			? context.supabase
					.from("pre_plan_hydrants")
					.select("pre_plan_id, id")
					.eq("department_id", context.departmentId)
					.in("pre_plan_id", planIds)
			: Promise.resolve({ data: [] as Array<{ pre_plan_id: string; id: string }>, error: null }),
		planIds.length > 0
			? context.supabase
					.from("pre_plan_hazards")
					.select("pre_plan_id, id")
					.eq("department_id", context.departmentId)
					.in("pre_plan_id", planIds)
			: Promise.resolve({ data: [] as Array<{ pre_plan_id: string; id: string }>, error: null }),
	]);

	if (hydrantCountsQuery.error || hazardCountsQuery.error) {
		return buildError(
			"QUERY_ERROR",
			hydrantCountsQuery.error?.message ||
				hazardCountsQuery.error?.message ||
				"Unable to load pre-plan supporting counts.",
		);
	}

	const hydrantCountByPlan = new Map<string, number>();
	for (const item of hydrantCountsQuery.data ?? []) {
		const key = String(item.pre_plan_id);
		hydrantCountByPlan.set(key, (hydrantCountByPlan.get(key) ?? 0) + 1);
	}

	const hazardCountByPlan = new Map<string, number>();
	for (const item of hazardCountsQuery.data ?? []) {
		const key = String(item.pre_plan_id);
		hazardCountByPlan.set(key, (hazardCountByPlan.get(key) ?? 0) + 1);
	}

	const filtered = plans.filter((row) => {
		if (dateBasisFilter === "updated-date" && !isWithinUtcRange(row.updated_at ?? row.created_at, fromIso, toExclusiveIso)) {
			return false;
		}

		if (!searchTerm) {
			return true;
		}

		const searchable = [
			row.business_name,
			row.address,
			row.city,
			row.state,
			row.zip,
			row.occupancy_id_number,
			row.primary_contact_name,
			row.primary_contact_phone,
			row.normal_occupant_load,
			row.critical_information,
			row.last_verified_at,
		].map((value) => normalizeText(value).toLowerCase()).join(" ");

		return searchable.includes(searchTerm);
	});

	const summary = [
		{ label: "Pre-Plans", value: String(filtered.length) },
		{ label: "Updated", value: String(filtered.length) },
	];

		const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = filtered.slice(offset, offset + pageSize).map((row): ReportRow => {
		const hydrants = hydrantCountByPlan.get(row.id) ?? 0;
		const hazards = hazardCountByPlan.get(row.id) ?? 0;
		return {
			business_name: normalizeText(row.business_name) || "Unknown",
			address: normalizeText(row.address) || "-",
			city: normalizeText(row.city) || "-",
			state: normalizeText(row.state) || "-",
			zip: normalizeText(row.zip) || "-",
			occupancy_id_number: normalizeText(row.occupancy_id_number) || "-",
			last_verified_at: row.last_verified_at ? formatDateTimeLabel(row.last_verified_at) : "-",
			updated_at: row.updated_at ? formatDateTimeLabel(row.updated_at) : row.created_at ? formatDateTimeLabel(row.created_at) : "-",
			primary_contact_name: normalizeText(row.primary_contact_name) || "-",
			primary_contact_phone: normalizeText(row.primary_contact_phone) || "-",
			normal_occupant_load: row.normal_occupant_load === null || row.normal_occupant_load === undefined ? "-" : String(row.normal_occupant_load),
			hydrant_count: String(hydrants),
			hazard_count: String(hazards),
			critical_information: normalizeText(row.critical_information) || "-",
		};
	});

	const periodBasisLabel = dateBasisFilter === "updated-date" ? "Updated Date" : "Activity Date";

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: periodBasisLabel,
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: source.columns,
		rows: pagedRows,
		totalRows: filtered.length,
		page,
		pageSize,
	};
}

async function runActivityReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const memberFilter = normalizeText(request.filters.member_id);
	const moduleFilter = normalizeText(request.filters.module).toLowerCase();
	const actionFilter = normalizeText(request.filters.action).toLowerCase();

	const apparatusQuery = await context.supabase
		.from("apparatus")
		.select("id")
		.eq("department_id", context.departmentId);

	if (apparatusQuery.error) {
		return buildError("QUERY_ERROR", apparatusQuery.error.message || "Unable to scope activity data by department.");
	}

	const apparatusIds = (apparatusQuery.data ?? [])
		.map((item) => (typeof (item as Record<string, unknown>).id === "string" ? ((item as Record<string, unknown>).id as string) : ""))
		.filter(Boolean);

	const [
		calendarQuery,
		deficienciesQuery,
		apparatusInspectionsQuery,
		maintenanceQuery,
		trainingEventsQuery,
		outsideSubmissionsQuery,
		memberCertificationsQuery,
		prePlansQuery,
	] = await Promise.all([
		context.supabase
			.from("department_calendar_activities")
			.select("id, title, activity_type, status, start_at, created_at, updated_at, created_by")
			.eq("department_id", context.departmentId)
			.order("start_at", { ascending: false }),
		context.supabase
			.from("deficiencies")
			.select("id, deficiency_number, description, reported_at, resolved_at, reported_by, resolved_by, status_info:deficiency_statuses!fk_deficiencies_status(name)")
			.eq("department_id", context.departmentId)
			.order("reported_at", { ascending: false }),
		context.supabase
			.from("apparatus_inspections")
			.select("id, member_id, status, notes, created_at, apparatus:apparatus_id(name)")
			.eq("department_id", context.departmentId)
			.order("created_at", { ascending: false }),
		apparatusIds.length > 0
			? context.supabase
					.from("maintenance_records")
					.select("id, maintenance_number, maintenance_type, service_date, description, completed_by")
					.eq("department_id", context.departmentId)
					.in("apparatus_id", apparatusIds)
					.order("service_date", { ascending: false })
			: Promise.resolve({ data: [] as unknown[], error: null }),
		context.supabase
			.from("training_events")
			.select("id, title, status, starts_at, created_by, updated_by, created_at, updated_at")
			.eq("department_id", context.departmentId)
			.order("starts_at", { ascending: false }),
		context.supabase
			.from("training_outside_submissions")
			.select("id, title, status, member_id, reviewed_by, reviewed_at, created_at")
			.eq("department_id", context.departmentId)
			.order("created_at", { ascending: false }),
		context.supabase
			.from("member_certifications")
			.select("id, member_id, created_by, updated_by, created_at, updated_at, certification:certification_id(name)")
			.eq("department_id", context.departmentId)
			.order("created_at", { ascending: false }),
		context.supabase
			.from("pre_plans")
			.select("id, business_name, created_by, updated_by, created_at, updated_at")
			.eq("department_id", context.departmentId)
			.order("updated_at", { ascending: false }),
	]);

	if (
		calendarQuery.error ||
		deficienciesQuery.error ||
		apparatusInspectionsQuery.error ||
		maintenanceQuery.error ||
		trainingEventsQuery.error ||
		outsideSubmissionsQuery.error ||
		memberCertificationsQuery.error ||
		prePlansQuery.error
	) {
		return buildError(
			"QUERY_ERROR",
			calendarQuery.error?.message ||
				deficienciesQuery.error?.message ||
				apparatusInspectionsQuery.error?.message ||
				maintenanceQuery.error?.message ||
				trainingEventsQuery.error?.message ||
				outsideSubmissionsQuery.error?.message ||
				memberCertificationsQuery.error?.message ||
				prePlansQuery.error?.message ||
				"Unable to load activity events.",
		);
	}

	const calendarRows = (calendarQuery.data ?? []) as CalendarActivityRow[];
	const deficiencyRows = (deficienciesQuery.data ?? []) as ActivityDeficiencyRow[];
	const apparatusInspectionRows = (apparatusInspectionsQuery.data ?? []) as ActivityApparatusInspectionRow[];
	const maintenanceRows = (maintenanceQuery.data ?? []) as Array<{
		id: string;
		maintenance_number: string | null;
		maintenance_type: string | null;
		service_date: string;
		description: string | null;
		completed_by: string | null;
	}>;
	const trainingEventRows = (trainingEventsQuery.data ?? []) as ActivityTrainingEventRow[];
	const outsideSubmissionRows = (outsideSubmissionsQuery.data ?? []) as ActivityTrainingOutsideSubmissionRow[];
	const memberCertificationRows = (memberCertificationsQuery.data ?? []) as ActivityMemberCertificationRow[];
	const prePlanRows = (prePlansQuery.data ?? []) as ActivityPrePlanRow[];

	const memberIds = Array.from(
		new Set(
			[
				...calendarRows.map((row) => row.created_by),
				...deficiencyRows.map((row) => row.reported_by),
				...deficiencyRows.map((row) => row.resolved_by),
				...apparatusInspectionRows.map((row) => row.member_id),
				...maintenanceRows.map((row) => row.completed_by),
				...trainingEventRows.map((row) => row.created_by),
				...trainingEventRows.map((row) => row.updated_by),
				...outsideSubmissionRows.map((row) => row.member_id),
				...outsideSubmissionRows.map((row) => row.reviewed_by),
				...memberCertificationRows.map((row) => row.member_id),
				...memberCertificationRows.map((row) => row.created_by),
				...memberCertificationRows.map((row) => row.updated_by),
				...prePlanRows.map((row) => row.created_by),
				...prePlanRows.map((row) => row.updated_by),
			].filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);

	const membersQuery = memberIds.length > 0
		? await context.supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", context.departmentId)
				.in("id", memberIds)
		: { data: [] as MemberNameRow[], error: null };

	if (membersQuery.error) {
		return buildError("QUERY_ERROR", membersQuery.error.message || "Unable to resolve activity member names.");
	}

	const memberNameById = new Map(
		((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
	);

	type TimelineEvent = {
		activityDateRaw: string;
		memberId: string | null;
		memberName: string;
		module: string;
		action: string;
		description: string;
		relatedItem: string;
	};

	const events: TimelineEvent[] = [];

	function addEvent(event: Omit<TimelineEvent, "memberName">) {
		if (!isWithinUtcRange(event.activityDateRaw, fromIso, toExclusiveIso)) {
			return;
		}

		if (memberFilter && memberFilter !== "all" && event.memberId !== memberFilter) {
			return;
		}

		const moduleValue = normalizeText(event.module).toLowerCase();
		if (moduleFilter && moduleFilter !== "all" && moduleValue !== moduleFilter) {
			return;
		}

		const actionValue = normalizeText(event.action).toLowerCase();
		if (actionFilter && actionFilter !== "all" && actionValue !== actionFilter) {
			return;
		}

		const memberName = event.memberId ? (memberNameById.get(event.memberId) ?? event.memberId) : "Unknown";

		if (searchTerm) {
			const searchable = [
				event.module,
				event.action,
				event.description,
				event.relatedItem,
				memberName,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			if (!searchable.includes(searchTerm)) {
				return;
			}
		}

		events.push({
			...event,
			memberName,
		});
	}

	for (const row of calendarRows) {
		const title = normalizeText(row.title) || "Calendar Activity";
		const activityType = normalizeText(row.activity_type);
		const status = normalizeText(row.status);
		const details = [activityType, status].filter(Boolean).join(" | ");

		addEvent({
			activityDateRaw: row.created_at,
			memberId: row.created_by,
			module: "Calendar",
			action: "Created",
			description: details ? `${title} (${details})` : title,
			relatedItem: title,
		});

		if (row.updated_at && row.updated_at !== row.created_at) {
			addEvent({
				activityDateRaw: row.updated_at,
				memberId: row.created_by,
				module: "Calendar",
				action: "Updated",
				description: `Calendar activity updated: ${title}`,
				relatedItem: title,
			});
		}

		if (row.start_at) {
			addEvent({
				activityDateRaw: row.start_at,
				memberId: row.created_by,
				module: "Calendar",
				action: "Scheduled",
				description: `Scheduled calendar activity: ${title}`,
				relatedItem: title,
			});
		}
	}

	for (const row of deficiencyRows) {
		const deficiencyNumber = normalizeText(row.deficiency_number) || row.id;
		const description = normalizeText(row.description) || "Deficiency reported";
		const statusName = normalizeText(normalizeRelation<{ name: string | null }>(row.status_info)?.name);

		if (row.reported_at) {
			addEvent({
				activityDateRaw: row.reported_at,
				memberId: row.reported_by,
				module: "Deficiencies",
				action: "Reported",
				description,
				relatedItem: deficiencyNumber,
			});
		}

		if (row.resolved_at) {
			addEvent({
				activityDateRaw: row.resolved_at,
				memberId: row.resolved_by,
				module: "Deficiencies",
				action: "Resolved",
				description: statusName ? `Deficiency ${statusName.toLowerCase()}` : "Deficiency resolved",
				relatedItem: deficiencyNumber,
			});
		}
	}

	for (const row of apparatusInspectionRows) {
		const apparatusName = normalizeText(normalizeRelation<{ name: string | null }>(row.apparatus)?.name) || "Apparatus";
		addEvent({
			activityDateRaw: row.created_at,
			memberId: row.member_id,
			module: "Apparatus Checks",
			action: "Completed",
			description: normalizeText(row.status) ? `Inspection ${normalizeText(row.status).toLowerCase()}` : "Inspection completed",
			relatedItem: apparatusName,
		});
	}

	for (const row of maintenanceRows) {
		addEvent({
			activityDateRaw: row.service_date,
			memberId: row.completed_by,
			module: "Maintenance",
			action: "Completed",
			description: normalizeText(row.description) || "Maintenance completed",
			relatedItem: normalizeText(row.maintenance_number) || normalizeText(row.maintenance_type) || row.id,
		});
	}

	for (const row of trainingEventRows) {
		const title = normalizeText(row.title) || "Training Event";
		const status = normalizeText(row.status);

		addEvent({
			activityDateRaw: row.created_at,
			memberId: row.created_by,
			module: "Training",
			action: "Created",
			description: status ? `${title} (${status})` : title,
			relatedItem: title,
		});

		if (row.updated_at && row.updated_at !== row.created_at) {
			addEvent({
				activityDateRaw: row.updated_at,
				memberId: row.updated_by ?? row.created_by,
				module: "Training",
				action: "Updated",
				description: `Training event updated: ${title}`,
				relatedItem: title,
			});
		}

		if (row.starts_at) {
			addEvent({
				activityDateRaw: row.starts_at,
				memberId: row.created_by,
				module: "Training",
				action: "Scheduled",
				description: `Training scheduled: ${title}`,
				relatedItem: title,
			});
		}
	}

	for (const row of outsideSubmissionRows) {
		const title = normalizeText(row.title) || "Outside Training";
		const status = normalizeText(row.status);

		addEvent({
			activityDateRaw: row.created_at,
			memberId: row.member_id,
			module: "Training",
			action: "Submitted",
			description: status ? `Outside training submitted (${status})` : "Outside training submitted",
			relatedItem: title,
		});

		if (row.reviewed_at) {
			addEvent({
				activityDateRaw: row.reviewed_at,
				memberId: row.reviewed_by,
				module: "Training",
				action: "Reviewed",
				description: `Outside training reviewed: ${title}`,
				relatedItem: title,
			});
		}
	}

	for (const row of memberCertificationRows) {
		const certificationName = normalizeText(normalizeRelation<{ name: string | null }>(row.certification)?.name) || "Certification";
		const holderName = memberNameById.get(row.member_id) ?? row.member_id;

		addEvent({
			activityDateRaw: row.created_at,
			memberId: row.created_by ?? row.member_id,
			module: "Certifications",
			action: "Created",
			description: `Certification record created for ${holderName}`,
			relatedItem: certificationName,
		});

		if (row.updated_at && row.updated_at !== row.created_at) {
			addEvent({
				activityDateRaw: row.updated_at,
				memberId: row.updated_by,
				module: "Certifications",
				action: "Updated",
				description: `Certification record updated for ${holderName}`,
				relatedItem: certificationName,
			});
		}
	}

	for (const row of prePlanRows) {
		const businessName = normalizeText(row.business_name) || "Pre-Plan";

		if (row.created_at) {
			addEvent({
				activityDateRaw: row.created_at,
				memberId: row.created_by,
				module: "Pre-Plans",
				action: "Created",
				description: `Pre-plan created: ${businessName}`,
				relatedItem: businessName,
			});
		}

		if (row.updated_at && row.updated_at !== row.created_at) {
			addEvent({
				activityDateRaw: row.updated_at,
				memberId: row.updated_by,
				module: "Pre-Plans",
				action: "Updated",
				description: `Pre-plan updated: ${businessName}`,
				relatedItem: businessName,
			});
		}
	}

	events.sort((left, right) => {
		const leftTime = getComparableTimestamp(left.activityDateRaw) ?? 0;
		const rightTime = getComparableTimestamp(right.activityDateRaw) ?? 0;
		return rightTime - leftTime;
	});

	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = events.slice(offset, offset + pageSize).map((event): ReportRow => ({
		activity_date: formatDateTimeLabel(event.activityDateRaw),
		member_name: event.memberName,
		module: event.module,
		action: event.action,
		description: event.description,
		related_item: event.relatedItem,
	}));

	const uniqueMembers = new Set(events.map((event) => event.memberId).filter(Boolean));
	const uniqueModules = new Set(events.map((event) => event.module));

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: "Recorded Activity Timestamp",
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary: [
			{ label: "Total Events", value: String(events.length) },
			{ label: "Members Involved", value: String(uniqueMembers.size) },
			{ label: "Modules", value: String(uniqueModules.size) },
			{ label: "Most Recent Activity", value: events[0] ? formatDateTimeLabel(events[0].activityDateRaw) : "-" },
		],
		columns: source.columns,
		rows: pagedRows,
		totalRows: events.length,
		page,
		pageSize,
	};
}

async function runPersonnelReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const statusFilter = normalizeText(request.filters.status).toLowerCase();
	const roleFilter = normalizeText(request.filters.role_id);
	const stationFilter = normalizeText(request.filters.station);
	const shiftFilter = normalizeText(request.filters.shift);

	const [membersQuery, rolesQuery] = await Promise.all([
		context.supabase
			.from("members")
			.select("id, department_id, first_name, last_name, email, phone, rank, role, status, active, station, shift, department_role_id, created_at")
			.eq("department_id", context.departmentId)
			.order("last_name", { ascending: true })
			.order("first_name", { ascending: true }),
		context.supabase
			.from("department_roles")
			.select("id, name")
			.eq("department_id", context.departmentId)
			.eq("active", true)
			.order("name", { ascending: true }),
	]);

	if (membersQuery.error || rolesQuery.error) {
		return buildError(
			"QUERY_ERROR",
			membersQuery.error?.message || rolesQuery.error?.message || "Unable to load personnel roster.",
		);
	}

	const roleNameById = new Map(
		((rolesQuery.data ?? []) as Array<{ id: string; name: string | null }>).map((role) => [role.id, normalizeText(role.name) || "Unknown Role"]),
	);

	const rows = ((membersQuery.data ?? []) as Array<{
		id: string;
		first_name: string | null;
		last_name: string | null;
		email: string | null;
		phone: string | null;
		rank: string | null;
		role: string | null;
		status: string | null;
		active: boolean | null;
		station: string | null;
		shift: string | null;
		department_role_id: string | null;
		created_at: string | null;
	}>).filter((member) => {
		if (statusFilter === "active" && member.active !== true) return false;
		if (statusFilter === "inactive" && member.active !== false) return false;
		if (roleFilter && roleFilter !== "all") {
			const matchesRoleId = member.department_role_id === roleFilter;
			const roleName = normalizeText(member.role) || roleNameById.get(member.department_role_id ?? "") || "";
			const roleMatch = matchesRoleId || roleName === roleFilter || String(member.department_role_id ?? "") === roleFilter;
			if (!roleMatch) return false;
		}
		if (stationFilter && stationFilter !== "all" && normalizeText(member.station) !== stationFilter) {
			return false;
		}
		if (shiftFilter && shiftFilter !== "all" && normalizeText(member.shift) !== shiftFilter) {
			return false;
		}

		if (!searchTerm) return true;

		const nameValue = `${normalizeText(member.first_name)} ${normalizeText(member.last_name)}`.trim();
		const roleValue = normalizeText(member.role) || roleNameById.get(member.department_role_id ?? "") || "";
		const searchable = [
			nameValue,
			normalizeText(member.first_name),
			normalizeText(member.last_name),
			normalizeText(member.email),
			normalizeText(member.rank),
			roleValue,
			normalizeText(member.station),
			normalizeText(member.shift),
			normalizeText(member.status),
		].join(" ").toLowerCase();

		return searchable.includes(searchTerm);
	});

	const totalActive = rows.filter((row) => row.active === true).length;
	const totalInactive = rows.filter((row) => row.active === false).length;
	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = rows.slice(offset, offset + pageSize).map((member): ReportRow => {
		let departmentRoleName = normalizeText(member.role) || "Unknown Role";
		if (member.department_role_id) {
			const mappedRoleName = roleNameById.get(member.department_role_id);
			departmentRoleName = mappedRoleName || normalizeText(member.role) || "Unknown Role";
		}
		return {
			member_name: `${normalizeText(member.first_name)} ${normalizeText(member.last_name)}`.trim() || member.id,
			role_name: departmentRoleName,
			rank: normalizeText(member.rank) || "-",
			status: normalizeText(member.status) || (member.active === true ? "Active" : "Inactive"),
			email: normalizeText(member.email) || "-",
			phone: normalizeText(member.phone) || "-",
			station: normalizeText(member.station) || "-",
			shift: normalizeText(member.shift) || "-",
			active: member.active === true ? "Yes" : member.active === false ? "No" : "-",
		};
	});

	const summary = [
		{ label: "Total Personnel", value: String(rows.length) },
		{ label: "Active", value: String(totalActive) },
		{ label: "Inactive", value: String(totalInactive) },
	];

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: "Roster",
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		columns: source.columns,
		rows: pagedRows,
		totalRows: rows.length,
		page,
		pageSize,
	};
}

async function runTrainingReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const memberFilter = normalizeText(request.filters.member_id);
	const categoryFilter = normalizeText(request.filters.category_id);

	const [attendanceQuery, outsideQuery, assignmentMemberQuery] = await Promise.all([
		context.supabase
			.from("training_event_attendance")
			.select("id, training_event_id, member_id, attendance_status, completion_status")
			.eq("department_id", context.departmentId)
			.eq("attendance_status", "attending"),
		context.supabase
			.from("training_outside_submissions")
			.select("id, member_id, title, category_id, training_date, hours, description, notes, status")
			.eq("department_id", context.departmentId)
			.eq("status", "approved"),
		context.supabase
			.from("training_assignment_members")
			.select("id, training_assignment_id, member_id, completion_status, hours_earned, completed_at, updated_at, created_at")
			.eq("department_id", context.departmentId)
			.eq("completion_status", "approved"),
	]);

	if (attendanceQuery.error || outsideQuery.error || assignmentMemberQuery.error) {
		return buildError(
			"QUERY_ERROR",
			attendanceQuery.error?.message ||
				outsideQuery.error?.message ||
				assignmentMemberQuery.error?.message ||
				"Unable to load training records.",
		);
	}

	const attendanceRows = (attendanceQuery.data ?? []) as TrainingEventAttendanceRow[];
	const outsideRows = (outsideQuery.data ?? []) as TrainingOutsideSubmissionRow[];
	const assignmentMemberRows = (assignmentMemberQuery.data ?? []) as TrainingAssignmentMemberRow[];

	const eventIds = Array.from(new Set(attendanceRows.map((row) => row.training_event_id).filter(Boolean)));
	const assignmentIds = Array.from(
		new Set(assignmentMemberRows.map((row) => row.training_assignment_id).filter(Boolean)),
	);

	const [eventsQuery, assignmentsQuery] = await Promise.all([
		eventIds.length > 0
			? context.supabase
					.from("training_events")
					.select("id, title, category_id, training_type, location, instructor_name, starts_at, hours_credit, status")
					.eq("department_id", context.departmentId)
					.in("id", eventIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		assignmentIds.length > 0
			? context.supabase
					.from("training_assignments")
					.select("id, title, category_id, hours_credit, description")
					.eq("department_id", context.departmentId)
					.in("id", assignmentIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
	]);

	if (eventsQuery.error || assignmentsQuery.error) {
		return buildError(
			"QUERY_ERROR",
			eventsQuery.error?.message || assignmentsQuery.error?.message || "Unable to load training metadata.",
		);
	}

	const eventRows = (eventsQuery.data ?? []) as TrainingEventRow[];
	const assignmentRows = (assignmentsQuery.data ?? []) as TrainingAssignmentRow[];

	const memberIds = Array.from(
		new Set(
			[...attendanceRows.map((row) => row.member_id), ...outsideRows.map((row) => row.member_id), ...assignmentMemberRows.map((row) => row.member_id)].filter(Boolean),
		),
	);

	const categoryIds = Array.from(
		new Set(
			[
				...eventRows.map((row) => row.category_id),
				...outsideRows.map((row) => row.category_id),
				...assignmentRows.map((row) => row.category_id),
			].filter((value): value is string => typeof value === "string" && value.length > 0),
		),
	);

	const [membersQuery, categoriesQuery] = await Promise.all([
		memberIds.length > 0
			? context.supabase
					.from("members")
					.select("id, first_name, last_name")
					.eq("department_id", context.departmentId)
					.in("id", memberIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
		categoryIds.length > 0
			? context.supabase
					.from("training_categories")
					.select("id, name")
					.eq("department_id", context.departmentId)
					.in("id", categoryIds)
			: Promise.resolve({ data: [] as unknown[], error: null }),
	]);

	if (membersQuery.error || categoriesQuery.error) {
		return buildError(
			"QUERY_ERROR",
			membersQuery.error?.message || categoriesQuery.error?.message || "Unable to resolve training labels.",
		);
	}

	const memberNameById = new Map(
		((membersQuery.data ?? []) as MemberNameRow[]).map((member) => [member.id, formatMemberName(member)]),
	);
	const eventById = new Map(eventRows.map((row) => [row.id, row]));
	const assignmentById = new Map(assignmentRows.map((row) => [row.id, row]));
	const categoryNameById = new Map(
		((categoriesQuery.data ?? []) as TrainingCategoryRow[]).map((category) => [category.id, normalizeText(category.name) || "Uncategorized"]),
	);

	const records: TrainingRecord[] = [];

	for (const row of attendanceRows) {
		const event = eventById.get(row.training_event_id);
		if (!event || !event.starts_at) {
			continue;
		}

		records.push({
			id: `event-${row.id}`,
			sourceType: "Department Event",
			trainingDateRaw: event.starts_at,
			memberId: row.member_id,
			memberName: memberNameById.get(row.member_id) ?? row.member_id,
			trainingName: normalizeText(event.title) || "Department Training",
			categoryId: event.category_id,
			categoryName: event.category_id ? (categoryNameById.get(event.category_id) ?? "Uncategorized") : "Uncategorized",
			hours: parseHoursValue(event.hours_credit),
			instructorName: normalizeText(event.instructor_name) || "-",
			trainingType: normalizeText(event.training_type) || "-",
			location: normalizeText(event.location) || "-",
			searchableDescription: "",
		});
	}

	for (const row of outsideRows) {
		if (!row.training_date) {
			continue;
		}

		records.push({
			id: `outside-${row.id}`,
			sourceType: "Outside Submission",
			trainingDateRaw: row.training_date,
			memberId: row.member_id,
			memberName: memberNameById.get(row.member_id) ?? row.member_id,
			trainingName: normalizeText(row.title) || "Outside Training",
			categoryId: row.category_id,
			categoryName: row.category_id ? (categoryNameById.get(row.category_id) ?? "Uncategorized") : "Uncategorized",
			hours: parseHoursValue(row.hours),
			instructorName: "-",
			trainingType: "Outside Submission",
			location: "-",
			searchableDescription: `${normalizeText(row.description)} ${normalizeText(row.notes)}`.trim(),
		});
	}

	for (const row of assignmentMemberRows) {
		const assignment = assignmentById.get(row.training_assignment_id);
		if (!assignment) {
			continue;
		}

		const assignedHours = parseHoursValue(assignment.hours_credit);
		const earnedHours = parseHoursValue(row.hours_earned);
		const completedAt = row.completed_at || row.updated_at || row.created_at;
		if (!completedAt) {
			continue;
		}

		records.push({
			id: `assignment-${row.id}`,
			sourceType: "Assigned Training",
			trainingDateRaw: completedAt,
			memberId: row.member_id,
			memberName: memberNameById.get(row.member_id) ?? row.member_id,
			trainingName: normalizeText(assignment.title) || "Assigned Training",
			categoryId: assignment.category_id,
			categoryName: assignment.category_id ? (categoryNameById.get(assignment.category_id) ?? "Uncategorized") : "Uncategorized",
			hours: earnedHours > 0 ? earnedHours : assignedHours,
			instructorName: "-",
			trainingType: "Assigned Training",
			location: "-",
			searchableDescription: normalizeText(assignment.description),
		});
	}

	const filteredRecords = records
		.filter((record) => {
			if (memberFilter && memberFilter !== "all" && record.memberId !== memberFilter) {
				return false;
			}

			if (categoryFilter && categoryFilter !== "all" && record.categoryId !== categoryFilter) {
				return false;
			}

			if (!isWithinUtcRange(record.trainingDateRaw, fromIso, toExclusiveIso)) {
				return false;
			}

			if (!searchTerm) {
				return true;
			}

			const searchable = [
				record.memberName,
				record.trainingName,
				record.categoryName,
				record.instructorName,
				record.trainingType,
				record.sourceType,
				record.location,
				record.searchableDescription,
			]
				.map((value) => normalizeText(value).toLowerCase())
				.filter(Boolean)
				.join(" ");

			return searchable.includes(searchTerm);
		})
		.sort((left, right) => {
			const leftTime = getComparableTimestamp(left.trainingDateRaw) ?? 0;
			const rightTime = getComparableTimestamp(right.trainingDateRaw) ?? 0;
			return rightTime - leftTime;
		});

	const totalHours = filteredRecords.reduce((total, record) => total + record.hours, 0);
	const filteredMemberIds = Array.from(new Set(filteredRecords.map((record) => record.memberId).filter(Boolean)));
	const memberDirectoryById = new Map<string, string>();

	if (filteredMemberIds.length > 0) {
		const admin = createSupabaseAdminClient();
		const memberDirectoryQuery = await admin
			.from("members")
			.select("id, first_name, last_name")
			.eq("department_id", context.departmentId)
			.in("id", filteredMemberIds);

		if (memberDirectoryQuery.error) {
			return buildError(
				"QUERY_ERROR",
				memberDirectoryQuery.error.message || "Unable to resolve Training member names.",
			);
		}

		for (const member of (memberDirectoryQuery.data ?? []) as MemberNameRow[]) {
			const memberName = `${normalizeText(member.first_name)} ${normalizeText(member.last_name)}`.trim();
			if (memberName) {
				memberDirectoryById.set(member.id, memberName);
			}
		}
	}

	const memberBreakdownById = new Map<string, {
		memberId: string;
		memberName: string;
		totalHours: number;
		recordCount: number;
	}>();

	for (const record of filteredRecords) {
		const memberName = memberDirectoryById.get(record.memberId);
		if (!memberName) {
			return buildError(
				"QUERY_ERROR",
				`Unable to resolve Training member ${record.memberId} within the report department.`,
			);
		}

		const current = memberBreakdownById.get(record.memberId) ?? {
			memberId: record.memberId,
			memberName,
			totalHours: 0,
			recordCount: 0,
		};
		current.totalHours += record.hours;
		current.recordCount += 1;
		memberBreakdownById.set(record.memberId, current);
	}

	const memberBreakdown = Array.from(memberBreakdownById.values()).sort((left, right) => {
		if (right.totalHours !== left.totalHours) {
			return right.totalHours - left.totalHours;
		}
		return left.memberName.localeCompare(right.memberName, undefined, { sensitivity: "base" });
	});

	const categoryBreakdownByKey = new Map<string, {
		categoryId: string | null;
		categoryName: string;
		totalHours: number;
		recordCount: number;
	}>();

	for (const record of filteredRecords) {
		const categoryKey = record.categoryId ?? `name:${record.categoryName}`;
		const current = categoryBreakdownByKey.get(categoryKey) ?? {
			categoryId: record.categoryId,
			categoryName: record.categoryName,
			totalHours: 0,
			recordCount: 0,
		};
		current.totalHours += record.hours;
		current.recordCount += 1;
		categoryBreakdownByKey.set(categoryKey, current);
	}

	const categoryBreakdown = Array.from(categoryBreakdownByKey.values()).sort((left, right) => {
		if (right.totalHours !== left.totalHours) {
			return right.totalHours - left.totalHours;
		}
		return left.categoryName.localeCompare(right.categoryName, undefined, { sensitivity: "base" });
	});
	const pageSize = request.pageSize === 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = filteredRecords.slice(offset, offset + pageSize).map((record): ReportRow => ({
		training_date: formatDateOnlyLabel(record.trainingDateRaw),
		member_name: record.memberName,
		training_name: record.trainingName,
		category_name: record.categoryName,
		hours: formatHoursValue(record.hours),
		instructor_name: record.instructorName,
		training_type: record.trainingType.replaceAll(" | ", " • "),
		source_type: record.sourceType,
	}));

	const memberTotals = new Map<string, number>();
	for (const record of filteredRecords) {
		memberTotals.set(record.memberName, (memberTotals.get(record.memberName) ?? 0) + record.hours);
	}

	const topMemberSummaries = Array.from(memberTotals.entries())
		.sort((left, right) => right[1] - left[1])
		.slice(0, 5)
		.map(([name, hours]) => `${name}: ${formatHoursValue(hours)} hrs`);

	const summary = [
		{ label: "Total Hours", value: `${formatHoursValue(totalHours)} hrs` },
		{ label: "Training Records", value: String(filteredRecords.length) },
		...(topMemberSummaries.length > 0 ? [{ label: "Top Member Totals", value: topMemberSummaries.join(" | ") }] : []),
	];

	return {
		ok: true,
		comingSoon: false,
		source: {
			key: source.key,
			name: source.name,
			description: source.description,
		},
		departmentName: context.departmentName,
		generatedAt: new Date().toISOString(),
		period: {
			from: request.dateRange.from,
			to: request.dateRange.to,
			label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to),
			basisLabel: getTrainingPeriodBasisLabel(),
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary,
		breakdowns: {
			members: memberBreakdown,
			categories: categoryBreakdown,
		},
		columns: source.columns,
		rows: pagedRows,
		totalRows: filteredRecords.length,
		page,
		pageSize,
	};
}

function resolveDateRange(request: ReportRunRequest):
	| { ok: true; value: { from: string; to: string } }
	| { ok: false; error: ReportErrorPayload } {
	const preset = request.dateRange?.preset;
	if (!preset) {
		return {
			ok: false,
			error: buildError("INVALID_DATE_RANGE", "Date preset is required."),
		};
	}

	if (preset === "custom") {
		const from = normalizeText(request.dateRange.from);
		const to = normalizeText(request.dateRange.to);
		if (!from || !to) {
			return {
				ok: false,
				error: buildError("INVALID_DATE_RANGE", "Custom date ranges require both from and to dates."),
			};
		}

		const fromParts = parseDateOnly(from);
		const toParts = parseDateOnly(to);
		if (!fromParts || !toParts) {
			return {
				ok: false,
				error: buildError("INVALID_DATE_RANGE", "Custom date range values are invalid."),
			};
		}

		return { ok: true, value: { from, to } };
	}

	return {
		ok: true,
		value: buildDateRangeFromPreset(preset),
	};
}

export async function runReport(
	request: ReportRunRequest,
	context: ReportContext,
): Promise<ReportRunResponse> {
	const source = getReportSourceConfig(request.category);
	if (!source) {
		return buildError("SOURCE_NOT_FOUND", "Select a valid report category.");
	}

	const dateRangeResult = resolveDateRange(request);
	if (!dateRangeResult.ok) {
		return dateRangeResult.error;
	}
	const dateRange = dateRangeResult.value;

	const utcBounds = buildUtcBoundsForDateRange(dateRange.from, dateRange.to);
	if (!utcBounds) {
		return buildError("INVALID_DATE_RANGE", "From date must be on or before To date.");
	}

	if (source.availability === "coming-soon") {
		return {
			ok: true,
			comingSoon: true,
			source: {
				key: source.key,
				name: source.name,
				description: source.description,
			},
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: {
				from: dateRange.from,
				to: dateRange.to,
				label: formatReportPeriodLabel(dateRange.from, dateRange.to),
				basisLabel: "Activity Date",
			},
			filtersApplied: [],
			columns: [],
			rows: [],
			totalRows: 0,
			page: 1,
			pageSize: 0,
			message: "This report is coming soon.",
		};
	}

	if (source.key === "deficiencies") {
		return runDeficiencyReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "personnel") {
		return runPersonnelReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "training") {
		return runTrainingReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "certifications") {
		return runCertificationReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "inspections") {
		return runInspectionsReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "apparatus") {
		return runApparatusReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "inventory") {
		return runInventoryReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "maintenance") {
		return runMaintenanceReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "pre-plans") {
		return runPrePlansReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "activity") {
		return runActivityReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	if (source.key === "ems") {
		return runEmsReport(
			request,
			context,
			source,
			utcBounds.fromIso,
			utcBounds.toExclusiveIso,
		);
	}

	return buildError("SOURCE_NOT_FOUND", "Selected report source is not available.");
}
