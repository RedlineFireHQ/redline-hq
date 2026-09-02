import type { SupabaseClient } from "@supabase/supabase-js";
import { formatReportPeriodLabel } from "@/lib/reports/date-range";
import type {
	AppliedReportFilter,
	ReportRow,
	ReportRunRequest,
	ReportRunResponse,
	ReportSourceConfig,
} from "@/lib/reports/types";

type ReportContext = {
	supabase: SupabaseClient;
	departmentId: string;
	departmentName: string | null;
};

type InternalRow = {
	categoryKey: string;
	categoryLabel: string;
	itemName: string;
	identifier: string;
	serialNumber: string;
	status: string;
	locationOrApparatus: string;
	latestActivity: string;
	latestResult: string;
	dueDate: string;
	openDeficiencies: number;
	activitySortDate: string | null;
	searchText: string;
};

function normalizeText(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

function displayText(value: unknown) {
	const text = normalizeText(value);
	return text || "-";
}

function isWithinUtcRange(value: string | null, fromIso: string, toExclusiveIso: string) {
	if (!value) {
		return false;
	}

	const candidate = new Date(value).getTime();
	const from = new Date(fromIso).getTime();
	const toExclusive = new Date(toExclusiveIso).getTime();
	if (Number.isNaN(candidate) || Number.isNaN(from) || Number.isNaN(toExclusive)) {
		return false;
	}

	return candidate >= from && candidate < toExclusive;
}

function formatDate(value: string | null) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		const fallback = new Date(value);
		if (Number.isNaN(fallback.getTime())) {
			return value;
		}
		return fallback.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
	}

	return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function buildAppliedFilters(source: ReportSourceConfig, filters: Record<string, string>, searchTerm: string): AppliedReportFilter[] {
	const items: AppliedReportFilter[] = [];

	for (const definition of source.filters) {
		const rawValue = normalizeText(filters[definition.key]);
		if (!rawValue || rawValue.toLowerCase() === "all") {
			continue;
		}

		if (definition.type === "select" && definition.options) {
			const option = definition.options.find((item) => item.value === rawValue);
			items.push({ label: definition.label, value: option?.label ?? rawValue });
			continue;
		}

		items.push({ label: definition.label, value: rawValue });
	}

	if (searchTerm) {
		items.push({ label: "Search", value: searchTerm });
	}

	return items;
}

function buildOpenDeficiencyCountMap(rows: Array<Record<string, unknown>>, fieldName: string) {
	const counts = new Map<string, number>();

	for (const row of rows) {
		const itemId = normalizeText(row[fieldName]);
		if (!itemId) {
			continue;
		}

		const statusRelation = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
		const statusName = normalizeText((statusRelation as { name?: unknown } | null | undefined)?.name).toLowerCase();
		if (statusName === "resolved" || statusName === "closed") {
			continue;
		}

		counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
	}

	return counts;
}

function buildLatestRecordMap(rows: Array<Record<string, unknown>>, itemField: string) {
	const latestByItem = new Map<string, Record<string, unknown>>();

	for (const row of rows) {
		const itemId = normalizeText(row[itemField]);
		if (!itemId || latestByItem.has(itemId)) {
			continue;
		}

		latestByItem.set(itemId, row);
	}

	return latestByItem;
}

function assignmentLocationLabel(
	assignment: Record<string, unknown> | null | undefined,
	memberNameById: Map<string, string>,
	apparatusNameById: Map<string, string>,
	portableRadioNameById: Map<string, string>,
) {
	if (!assignment) {
		return "Unassigned";
	}

	const assignmentType = normalizeText(assignment.assignment_type);
	if (assignmentType === "Member") {
		const memberId = normalizeText(assignment.member_id);
		return memberId ? memberNameById.get(memberId) ?? memberId : "Unassigned";
	}

	if (assignmentType === "Apparatus") {
		const apparatusId = normalizeText(assignment.apparatus_id);
		return apparatusId ? apparatusNameById.get(apparatusId) ?? apparatusId : "Unassigned";
	}

	if (assignmentType === "Station") {
		return displayText(assignment.station_name);
	}

	if (assignmentType === "Equipment") {
		return displayText(assignment.equipment_reference);
	}

	if (assignmentType === "Portable Radio") {
		const radioId = normalizeText(assignment.portable_radio_id);
		return radioId ? portableRadioNameById.get(radioId) ?? radioId : "Unassigned";
	}

	return assignmentType || "Unassigned";
}

function addRow(rows: InternalRow[], params: {
	categoryKey: string;
	categoryLabel: string;
	itemName: unknown;
	identifier: unknown;
	serialNumber: unknown;
	status: unknown;
	locationOrApparatus: unknown;
	latestActivityRaw: string | null;
	latestResult: unknown;
	dueDateRaw: string | null;
	openDeficiencies: number;
	searchParts: Array<unknown>;
}) {
	rows.push({
		categoryKey: params.categoryKey,
		categoryLabel: params.categoryLabel,
		itemName: displayText(params.itemName),
		identifier: displayText(params.identifier),
		serialNumber: displayText(params.serialNumber),
		status: displayText(params.status),
		locationOrApparatus: displayText(params.locationOrApparatus),
		latestActivity: params.latestActivityRaw ? formatDate(params.latestActivityRaw) : "-",
		latestResult: displayText(params.latestResult),
		dueDate: params.dueDateRaw ? formatDate(params.dueDateRaw) : "-",
		openDeficiencies: params.openDeficiencies,
		activitySortDate: params.latestActivityRaw ?? params.dueDateRaw,
		searchText: params.searchParts.map((part) => normalizeText(part).toLowerCase()).filter(Boolean).join(" "),
	});
}

function toReportRows(rows: InternalRow[]): ReportRow[] {
	return rows.map((row) => ({
		inventory_type: row.categoryLabel,
		item_name: row.itemName,
		identifier: row.identifier,
		serial_number: row.serialNumber,
		status: row.status,
		location_or_apparatus: row.locationOrApparatus,
		latest_activity: row.latestActivity,
		latest_result: row.latestResult,
		due_date: row.dueDate,
		open_deficiencies: row.openDeficiencies,
	}));
}

function buildError(error: string): ReportRunResponse {
	return {
		ok: false,
		errorCode: "QUERY_ERROR",
		error,
	};
}

function formatInventoryResult(value: unknown) {
	const text = normalizeText(value);
	return text || "-";
}

export type InventoryReportTypeOption = {
	value: string;
	label: string;
};

export function getInventoryReportTypeOptions(categoryKey: string): InventoryReportTypeOption[] {
	const normalized = normalizeText(categoryKey).toLowerCase();

	if (normalized === "fire-hose") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "fire-hose-testing", label: "Hose Testing" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "scba-cylinders") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "scba-cylinder-hydrostatic-testing", label: "Hydrostatic Testing" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "scba-packs") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "scba-pack-flow-testing", label: "Flow Testing" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "gas-monitors") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "gas-monitor-calibration", label: "Calibration" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "rope") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "rope-inspections", label: "Rope Inspections" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "ground-ladders") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "ground-ladder-service-testing", label: "Ladder Testing" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "fire-extinguishers") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "misc-fire-equipment") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "ppe") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "ems-equipment" || normalized === "ems-supplies") {
		return [
			{ value: "inventory", label: "Inventory" },
			{ value: "deficiencies", label: "Deficiencies" },
		];
	}

	if (normalized === "all") {
		return [{ value: "inventory", label: "Inventory" }];
	}

	return [{ value: "inventory", label: "Inventory" }];
}

export function resolveInventoryReportMode(categoryKey: string, reportTypeKey: string) {
	const normalizedCategory = normalizeText(categoryKey).toLowerCase() || "all";
	const options = getInventoryReportTypeOptions(normalizedCategory);
	const safeReportType = normalizeText(reportTypeKey).toLowerCase() || "inventory";
	const selectedOption = options.find((option) => option.value === safeReportType) ?? options[0] ?? { value: "inventory", label: "Inventory" };

	return {
		categoryKey: normalizedCategory,
		reportTypeKey: selectedOption.value,
		reportTypeLabel: selectedOption.label,
	};
}

function getInventoryCategoryLabel(categoryKey: string) {
	const normalized = normalizeText(categoryKey).toLowerCase();
	const labels: Record<string, string> = {
		"fire-hose": "Fire Hose",
		"scba-cylinders": "SCBA Cylinders",
		"scba-packs": "SCBA Packs",
		"portable-radios": "Portable Radios",
		"portable-radio-mics": "Portable Radio Mics",
		"fire-extinguishers": "Fire Extinguishers",
		"thermal-cameras": "Thermal Imaging Cameras",
		"gas-monitors": "Gas Monitors",
		"rope": "Rope",
		"misc-fire-equipment": "Misc Fire Equipment",
		"ems-equipment": "EMS Equipment",
		"batteries": "Batteries",
		"ground-ladders": "Ground Ladders",
		"pie": "PIE Equipment",
		"ppe": "PPE",
		"ems-supplies": "EMS Supplies",
		all: "All Inventory",
	};
	return labels[normalized] ?? "Inventory";
}

function toSummaryValue(value: number) {
	return String(value);
}

function getModeDisplayName(categoryKey: string, reportTypeKey: string) {
	const categoryLabel = getInventoryCategoryLabel(categoryKey);
	const typeLabel = getInventoryReportTypeOptions(categoryKey).find((option) => option.value === reportTypeKey)?.label ?? "Inventory";
	if (reportTypeKey === "inventory") {
		return `${categoryLabel} Inventory`;
	}
	if (reportTypeKey === "deficiencies") {
		return `${categoryLabel} Deficiencies`;
	}
	if (reportTypeKey === "fire-hose-testing") {
		return "Fire Hose Testing Report";
	}
	if (reportTypeKey === "scba-cylinder-hydrostatic-testing") {
		return "SCBA Cylinder Hydrostatic Testing Report";
	}
	if (reportTypeKey === "scba-pack-flow-testing") {
		return "SCBA Pack Flow Testing Report";
	}
	if (reportTypeKey === "gas-monitor-calibration") {
		return "Gas Monitor Calibration Report";
	}
	if (reportTypeKey === "rope-inspections") {
		return "Rope Inspection Report";
	}
	if (reportTypeKey === "ground-ladder-service-testing") {
		return "Ground Ladder Testing Report";
	}
	return `${typeLabel} Report`;
}

function buildInventorySearchText(parts: Array<unknown>) {
	return parts
		.map((part) => normalizeText(part))
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

export async function runInventoryReport(
	request: ReportRunRequest,
	context: ReportContext,
	source: ReportSourceConfig,
	fromIso: string,
	toExclusiveIso: string,
): Promise<ReportRunResponse> {
	const searchTerm = normalizeText(request.searchTerm).toLowerCase();
	const inventoryCategoryFilter = normalizeText(request.filters.inventory_category).toLowerCase();
	const inventoryReportTypeFilter = normalizeText(request.filters.inventory_report_type).toLowerCase();
	const mode = resolveInventoryReportMode(inventoryCategoryFilter || "all", inventoryReportTypeFilter || "inventory");
	const categoryKey = mode.categoryKey === "all" ? "all" : inventoryCategoryFilter || mode.categoryKey;
	const categoryLabel = getInventoryCategoryLabel(categoryKey);

	if (mode.reportTypeKey === "deficiencies") {
		const { data, error } = await context.supabase
			.from("deficiencies")
			.select("id, department_id, deficiency_number, description, reported_at, resolved_at, status_info:deficiency_statuses!fk_deficiencies_status(name), priority_info:deficiency_priorities!fk_deficiencies_priority(name), category_info:deficiency_categories!fk_deficiencies_category(name), fire_hose_id, scba_cylinder_id, scba_pack_id, portable_radio_id, portable_radio_mic_id, thermal_imaging_camera_id, gas_monitor_id, battery_id, ground_ladder_id, pie_equipment_id, ems_equipment_id, ppe_item_id, rope_item_id, fire_extinguisher_id, misc_fire_equipment_id, fire_hose:fire_hose_id(inventory_number), scba_cylinder:scba_cylinder_id(cylinder_number), scba_pack:scba_pack_id(pack_number), rope_item:rope_item_id(rope_name, rope_identifier), gas_monitor:gas_monitor_id(monitor_number), ground_ladder:ground_ladder_id(ladder_number), fire_extinguisher:fire_extinguisher_id(extinguisher_number, extinguisher_type)")
			.eq("department_id", context.departmentId)
			.order("reported_at", { ascending: false });

		if (error) return buildError(error.message || "Unable to load deficiency records.");

		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => {
				if (categoryKey === "all") return true;
				const fieldMap: Record<string, string> = {
					"fire-hose": "fire_hose_id",
					"scba-cylinders": "scba_cylinder_id",
					"scba-packs": "scba_pack_id",
					"gas-monitors": "gas_monitor_id",
					"rope": "rope_item_id",
					"ground-ladders": "ground_ladder_id",
					"fire-extinguishers": "fire_extinguisher_id",
					"misc-fire-equipment": "misc_fire_equipment_id",
					"ppe": "ppe_item_id",
					"ems-equipment": "ems_equipment_id",
				};
				return Boolean(row[fieldMap[categoryKey] ?? ""]);
			})
			.filter((row) => {
				const dateValue = normalizeText(row.reported_at);
				return dateValue ? isWithinUtcRange(dateValue, fromIso, toExclusiveIso) : false;
			})
			.filter((row) => {
				if (!searchTerm) return true;
				const searchable = [
					row.deficiency_number,
					row.description,
					row.reported_by,
					row.category_info,
					row.priority_info,
					row.fire_hose,
					row.scba_cylinder,
					row.scba_pack,
					row.gas_monitor,
					row.rope_item,
					row.fire_extinguisher,
				].join(" ");
				return searchable.toLowerCase().includes(searchTerm);
			});

		const filtered = rows.map((row) => ({
			id: normalizeText(row.id),
			deficiency_number: displayText(row.deficiency_number),
			reported_at: formatDate(normalizeText(row.reported_at) || null),
			status: displayText(((Array.isArray(row.status_info) ? row.status_info[0] : row.status_info) as { name?: unknown } | null | undefined)?.name),
			priority: displayText(((Array.isArray(row.priority_info) ? row.priority_info[0] : row.priority_info) as { name?: unknown } | null | undefined)?.name),
			related_item: displayText(
				((Array.isArray(row.fire_hose) ? row.fire_hose[0] : row.fire_hose) as { inventory_number?: unknown } | null | undefined)?.inventory_number ??
				((Array.isArray(row.scba_cylinder) ? row.scba_cylinder[0] : row.scba_cylinder) as { cylinder_number?: unknown } | null | undefined)?.cylinder_number ??
				((Array.isArray(row.scba_pack) ? row.scba_pack[0] : row.scba_pack) as { pack_number?: unknown } | null | undefined)?.pack_number ??
				((Array.isArray(row.rope_item) ? row.rope_item[0] : row.rope_item) as { rope_identifier?: unknown; rope_name?: unknown } | null | undefined)?.rope_identifier ??
				((Array.isArray(row.gas_monitor) ? row.gas_monitor[0] : row.gas_monitor) as { monitor_number?: unknown } | null | undefined)?.monitor_number ??
				((Array.isArray(row.ground_ladder) ? row.ground_ladder[0] : row.ground_ladder) as { ladder_number?: unknown } | null | undefined)?.ladder_number ??
				((Array.isArray(row.fire_extinguisher) ? row.fire_extinguisher[0] : row.fire_extinguisher) as { extinguisher_number?: unknown } | null | undefined)?.extinguisher_number ??
				"-"
			),
			description: displayText(row.description),
		}));

		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName(categoryKey, mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Reported Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [
				{ label: "Deficiencies", value: toSummaryValue(filtered.length) },
				{ label: "Open", value: toSummaryValue(filtered.filter((row) => (row.status ?? "").toLowerCase() !== "resolved" && (row.status ?? "").toLowerCase() !== "closed").length) },
				{ label: "Resolved", value: toSummaryValue(filtered.filter((row) => (row.status ?? "").toLowerCase() === "resolved" || (row.status ?? "").toLowerCase() === "closed").length) },
			],
			columns: [
				{ key: "deficiency_number", label: "Deficiency #" },
				{ key: "reported_at", label: "Reported" },
				{ key: "status", label: "Status" },
				{ key: "priority", label: "Priority" },
				{ key: "related_item", label: "Related Item" },
				{ key: "description", label: "Description" },
			],
			rows: filtered.map((row) => ({
				id: row.id,
				deficiency_number: row.deficiency_number,
				reported_at: row.reported_at,
				status: row.status,
				priority: row.priority,
				related_item: row.related_item,
				description: row.description,
			})),
			totalRows: filtered.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	if (mode.reportTypeKey === "fire-hose-testing") {
		const { data, error } = await context.supabase
			.from("fire_hose_testing_results")
			.select("id, hose_id, test_date, result, tester, inventory_number, fire_hose:hose_id(inventory_number, hose_size, hose_length, status)")
			.eq("department_id", context.departmentId)
			.order("test_date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) return buildError(error.message || "Unable to load fire hose testing records.");
		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => categoryKey === "all" || categoryKey === "fire-hose")
			.filter((row) => isWithinUtcRange(normalizeText(row.test_date), fromIso, toExclusiveIso))
			.filter((row) => {
				if (!searchTerm) return true;
				const hose = Array.isArray(row.fire_hose) ? row.fire_hose[0] : row.fire_hose;
				return buildInventorySearchText([
					row.inventory_number,
					row.tester,
					row.result,
					row.test_date,
					(hose as { inventory_number?: unknown; hose_size?: unknown; hose_length?: unknown; status?: unknown } | null | undefined)?.inventory_number,
					(hose as { inventory_number?: unknown; hose_size?: unknown; hose_length?: unknown; status?: unknown } | null | undefined)?.status,
				]).includes(searchTerm);
			});
		const pass = rows.filter((row) => normalizeText(row.result).toLowerCase() === "pass").length;
		const fail = rows.filter((row) => normalizeText(row.result).toLowerCase() === "fail").length;
		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName("fire-hose", mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Test Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [{ label: "Hoses Tested", value: toSummaryValue(rows.length) }, { label: "Passed", value: toSummaryValue(pass) }, { label: "Failed", value: toSummaryValue(fail) }],
			columns: [{ key: "test_date", label: "Test Date" }, { key: "inventory_number", label: "Hose" }, { key: "tester", label: "Tester" }, { key: "result", label: "Result" }],
			rows: rows.map((row) => ({ id: normalizeText(row.id) || null, test_date: formatDate(normalizeText(row.test_date) || null), inventory_number: displayText(row.inventory_number || ((Array.isArray(row.fire_hose) ? row.fire_hose[0] : row.fire_hose) as { inventory_number?: unknown } | null | undefined)?.inventory_number), tester: displayText(row.tester), result: displayText(row.result) })),
			totalRows: rows.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	if (mode.reportTypeKey === "gas-monitor-calibration") {
		const { data, error } = await context.supabase
			.from("gas_monitor_calibrations")
			.select("id, gas_monitor_id, calibration_date, result, tester_mode, tester_member_id, external_tester_name, external_tester_company, notes, gas_monitor:gas_monitor_id(monitor_number, serial_number, manufacturer, model)")
			.eq("department_id", context.departmentId)
			.order("calibration_date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) return buildError(error.message || "Unable to load gas monitor calibration records.");
		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => categoryKey === "all" || categoryKey === "gas-monitors")
			.filter((row) => isWithinUtcRange(normalizeText(row.calibration_date), fromIso, toExclusiveIso))
			.filter((row) => {
				if (!searchTerm) return true;
				const monitor = Array.isArray(row.gas_monitor) ? row.gas_monitor[0] : row.gas_monitor;
				return buildInventorySearchText([
					row.result,
					row.external_tester_name,
					row.external_tester_company,
					row.calibration_date,
					(row.tester_mode),
					(monitor as { monitor_number?: unknown; serial_number?: unknown; manufacturer?: unknown; model?: unknown } | null | undefined)?.monitor_number,
				]).includes(searchTerm);
			});
		const pass = rows.filter((row) => normalizeText(row.result).toLowerCase() === "passed" || normalizeText(row.result).toLowerCase() === "pass").length;
		const fail = rows.filter((row) => normalizeText(row.result).toLowerCase() === "failed" || normalizeText(row.result).toLowerCase() === "fail").length;
		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName("gas-monitors", mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Calibration Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [{ label: "Calibrations", value: toSummaryValue(rows.length) }, { label: "Passed", value: toSummaryValue(pass) }, { label: "Failed", value: toSummaryValue(fail) }],
			columns: [{ key: "calibration_date", label: "Calibration Date" }, { key: "monitor_number", label: "Monitor" }, { key: "tester_name", label: "Tester" }, { key: "result", label: "Result" }],
			rows: rows.map((row) => ({
				id: normalizeText(row.id) || null,
				calibration_date: formatDate(normalizeText(row.calibration_date) || null),
				monitor_number: displayText(((Array.isArray(row.gas_monitor) ? row.gas_monitor[0] : row.gas_monitor) as { monitor_number?: unknown } | null | undefined)?.monitor_number),
				tester_name: displayText(row.tester_mode === "Name/Company" ? [row.external_tester_name, row.external_tester_company].filter(Boolean).join(" / ") : row.external_tester_name || row.external_tester_company || row.tester_member_id),
				result: displayText(row.result),
			})),
			totalRows: rows.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	if (mode.reportTypeKey === "scba-pack-flow-testing") {
		const { data, error } = await context.supabase
			.from("scba_pack_flow_tests")
			.select("id, scba_pack_id, test_date, result, tester, notes, scba_pack:scba_pack_id(pack_number, manufacturer, model, serial_number)")
			.eq("department_id", context.departmentId)
			.order("test_date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) return buildError(error.message || "Unable to load SCBA pack flow test records.");
		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => categoryKey === "all" || categoryKey === "scba-packs")
			.filter((row) => isWithinUtcRange(normalizeText(row.test_date), fromIso, toExclusiveIso))
			.filter((row) => {
				if (!searchTerm) return true;
				const pack = Array.isArray(row.scba_pack) ? row.scba_pack[0] : row.scba_pack;
				return buildInventorySearchText([row.test_date, row.tester, row.result, row.notes, (pack as { pack_number?: unknown; manufacturer?: unknown; model?: unknown; serial_number?: unknown } | null | undefined)?.pack_number]).includes(searchTerm);
			});
		const pass = rows.filter((row) => normalizeText(row.result).toLowerCase() === "pass").length;
		const fail = rows.filter((row) => normalizeText(row.result).toLowerCase() === "fail").length;
		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName("scba-packs", mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Test Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [{ label: "Tests", value: toSummaryValue(rows.length) }, { label: "Passed", value: toSummaryValue(pass) }, { label: "Failed", value: toSummaryValue(fail) }],
			columns: [{ key: "test_date", label: "Test Date" }, { key: "pack_number", label: "Pack" }, { key: "tester", label: "Tester" }, { key: "result", label: "Result" }],
			rows: rows.map((row) => ({ id: normalizeText(row.id) || null, test_date: formatDate(normalizeText(row.test_date) || null), pack_number: displayText(((Array.isArray(row.scba_pack) ? row.scba_pack[0] : row.scba_pack) as { pack_number?: unknown } | null | undefined)?.pack_number), tester: displayText(row.tester), result: displayText(row.result) })),
			totalRows: rows.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	if (mode.reportTypeKey === "rope-inspections") {
		const { data, error } = await context.supabase
			.from("rope_inspections")
			.select("id, rope_item_id, inspection_date, result, primary_inspector_member_id, notes, rope_item:rope_item_id(rope_name, rope_identifier, rope_type)")
			.eq("department_id", context.departmentId)
			.order("inspection_date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) return buildError(error.message || "Unable to load rope inspection records.");
		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => categoryKey === "all" || categoryKey === "rope")
			.filter((row) => isWithinUtcRange(normalizeText(row.inspection_date), fromIso, toExclusiveIso))
			.filter((row) => {
				if (!searchTerm) return true;
				const rope = Array.isArray(row.rope_item) ? row.rope_item[0] : row.rope_item;
				return buildInventorySearchText([row.inspection_date, row.result, row.primary_inspector_member_id, (rope as { rope_name?: unknown; rope_identifier?: unknown; rope_type?: unknown } | null | undefined)?.rope_name, (rope as { rope_name?: unknown; rope_identifier?: unknown; rope_type?: unknown } | null | undefined)?.rope_identifier]).includes(searchTerm);
			});
		const pass = rows.filter((row) => normalizeText(row.result).toLowerCase() === "pass").length;
		const fail = rows.filter((row) => normalizeText(row.result).toLowerCase() === "fail").length;
		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName("rope", mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Inspection Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [{ label: "Inspections", value: toSummaryValue(rows.length) }, { label: "Passed", value: toSummaryValue(pass) }, { label: "Failed", value: toSummaryValue(fail) }],
			columns: [{ key: "inspection_date", label: "Inspection Date" }, { key: "rope_name", label: "Rope" }, { key: "result", label: "Result" }, { key: "primary_inspector_member_id", label: "Inspector" }],
			rows: rows.map((row) => ({ id: normalizeText(row.id) || null, inspection_date: formatDate(normalizeText(row.inspection_date) || null), rope_name: displayText(((Array.isArray(row.rope_item) ? row.rope_item[0] : row.rope_item) as { rope_name?: unknown; rope_identifier?: unknown } | null | undefined)?.rope_name), result: displayText(row.result), primary_inspector_member_id: displayText(row.primary_inspector_member_id) })),
			totalRows: rows.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	if (mode.reportTypeKey === "ground-ladder-service-testing") {
		const { data, error } = await context.supabase
			.from("ground_ladder_service_tests")
			.select("id, ground_ladder_id, test_date, tester_type, member_id, external_tester_name, company_name, result, notes, next_test_due_date, ground_ladder:ground_ladder_id(ladder_number, ladder_type)")
			.eq("department_id", context.departmentId)
			.order("test_date", { ascending: false })
			.order("created_at", { ascending: false });
		if (error) return buildError(error.message || "Unable to load ground ladder testing records.");
		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => categoryKey === "all" || categoryKey === "ground-ladders")
			.filter((row) => isWithinUtcRange(normalizeText(row.test_date), fromIso, toExclusiveIso))
			.filter((row) => {
				if (!searchTerm) return true;
				const ladder = Array.isArray(row.ground_ladder) ? row.ground_ladder[0] : row.ground_ladder;
				return buildInventorySearchText([row.test_date, row.result, row.tester_type, row.member_id, row.external_tester_name, row.company_name, (ladder as { ladder_number?: unknown; ladder_type?: unknown } | null | undefined)?.ladder_number]).includes(searchTerm);
			});
		const pass = rows.filter((row) => normalizeText(row.result).toLowerCase() === "pass").length;
		const fail = rows.filter((row) => normalizeText(row.result).toLowerCase() === "fail").length;
		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName("ground-ladders", mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Test Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [{ label: "Tests", value: toSummaryValue(rows.length) }, { label: "Passed", value: toSummaryValue(pass) }, { label: "Failed", value: toSummaryValue(fail) }],
			columns: [{ key: "test_date", label: "Test Date" }, { key: "ladder_number", label: "Ladder" }, { key: "tester_type", label: "Tester Type" }, { key: "result", label: "Result" }],
			rows: rows.map((row) => ({ id: normalizeText(row.id) || null, test_date: formatDate(normalizeText(row.test_date) || null), ladder_number: displayText(((Array.isArray(row.ground_ladder) ? row.ground_ladder[0] : row.ground_ladder) as { ladder_number?: unknown } | null | undefined)?.ladder_number), tester_type: displayText(row.tester_type), result: displayText(row.result) })),
			totalRows: rows.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	if (mode.reportTypeKey === "scba-cylinder-hydrostatic-testing") {
		const { data, error } = await context.supabase
			.from("scba_cylinders")
			.select("id, cylinder_number, cylinder_type, last_hydrostatic_test_date, next_hydrostatic_test_due_date, serial_number, manufacturer, model, status")
			.eq("department_id", context.departmentId)
			.order("last_hydrostatic_test_date", { ascending: false });
		if (error) return buildError(error.message || "Unable to load SCBA cylinder hydrostatic dates.");
		const rows = ((data ?? []) as Array<Record<string, unknown>>)
			.filter((row) => categoryKey === "all" || categoryKey === "scba-cylinders")
			.filter((row) => isWithinUtcRange(normalizeText(row.last_hydrostatic_test_date), fromIso, toExclusiveIso))
			.filter((row) => {
				if (!searchTerm) return true;
				return buildInventorySearchText([row.cylinder_number, row.serial_number, row.manufacturer, row.model, row.last_hydrostatic_test_date, row.next_hydrostatic_test_due_date]).includes(searchTerm);
			});
		const dueSoon = rows.filter((row) => normalizeText(row.next_hydrostatic_test_due_date).length > 0).length;
		return {
			ok: true,
			comingSoon: false,
			source: { key: source.key, name: getModeDisplayName("scba-cylinders", mode.reportTypeKey), description: source.description },
			departmentName: context.departmentName,
			generatedAt: new Date().toISOString(),
			period: { from: request.dateRange.from, to: request.dateRange.to, label: formatReportPeriodLabel(request.dateRange.from, request.dateRange.to), basisLabel: "Hydrostatic Test Date" },
			filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
			summary: [{ label: "Hydro Tests", value: toSummaryValue(rows.length) }, { label: "Cylinders With Due Date", value: toSummaryValue(dueSoon) }],
			columns: [{ key: "last_hydrostatic_test_date", label: "Last Hydro Test" }, { key: "cylinder_number", label: "Cylinder" }, { key: "serial_number", label: "Serial #" }, { key: "next_hydrostatic_test_due_date", label: "Next Due" }],
			rows: rows.map((row) => ({ id: normalizeText(row.id) || null, last_hydrostatic_test_date: formatDate(normalizeText(row.last_hydrostatic_test_date) || null), cylinder_number: displayText(row.cylinder_number), serial_number: displayText(row.serial_number), next_hydrostatic_test_due_date: formatDate(normalizeText(row.next_hydrostatic_test_due_date) || null) })),
			totalRows: rows.length,
			page: Number(request.page) || 1,
			pageSize: Number(request.pageSize) || 50,
		};
	}

	const [
		membersQuery,
		apparatusQuery,
		deficienciesQuery,
		fireHoseQuery,
		fireHoseTestsQuery,
		scbaCylindersQuery,
		scbaPacksQuery,
		scbaPackTestsQuery,
		portableRadiosQuery,
		portableRadioAssignmentsQuery,
		portableRadioMicsQuery,
		portableRadioMicAssignmentsQuery,
		fireExtinguishersQuery,
		thermalCamerasQuery,
		thermalCameraAssignmentsQuery,
		gasMonitorsQuery,
		gasMonitorAssignmentsQuery,
		gasMonitorCalibrationsQuery,
		gasMonitorCalibrationSettingsQuery,
		ropeItemsQuery,
		ropeInspectionsQuery,
		miscFireEquipmentQuery,
		emsEquipmentQuery,
		batteriesQuery,
		batteryAssignmentsQuery,
		groundLaddersQuery,
		groundLadderAssignmentsQuery,
		groundLadderServiceTestsQuery,
		groundLadderMaintenanceQuery,
		pieEquipmentQuery,
		pieEquipmentAssignmentsQuery,
		ppeItemsQuery,
		emsSupplyItemsQuery,
	] = await Promise.all([
		context.supabase.from("members").select("id, first_name, last_name").eq("department_id", context.departmentId),
		context.supabase.from("apparatus").select("id, name").eq("department_id", context.departmentId),
		context.supabase
			.from("deficiencies")
			.select("fire_hose_id, scba_cylinder_id, scba_pack_id, portable_radio_id, portable_radio_mic_id, thermal_imaging_camera_id, gas_monitor_id, battery_id, ground_ladder_id, pie_equipment_id, ems_equipment_id, ppe_item_id, rope_item_id, fire_extinguisher_id, misc_fire_equipment_id, status_info:deficiency_statuses!fk_deficiencies_status(name, active)")
			.eq("department_id", context.departmentId),
		context.supabase.from("fire_hose").select("id, inventory_number, hose_size, hose_length, booster_reel, in_service_date, next_test_date, status, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("fire_hose_testing_results").select("id, hose_id, testing_session_id, result, test_date, tester, inventory_number, created_at").eq("department_id", context.departmentId).order("test_date", { ascending: false }).order("created_at", { ascending: false }),
		context.supabase.from("scba_cylinders").select("id, cylinder_number, cylinder_type, in_service_date, last_hydrostatic_test_date, next_hydrostatic_test_due_date, service_life_end_date, manufacturer, model, serial_number, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("scba_packs").select("id, pack_number, manufacturer, model, serial_number, in_service_date, last_flow_test_date, next_flow_test_due_date, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("scba_pack_flow_tests").select("id, scba_pack_id, test_date, tester, result, notes, created_at").eq("department_id", context.departmentId).order("test_date", { ascending: false }).order("created_at", { ascending: false }),
		context.supabase.from("portable_radios").select("id, radio_number, serial_number, manufacturer, model, radio_unit_id, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("portable_radio_assignments").select("id, department_id, portable_radio_id, assignment_type, member_id, apparatus_id, assigned_at, ended_at, assigned_by, notes, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("portable_radio_mics").select("id, mic_number, serial_number, manufacturer, model, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("portable_radio_mic_assignments").select("id, department_id, portable_radio_mic_id, assignment_type, portable_radio_id, assigned_at, ended_at, assigned_by, notes, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("fire_extinguishers").select("id, extinguisher_number, extinguisher_type, location_type, apparatus_id, other_location, status, notes, photo_path, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("thermal_imaging_cameras").select("id, camera_number, serial_number, manufacturer, model, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("thermal_imaging_camera_assignments").select("id, department_id, thermal_imaging_camera_id, assignment_type, member_id, apparatus_id, assigned_at, ended_at, assigned_by, notes, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("gas_monitors").select("id, monitor_number, serial_number, manufacturer, model, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("gas_monitor_assignments").select("id, department_id, gas_monitor_id, assignment_type, member_id, apparatus_id, assigned_at, ended_at, assigned_by, notes, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("gas_monitor_calibrations").select("id, gas_monitor_id, calibration_date, result, tester_mode, tester_member_id, external_tester_name, external_tester_company, notes, created_at").eq("department_id", context.departmentId).order("calibration_date", { ascending: false }).order("created_at", { ascending: false }),
		context.supabase.from("gas_monitor_calibration_settings").select("calibration_interval_months").eq("department_id", context.departmentId).maybeSingle(),
		context.supabase.from("rope_items").select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, diameter_mm, location_type, apparatus_id, other_location, status, notes, photo_path, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("rope_inspections").select("id, rope_item_id, inspection_date, result, created_at").eq("department_id", context.departmentId).order("inspection_date", { ascending: false }).order("created_at", { ascending: false }),
		context.supabase.from("misc_fire_equipment").select("id, equipment_name, asset_number, location_type, apparatus_id, other_location, status, date_placed_in_service, manufacturer, model, notes, photo_path, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("ems_equipment").select("id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("batteries").select("id, battery_number, serial_number, manufacturer, model, battery_type, compatible_equipment, in_service_date, status, location, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("battery_assignments").select("id, department_id, battery_id, assignment_type, apparatus_id, station_name, equipment_reference, notes, assigned_at, ended_at, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("ground_ladders").select("id, ladder_number, ladder_type, ladder_length_ft, manufacturer, model, serial_number, status, in_service_date, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("ground_ladder_assignments").select("id, department_id, ground_ladder_id, assignment_type, apparatus_id, station_name, equipment_reference, assigned_at, ended_at, assigned_by, notes, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("ground_ladder_service_tests").select("id, ground_ladder_id, test_date, tester_type, member_id, external_tester_name, company_name, result, notes, next_test_due_date, created_at").eq("department_id", context.departmentId).order("test_date", { ascending: false }).order("created_at", { ascending: false }),
		context.supabase.from("ground_ladder_maintenance").select("id, ground_ladder_id, maintenance_date, performed_by_member_id, performed_by_name, result, notes, next_maintenance_due, maintenance_interval_months, created_at").eq("department_id", context.departmentId).order("maintenance_date", { ascending: false }).order("created_at", { ascending: false }),
		context.supabase.from("pie_equipment").select("id, equipment_number, serial_number, manufacturer, model, equipment_type, power_source, location, in_service_date, status, notes, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("pie_equipment_assignments").select("id, department_id, pie_equipment_id, assignment_type, apparatus_id, station_name, equipment_reference, notes, assigned_at, ended_at, created_at").eq("department_id", context.departmentId).order("assigned_at", { ascending: false }),
		context.supabase.from("ppe_items").select("id, item_name, assigned_member_id, manufacturer, model, serial_number, asset_number, size, date_manufactured, placed_in_service_date, expiration_date, location, status, notes, photo_path, created_at, updated_at").eq("department_id", context.departmentId),
		context.supabase.from("ems_supply_items").select("id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at").eq("department_id", context.departmentId),
	]);

	const queryErrors = [
		membersQuery.error,
		apparatusQuery.error,
		deficienciesQuery.error,
		fireHoseQuery.error,
		fireHoseTestsQuery.error,
		scbaCylindersQuery.error,
		scbaPacksQuery.error,
		scbaPackTestsQuery.error,
		portableRadiosQuery.error,
		portableRadioAssignmentsQuery.error,
		portableRadioMicsQuery.error,
		portableRadioMicAssignmentsQuery.error,
		fireExtinguishersQuery.error,
		thermalCamerasQuery.error,
		thermalCameraAssignmentsQuery.error,
		gasMonitorsQuery.error,
		gasMonitorAssignmentsQuery.error,
		gasMonitorCalibrationsQuery.error,
		gasMonitorCalibrationSettingsQuery.error,
		ropeItemsQuery.error,
		ropeInspectionsQuery.error,
		miscFireEquipmentQuery.error,
		emsEquipmentQuery.error,
		batteriesQuery.error,
		batteryAssignmentsQuery.error,
		groundLaddersQuery.error,
		groundLadderAssignmentsQuery.error,
		groundLadderServiceTestsQuery.error,
		groundLadderMaintenanceQuery.error,
		pieEquipmentQuery.error,
		pieEquipmentAssignmentsQuery.error,
		ppeItemsQuery.error,
		emsSupplyItemsQuery.error,
	].filter(Boolean) as Array<{ message?: string | null }>;

	if (queryErrors.length > 0) {
		return buildError(queryErrors[0]?.message || "Unable to load inventory records.");
	}

	const memberNameById = new Map(
		((membersQuery.data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((member) => [
			member.id,
			`${normalizeText(member.first_name)} ${normalizeText(member.last_name)}`.trim() || member.id,
		]),
	);
	const apparatusNameById = new Map(
		((apparatusQuery.data ?? []) as Array<{ id: string; name: string | null }>).map((item) => [item.id, normalizeText(item.name) || item.id]),
	);
	const portableRadioNameById = new Map(
		((portableRadiosQuery.data ?? []) as Array<{ id: string; radio_number: string | null }>).map((item) => [item.id, normalizeText(item.radio_number) || item.id]),
	);

	const deficiencyRows = (deficienciesQuery.data ?? []) as Array<Record<string, unknown>>;
	const openCounts = {
		fire_hose_id: buildOpenDeficiencyCountMap(deficiencyRows, "fire_hose_id"),
		scba_cylinder_id: buildOpenDeficiencyCountMap(deficiencyRows, "scba_cylinder_id"),
		scba_pack_id: buildOpenDeficiencyCountMap(deficiencyRows, "scba_pack_id"),
		portable_radio_id: buildOpenDeficiencyCountMap(deficiencyRows, "portable_radio_id"),
		portable_radio_mic_id: buildOpenDeficiencyCountMap(deficiencyRows, "portable_radio_mic_id"),
		thermal_imaging_camera_id: buildOpenDeficiencyCountMap(deficiencyRows, "thermal_imaging_camera_id"),
		gas_monitor_id: buildOpenDeficiencyCountMap(deficiencyRows, "gas_monitor_id"),
		battery_id: buildOpenDeficiencyCountMap(deficiencyRows, "battery_id"),
		ground_ladder_id: buildOpenDeficiencyCountMap(deficiencyRows, "ground_ladder_id"),
		pie_equipment_id: buildOpenDeficiencyCountMap(deficiencyRows, "pie_equipment_id"),
		ems_equipment_id: buildOpenDeficiencyCountMap(deficiencyRows, "ems_equipment_id"),
		ppe_item_id: buildOpenDeficiencyCountMap(deficiencyRows, "ppe_item_id"),
		rope_item_id: buildOpenDeficiencyCountMap(deficiencyRows, "rope_item_id"),
		fire_extinguisher_id: buildOpenDeficiencyCountMap(deficiencyRows, "fire_extinguisher_id"),
		misc_fire_equipment_id: buildOpenDeficiencyCountMap(deficiencyRows, "misc_fire_equipment_id"),
	};

	const fireHoseLatestById = buildLatestRecordMap((fireHoseTestsQuery.data ?? []) as Array<Record<string, unknown>>, "hose_id");
	const scbaPackLatestById = buildLatestRecordMap((scbaPackTestsQuery.data ?? []) as Array<Record<string, unknown>>, "scba_pack_id");
	const gasMonitorLatestById = buildLatestRecordMap((gasMonitorCalibrationsQuery.data ?? []) as Array<Record<string, unknown>>, "gas_monitor_id");
	const ropeLatestById = buildLatestRecordMap((ropeInspectionsQuery.data ?? []) as Array<Record<string, unknown>>, "rope_item_id");
	const ladderServiceLatestById = buildLatestRecordMap((groundLadderServiceTestsQuery.data ?? []) as Array<Record<string, unknown>>, "ground_ladder_id");
	const ladderMaintenanceLatestById = buildLatestRecordMap((groundLadderMaintenanceQuery.data ?? []) as Array<Record<string, unknown>>, "ground_ladder_id");
	const gasCalibrationIntervalMonths = typeof gasMonitorCalibrationSettingsQuery.data?.calibration_interval_months === "number"
		? gasMonitorCalibrationSettingsQuery.data.calibration_interval_months
		: null;

	const inventoryRows: InternalRow[] = [];

	for (const row of (fireHoseQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const latest = fireHoseLatestById.get(id) ?? null;
		addRow(inventoryRows, {
			categoryKey: "fire-hose",
			categoryLabel: "Fire Hose",
			itemName: row.inventory_number,
			identifier: row.inventory_number,
			serialNumber: null,
			status: row.status,
			locationOrApparatus: row.hose_size,
			latestActivityRaw: normalizeText(latest?.test_date) || normalizeText(row.next_test_date) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: latest?.result,
			dueDateRaw: normalizeText(row.next_test_date) || null,
			openDeficiencies: openCounts.fire_hose_id.get(id) ?? 0,
			searchParts: ["Fire Hose", row.inventory_number, row.hose_size, row.hose_length, row.booster_reel, row.status, row.next_test_date, latest?.tester, latest?.result],
		});
	}

	for (const row of (scbaCylindersQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		addRow(inventoryRows, {
			categoryKey: "scba-cylinders",
			categoryLabel: "SCBA Cylinders",
			itemName: row.cylinder_number,
			identifier: row.cylinder_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus: row.cylinder_type,
			latestActivityRaw: normalizeText(row.last_hydrostatic_test_date) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: row.last_hydrostatic_test_date ? "Hydrostatic Test" : "-",
			dueDateRaw: normalizeText(row.next_hydrostatic_test_due_date) || normalizeText(row.service_life_end_date) || null,
			openDeficiencies: openCounts.scba_cylinder_id.get(id) ?? 0,
			searchParts: ["SCBA Cylinders", row.cylinder_number, row.cylinder_type, row.serial_number, row.manufacturer, row.model, row.status, row.next_hydrostatic_test_due_date],
		});
	}

	for (const row of (scbaPacksQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const latest = scbaPackLatestById.get(id) ?? null;
		addRow(inventoryRows, {
			categoryKey: "scba-packs",
			categoryLabel: "SCBA Packs",
			itemName: row.pack_number,
			identifier: row.pack_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus: row.manufacturer,
			latestActivityRaw: normalizeText(latest?.test_date) || normalizeText(row.next_flow_test_due_date) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: latest?.result,
			dueDateRaw: normalizeText(row.next_flow_test_due_date) || null,
			openDeficiencies: openCounts.scba_pack_id.get(id) ?? 0,
			searchParts: ["SCBA Packs", row.pack_number, row.serial_number, row.manufacturer, row.model, row.status, row.next_flow_test_due_date, latest?.tester, latest?.result],
		});
	}

	for (const row of (portableRadiosQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((portableRadioAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.portable_radio_id) === id && !normalizeText(assignmentRow.ended_at));
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "portable-radios",
			categoryLabel: "Portable Radios",
			itemName: row.radio_number,
			identifier: row.radio_unit_id,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(assignment?.assigned_at) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: assignment ? normalizeText(assignment.assignment_type) || "-" : "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.portable_radio_id.get(id) ?? 0,
			searchParts: ["Portable Radios", row.radio_number, row.serial_number, row.manufacturer, row.model, row.status, locationOrApparatus],
		});
	}

	for (const row of (portableRadioMicsQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((portableRadioMicAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.portable_radio_mic_id) === id && !normalizeText(assignmentRow.ended_at));
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "portable-radio-mics",
			categoryLabel: "Portable Radio Mics",
			itemName: row.mic_number,
			identifier: row.mic_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(assignment?.assigned_at) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: assignment ? normalizeText(assignment.assignment_type) || "-" : "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.portable_radio_mic_id.get(id) ?? 0,
			searchParts: ["Portable Radio Mics", row.mic_number, row.serial_number, row.manufacturer, row.model, row.status, locationOrApparatus],
		});
	}

	for (const row of (fireExtinguishersQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const apparatusId = normalizeText(row.apparatus_id);
		const locationOrApparatus = row.location_type === "Apparatus"
			? (apparatusId ? apparatusNameById.get(apparatusId) ?? apparatusId : "Unassigned")
			: row.location_type === "Other"
				? displayText(row.other_location)
				: displayText(row.location_type);
		addRow(inventoryRows, {
			categoryKey: "fire-extinguishers",
			categoryLabel: "Fire Extinguishers",
			itemName: row.extinguisher_number,
			identifier: row.extinguisher_number,
			serialNumber: null,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.fire_extinguisher_id.get(id) ?? 0,
			searchParts: ["Fire Extinguishers", row.extinguisher_number, row.extinguisher_type, row.status, locationOrApparatus],
		});
	}

	for (const row of (thermalCamerasQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((thermalCameraAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.thermal_imaging_camera_id) === id && !normalizeText(assignmentRow.ended_at));
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "thermal-cameras",
			categoryLabel: "Thermal Imaging Cameras",
			itemName: row.camera_number,
			identifier: row.camera_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(assignment?.assigned_at) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: assignment ? normalizeText(assignment.assignment_type) || "-" : "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.thermal_imaging_camera_id.get(id) ?? 0,
			searchParts: ["Thermal Imaging Cameras", row.camera_number, row.serial_number, row.manufacturer, row.model, row.status, locationOrApparatus],
		});
	}

	for (const row of (gasMonitorsQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((gasMonitorAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.gas_monitor_id) === id && !normalizeText(assignmentRow.ended_at));
		const latestCalibration = gasMonitorLatestById.get(id) ?? null;
		const dueDateRaw = latestCalibration && gasCalibrationIntervalMonths && gasCalibrationIntervalMonths > 0
			? (() => {
				const date = new Date(`${normalizeText(latestCalibration.calibration_date) || ""}T00:00:00`);
				if (Number.isNaN(date.getTime())) {
					return null;
				}
				date.setMonth(date.getMonth() + gasCalibrationIntervalMonths);
				return date.toISOString().slice(0, 10);
			})()
			: null;
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "gas-monitors",
			categoryLabel: "Gas Monitors",
			itemName: row.monitor_number,
			identifier: row.monitor_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(latestCalibration?.calibration_date) || normalizeText(assignment?.assigned_at) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: formatInventoryResult(latestCalibration?.result),
			dueDateRaw,
			openDeficiencies: openCounts.gas_monitor_id.get(id) ?? 0,
			searchParts: ["Gas Monitors", row.monitor_number, row.serial_number, row.manufacturer, row.model, row.status, locationOrApparatus, latestCalibration?.result, dueDateRaw],
		});
	}

	for (const row of (ropeItemsQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const latest = ropeLatestById.get(id) ?? null;
		const ropeLocationType = normalizeText(row.location_type);
		const ropeApparatusId = normalizeText(row.apparatus_id);
		const ropeLocationOrApparatus = ropeLocationType === "Apparatus"
			? (ropeApparatusId ? apparatusNameById.get(ropeApparatusId) ?? ropeApparatusId : "Unassigned")
			: ropeLocationType === "Other"
				? displayText(row.other_location)
				: displayText(ropeLocationType);
		addRow(inventoryRows, {
			categoryKey: "rope",
			categoryLabel: "Rope",
			itemName: row.rope_name,
			identifier: row.rope_identifier,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus: ropeLocationOrApparatus,
			latestActivityRaw: normalizeText(latest?.inspection_date) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: latest?.result,
			dueDateRaw: null,
			openDeficiencies: openCounts.rope_item_id.get(id) ?? 0,
			searchParts: ["Rope", row.rope_name, row.rope_identifier, row.rope_type, row.serial_number, row.diameter_mm, row.status, ropeLocationOrApparatus, latest?.result],
		});
	}

	for (const row of (miscFireEquipmentQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const apparatusId = normalizeText(row.apparatus_id);
		const locationOrApparatus = row.location_type === "Apparatus"
			? (apparatusId ? apparatusNameById.get(apparatusId) ?? apparatusId : "Unassigned")
			: row.location_type === "Other"
				? displayText(row.other_location)
				: displayText(row.location_type);
		addRow(inventoryRows, {
			categoryKey: "misc-fire-equipment",
			categoryLabel: "Misc Fire Equipment",
			itemName: row.equipment_name,
			identifier: row.asset_number,
			serialNumber: null,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(row.date_placed_in_service) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.misc_fire_equipment_id.get(id) ?? 0,
			searchParts: ["Misc Fire Equipment", row.equipment_name, row.asset_number, row.manufacturer, row.model, row.status, locationOrApparatus],
		});
	}

	for (const row of (emsEquipmentQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		addRow(inventoryRows, {
			categoryKey: "ems-equipment",
			categoryLabel: "EMS Equipment",
			itemName: row.equipment_name,
			identifier: row.equipment_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus: row.location,
			latestActivityRaw: normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.ems_equipment_id.get(id) ?? 0,
			searchParts: ["EMS Equipment", row.equipment_name, row.equipment_number, row.serial_number, row.status, row.location],
		});
	}

	for (const row of (batteriesQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((batteryAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.battery_id) === id && !normalizeText(assignmentRow.ended_at));
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "batteries",
			categoryLabel: "Batteries",
			itemName: row.battery_number,
			identifier: row.battery_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(assignment?.assigned_at) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: assignment ? normalizeText(assignment.assignment_type) || "-" : "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.battery_id.get(id) ?? 0,
			searchParts: ["Batteries", row.battery_number, row.serial_number, row.manufacturer, row.model, row.status, locationOrApparatus],
		});
	}

	for (const row of (groundLaddersQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((groundLadderAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.ground_ladder_id) === id && !normalizeText(assignmentRow.ended_at));
		const serviceTest = ladderServiceLatestById.get(id) ?? null;
		const maintenance = ladderMaintenanceLatestById.get(id) ?? null;
		const latestDate = normalizeText(serviceTest?.test_date) || normalizeText(maintenance?.maintenance_date) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null;
		const latestResult = normalizeText(serviceTest?.result) || normalizeText(maintenance?.result) || normalizeText(assignment?.assignment_type) || "-";
		const dueDateRaw = normalizeText(serviceTest?.next_test_due_date) || normalizeText(maintenance?.next_maintenance_due) || null;
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "ground-ladders",
			categoryLabel: "Ground Ladders",
			itemName: row.ladder_number,
			identifier: row.ladder_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: latestDate,
			latestResult,
			dueDateRaw,
			openDeficiencies: openCounts.ground_ladder_id.get(id) ?? 0,
			searchParts: ["Ground Ladders", row.ladder_number, row.ladder_type, row.serial_number, row.status, locationOrApparatus, latestResult, dueDateRaw],
		});
	}

	for (const row of (pieEquipmentQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignment = ((pieEquipmentAssignmentsQuery.data ?? []) as Array<Record<string, unknown>>).find((assignmentRow) => normalizeText(assignmentRow.pie_equipment_id) === id && !normalizeText(assignmentRow.ended_at));
		const locationOrApparatus = assignmentLocationLabel(assignment, memberNameById, apparatusNameById, portableRadioNameById);
		addRow(inventoryRows, {
			categoryKey: "pie",
			categoryLabel: "PIE Equipment",
			itemName: row.equipment_number,
			identifier: row.equipment_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(assignment?.assigned_at) || normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: assignment ? normalizeText(assignment.assignment_type) || "-" : "-",
			dueDateRaw: null,
			openDeficiencies: openCounts.pie_equipment_id.get(id) ?? 0,
			searchParts: ["PIE Equipment", row.equipment_number, row.serial_number, row.equipment_type, row.power_source, row.status, locationOrApparatus],
		});
	}

	for (const row of (ppeItemsQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const assignedMemberId = normalizeText(row.assigned_member_id);
		const locationOrApparatus = assignedMemberId ? memberNameById.get(assignedMemberId) ?? assignedMemberId : row.location;
		addRow(inventoryRows, {
			categoryKey: "ppe",
			categoryLabel: "PPE",
			itemName: row.item_name,
			identifier: row.asset_number,
			serialNumber: row.serial_number,
			status: row.status,
			locationOrApparatus,
			latestActivityRaw: normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: assignedMemberId ? (memberNameById.get(assignedMemberId) ?? assignedMemberId) : "-",
			dueDateRaw: normalizeText(row.expiration_date) || null,
			openDeficiencies: openCounts.ppe_item_id.get(id) ?? 0,
			searchParts: ["PPE", row.item_name, row.asset_number, row.serial_number, row.size, row.status, locationOrApparatus, row.expiration_date],
		});
	}

	for (const row of (emsSupplyItemsQuery.data ?? []) as Array<Record<string, unknown>>) {
		const id = normalizeText(row.id);
		if (!id) continue;
		const quantityOnHand = typeof row.quantity_on_hand === "number" ? row.quantity_on_hand : Number(row.quantity_on_hand ?? 0);
		const reorderThreshold = typeof row.reorder_threshold === "number" ? row.reorder_threshold : Number(row.reorder_threshold ?? 0);
		const criticalThreshold = typeof row.critical_threshold === "number" ? row.critical_threshold : null;
		let status = displayText(row.status);
		if (status === "Active") {
			if (quantityOnHand <= 0) {
				status = "Out of Stock";
			} else if (criticalThreshold !== null && quantityOnHand <= criticalThreshold) {
				status = "Critical";
			} else if (quantityOnHand <= reorderThreshold) {
				status = "Low";
			} else {
				status = "Normal";
			}
		}
		addRow(inventoryRows, {
			categoryKey: "ems-supplies",
			categoryLabel: "EMS Supplies",
			itemName: row.item_name,
			identifier: row.qr_identifier,
			serialNumber: null,
			status,
			locationOrApparatus: row.location,
			latestActivityRaw: normalizeText(row.updated_at) || normalizeText(row.created_at) || null,
			latestResult: `On Hand ${quantityOnHand.toLocaleString("en-US")}`,
			dueDateRaw: null,
			openDeficiencies: 0,
			searchParts: ["EMS Supplies", row.item_name, row.item_category, row.qr_identifier, row.location, row.status, quantityOnHand, reorderThreshold, criticalThreshold],
		});
	}

	const categoryFilter = inventoryCategoryFilter && inventoryCategoryFilter !== "all" ? inventoryCategoryFilter : null;
	const filteredRows = inventoryRows.filter((row) => {
		if (categoryFilter && row.categoryKey !== categoryFilter) {
			return false;
		}

		if (row.activitySortDate && !isWithinUtcRange(row.activitySortDate, fromIso, toExclusiveIso)) {
			return false;
		}

		if (!searchTerm) {
			return true;
		}

		return [
			row.categoryLabel,
			row.itemName,
			row.identifier,
			row.serialNumber,
			row.status,
			row.locationOrApparatus,
			row.latestActivity,
			row.latestResult,
			row.dueDate,
			row.searchText,
		].join(" ").toLowerCase().includes(searchTerm);
	});

	filteredRows.sort((left, right) => {
		const order = [
			"fire-hose",
			"scba-cylinders",
			"scba-packs",
			"portable-radios",
			"portable-radio-mics",
			"fire-extinguishers",
			"thermal-cameras",
			"gas-monitors",
			"rope",
			"misc-fire-equipment",
			"ems-equipment",
			"batteries",
			"ground-ladders",
			"pie",
			"ppe",
			"ems-supplies",
		];
		const leftOrder = order.indexOf(left.categoryKey);
		const rightOrder = order.indexOf(right.categoryKey);
		if (leftOrder !== rightOrder) {
			return leftOrder - rightOrder;
		}

		return left.itemName.localeCompare(right.itemName, undefined, { numeric: true, sensitivity: "base" });
	});

	const pageSize = Math.max(1, Math.min(Number(request.pageSize) || 50, 200));
	const page = Math.max(1, Number(request.page) || 1);
	const offset = (page - 1) * pageSize;
	const pagedRows = toReportRows(filteredRows.slice(offset, offset + pageSize));

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
			basisLabel: "Inventory Activity Date",
		},
		filtersApplied: buildAppliedFilters(source, request.filters, request.searchTerm),
		summary: [
			{ label: "Total Items", value: String(filteredRows.length) },
			{ label: "Categories", value: String(new Set(filteredRows.map((row) => row.categoryKey)).size) },
			{ label: "Open Deficiencies", value: String(filteredRows.reduce((total, row) => total + row.openDeficiencies, 0)) },
			{ label: "With Activity In Period", value: String(filteredRows.filter((row) => Boolean(row.activitySortDate)).length) },
		],
		columns: source.columns,
		rows: pagedRows,
		totalRows: filteredRows.length,
		page,
		pageSize,
	};
}