import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportColumn, ReportRow } from "./types";

export type EmsInspectionType = "pediatric-bags" | "drug-boxes";
type Row = Record<string, unknown>;

export type EmsInspectionReportRecord = {
	inspectionDateRaw: string | null;
	inspectionTypeKey: EmsInspectionType;
	inspectionTypeLabel: string;
	itemId: string;
	itemName: string;
	itemIdentifier: string;
	result: string;
	inspectedBy: string;
	itemStatus: string;
	nextDueDateRaw: null;
	openDeficiencies: number;
	notes: string;
	details: ReportRow;
};

export const EMS_INSPECTION_COLUMNS: ReportColumn[] = [
	{ key: "inspection_id", label: "Inspection ID" },
	{ key: "inspection_timestamp", label: "Completed At (ISO Timestamp)" },
	{ key: "bag_label", label: "Bag" },
	{ key: "squad_number", label: "Squad" },
	{ key: "unit_number", label: "Unit" },
	{ key: "box_lock_number", label: "Box Lock #" },
	{ key: "cs_lock_number", label: "Controlled Substance Lock #" },
	{ key: "ez_io_number", label: "EZ-IO #" },
	{ key: "assisting_personnel", label: "Assisting Personnel" },
	{ key: "recorded_status", label: "Recorded Status" },
	{ key: "item_count", label: "Snapshot Items" },
	{ key: "items_unchecked", label: "Expired / Failed / Unreviewed Items" },
	{ key: "deficiency_items", label: "Deficiency Items" },
	{ key: "snapshot_deficiencies", label: "Recorded Checklist Deficiencies" },
	{ key: "checklist_results", label: "Saved Checklist Results" },
];

function text(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function rows(value: unknown): Row[] {
	return Array.isArray(value)
		? value.filter((row): row is Row => typeof row === "object" && row !== null && !Array.isArray(row))
		: [];
}

async function load(client: SupabaseClient, table: string, departmentId: string, columns = "*"): Promise<Row[]> {
	const result: Row[] = [];
	for (let offset = 0; ; offset += 1000) {
		const response = await client.from(table).select(columns).eq("department_id", departmentId)
			.order("id", { ascending: true }).range(offset, offset + 999);
		if (response.error) {
			throw new Error(`Unable to load ${table} inspection report data: ${response.error.message}`);
		}
		const page = rows(response.data);
		result.push(...page.filter((row) => row.department_id === departmentId));
		if (page.length < 1000) return result;
	}
}

export async function loadEmsInspectionRecords(
	client: SupabaseClient,
	departmentId: string,
	type: EmsInspectionType,
): Promise<EmsInspectionReportRecord[]> {
	const pediatric = type === "pediatric-bags";
	const prefix = pediatric ? "pediatric_bag" : "drug_box";
	const [inspections, snapshots, members, bags, sessions, participants] = await Promise.all([
		load(client, `${prefix}_inspections`, departmentId),
		load(client, `${prefix}_checklist_results`, departmentId),
		load(client, "members", departmentId, "id, department_id, first_name, last_name"),
		pediatric ? load(client, "pediatric_bags", departmentId) : Promise.resolve([]),
		pediatric ? load(client, "pediatric_bag_checklist_sessions", departmentId) : Promise.resolve([]),
		pediatric ? load(client, "pediatric_bag_check_session_members", departmentId) : Promise.resolve([]),
	]);
	const memberNames = new Map(members.map((member) => [
		text(member.id), `${text(member.first_name)} ${text(member.last_name)}`.trim() || "Unknown",
	]));
	const bagLabels = new Map(bags.map((bag) => [text(bag.id), text(bag.bag_label)]));
	const inspectionIds = new Set(inspections.map((inspection) => text(inspection.id)));
	const results = new Map<string, Row[]>();
	for (const snapshot of snapshots) {
		const id = text(snapshot.inspection_id);
		if (!inspectionIds.has(id)) continue;
		const group = results.get(id) ?? [];
		group.push(snapshot);
		results.set(id, group);
	}
	const sessionInspections = new Map(sessions
		.filter((session) => inspectionIds.has(text(session.completed_inspection_id)))
		.map((session) => [text(session.id), text(session.completed_inspection_id)]));
	const helpers = new Map<string, Set<string>>();
	// Check department ownership at every link, not only on the producing inspection.
	for (const participant of participants) {
		const inspectionId = sessionInspections.get(text(participant.session_id));
		const memberId = text(participant.member_id);
		if (!inspectionId || !memberNames.has(memberId)) continue;
		const ids = helpers.get(inspectionId) ?? new Set<string>();
		ids.add(memberId);
		helpers.set(inspectionId, ids);
	}
	return inspections.map((inspection) => {
		const id = text(inspection.id);
		const items = (results.get(id) ?? []).sort((a, b) => Number(a.item_order ?? 0) - Number(b.item_order ?? 0));
		const status = (item: Row) => pediatric ? text(item.result_status) : item.is_checked === true ? "checked" : "expired";
		const unchecked = items.filter((item) => !["checked", "not_applicable"].includes(status(item))).length;
		const expired = items.filter((item) => status(item) === "expired").length;
		const deficiencies = items.filter((item) => status(item) === "deficiency");
		const recordedStatus = text(inspection.status);
		const overall = items.length === 0 ? "Snapshot Unavailable"
			: recordedStatus === "out_of_service" ? "Out of Service"
				: deficiencies.length > 0 ? "Deficiencies Reported"
					: unchecked > expired ? "Items Need Review"
						: expired > 0 ? "Items Expired"
							: recordedStatus === "needs_attention" ? "Needs Attention" : "Ready for Service";
		const bagLabel = pediatric ? bagLabels.get(text(inspection.pediatric_bag_id)) || "Unknown Bag" : "-";
		const squad = text(inspection.squad_number);
		const inspectorId = text(inspection.member_id);
		const inspector = memberNames.get(inspectorId) ?? "Unknown";
		const personnel = pediatric
			? [...(helpers.get(id) ?? [])].filter((memberId) => memberId !== inspectorId).map((memberId) => memberNames.get(memberId) ?? "Unknown")
			: Array.isArray(inspection.assisting_personnel) ? inspection.assisting_personnel.map(text).filter(Boolean) : [];
		const details: ReportRow = {
			inspection_id: id,
			inspection_timestamp: text(inspection.created_at) || "-",
			bag_label: bagLabel,
			squad_number: squad || "-",
			unit_number: text(inspection.unit_number) || "-",
			box_lock_number: text(inspection.box_lock_number) || "-",
			cs_lock_number: text(inspection.cs_lock_number) || "-",
			ez_io_number: text(inspection.ez_io_number) || "-",
			inspector,
			assisting_personnel: personnel.join(", ") || "-",
			overall_status: overall,
			overall_result: overall,
			recorded_status: recordedStatus || "-",
			item_count: items.length,
			items_unchecked: items.length ? String(unchecked) : null,
			items_missing: items.length ? String(unchecked) : null,
			deficiency_items: deficiencies.map((item) => text(item.item_label_snapshot) || "Unnamed item").join(", ") || "-",
			snapshot_deficiencies: deficiencies.length,
			checklist_results: items.map((item) => {
				const quantity = text(item.source_quantity_text_snapshot) || String(item.required_quantity_snapshot ?? "");
				return `${text(item.section_name_snapshot)} / ${text(item.item_label_snapshot) || "Unnamed item"}${quantity ? ` (${quantity})` : ""}: ${status(item) || "unknown"}`;
			}).join("; ") || "Snapshot Unavailable",
		};
		return {
			inspectionDateRaw: text(inspection.created_at) || null,
			inspectionTypeKey: type,
			inspectionTypeLabel: pediatric ? "Pediatric Bag Inspection" : "Drug Box Inspection",
			itemId: text(pediatric ? inspection.pediatric_bag_id : inspection.drug_box_id) || squad || id,
			itemName: pediatric ? `Pediatric Bag ${bagLabel}` : `Drug Box ${squad || "Unknown"}`,
			itemIdentifier: pediatric ? bagLabel : squad || "-",
			result: overall,
			inspectedBy: inspector,
			itemStatus: recordedStatus || overall,
			nextDueDateRaw: null,
			openDeficiencies: 0,
			notes: text(inspection.notes) || "-",
			details,
		};
	});
}
