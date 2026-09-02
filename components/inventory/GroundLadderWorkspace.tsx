"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import GroundLadderFormModal, { GroundLadderFormValues } from "@/components/inventory/GroundLadderFormModal";
import GroundLadderAssignmentModal, { GroundLadderAssignmentValues } from "@/components/inventory/GroundLadderAssignmentModal";
import type {
	ApparatusOption,
	GroundLadderAssignmentRecord,
	GroundLadderMaintenanceItemRecord,
	GroundLadderMaintenanceRecord,
	GroundLadderMaintenanceSettingsRecord,
	GroundLadderRecord,
	GroundLadderServiceTestRecord,
} from "@/app/inventory/ground-ladders/data";

const STATION_SUPPLY_OPTION = {
	id: "station-supply",
	label: "Station Supply",
};

const STATUS_FILTERS = ["All", "In Service", "Unassigned", "Out of Service", "Retired"];
const DETAIL_TABS = ["Overview", "Assignment", "Service Testing", "Maintenance", "History"] as const;

type DetailTab = (typeof DETAIL_TABS)[number];

type MemberRecord = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

type LadderEvent = {
	type: string;
	label: string;
	description: string;
	occurredAt: string;
	statusTone: "green" | "amber" | "red" | "neutral";
};

type GroundLadderServiceTestFormValues = {
	testDate: string;
	testerType: "Department Member" | "External Tester" | "Company";
	memberId: string;
	externalTesterName: string;
	companyName: string;
	result: "Pass" | "Fail";
	notes: string;
};

type GroundLadderInspectionResult = "ready" | "ready-with-deficiencies" | "out-of-service";

type GroundLadderDeficiencyHistoryRecord = {
	id: string;
	ground_ladder_id: string;
	title: string | null;
	status_name: string | null;
	status_active: boolean | null;
	created_at: string | null;
	resolved_at: string | null;
};

const GROUND_LADDER_PROCEDURE_ITEMS = [
	"Beams & Rungs",
	"Welds & Rivets",
	"Butt Spurs",
	"Pawls / Dogs",
	"Roof Hooks",
	"Pulleys & Halyards",
	"Slide Guides",
	"Heat Sensor Labels",
	"Warning/Data Plates",
	"Cleanliness",
];

function toTitleCase(value: string) {
	return value
		.split(" ")
		.filter(Boolean)
		.map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
		.join(" ");
}

function normalizeStatus(status: string | null | undefined) {
	if (!status) {
		return "Unassigned";
	}

	const normalized = status.trim().toLowerCase();
	if (normalized === "in service") {
		return "In Service";
	}
	if (normalized === "unassigned") {
		return "Unassigned";
	}
	if (normalized === "out of service") {
		return "Out of Service";
	}
	if (normalized === "lost") {
		return "Lost";
	}
	if (normalized === "stolen") {
		return "Stolen";
	}
	if (normalized === "retired") {
		return "Retired";
	}

	return toTitleCase(status);
}

function statusClasses(status: string) {
	if (status === "In Service") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Unassigned") {
		return "border-amber-700/40 bg-amber-900/20 text-amber-300";
	}

	if (status === "Out of Service" || status === "Lost" || status === "Stolen") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}

	if (status === "Retired") {
		return "border-neutral-600/40 bg-neutral-800 text-neutral-300";
	}

	return "border-white/15 bg-neutral-900 text-neutral-200";
}

function detailToneClasses(tone: "green" | "amber" | "red" | "neutral") {
	if (tone === "green") {
		return "border-green-700/30 bg-green-950/20 text-green-200";
	}

	if (tone === "amber") {
		return "border-amber-700/30 bg-amber-950/20 text-amber-200";
	}

	if (tone === "red") {
		return "border-red-700/30 bg-red-950/20 text-red-200";
	}

	return "border-neutral-700/30 bg-neutral-900/40 text-neutral-200";
}

function formatDate(value: string | null | undefined) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
}

function formatDateTime(value: string | null | undefined) {
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
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatLength(value: number | null | undefined) {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return "-";
	}

	return `${value} ft`;
}

function normalizeLadderNumber(value: string | null | undefined) {
	if (typeof value !== "string") {
		return "";
	}

	return decodeURIComponent(value).trim().toUpperCase();
}

function compareLadderNumbers(left: string | null | undefined, right: string | null | undefined) {
	const leftValue = normalizeLadderNumber(left);
	const rightValue = normalizeLadderNumber(right);

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

function compareByDateDesc(left: string | null | undefined, right: string | null | undefined) {
	const leftTime = left ? new Date(left).getTime() : 0;
	const rightTime = right ? new Date(right).getTime() : 0;
	return rightTime - leftTime;
}

function compareWithToday(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (parsed.getTime() < today.getTime()) {
		return "past";
	}

	if (parsed.getTime() === today.getTime()) {
		return "today";
	}

	return "future";
}

function getAssignmentLabel(
	assignment: GroundLadderAssignmentRecord | null | undefined,
	apparatusLookup: Map<string, ApparatusOption>,
) {
	if (!assignment) {
		return "Unassigned";
	}

	if (assignment.assignment_type === "Apparatus") {
		return `Apparatus: ${apparatusLookup.get(assignment.apparatus_id ?? "")?.name || "Unknown Apparatus"}`;
	}

	if (assignment.assignment_type === "Station") {
		return assignment.station_name?.trim() || "Station Supply";
	}

	return "Unassigned";
}

function getServiceTestStatus(latestTest: GroundLadderServiceTestRecord | null | undefined) {
	if (!latestTest) {
		return { label: "No Service Test", tone: "amber" as const };
	}

	const comparison = compareWithToday(latestTest.next_test_due_date);
	if (comparison === "past") {
		return { label: "Overdue", tone: "red" as const };
	}

	if (comparison === "today") {
		return { label: "Due Today", tone: "amber" as const };
	}

	return { label: "Current", tone: "green" as const };
}

function getMaintenanceStatus(latestMaintenance: GroundLadderMaintenanceRecord | null | undefined) {
	if (!latestMaintenance) {
		return { label: "No Maintenance", tone: "amber" as const };
	}

	const comparison = compareWithToday(latestMaintenance.next_maintenance_due);
	if (comparison === "past") {
		return { label: "Overdue", tone: "red" as const };
	}

	if (comparison === "today") {
		return { label: "Due Today", tone: "amber" as const };
	}

	return { label: "Current", tone: "green" as const };
}

function getLadderTypeOptions() {
	return ["Folding / Attic", "Roof", "Extension"];
}

function getLengthOptions(ladderType: string | null | undefined) {
	if (ladderType === "Folding / Attic") {
		return [8, 10, 12, 14];
	}

	if (ladderType === "Roof") {
		return [14, 16, 20];
	}

	if (ladderType === "Extension") {
		return [24, 28, 35, 40];
	}

	return [8, 10, 12, 14];
}

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function addOneYearToIsoDate(value: string) {
	if (!value) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	parsed.setFullYear(parsed.getFullYear() + 1);
	return parsed.toISOString().split("T")[0];
}

function addMonthsToIsoDate(dateValue: string, months: number) {
	const baseDate = new Date(`${dateValue}T00:00:00`);
	if (Number.isNaN(baseDate.getTime())) {
		return null;
	}

	const year = baseDate.getUTCFullYear();
	const month = baseDate.getUTCMonth();
	const day = baseDate.getUTCDate();
	const targetDate = new Date(Date.UTC(year, month + months, day));

	if (targetDate.getUTCDate() !== day) {
		targetDate.setUTCDate(0);
	}

	return targetDate.toISOString().slice(0, 10);
}

function toGroundLadderFormValues(row: GroundLadderRecord): GroundLadderFormValues {
	const ladderType = row.ladder_type || "Folding / Attic";
	const lengthOptions = getLengthOptions(ladderType);

	return {
		ladderNumber: row.ladder_number,
		ladderType,
		ladderLengthFt: row.ladder_length_ft ? String(row.ladder_length_ft) : String(lengthOptions[0] ?? 8),
		manufacturer: row.manufacturer ?? "",
		model: row.model ?? "",
		serialNumber: row.serial_number ?? "",
		inServiceDate: row.in_service_date ?? "",
		status: normalizeStatus(row.status) as GroundLadderFormValues["status"],
		assignmentType: "Unassigned",
		apparatusId: "",
		stationName: "Station Supply",
		notes: row.notes ?? "",
	};
}

function getServiceTestTesterLabel(record: GroundLadderServiceTestRecord, memberLookup: Map<string, string>) {
	if (record.tester_type === "Department Member" && record.member_id) {
		return memberLookup.get(record.member_id) || record.member_id;
	}

	if (record.tester_type === "External Tester") {
		return record.external_tester_name || "External Tester";
	}

	if (record.tester_type === "Company") {
		if (record.external_tester_name && record.company_name) {
			return `${record.external_tester_name} (${record.company_name})`;
		}

		return record.company_name || record.external_tester_name || "Company";
	}

	return record.external_tester_name || record.company_name || "Unknown";
}

function getMaintenancePerformerLabel(record: GroundLadderMaintenanceRecord, memberLookup: Map<string, string>) {
	if (record.performed_by_member_id) {
		return memberLookup.get(record.performed_by_member_id) || record.performed_by_member_id;
	}

	return record.performed_by_name || "Unknown";
}

function buildDeficiencyHref(
	ladder: GroundLadderRecord,
	assignment: GroundLadderAssignmentRecord | null | undefined,
	returnTo: string,
) {
	const params = new URLSearchParams();
	params.set("returnTo", returnTo);
	params.set("inventoryCategory", "ground-ladders");
	params.set("inventoryItemId", ladder.id);
	params.set("inventoryItemLabel", ladder.ladder_number);

	if (assignment?.assignment_type === "Apparatus" && assignment.apparatus_id) {
		params.set("apparatusId", assignment.apparatus_id);
	} else {
		params.set("apparatusId", STATION_SUPPLY_OPTION.id);
	}

	return `/deficiencies/report?${params.toString()}`;
}

interface GroundLadderWorkspaceProps {
	departmentId: string | null;
	departmentName: string | null;
	initialRows: GroundLadderRecord[];
	initialAssignments: GroundLadderAssignmentRecord[];
	initialServiceTests: GroundLadderServiceTestRecord[];
	initialMaintenanceSettings: GroundLadderMaintenanceSettingsRecord | null;
	initialMaintenanceRecords: GroundLadderMaintenanceRecord[];
	initialMaintenanceItems: GroundLadderMaintenanceItemRecord[];
	apparatusOptions: ApparatusOption[];
	selectedLadderNumber?: string | null;
	canDeleteLadder: boolean;
}

export default function GroundLadderWorkspace({
	departmentId,
	departmentName = null,
	initialRows,
	initialAssignments,
	initialServiceTests,
	initialMaintenanceSettings,
	initialMaintenanceRecords,
	initialMaintenanceItems,
	apparatusOptions,
	selectedLadderNumber = null,
	canDeleteLadder,
}: GroundLadderWorkspaceProps) {
	const router = useRouter();
	const [rows, setRows] = useState<GroundLadderRecord[]>(initialRows);
	const [assignments, setAssignments] = useState<GroundLadderAssignmentRecord[]>(initialAssignments);
	const [serviceTests, setServiceTests] = useState<GroundLadderServiceTestRecord[]>(initialServiceTests);
	const [maintenanceSettings, setMaintenanceSettings] = useState<GroundLadderMaintenanceSettingsRecord | null>(initialMaintenanceSettings);
	const [maintenanceRecords, setMaintenanceRecords] = useState<GroundLadderMaintenanceRecord[]>(initialMaintenanceRecords);
	const [maintenanceItems, setMaintenanceItems] = useState<GroundLadderMaintenanceItemRecord[]>(initialMaintenanceItems);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
	const [editLadder, setEditLadder] = useState<GroundLadderRecord | null>(null);
	const [assignmentLadder, setAssignmentLadder] = useState<GroundLadderRecord | null>(null);
	const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
	const [isSavingForm, setIsSavingForm] = useState(false);
	const [isSavingAssignment, setIsSavingAssignment] = useState(false);
	const [isServiceTestOpen, setIsServiceTestOpen] = useState(false);
	const [serviceTestLadder, setServiceTestLadder] = useState<GroundLadderRecord | null>(null);
	const [isCategoryServiceTestOpen, setIsCategoryServiceTestOpen] = useState(false);
	const [isSavingServiceTest, setIsSavingServiceTest] = useState(false);
	const [serviceTestErrorMessage, setServiceTestErrorMessage] = useState<string | null>(null);
	const [isInspectionOpen, setIsInspectionOpen] = useState(false);
	const [inspectionLadder, setInspectionLadder] = useState<GroundLadderRecord | null>(null);
	const [inspectionResult, setInspectionResult] = useState<GroundLadderInspectionResult | null>(null);
	const [inspectionCertified, setInspectionCertified] = useState(false);
	const [inspectionNotes, setInspectionNotes] = useState("");
	const [inspectionErrorMessage, setInspectionErrorMessage] = useState<string | null>(null);
	const [isSavingInspection, setIsSavingInspection] = useState(false);
	const [isProceduresOpen, setIsProceduresOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [toastVisible, setToastVisible] = useState(false);
	const [selectedTab, setSelectedTab] = useState<DetailTab>("Overview");
	const [selectedDetailLadder, setSelectedDetailLadder] = useState<string | null>(selectedLadderNumber);
	const [activeDeficiencyByLadderId, setActiveDeficiencyByLadderId] = useState<Record<string, boolean>>({});
	const [memberDirectory, setMemberDirectory] = useState<MemberRecord[]>([]);
	const [deficiencyHistoryByLadderId, setDeficiencyHistoryByLadderId] = useState<Record<string, GroundLadderDeficiencyHistoryRecord[]>>({});

	useEffect(() => {
		setRows(initialRows);
	}, [initialRows]);

	useEffect(() => {
		setAssignments(initialAssignments);
	}, [initialAssignments]);

	useEffect(() => {
		setServiceTests(initialServiceTests);
	}, [initialServiceTests]);

	useEffect(() => {
		setMaintenanceSettings(initialMaintenanceSettings);
	}, [initialMaintenanceSettings]);

	useEffect(() => {
		setMaintenanceRecords(initialMaintenanceRecords);
	}, [initialMaintenanceRecords]);

	useEffect(() => {
		setMaintenanceItems(initialMaintenanceItems);
	}, [initialMaintenanceItems]);

	useEffect(() => {
		setSelectedDetailLadder(selectedLadderNumber ? normalizeLadderNumber(selectedLadderNumber) : null);
		setSelectedTab("Overview");
	}, [selectedLadderNumber]);

	useEffect(() => {
		if (!toastMessage) {
			return;
		}

		setToastVisible(true);
		const timeout = window.setTimeout(() => setToastVisible(false), 4000);
		return () => window.clearTimeout(timeout);
	}, [toastMessage]);

	useEffect(() => {
		let isMounted = true;

		const buildActiveDeficiencyMap = async () => {
			const ladderIds = rows
				.map((row) => row.id)
				.filter((id): id is string => typeof id === "string" && id.length > 0);

			if (ladderIds.length === 0) {
				if (isMounted) {
					setActiveDeficiencyByLadderId({});
				}
				return;
			}

			const { data, error } = await supabase
				.from("deficiencies")
				.select("ground_ladder_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
				.in("ground_ladder_id", ladderIds);

			if (error) {
				if (isMounted) {
					setToastMessage(error.message || "Unable to verify linked deficiencies.");
				}
				return;
			}

			const nextMap: Record<string, boolean> = {};
			for (const row of data ?? []) {
				const ladderId = row.ground_ladder_id;
				if (typeof ladderId !== "string" || !ladderId) {
					continue;
				}

				const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
				const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
				if (statusName === "resolved" || statusName === "closed") {
					continue;
				}

				if (statusInfo?.active === true || !statusName) {
					nextMap[ladderId] = true;
				}
			}

			if (isMounted) {
				setActiveDeficiencyByLadderId(nextMap);
			}
		};

		void buildActiveDeficiencyMap();

		return () => {
			isMounted = false;
		};
	}, [rows]);

	useEffect(() => {
		if (!departmentId) {
			setMemberDirectory([]);
			return;
		}

		let isMounted = true;

		const loadMembers = async () => {
			const { data, error } = await supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", departmentId)
				.order("last_name", { ascending: true })
				.order("first_name", { ascending: true });

			if (error) {
				if (isMounted) {
					setToastMessage(error.message || "Unable to load members.");
				}
				return;
			}

			if (isMounted) {
				setMemberDirectory((data ?? []) as MemberRecord[]);
			}
		};

		void loadMembers();

		return () => {
			isMounted = false;
		};
	}, [departmentId]);

	useEffect(() => {
		let isMounted = true;

		const loadDeficiencyHistory = async () => {
			const ladderIds = rows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id.length > 0);

			if (ladderIds.length === 0) {
				if (isMounted) {
					setDeficiencyHistoryByLadderId({});
				}
				return;
			}

			const { data, error } = await supabase
				.from("deficiencies")
				.select("id, ground_ladder_id, title, created_at, resolved_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active)")
				.in("ground_ladder_id", ladderIds);

			if (error) {
				if (isMounted) {
					setToastMessage(error.message || "Unable to load deficiency history.");
				}
				return;
			}

			const nextMap: Record<string, GroundLadderDeficiencyHistoryRecord[]> = {};
			for (const row of data ?? []) {
				const ladderId = row.ground_ladder_id;
				if (typeof ladderId !== "string" || !ladderId) {
					continue;
				}

				const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
				const record: GroundLadderDeficiencyHistoryRecord = {
					id: row.id,
					ground_ladder_id: ladderId,
					title: typeof row.title === "string" ? row.title : null,
					status_name: typeof statusInfo?.name === "string" ? statusInfo.name : null,
					status_active: typeof statusInfo?.active === "boolean" ? statusInfo.active : null,
					created_at: typeof row.created_at === "string" ? row.created_at : null,
					resolved_at: typeof row.resolved_at === "string" ? row.resolved_at : null,
				};

				const bucket = nextMap[ladderId] ?? [];
				bucket.push(record);
				nextMap[ladderId] = bucket;
			}

			if (isMounted) {
				setDeficiencyHistoryByLadderId(nextMap);
			}
		};

		void loadDeficiencyHistory();

		return () => {
			isMounted = false;
		};
	}, [rows]);

	useEffect(() => {
		let isMounted = true;

		const loadCurrentMember = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const email = user?.email?.trim();
			if (!email || !isMounted) {
				return;
			}

			const { data } = await supabase
				.from("members")
				.select("id")
				.eq("email", email)
				.maybeSingle();

			if (!isMounted) {
				return;
			}

			setCurrentMemberId(typeof data?.id === "string" ? data.id : null);
		};

		void loadCurrentMember();

		return () => {
			isMounted = false;
		};
	}, []);

	const apparatusLookup = useMemo(
		() => new Map(apparatusOptions.map((option) => [option.id, option] as const)),
		[apparatusOptions],
	);

	const memberLookup = useMemo(() => {
		const lookup = new Map<string, string>();
		for (const member of memberDirectory) {
			const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
			const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
			const label = `${firstName} ${lastName}`.trim() || member.id;
			lookup.set(member.id, label);
		}
		return lookup;
	}, [memberDirectory]);

	const activeAssignmentByLadderId = useMemo(() => {
		const entries = assignments
			.filter((assignment) => !assignment.ended_at)
			.sort((left, right) => compareByDateDesc(left.assigned_at, right.assigned_at))
			.map((assignment) => [assignment.ground_ladder_id, assignment] as const);

		return new Map<string, GroundLadderAssignmentRecord>(entries);
	}, [assignments]);

	const latestServiceTestByLadderId = useMemo(() => {
		const nextMap = new Map<string, GroundLadderServiceTestRecord>();
		for (const record of [...serviceTests].sort((left, right) => compareByDateDesc(left.test_date, right.test_date))) {
			if (!nextMap.has(record.ground_ladder_id)) {
				nextMap.set(record.ground_ladder_id, record);
			}
		}
		return nextMap;
	}, [serviceTests]);

	const latestMaintenanceByLadderId = useMemo(() => {
		const nextMap = new Map<string, GroundLadderMaintenanceRecord>();
		for (const record of [...maintenanceRecords].sort((left, right) => compareByDateDesc(left.maintenance_date, right.maintenance_date))) {
			if (!nextMap.has(record.ground_ladder_id)) {
				nextMap.set(record.ground_ladder_id, record);
			}
		}
		return nextMap;
	}, [maintenanceRecords]);

	const maintenanceItemsByMaintenanceId = useMemo(() => {
		const nextMap = new Map<string, GroundLadderMaintenanceItemRecord[]>();
		for (const item of maintenanceItems) {
			const bucket = nextMap.get(item.maintenance_id) ?? [];
			bucket.push(item);
			nextMap.set(item.maintenance_id, bucket);
		}
		for (const bucket of nextMap.values()) {
			bucket.sort((left, right) => left.check_order - right.check_order);
		}
		return nextMap;
	}, [maintenanceItems]);

	const selectedLadder = useMemo(() => {
		if (!selectedDetailLadder) {
			return null;
		}

		const normalizedSelection = normalizeLadderNumber(selectedDetailLadder);
		return rows.find((row) => normalizeLadderNumber(row.ladder_number) === normalizedSelection) ?? null;
	}, [rows, selectedDetailLadder]);

	const sortedRows = useMemo(() => {
		return [...rows].sort((left, right) => {
			const leftRetired = normalizeStatus(left.status) === "Retired";
			const rightRetired = normalizeStatus(right.status) === "Retired";

			if (leftRetired !== rightRetired) {
				return leftRetired ? 1 : -1;
			}

			return compareLadderNumbers(left.ladder_number, right.ladder_number);
		});
	}, [rows]);

	const derivedRows = useMemo(() => {
		return sortedRows.map((row) => {
			const assignment = activeAssignmentByLadderId.get(row.id) ?? null;
			const serviceTest = latestServiceTestByLadderId.get(row.id) ?? null;
			const maintenance = latestMaintenanceByLadderId.get(row.id) ?? null;
			const serviceTestStatus = getServiceTestStatus(serviceTest);
			const maintenanceStatus = getMaintenanceStatus(maintenance);
			const status = normalizeStatus(row.status);
			const hasActiveDeficiency = activeDeficiencyByLadderId[row.id] === true;
			const displayStatus =
				status === "Retired"
					? "Retired"
					: status === "Out of Service" || status === "Lost" || status === "Stolen" || hasActiveDeficiency
						? "Out of Service"
						: status;

			let readinessTone: "green" | "amber" | "red" | "neutral" = "green";
			if (displayStatus === "Retired") {
				readinessTone = "neutral";
			} else if (displayStatus === "Out of Service") {
				readinessTone = "red";
			} else if (serviceTestStatus.tone === "red" || maintenanceStatus.tone === "red") {
				readinessTone = "red";
			} else if (displayStatus === "Unassigned" || serviceTestStatus.tone === "amber" || maintenanceStatus.tone === "amber") {
				readinessTone = "amber";
			}

			return {
				...row,
				status,
				displayStatus,
				hasActiveDeficiency,
				assignmentLabel: getAssignmentLabel(assignment, apparatusLookup),
				serviceTestStatus,
				maintenanceStatus,
				assignment,
				serviceTest,
				maintenance,
				readinessTone,
			};
		});
	}, [activeAssignmentByLadderId, activeDeficiencyByLadderId, apparatusLookup, latestMaintenanceByLadderId, latestServiceTestByLadderId, sortedRows]);

	const filteredRows = useMemo(() => {
		const search = searchTerm.trim().toLowerCase();

		return derivedRows.filter((row) => {
			if (statusFilter !== "All" && row.displayStatus !== statusFilter) {
				return false;
			}

			if (!search) {
				return true;
			}

			const haystack = [
				row.ladder_number,
				row.ladder_type,
				row.ladder_length_ft ? String(row.ladder_length_ft) : "",
				row.manufacturer,
				row.model,
				row.serial_number,
				row.assignmentLabel,
				row.status,
			]
				.filter((value): value is string => Boolean(value))
				.join(" ")
				.toLowerCase();

			return haystack.includes(search);
		});
	}, [derivedRows, searchTerm, statusFilter]);

	const metrics = useMemo(() => {
		let inService = 0;
		let unassigned = 0;
		let outOfService = 0;
		let serviceDue = 0;
		let maintenanceDue = 0;
		let activeDeficiencies = 0;

		for (const row of derivedRows) {
			if (row.displayStatus === "In Service") {
				inService += 1;
			}
			if (row.displayStatus === "Unassigned") {
				unassigned += 1;
			}
			if (row.displayStatus === "Out of Service") {
				outOfService += 1;
			}
			if (row.serviceTestStatus.label === "Overdue" || row.serviceTestStatus.label === "Due Today") {
				serviceDue += 1;
			}
			if (row.maintenanceStatus.label === "Overdue" || row.maintenanceStatus.label === "Due Today") {
				maintenanceDue += 1;
			}
			if (row.hasActiveDeficiency) {
				activeDeficiencies += 1;
			}
		}

		const total = derivedRows.length;
		const totalActive = derivedRows.filter((row) => row.displayStatus !== "Retired").length;
		const readinessScore = totalActive > 0 ? Math.round((inService / totalActive) * 100) : 0;

		return {
			total,
			totalActive,
			inService,
			unassigned,
			outOfService,
			serviceDue,
			maintenanceDue,
			activeDeficiencies,
			readinessScore,
		};
	}, [derivedRows]);

	const detailLadder =
		selectedLadder ??
		((selectedDetailLadder
			? derivedRows.find((row) => normalizeLadderNumber(row.ladder_number) === normalizeLadderNumber(selectedDetailLadder))
			: null) ?? null);
	const detailAssignment = detailLadder ? activeAssignmentByLadderId.get(detailLadder.id) ?? null : null;
	const detailServiceTests = detailLadder ? serviceTests.filter((record) => record.ground_ladder_id === detailLadder.id) : [];
	const detailMaintenanceRecords = detailLadder ? maintenanceRecords.filter((record) => record.ground_ladder_id === detailLadder.id) : [];
	const detailDeficiencies = detailLadder ? deficiencyHistoryByLadderId[detailLadder.id] ?? [] : [];
	const detailTimeline = useMemo(() => {
		if (!detailLadder) {
			return [] as LadderEvent[];
		}

		const ladderAssignments = assignments
			.filter((record) => record.ground_ladder_id === detailLadder.id)
			.map((record) => ({
				type: record.assignment_type,
				label:
					record.assignment_type === "Apparatus"
						? `Apparatus Assignment`
						: record.assignment_type === "Station"
							? "Station Supply"
							: "Unassigned",
				description:
					record.assignment_type === "Apparatus"
						? apparatusLookup.get(record.apparatus_id ?? "")?.name || "Unknown Apparatus"
						: record.station_name || "Unassigned",
					overrideTimestamp: record.assigned_at,
					tone: record.assignment_type === "Apparatus" ? ("green" as const) : record.assignment_type === "Station" ? ("amber" as const) : ("neutral" as const),
				}))
			.map((entry) => ({
				type: entry.type,
				label: entry.label,
				description: entry.description,
				occurredAt: entry.overrideTimestamp,
				statusTone: entry.tone,
			}));

		const ladderTests = detailServiceTests.map((record) => ({
			type: "Service Test",
			label: `${record.result} Service Test`,
			description: `${record.tester_type} • Due ${formatDate(record.next_test_due_date)}`,
			occurredAt: record.test_date,
			statusTone: record.result.toLowerCase() === "pass" ? ("green" as const) : ("red" as const),
		}));

		const ladderMaintenance = detailMaintenanceRecords.map((record) => ({
			type: "Maintenance",
			label: `Maintenance ${record.result}`,
			description: record.notes || "Maintenance entry",
			occurredAt: record.maintenance_date,
			statusTone: record.result.toLowerCase() === "pass" ? ("green" as const) : ("red" as const),
		}));

		const ladderDeficiencies = detailDeficiencies.flatMap((record) => {
			const events: LadderEvent[] = [];
			const deficiencyTitle = record.title?.trim() || "Deficiency";
			const statusName = record.status_name?.trim() || "Unknown";

			if (record.created_at) {
				events.push({
					type: "Deficiency",
					label: `Reported: ${deficiencyTitle}`,
					description: `Status: ${statusName}`,
					occurredAt: record.created_at,
					statusTone: "red",
				});
			}

			if (record.resolved_at) {
				events.push({
					type: "Deficiency",
					label: `Resolved: ${deficiencyTitle}`,
					description: "Deficiency resolved and closed.",
					occurredAt: record.resolved_at,
					statusTone: "green",
				});
			}

			return events;
		});

		return [...ladderAssignments, ...ladderTests, ...ladderMaintenance, ...ladderDeficiencies].sort((left, right) => compareByDateDesc(left.occurredAt, right.occurredAt));
	}, [apparatusLookup, assignments, detailDeficiencies, detailLadder, detailMaintenanceRecords, detailServiceTests]);

	useEffect(() => {
		if (!detailLadder) {
			setSelectedTab("Overview");
		}
	}, [detailLadder]);

	function openAddModal() {
		setEditLadder(null);
		setIsFormOpen(true);
	}

	function openLadderDetail(ladder: GroundLadderRecord) {
		router.push(`/inventory/ground-ladders/${encodeURIComponent(ladder.ladder_number)}`);
	}

	function openEditModal(ladder: GroundLadderRecord) {
		setEditLadder(ladder);
		setIsFormOpen(true);
	}

	function openAssignmentModal(ladder: GroundLadderRecord) {
		const currentAssignment = activeAssignmentByLadderId.get(ladder.id) ?? null;
		setAssignmentLadder(ladder);
		setIsAssignmentOpen(true);

		if (currentAssignment?.assignment_type === "Apparatus") {
			return;
		}
	}

	function openServiceTestModal(ladder: GroundLadderRecord) {
		setServiceTestLadder(ladder);
		setServiceTestErrorMessage(null);
		setIsServiceTestOpen(true);
	}

	function openInspectionModal(ladder: GroundLadderRecord) {
		setInspectionLadder(ladder);
		setInspectionResult(null);
		setInspectionCertified(false);
		setInspectionNotes("");
		setInspectionErrorMessage(null);
		setIsInspectionOpen(true);
	}

	function closeInspectionModal() {
		setIsInspectionOpen(false);
		setInspectionLadder(null);
		setInspectionResult(null);
		setInspectionCertified(false);
		setInspectionNotes("");
		setInspectionErrorMessage(null);
	}

	function openProceduresModal() {
		setIsProceduresOpen(true);
	}

	function closeProceduresModal() {
		setIsProceduresOpen(false);
	}

	async function refreshAssignmentsForLadder(ladderId: string) {
		const { data, error } = await supabase
			.from("ground_ladder_assignments")
			.select("id, department_id, ground_ladder_id, assignment_type, apparatus_id, station_name, equipment_reference, assigned_at, ended_at, assigned_by, notes, created_at")
			.eq("department_id", departmentId)
			.eq("ground_ladder_id", ladderId)
			.order("assigned_at", { ascending: false });

		if (error) {
			throw error;
		}

		setAssignments((current) => {
			const withoutTarget = current.filter((entry) => entry.ground_ladder_id !== ladderId);
			return [...withoutTarget, ...((data ?? []) as GroundLadderAssignmentRecord[])];
		});
	}

	async function handleSaveForm(values: GroundLadderFormValues) {
		if (!departmentId) {
			alert("Unable to determine department. Please refresh and try again.");
			return;
		}

		if (!values.ladderNumber.trim()) {
			alert("Ladder Number is required.");
			return;
		}

		setIsSavingForm(true);

		try {
			const payload = {
				department_id: departmentId,
				ladder_number: values.ladderNumber.trim(),
				ladder_type: values.ladderType.trim() || null,
				ladder_length_ft: values.ladderLengthFt.trim() ? Number.parseInt(values.ladderLengthFt, 10) : null,
				manufacturer: values.manufacturer.trim() || null,
				model: values.model.trim() || null,
				serial_number: values.serialNumber.trim() || null,
				in_service_date: values.inServiceDate || null,
				status: values.status,
				notes: values.notes.trim() || null,
			};

			if (editLadder) {
				const { error } = await supabase
					.from("ground_ladders")
					.update(payload)
					.eq("id", editLadder.id);

				if (error) {
					throw error;
				}
			} else {
				const { data: insertedLadder, error: insertError } = await supabase
					.from("ground_ladders")
					.insert(payload)
					.select("id")
					.single();

				if (insertError || !insertedLadder) {
					throw insertError ?? new Error("Unable to create ground ladder record.");
				}

				const today = getTodayDate();
				const defaultServiceIntervalMonths = 12;
				const serviceDueDate = addOneYearToIsoDate(today) ?? today;
				const maintenanceIntervalMonths = maintenanceSettings?.maintenance_interval_months ?? defaultServiceIntervalMonths;
				const maintenanceDueDate = addMonthsToIsoDate(today, maintenanceIntervalMonths) ?? today;

				const assignmentType = values.status === "In Service" ? values.assignmentType : "Unassigned";
				if (values.status === "In Service" && assignmentType !== "Unassigned") {
					const assignmentInsert = {
						department_id: departmentId,
						ground_ladder_id: insertedLadder.id,
						assignment_type: assignmentType,
						apparatus_id: assignmentType === "Apparatus" ? values.apparatusId || null : null,
						station_name: assignmentType === "Station" ? (values.stationName || "Station Supply").trim() || "Station Supply" : null,
						equipment_reference: null,
						assigned_by: currentMemberId,
						notes: null,
						assigned_at: new Date().toISOString(),
					};

					const { error: assignmentError } = await supabase
						.from("ground_ladder_assignments")
						.insert(assignmentInsert);

					if (assignmentError) {
						throw assignmentError;
					}
				}

				const { error: serviceTestError } = await supabase.from("ground_ladder_service_tests").insert({
					department_id: departmentId,
					ground_ladder_id: insertedLadder.id,
					test_date: today,
					tester_type: "Company",
					company_name: "Department Initial Setup",
					result: "Pass",
					notes: "Initial ladder setup",
					next_test_due_date: serviceDueDate,
				});

				if (serviceTestError) {
					throw serviceTestError;
				}

				const { error: maintenanceError } = await supabase.from("ground_ladder_maintenance").insert({
					department_id: departmentId,
					ground_ladder_id: insertedLadder.id,
					maintenance_date: today,
					performed_by_member_id: currentMemberId,
					performed_by_name: currentMemberId ? null : "Department Initial Setup",
					result: "Pass",
					notes: "Initial ladder setup",
					next_maintenance_due: maintenanceDueDate,
					maintenance_interval_months: maintenanceIntervalMonths,
				});

				if (maintenanceError) {
					throw maintenanceError;
				}
			}

			setToastMessage(editLadder ? "Ground ladder updated." : "Ground ladder created.");
			setIsFormOpen(false);
			setEditLadder(null);
			router.refresh();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to save ground ladder.";
			setToastMessage(message);
		} finally {
			setIsSavingForm(false);
		}
	}

	async function handleSaveAssignment(values: GroundLadderAssignmentValues) {
		if (!departmentId || !assignmentLadder) {
			alert("Unable to determine ladder assignment context.");
			return;
		}

		if (values.assignmentType === "Apparatus" && !values.apparatusId) {
			alert("Select an apparatus for this assignment.");
			return;
		}

		setIsSavingAssignment(true);

		try {
			const nowIso = new Date().toISOString();
			const closeResult = await supabase
				.from("ground_ladder_assignments")
				.update({ ended_at: nowIso })
				.eq("department_id", departmentId)
				.eq("ground_ladder_id", assignmentLadder.id)
				.is("ended_at", null);

			if (closeResult.error) {
				throw closeResult.error;
			}

			const insertPayload = {
				department_id: departmentId,
				ground_ladder_id: assignmentLadder.id,
				assignment_type: values.assignmentType,
				apparatus_id: values.assignmentType === "Apparatus" ? values.apparatusId : null,
				station_name: values.assignmentType === "Station" ? values.stationName.trim() || "Station Supply" : null,
				equipment_reference: null,
				assigned_by: currentMemberId,
				notes: values.notes.trim() || null,
				assigned_at: nowIso,
			};

			const insertResult = await supabase.from("ground_ladder_assignments").insert(insertPayload);
			if (insertResult.error) {
				throw insertResult.error;
			}

			await refreshAssignmentsForLadder(assignmentLadder.id);
			setToastMessage("Ground ladder assignment updated.");
			setIsAssignmentOpen(false);
			setAssignmentLadder(null);
			router.refresh();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to save assignment.";
			setToastMessage(message);
		} finally {
			setIsSavingAssignment(false);
		}
	}

	async function handleDeleteLadder() {
		if (!assignmentLadder && !editLadder) {
			return;
		}

		const target = editLadder ?? assignmentLadder;
		if (!target) {
			return;
		}

		if (!window.confirm(`Delete ladder ${target.ladder_number}? This cannot be undone.`)) {
			return;
		}

		const { error } = await supabase.from("ground_ladders").delete().eq("id", target.id);
		if (error) {
			setToastMessage(error.message || "Unable to delete ground ladder.");
			return;
		}

		setToastMessage("Ground ladder deleted.");
		setIsFormOpen(false);
		setEditLadder(null);
		router.refresh();
	}

	async function handleSaveServiceTest(values: GroundLadderServiceTestFormValues) {
		if (!departmentId || !serviceTestLadder) {
			setServiceTestErrorMessage("Unable to determine ground ladder context.");
			return;
		}

		const normalizedDate = values.testDate.trim();
		const nextDueDate = addOneYearToIsoDate(normalizedDate);
		if (!normalizedDate || !nextDueDate) {
			setServiceTestErrorMessage("Valid test date is required.");
			return;
		}

		if (values.testerType === "Department Member" && !values.memberId) {
			setServiceTestErrorMessage("Select a department member.");
			return;
		}

		if (values.testerType === "External Tester" && !values.externalTesterName.trim()) {
			setServiceTestErrorMessage("External tester name is required.");
			return;
		}

		if (values.testerType === "Company" && !values.companyName.trim()) {
			setServiceTestErrorMessage("Company name is required.");
			return;
		}

		setIsSavingServiceTest(true);
		setServiceTestErrorMessage(null);

		const insertPayload = {
			department_id: departmentId,
			ground_ladder_id: serviceTestLadder.id,
			test_date: normalizedDate,
			tester_type: values.testerType,
			member_id: values.testerType === "Department Member" ? values.memberId : null,
			external_tester_name:
				values.testerType === "Department Member"
					? null
					: values.externalTesterName.trim() || null,
			company_name: values.testerType === "Company" ? values.companyName.trim() || null : null,
			result: values.result,
			notes: values.notes.trim() || null,
			next_test_due_date: nextDueDate,
		};

		const { data: insertedRecord, error: insertError } = await supabase
			.from("ground_ladder_service_tests")
			.insert(insertPayload)
			.select("*")
			.single();

		if (insertError || !insertedRecord) {
			setIsSavingServiceTest(false);
			setServiceTestErrorMessage(insertError?.message || "Unable to save service test.");
			return;
		}

		const activeAssignment = activeAssignmentByLadderId.get(serviceTestLadder.id) ?? null;
		const hasActiveDeficiency = activeDeficiencyByLadderId[serviceTestLadder.id] === true;

		let nextStatus: string;
		if (normalizeStatus(serviceTestLadder.status) === "Retired") {
			nextStatus = "Retired";
		} else if (values.result === "Fail" || hasActiveDeficiency) {
			nextStatus = "Out of Service";
		} else if (activeAssignment && activeAssignment.assignment_type !== "Unassigned") {
			nextStatus = "In Service";
		} else {
			nextStatus = "Unassigned";
		}

		const { error: statusError } = await supabase
			.from("ground_ladders")
			.update({ status: nextStatus })
			.eq("id", serviceTestLadder.id);

		if (statusError) {
			setIsSavingServiceTest(false);
			setServiceTestErrorMessage(statusError.message || "Unable to update ladder status after service test.");
			return;
		}

		setServiceTests((current) => [insertedRecord as GroundLadderServiceTestRecord, ...current]);
		setRows((current) =>
			current.map((row) =>
				row.id === serviceTestLadder.id
					? {
						...row,
						status: nextStatus,
					  }
					: row,
			),
		);

		setIsSavingServiceTest(false);
		setIsServiceTestOpen(false);
		setServiceTestLadder(null);
		setToastMessage("Ground ladder service test recorded.");
		router.refresh();
	}

	async function handleCompleteInspection() {
		if (!departmentId || !inspectionLadder) {
			setInspectionErrorMessage("Unable to determine ground ladder context.");
			return;
		}

		if (!inspectionResult) {
			setInspectionErrorMessage("Select an overall inspection result.");
			return;
		}

		if (!inspectionCertified) {
			setInspectionErrorMessage("Certification is required before completion.");
			return;
		}

		const requiresDeficiency = inspectionResult === "ready-with-deficiencies" || inspectionResult === "out-of-service";
		if (requiresDeficiency && activeDeficiencyByLadderId[inspectionLadder.id] !== true) {
			setInspectionErrorMessage("Report at least one deficiency before completing this inspection result.");
			return;
		}

		const activeAssignment = activeAssignmentByLadderId.get(inspectionLadder.id) ?? null;
		let nextStatus: string;
		if (inspectionResult === "out-of-service") {
			nextStatus = "Out of Service";
		} else if (activeAssignment && activeAssignment.assignment_type !== "Unassigned") {
			nextStatus = "In Service";
		} else {
			nextStatus = "Unassigned";
		}

		setIsSavingInspection(true);
		setInspectionErrorMessage(null);

		const nextNotes = inspectionNotes.trim()
			? [inspectionLadder.notes?.trim(), `Inspection (${new Date().toLocaleString("en-US")}): ${inspectionResult}. ${inspectionNotes.trim()}`]
				.filter(Boolean)
				.join("\n\n")
			: inspectionLadder.notes;

		const { error } = await supabase
			.from("ground_ladders")
			.update({
				status: nextStatus,
				notes: nextNotes || null,
			})
			.eq("id", inspectionLadder.id)
			.eq("department_id", departmentId);

		setIsSavingInspection(false);

		if (error) {
			setInspectionErrorMessage(error.message || "Unable to complete ladder inspection.");
			return;
		}

		setRows((current) =>
			current.map((row) =>
				row.id === inspectionLadder.id
					? {
						...row,
						status: nextStatus,
						notes: nextNotes || null,
					  }
					: row,
			),
		);

		setToastMessage("Ground ladder inspection completed.");
		closeInspectionModal();
		router.refresh();
	}

	const handleSaveGroundLadderServiceTestSession = async (
		values: {
			testingDate: string;
			testerMode: "member" | "external";
			memberId: string;
			externalTesterName: string;
			companyName: string;
			sessionNotes: string;
			ladderNotes: Record<string, string>;
			selectedLadderIds: string[];
			results: Record<string, "Pass" | "Fail">;
		},
		options?: { routeToDeficiencyReport?: boolean },
	) => {
		if (!departmentId) {
			setToastMessage("Unable to determine department.");
			return false;
		}

		const selectedRows = rows.filter((row) => values.selectedLadderIds.includes(row.id));
		if (selectedRows.length === 0) {
			setToastMessage("Select at least one ladder to test.");
			return false;
		}

		const unselectedResults = selectedRows.filter((row) => typeof values.results[row.id] !== "string");
		if (unselectedResults.length > 0) {
			setToastMessage("Each selected ladder must be marked Pass or Fail before saving the session.");
			return false;
		}

		const normalizedDate = values.testingDate.trim();
		if (!normalizedDate) {
			setToastMessage("Test date is required.");
			return false;
		}

		if (values.testerMode === "member" && !values.memberId) {
			setToastMessage("Select the department member who performed the test.");
			return false;
		}

		if (values.testerMode === "external" && !values.externalTesterName.trim()) {
			setToastMessage("External tester name is required.");
			return false;
		}

		if (values.testerMode === "external" && !values.companyName.trim()) {
			setToastMessage("External tester company or organization is required.");
			return false;
		}

		const failedRowsMissingDeficiency = selectedRows.filter((row) => {
			const result = values.results[row.id];
			return result === "Fail" && activeDeficiencyByLadderId[row.id] !== true;
		});

		if (failedRowsMissingDeficiency.length > 0 && !options?.routeToDeficiencyReport) {
			setToastMessage("Failed ladders must have deficiency reports. Use Save + Report Failed Ladders.");
			return false;
		}

		const inserts = selectedRows.map((row) => {
			const result = values.results[row.id];
			const nextDueDate = addOneYearToIsoDate(normalizedDate) ?? normalizedDate;
			const ladderNote = (values.ladderNotes[row.id] ?? "").trim();
			return {
				department_id: departmentId,
				ground_ladder_id: row.id,
				test_date: normalizedDate,
				tester_type: values.testerMode === "member" ? "Department Member" : "External Tester",
				member_id: values.testerMode === "member" ? values.memberId : null,
				external_tester_name: values.testerMode === "external" ? values.externalTesterName.trim() || "External Tester" : null,
				company_name: values.testerMode === "external" ? values.companyName.trim() || null : null,
				result,
				notes: ladderNote || values.sessionNotes.trim() || `Annual service test: ${result}`,
				next_test_due_date: nextDueDate,
			};
		});

		const { error } = await supabase.from("ground_ladder_service_tests").insert(inserts);
		if (error) {
			setToastMessage(error.message || "Unable to save ladder service test session.");
			return false;
		}

		const nextRows = rows.map((row) => {
			if (!values.selectedLadderIds.includes(row.id)) {
				return row;
			}

			const result = values.results[row.id];
			if (!result) {
				return row;
			}

			const hasCurrentAssignment = activeAssignmentByLadderId.get(row.id)?.assignment_type !== "Unassigned";
			const nextStatus = result === "Fail" ? "Out of Service" : hasCurrentAssignment ? "In Service" : "Unassigned";
			return { ...row, status: nextStatus };
		});

		setRows(nextRows);
		setIsCategoryServiceTestOpen(false);

		if (options?.routeToDeficiencyReport && failedRowsMissingDeficiency.length > 0) {
			const firstFailed = failedRowsMissingDeficiency[0];
			const firstFailedAssignment = activeAssignmentByLadderId.get(firstFailed.id) ?? null;
			const deficiencyHref = buildDeficiencyHref(firstFailed, firstFailedAssignment, "/inventory/ground-ladders");
			setToastMessage(`Session saved. Report the failed ladder deficiency for ${firstFailed.ladder_number}.`);
			router.push(deficiencyHref);
			return true;
		}

		setToastMessage(`Recorded service tests for ${selectedRows.length} ladders.`);
		router.refresh();
		return true;
	};

	const handleSaveGroundLadderServiceTestSessionAndReportFailures = (
		values: {
			testingDate: string;
			testerMode: "member" | "external";
			memberId: string;
			externalTesterName: string;
			companyName: string;
			sessionNotes: string;
			ladderNotes: Record<string, string>;
			selectedLadderIds: string[];
			results: Record<string, "Pass" | "Fail">;
		},
	) => {
		void handleSaveGroundLadderServiceTestSession(values, { routeToDeficiencyReport: true });
	};

	const topSummaryCards = [
		{ label: "Total Active Ladders", value: metrics.totalActive, tone: "ready" as const, filter: "All" },
		{ label: "In Service", value: metrics.inService, tone: "ready" as const, filter: "In Service" },
		{ label: "Out of Service", value: metrics.outOfService, tone: "out-of-service" as const, filter: "Out of Service" },
		{ label: "Retired", value: metrics.total - metrics.totalActive, tone: "retired" as const, filter: "Retired" },
	];

	const currentAssignments = useMemo(() => {
		return filteredRows.map((row) => ({
			...row,
			detailLink: `/inventory/ground-ladders/${encodeURIComponent(row.ladder_number)}`,
			statusClass: statusClasses(row.status),
		}));
	}, [filteredRows]);

	if (detailLadder) {
		const detailServiceStatus = getServiceTestStatus(latestServiceTestByLadderId.get(detailLadder.id));
		const detailMaintenanceStatus = getMaintenanceStatus(latestMaintenanceByLadderId.get(detailLadder.id));
		const latestMaintenance = latestMaintenanceByLadderId.get(detailLadder.id) ?? null;
		const detailService = latestServiceTestByLadderId.get(detailLadder.id) ?? null;
		const detailAssignmentLabel = getAssignmentLabel(detailAssignment, apparatusLookup);
		const detailReturnTo = `/inventory/ground-ladders/${encodeURIComponent(detailLadder.ladder_number)}`;
		const detailDeficiencyHref = buildDeficiencyHref(detailLadder, detailAssignment, detailReturnTo);
		const maintenanceParams = new URLSearchParams();
		if (detailAssignment?.assignment_type === "Apparatus" && detailAssignment.apparatus_id) {
			maintenanceParams.set("apparatusId", detailAssignment.apparatus_id);
		}
		maintenanceParams.set("returnTo", detailReturnTo);
		const maintenanceHref = `/maintenance/perform?${maintenanceParams.toString()}`;

		return (
			<div className="space-y-6">
				{toastVisible && toastMessage ? (
					<div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-[#2E2E2E] px-4 py-3 text-sm text-red-200 shadow-lg">
						<div className="flex items-center gap-3">
							<span>{toastMessage}</span>
							<button
								type="button"
								onClick={() => setToastVisible(false)}
								className="text-red-200/80 transition hover:text-red-100"
							>
								Dismiss
							</button>
						</div>
					</div>
				) : null}

<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Ground Ladder</p>
							<h1 className="mt-2 text-5xl font-black tracking-tight text-white">{detailLadder.ladder_number}</h1>
							<p className="mt-3 max-w-2xl text-lg text-neutral-400">
								{detailLadder.ladder_type || "Ground Ladder"} • {formatLength(detailLadder.ladder_length_ft)}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(normalizeStatus(detailLadder.status))}`}>
								{normalizeStatus(detailLadder.status)}
							</span>
							<button
								type="button"
								onClick={() => openInspectionModal(detailLadder)}
								className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
							>
								Inspect Ladder
							</button>
							<button
								type="button"
								onClick={() => openServiceTestModal(detailLadder)}
								className="inline-flex rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
							>
								Service Testing
							</button>
							<Link
								href="/inventory/ground-ladders"
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Back to Ground Ladders
							</Link>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-4">
						<SummaryCard label="Current Assignment" value={detailAssignmentLabel} tone={detailAssignment?.assignment_type === "Apparatus" ? "green" : detailAssignment?.assignment_type === "Station" ? "amber" : "neutral"} />
						<SummaryCard label="Service Test" value={detailServiceStatus.label} tone={detailServiceStatus.tone} subValue={detailService?.next_test_due_date ? `Due ${formatDate(detailService.next_test_due_date)}` : "No test on file"} />
						<SummaryCard label="Maintenance" value={detailMaintenanceStatus.label} tone={detailMaintenanceStatus.tone} subValue={latestMaintenance?.next_maintenance_due ? `Due ${formatDate(latestMaintenance.next_maintenance_due)}` : "No maintenance on file"} />
						<SummaryCard label="Deficiency" value={activeDeficiencyByLadderId[detailLadder.id] ? "Active Deficiency" : "No Active Deficiency"} tone={activeDeficiencyByLadderId[detailLadder.id] ? "red" : "green"} />
					</div>

					<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Inventory Profile</p>
						<h2 className="mt-2 text-2xl font-black tracking-tight text-white">General Information</h2>
						<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							<DetailField label="Ladder Number" value={detailLadder.ladder_number} />
							<DetailField label="Ladder Type" value={detailLadder.ladder_type || "-"} />
							<DetailField label="Length" value={formatLength(detailLadder.ladder_length_ft)} />
							<DetailField label="Manufacturer" value={detailLadder.manufacturer || "-"} />
							<DetailField label="Model" value={detailLadder.model || "-"} />
							<DetailField label="Serial Number" value={detailLadder.serial_number || "-"} />
							<DetailField label="In-Service Date" value={formatDate(detailLadder.in_service_date)} />
							<DetailField label="Current Status" value={detailLadder.status} />
							<DetailField label="Current Assignment" value={detailAssignmentLabel} />
						</div>
					</section>

					<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Inspection Records</p>
						<h2 className="mt-2 text-2xl font-black tracking-tight text-white">Service Testing</h2>
						<div className="mt-4 mb-4 grid gap-4 md:grid-cols-3">
							<DetailField label="Latest Test Date" value={detailService ? formatDate(detailService.test_date) : "-"} />
							<DetailField label="Next Test Due" value={detailService ? formatDate(detailService.next_test_due_date) : "-"} />
							<DetailField label="Test Status" value={detailServiceStatus.label} />
						</div>
						<div className="mb-4 flex flex-wrap items-center gap-2" />
						<DataTable
							columns={["Test Date", "Tester Type", "Tester", "Result", "Next Due", "Notes"]}
							rows={detailServiceTests
								.sort((left, right) => compareByDateDesc(left.test_date, right.test_date))
								.map((record) => [
									formatDate(record.test_date),
									record.tester_type,
									getServiceTestTesterLabel(record, memberLookup),
									record.result,
									formatDate(record.next_test_due_date),
									record.notes || "-",
								])}
						/>
					</section>

					<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Associated Deficiency Records</p>
						<h2 className="mt-2 text-2xl font-black tracking-tight text-white">Deficiencies</h2>
						<div className="mt-4 mb-4 flex justify-end">
							<Link
								href={detailDeficiencyHref}
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Report Deficiency
							</Link>
						</div>
						<DataTable
							columns={["Date", "Status", "Description", "Assigned To"]}
							rows={detailDeficiencies
								.sort((left, right) => compareByDateDesc(left.created_at ?? left.resolved_at ?? "", right.created_at ?? right.resolved_at ?? ""))
								.map((entry) => [
									formatDateTime(entry.created_at ?? entry.resolved_at),
									entry.status_active === true ? "Open" : "Resolved",
									entry.title || "Untitled deficiency",
									entry.status_name || "-",
								])}
						/>
					</section>

					<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Operational Activity</p>
						<h2 className="mt-2 text-2xl font-black tracking-tight text-white">Maintenance</h2>
						<div className="mt-4 mb-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => openAssignmentModal(detailLadder)}
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Assignment
							</button>
							<button
								type="button"
								onClick={() => openEditModal(detailLadder)}
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Edit Ladder
							</button>
							<Link
								href={maintenanceHref}
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Perform Maintenance
							</Link>
						</div>
						<div className="grid gap-4 md:grid-cols-3">
							<DetailField label="Latest Maintenance" value={latestMaintenance ? formatDate(latestMaintenance.maintenance_date) : "-"} />
							<DetailField label="Next Maintenance Due" value={latestMaintenance ? formatDate(latestMaintenance.next_maintenance_due) : "-"} />
							<DetailField label="Maintenance Status" value={detailMaintenanceStatus.label} />
						</div>
						<DataTable
							columns={["Maintenance Date", "Performed By", "Result", "Next Due", "Notes"]}
							rows={detailMaintenanceRecords
								.sort((left, right) => compareByDateDesc(left.maintenance_date, right.maintenance_date))
								.map((record) => [
									formatDate(record.maintenance_date),
									getMaintenancePerformerLabel(record, memberLookup),
									record.result,
									formatDate(record.next_maintenance_due),
									record.notes || "-",
								])}
						/>
					</section>

					<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Operational Notes</p>
						<h2 className="mt-2 text-2xl font-black tracking-tight text-white">Notes</h2>
						<div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-sm text-neutral-300">
							<p className="whitespace-pre-line text-neutral-200">{detailLadder.notes || "No notes recorded."}</p>
						</div>
					</section>

				<GroundLadderFormModal
					isOpen={isFormOpen}
					mode={editLadder ? "edit" : "add"}
					initialValues={editLadder ? toGroundLadderFormValues(editLadder) : undefined}
					apparatusOptions={apparatusOptions.map((option) => ({ id: option.id, label: option.name || "Unknown Apparatus" }))}
					isSaving={isSavingForm}
					onClose={() => {
						setIsFormOpen(false);
						setEditLadder(null);
					}}
					onSave={handleSaveForm}
					onReportDeficiency={
						editLadder
							? () =>
								router.push(
									buildDeficiencyHref(
										editLadder,
										activeAssignmentByLadderId.get(editLadder.id) ?? null,
										`/inventory/ground-ladders/${encodeURIComponent(editLadder.ladder_number)}`,
									),
								)
							: undefined
					}
					onDelete={canDeleteLadder ? handleDeleteLadder : undefined}
					canDelete={canDeleteLadder && Boolean(editLadder)}
				/>

				<GroundLadderAssignmentModal
					isOpen={isAssignmentOpen}
					ladderNumber={assignmentLadder?.ladder_number || ""}
					apparatusOptions={apparatusOptions.map((option) => ({ id: option.id, label: option.name || "Unknown Apparatus" }))}
					initialValues={assignmentLadder ? (() => {
						const currentAssignment = activeAssignmentByLadderId.get(assignmentLadder.id) ?? null;
						if (!currentAssignment) {
							return undefined;
						}

						return {
							assignmentType: currentAssignment.assignment_type === "Station" ? "Station" : currentAssignment.assignment_type === "Unassigned" ? "Unassigned" : "Apparatus",
							apparatusId: currentAssignment.apparatus_id || "",
							stationName: currentAssignment.station_name || "Station Supply",
							notes: currentAssignment.notes || "",
						};
					})() : undefined}
					isSaving={isSavingAssignment}
					onClose={() => {
						setIsAssignmentOpen(false);
						setAssignmentLadder(null);
					}}
					onSave={handleSaveAssignment}
				/>

				<GroundLadderServiceTestModal
					isOpen={isServiceTestOpen}
					ladderNumber={serviceTestLadder?.ladder_number || ""}
					memberOptions={memberDirectory.map((member) => ({
						id: member.id,
						label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
					}))}
					isSaving={isSavingServiceTest}
					errorMessage={serviceTestErrorMessage}
					onClose={() => {
						setIsServiceTestOpen(false);
						setServiceTestLadder(null);
						setServiceTestErrorMessage(null);
					}}
					onSave={handleSaveServiceTest}
				/>

				<GroundLadderInspectionModal
					isOpen={isInspectionOpen}
					ladderNumber={inspectionLadder?.ladder_number || ""}
					result={inspectionResult}
					notes={inspectionNotes}
					isCertified={inspectionCertified}
					hasActiveDeficiency={inspectionLadder ? activeDeficiencyByLadderId[inspectionLadder.id] === true : false}
					isSaving={isSavingInspection}
					errorMessage={inspectionErrorMessage}
					onResultChange={setInspectionResult}
					onNotesChange={setInspectionNotes}
					onCertifiedChange={setInspectionCertified}
					onClose={closeInspectionModal}
					onComplete={handleCompleteInspection}
					onReportDeficiency={
						inspectionLadder
							? () =>
								router.push(
									buildDeficiencyHref(
										inspectionLadder,
										activeAssignmentByLadderId.get(inspectionLadder.id) ?? null,
										`/inventory/ground-ladders/${encodeURIComponent(inspectionLadder.ladder_number)}`,
									),
								)
							: undefined
					}
				/>

				<GroundLadderProceduresModal
					isOpen={isProceduresOpen}
					onClose={closeProceduresModal}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-8">
		{toastVisible && toastMessage ? (
			<div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-[#2E2E2E] px-4 py-3 text-sm text-red-200 shadow-lg">
				<div className="flex items-center gap-3">
					<span>{toastMessage}</span>
					<button
						type="button"
						onClick={() => setToastVisible(false)}
						className="text-red-200/80 transition hover:text-red-100"
					>
						Dismiss
					</button>
				</div>
			</div>
		) : null}

			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Inventory</p>
					<h1 className="mt-2 text-5xl font-black tracking-tight text-white">Ground Ladders</h1>
					<p className="mt-3 max-w-2xl text-lg text-neutral-400">
						Manage department ground ladder inventory.
					</p>
					{departmentName ? (
						<p className="mt-2 text-sm text-neutral-500">Department: {departmentName}</p>
					) : null}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={openAddModal}
						className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
					>
						<Plus className="h-4 w-4" />
						Add Ladder
					</button>
					<button
						type="button"
						onClick={() => setIsCategoryServiceTestOpen(true)}
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
					>
						Service Testing
					</button>
					<Link
						href="/maintenance"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
					>
						Maintenance
					</Link>
					<Link
						href="/deficiencies/report"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
					>
						Report Deficiency
					</Link>
				</div>
			</div>

			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="min-w-0 flex-1">
						<h2 className="text-2xl font-bold text-white">Ladder Readiness</h2>
						<p className="mt-2 max-w-3xl text-sm text-neutral-400">Readiness is based on active ladders that are in service, current on testing/maintenance, and free of active deficiencies.</p>

						<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							{topSummaryCards.map((card) => {
								const active = statusFilter === card.filter;
								return (
									<button
										key={card.label}
										type="button"
										onClick={() => setStatusFilter(card.filter)}
										className={summaryCardClasses(active, card.tone)}
									>
										<p className="text-xs uppercase tracking-[0.22em] text-neutral-500">{card.label}</p>
										<p className="mt-2 text-4xl font-black text-white">{card.value}</p>
									</button>
								);
							})}
						</div>
					</div>

					<div className="w-full max-w-[220px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Ground Ladder Readiness</p>
						<p className="mt-1 text-4xl font-black text-white">{metrics.readinessScore}%</p>
						<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">{metrics.inService} In Service / {metrics.totalActive} Active</p>
						<p className="mt-3 text-sm text-neutral-400">Retired ladders are excluded from active readiness.</p>

						<div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
							<div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, metrics.readinessScore))}%` }} />
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0 flex-1">
						<label htmlFor="ground-ladder-search" className="sr-only">Search Ground Ladders</label>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
							<input
								id="ground-ladder-search"
								type="text"
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
								placeholder="Search by ladder number, type, size, manufacturer, model, serial, or assignment..."
								className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
							/>
						</div>
					</div>

					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value)}
						className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
					>
						{STATUS_FILTERS.map((filter) => (
							<option key={filter} value={filter}>{filter}</option>
						))}
					</select>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="overflow-x-auto">
					<table className="min-w-full border-separate border-spacing-0 text-left">
						<thead>
							<tr>
								{["Ladder #", "Type", "Size", "Manufacturer / Model", "Assignment", "Status", "Service Test", "Maintenance", "Actions"].map((column) => (
									<th
										key={column}
										scope="col"
										className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
									>
										{column}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{currentAssignments.length > 0 ? (
								currentAssignments.map((row) => {
									const ladderHref = `/inventory/ground-ladders/${encodeURIComponent(row.ladder_number)}`;
									const detailAssignment = activeAssignmentByLadderId.get(row.id) ?? null;
									const ladder = rows.find((entry) => entry.id === row.id) ?? row;
									const rowClassName =
										row.readinessTone === "red"
											? "transition bg-red-950/15 hover:bg-white/5"
											: row.readinessTone === "amber"
												? "transition bg-amber-950/15 hover:bg-white/5"
												: "transition hover:bg-white/5";
									return (
										<tr key={row.id} className={rowClassName}>
											<td className="border-b border-white/5 px-4 py-4 text-sm font-semibold text-white">
												<Link href={ladderHref} className="inline-flex items-center gap-2 text-white transition hover:text-red-300">
													{row.ladder_number}
													<ArrowRight className="h-4 w-4" />
												</Link>
												{row.hasActiveDeficiency ? <p className="text-xs text-red-300">Active deficiency linked</p> : null}
											</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">{row.ladder_type || "-"}</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">{formatLength(row.ladder_length_ft)}</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">
												<div className="font-medium text-white">{row.manufacturer || "-"}</div>
												<div className="text-xs text-neutral-500">{row.model || "-"}</div>
											</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">{row.assignmentLabel}</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">
												<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(row.displayStatus)}`}>{row.displayStatus}</span>
											</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">
												<div className="font-medium text-white">{row.serviceTestStatus.label}</div>
												<div className="text-xs text-neutral-500">
													{row.serviceTest ? `Due ${formatDate(row.serviceTest.next_test_due_date)}` : "No test on file"}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">
												<div className="font-medium text-white">{row.maintenanceStatus.label}</div>
												<div className="text-xs text-neutral-500">
													{row.maintenance ? `Due ${formatDate(row.maintenance.next_maintenance_due)}` : "No maintenance on file"}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-4 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => openLadderDetail(ladder)} className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700">Open</button>

                                                </div>
											</td>
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={9} className="border-b border-white/5 px-4 py-10 text-center text-sm text-neutral-400">
										{derivedRows.length === 0 ? "No ground ladders found. Add your first ladder to begin tracking readiness." : "No ground ladders match the current filters."}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</section>

			<GroundLadderFormModal
				isOpen={isFormOpen}
				mode={editLadder ? "edit" : "add"}
				initialValues={editLadder ? toGroundLadderFormValues(editLadder) : undefined}
				apparatusOptions={apparatusOptions.map((option) => ({ id: option.id, label: option.name || "Unknown Apparatus" }))}
				isSaving={isSavingForm}
				onClose={() => {
					setIsFormOpen(false);
					setEditLadder(null);
				}}
				onSave={handleSaveForm}
				onReportDeficiency={
					editLadder
						? () => router.push(buildDeficiencyHref(editLadder, activeAssignmentByLadderId.get(editLadder.id) ?? null, `/inventory/ground-ladders/${encodeURIComponent(editLadder.ladder_number)}`))
						: undefined
				}
				onDelete={canDeleteLadder ? handleDeleteLadder : undefined}
				canDelete={canDeleteLadder && Boolean(editLadder)}
			/>

			<GroundLadderAssignmentModal
				isOpen={isAssignmentOpen}
				ladderNumber={assignmentLadder?.ladder_number || ""}
				apparatusOptions={apparatusOptions.map((option) => ({ id: option.id, label: option.name || "Unknown Apparatus" }))}
				initialValues={assignmentLadder ? (() => {
					const currentAssignment = activeAssignmentByLadderId.get(assignmentLadder.id) ?? null;
					if (!currentAssignment) {
						return undefined;
					}

					return {
						assignmentType: currentAssignment.assignment_type === "Station" ? "Station" : currentAssignment.assignment_type === "Unassigned" ? "Unassigned" : "Apparatus",
						apparatusId: currentAssignment.apparatus_id || "",
						stationName: currentAssignment.station_name || "Station Supply",
						notes: currentAssignment.notes || "",
					};
				})() : undefined}
				isSaving={isSavingAssignment}
				onClose={() => {
					setIsAssignmentOpen(false);
					setAssignmentLadder(null);
				}}
				onSave={handleSaveAssignment}
			/>

			<GroundLadderServiceTestModal
				isOpen={isServiceTestOpen}
				ladderNumber={serviceTestLadder?.ladder_number || ""}
				memberOptions={memberDirectory.map((member) => ({
					id: member.id,
					label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
				}))}
				isSaving={isSavingServiceTest}
				errorMessage={serviceTestErrorMessage}
				onClose={() => {
					setIsServiceTestOpen(false);
					setServiceTestLadder(null);
					setServiceTestErrorMessage(null);
				}}
				onSave={handleSaveServiceTest}
			/>

			<GroundLadderCategoryServiceTestModal
				isOpen={isCategoryServiceTestOpen}
				ladders={currentAssignments}
				testerOptions={memberDirectory.map((member) => ({
					id: member.id,
					label: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
				}))}
				onClose={() => setIsCategoryServiceTestOpen(false)}
				onSave={handleSaveGroundLadderServiceTestSession}
				onSaveAndReportDeficiencies={handleSaveGroundLadderServiceTestSessionAndReportFailures}
			/>

			<GroundLadderInspectionModal
				isOpen={isInspectionOpen}
				ladderNumber={inspectionLadder?.ladder_number || ""}
				result={inspectionResult}
				notes={inspectionNotes}
				isCertified={inspectionCertified}
				hasActiveDeficiency={inspectionLadder ? activeDeficiencyByLadderId[inspectionLadder.id] === true : false}
				isSaving={isSavingInspection}
				errorMessage={inspectionErrorMessage}
				onResultChange={setInspectionResult}
				onNotesChange={setInspectionNotes}
				onCertifiedChange={setInspectionCertified}
				onClose={closeInspectionModal}
				onComplete={handleCompleteInspection}
				onReportDeficiency={
					inspectionLadder
						? () =>
							router.push(
								buildDeficiencyHref(
									inspectionLadder,
									activeAssignmentByLadderId.get(inspectionLadder.id) ?? null,
									`/inventory/ground-ladders/${encodeURIComponent(inspectionLadder.ladder_number)}`,
								),
							)
						: undefined
				}
			/>

			<GroundLadderProceduresModal
				isOpen={isProceduresOpen}
				onClose={closeProceduresModal}
			/>

		</div>
	);
}

function GroundLadderInspectionModal({
	isOpen,
	ladderNumber,
	result,
	notes,
	isCertified,
	hasActiveDeficiency,
	isSaving,
	errorMessage,
	onResultChange,
	onNotesChange,
	onCertifiedChange,
	onClose,
	onComplete,
	onReportDeficiency,
}: {
	isOpen: boolean;
	ladderNumber: string;
	result: GroundLadderInspectionResult | null;
	notes: string;
	isCertified: boolean;
	hasActiveDeficiency: boolean;
	isSaving: boolean;
	errorMessage: string | null;
	onResultChange: (value: GroundLadderInspectionResult) => void;
	onNotesChange: (value: string) => void;
	onCertifiedChange: (value: boolean) => void;
	onClose: () => void;
	onComplete: () => void;
	onReportDeficiency?: () => void;
}) {
	if (!isOpen) {
		return null;
	}

	const resultCards: Array<{ value: GroundLadderInspectionResult; label: string; description: string }> = [
		{
			value: "ready",
			label: "Ready for Service",
			description: "Ladder is operational and can remain available for assignment.",
		},
		{
			value: "ready-with-deficiencies",
			label: "Ready for Service with Deficiencies",
			description: "Ladder can remain in service but deficiencies must be documented.",
		},
		{
			value: "out-of-service",
			label: "Out of Service",
			description: "Ladder is not safe for use and must be removed from service.",
		},
	];

	const requiresDeficiency = result === "ready-with-deficiencies" || result === "out-of-service";

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<h3 className="text-xl font-black text-white">Inspect Ladder</h3>
				<p className="mt-1 text-sm text-neutral-400">Ground Ladder {ladderNumber}</p>

				{errorMessage ? (
					<div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">{errorMessage}</div>
				) : null}

				<div className="mt-5 space-y-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Overall Result</p>
						<div className="mt-3 grid gap-3 md:grid-cols-3">
							{resultCards.map((option) => {
								const isActive = result === option.value;
								return (
									<button
										key={option.value}
										type="button"
										onClick={() => onResultChange(option.value)}
										className={`rounded-xl border px-4 py-4 text-left transition ${
											isActive
												? "border-red-500/50 bg-red-600/20"
												: "border-white/10 bg-[#1b1b1b] hover:border-red-500/30"
										}`}
									>
										<p className="text-sm font-semibold text-white">{option.label}</p>
										<p className="mt-2 text-xs text-neutral-300">{option.description}</p>
									</button>
								);
							})}
						</div>
					</div>

					<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4">
						<div className="flex items-center justify-between gap-3">
							<p className="text-sm font-semibold text-white">Deficiency Requirement</p>
							<span className={`rounded-full border px-3 py-1 text-xs font-semibold ${hasActiveDeficiency ? "border-red-500/30 bg-red-900/20 text-red-200" : "border-white/10 bg-neutral-900 text-neutral-300"}`}>
								{hasActiveDeficiency ? "Deficiency on file" : "No active deficiency"}
							</span>
						</div>
						<p className="mt-2 text-sm text-neutral-300">
							Ready for Service with Deficiencies and Out of Service both require at least one linked deficiency.
						</p>
						{requiresDeficiency && !hasActiveDeficiency && onReportDeficiency ? (
							<button
								type="button"
								onClick={onReportDeficiency}
								className="mt-3 rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Report Deficiency
							</button>
						) : null}
					</div>

					<div>
						<label htmlFor="inspection-notes" className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Inspection Notes (Optional)</label>
						<textarea
							id="inspection-notes"
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							rows={4}
							placeholder="Enter noteworthy observations from this inspection..."
							className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>

					<label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-neutral-200">
						<input
							type="checkbox"
							checked={isCertified}
							onChange={(event) => onCertifiedChange(event.target.checked)}
							className="mt-0.5 h-4 w-4 rounded border-white/20 bg-neutral-900 text-red-600"
						/>
						<span>I certify this ladder inspection was completed according to department procedure and this result is accurate.</span>
					</label>
				</div>

				<div className="mt-6 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onComplete}
						disabled={isSaving}
						className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Completing..." : "Complete Inspection"}
					</button>
				</div>
			</div>
		</div>
	);
}

function GroundLadderCategoryServiceTestModal({
	isOpen,
	ladders,
	testerOptions,
	onClose,
	onSave,
	onSaveAndReportDeficiencies,
}: {
	isOpen: boolean;
	ladders: GroundLadderRecord[];
	testerOptions: Array<{ id: string; label: string }>;
	onClose: () => void;
	onSave: (values: { testingDate: string; testerMode: "member" | "external"; memberId: string; externalTesterName: string; companyName: string; sessionNotes: string; ladderNotes: Record<string, string>; selectedLadderIds: string[]; results: Record<string, "Pass" | "Fail"> }) => Promise<boolean> | boolean;
	onSaveAndReportDeficiencies?: (values: { testingDate: string; testerMode: "member" | "external"; memberId: string; externalTesterName: string; companyName: string; sessionNotes: string; ladderNotes: Record<string, string>; selectedLadderIds: string[]; results: Record<string, "Pass" | "Fail"> }) => void;
}) {
	const [testingDate, setTestingDate] = useState(getTodayDate());
	const [testerMode, setTesterMode] = useState<"member" | "external" | "">("");
	const [memberId, setMemberId] = useState("");
	const [externalTesterName, setExternalTesterName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [sessionNotes, setSessionNotes] = useState("");
	const [selectedLadderIds, setSelectedLadderIds] = useState<string[]>([]);
	const [results, setResults] = useState<Record<string, "Pass" | "Fail">>({});
	const [ladderNotes, setLadderNotes] = useState<Record<string, string>>({});
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setTestingDate(getTodayDate());
		setTesterMode("");
		setMemberId("");
		setExternalTesterName("");
		setCompanyName("");
		setSessionNotes("");
		setLadderNotes({});
		setSelectedLadderIds(ladders.map((ladder) => ladder.id));
		setResults({});
		setIsSaving(false);
	}, [isOpen, ladders]);

	if (!isOpen) {
		return null;
	}

	const selectedCount = selectedLadderIds.length;
	const passCount = selectedLadderIds.filter((ladderId) => results[ladderId] === "Pass").length;
	const failCount = selectedLadderIds.filter((ladderId) => results[ladderId] === "Fail").length;

	const setAllResults = (value: "Pass" | "Fail") => {
		setResults(Object.fromEntries(ladders.map((ladder) => [ladder.id, value])));
	};

	const clearAllResults = () => {
		setResults({});
	};

	const toggleResult = (ladderId: string, target: "Pass" | "Fail") => {
		setResults((current) => {
			const next = { ...current };
			if (current[ladderId] === target) {
				delete next[ladderId];
				return next;
			}
			next[ladderId] = target;
			return next;
		});
	};

	const toggleLadder = (ladderId: string) => {
		setSelectedLadderIds((current) => (current.includes(ladderId) ? current.filter((id) => id !== ladderId) : [...current, ladderId]));
	};

	const isExternalTester = testerMode === "external";

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
			<div className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">GROUND LADDERS</p>
						<h3 className="mt-2 text-3xl font-black tracking-tight text-white">Session Testing</h3>
						<p className="mt-2 text-sm text-neutral-400">Set the shared session details once, then mark each ladder as Pass or Fail in the session.</p>
					</div>

					<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs text-neutral-300">
						<p className="uppercase tracking-[0.16em] text-neutral-500">Selected Ladders</p>
						<p className="mt-1 text-lg font-semibold text-white">{selectedCount}</p>
						<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-green-300">Pass {passCount}</p>
						<p className="text-[11px] uppercase tracking-[0.14em] text-red-300">Fail {failCount}</p>
					</div>
				</div>

				<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
					<div className="grid gap-4 md:grid-cols-2">
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">TEST DATE *</span>
							<input
								type="date"
								value={testingDate}
								onChange={(event) => setTestingDate(event.target.value)}
								className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>

						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">TESTED BY *</span>
							<select
								value={testerMode}
								onChange={(event) => {
									const nextMode = event.target.value as "member" | "external" | "";
									setTesterMode(nextMode);
									if (nextMode !== "member") {
										setMemberId("");
									}
								}}
								className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							>
								<option value="">Select tester type</option>
								<option value="member">Department Member</option>
								<option value="external">External Tester</option>
							</select>
						</label>

						{testerMode === "member" ? (
							<label className="block md:col-span-2">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Department Member *</span>
								<select
									value={memberId}
									onChange={(event) => setMemberId(event.target.value)}
									className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								>
									<option value="">Select department member</option>
									{testerOptions.map((option) => (
										<option key={option.id} value={option.id}>{option.label}</option>
									))}
								</select>
							</label>
						) : null}

						{isExternalTester ? (
							<>
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Name *</span>
									<input
										value={externalTesterName}
										onChange={(event) => setExternalTesterName(event.target.value)}
										placeholder="External tester name"
										className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									/>
								</label>

								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Company / Organization *</span>
									<input
										value={companyName}
										onChange={(event) => setCompanyName(event.target.value)}
										placeholder="Company or organization"
										className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									/>
								</label>
							</>
						) : null}
					</div>

					<label className="mt-4 block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">SESSION NOTES</span>
						<textarea
							rows={2}
							value={sessionNotes}
							onChange={(event) => setSessionNotes(event.target.value)}
							placeholder="Optional notes for the shared service testing session"
							className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</section>

				<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setAllResults("Pass")}
							className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
						>
							Select All Pass
						</button>
						<button
							type="button"
							onClick={() => setAllResults("Fail")}
							className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
						>
							Select All Fail
						</button>
						<button
							type="button"
							onClick={clearAllResults}
							className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Clear All
						</button>
					</div>

					<div className="mt-4 overflow-x-auto">
						<table className="min-w-full border-separate border-spacing-0 text-left">
							<thead>
								<tr>
									{["Ladder", "Current Status", "Pass / Fail", "Ladder Note"].map((label) => (
										<th key={label} scope="col" className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
											{label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{ladders.map((ladder) => {
									const isSelected = selectedLadderIds.includes(ladder.id);
									const ladderResult = results[ladder.id];
									const ladderNote = ladderNotes[ladder.id] ?? "";
									return (
										<tr key={ladder.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<div className="flex items-center gap-3">
													<input
														type="checkbox"
														checked={isSelected}
														onChange={() => toggleLadder(ladder.id)}
														className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-red-600"
													/>
													<span className="font-semibold">{ladder.ladder_number}</span>
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(ladder.status)}`}>
													{ladder.status}
												</span>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													<button
														type="button"
														onClick={() => toggleResult(ladder.id, "Pass")}
														className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
															ladderResult === "Pass"
																? "border-emerald-500/40 bg-emerald-600 text-white"
																: "border-emerald-500/30 bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30"
														}`}
													>
														Pass
													</button>
													<button
														type="button"
														onClick={() => toggleResult(ladder.id, "Fail")}
														className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
															ladderResult === "Fail"
																? "border-red-500/40 bg-red-600 text-white"
																: "border-red-500/30 bg-red-900/20 text-red-100 hover:bg-red-900/30"
														}`}
													>
														Fail
													</button>
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<textarea
													rows={2}
													value={ladderNote}
													onChange={(event) =>
														setLadderNotes((current) => ({
															...current,
															[ladder.id]: event.target.value,
														}))
													}
													placeholder="Optional note"
													className="w-full rounded-lg border border-white/10 bg-[#141414] px-2 py-1.5 text-xs text-white focus:border-red-500/50 focus:outline-none"
												/>
											</td>
										</tr>
									);
									})}
								</tbody>
							</table>
					</div>
				</section>

				<div className="mt-6 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={isSaving || selectedLadderIds.length === 0 || !testerMode}
						onClick={async () => {
							setIsSaving(true);
							const successful = await onSave({
								testingDate,
								testerMode: testerMode === "external" ? "external" : "member",
								memberId,
								externalTesterName,
								companyName,
								sessionNotes,
								ladderNotes,
								selectedLadderIds,
								results,
							});
							if (successful) {
								onClose();
							}
							setIsSaving(false);
						}}
						className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Saving..." : "Save Session"}
					</button>
					{onSaveAndReportDeficiencies ? (
						<button
							type="button"
							disabled={isSaving || selectedLadderIds.length === 0 || failCount === 0 || !testerMode}
							onClick={() => {
								setIsSaving(true);
								onSaveAndReportDeficiencies({
									testingDate,
									testerMode: testerMode === "external" ? "external" : "member",
									memberId,
									externalTesterName,
									companyName,
									sessionNotes,
									ladderNotes,
									selectedLadderIds,
									results,
								});
								setIsSaving(false);
							}}
							className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
						>
							Save + Report Failed Ladders
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}

function GroundLadderProceduresModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<h3 className="text-xl font-black text-white">Ground Ladder Procedures</h3>
				<p className="mt-1 text-sm text-neutral-400">Reference checklist for firefighter inspections and maintenance guidance.</p>

				<ol className="mt-5 space-y-2 text-sm text-neutral-200">
					{GROUND_LADDER_PROCEDURE_ITEMS.map((item, index) => (
						<li key={item} className="rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2">
							<span className="text-neutral-400">{index + 1}.</span> {item}
						</li>
					))}
				</ol>

				<div className="mt-6 flex justify-end">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}

function GroundLadderServiceTestModal({
	isOpen,
	ladderNumber,
	memberOptions,
	isSaving = false,
	errorMessage = null,
	onClose,
	onSave,
}: {
	isOpen: boolean;
	ladderNumber: string;
	memberOptions: Array<{ id: string; label: string }>;
	isSaving?: boolean;
	errorMessage?: string | null;
	onClose: () => void;
	onSave: (values: GroundLadderServiceTestFormValues) => void;
}) {
	const [values, setValues] = useState<GroundLadderServiceTestFormValues>({
		testDate: getTodayDate(),
		testerType: "Department Member",
		memberId: "",
		externalTesterName: "",
		companyName: "",
		result: "Pass",
		notes: "",
	});

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setValues({
			testDate: getTodayDate(),
			testerType: "Department Member",
			memberId: "",
			externalTesterName: "",
			companyName: "",
			result: "Pass",
			notes: "",
		});
	}, [isOpen, ladderNumber]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<h3 className="text-xl font-black text-white">Record Service Test</h3>
				<p className="mt-1 text-sm text-neutral-400">Ground Ladder {ladderNumber}</p>

				{errorMessage ? (
					<div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">{errorMessage}</div>
				) : null}

				<div className="mt-5 grid gap-4">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Test Date *</span>
						<input
							type="date"
							value={values.testDate}
							onChange={(event) => setValues((current) => ({ ...current, testDate: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Type *</span>
						<select
							value={values.testerType}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									testerType:
										event.target.value === "External Tester"
											? "External Tester"
											: event.target.value === "Company"
												? "Company"
												: "Department Member",
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="Department Member">Department Member</option>
							<option value="External Tester">External Tester</option>
							<option value="Company">Company</option>
						</select>
					</label>

					{values.testerType === "Department Member" ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester / Member *</span>
							<select
								value={values.memberId}
								onChange={(event) => setValues((current) => ({ ...current, memberId: event.target.value }))}
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							>
								<option value="">Select member</option>
								{memberOptions.map((option) => (
									<option key={option.id} value={option.id}>{option.label}</option>
								))}
							</select>
						</label>
					) : null}

					{values.testerType === "External Tester" || values.testerType === "Company" ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Name {values.testerType === "External Tester" ? "*" : ""}</span>
							<input
								value={values.externalTesterName}
								onChange={(event) => setValues((current) => ({ ...current, externalTesterName: event.target.value }))}
								placeholder="Tester name"
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>
					) : null}

					{values.testerType === "Company" ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Company *</span>
							<input
								value={values.companyName}
								onChange={(event) => setValues((current) => ({ ...current, companyName: event.target.value }))}
								placeholder="Company or organization"
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>
					) : null}

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Result *</span>
						<select
							value={values.result}
							onChange={(event) => setValues((current) => ({ ...current, result: event.target.value === "Fail" ? "Fail" : "Pass" }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="Pass">Pass</option>
							<option value="Fail">Fail</option>
						</select>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Notes</span>
						<textarea
							rows={3}
							value={values.notes}
							onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</div>

				<div className="mt-6 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={isSaving}
						onClick={() => onSave(values)}
						className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Saving..." : "Save Service Test"}
					</button>
				</div>
			</div>
		</div>
	);
}

function summaryCardClasses(active: boolean, tone: "ready" | "due" | "out-of-service" | "retired") {
	const base = "rounded-xl border px-4 py-3 text-left transition";

	if (active) {
		return `${base} border-white/20 bg-white/[0.06]`;
	}

	if (tone === "due") {
		return `${base} border-amber-700/30 bg-amber-950/20 hover:bg-amber-950/30`;
	}

	if (tone === "out-of-service") {
		return `${base} border-red-700/30 bg-red-950/20 hover:bg-red-950/30`;
	}

	if (tone === "retired") {
		return `${base} border-neutral-700/30 bg-neutral-900/40 hover:bg-neutral-900/60`;
	}

	return `${base} border-green-700/30 bg-green-950/20 hover:bg-green-950/30`;
}

function SummaryCard({
	label,
	value,
	tone,
	subValue,
}: {
	label: string;
	value: string;
	tone: "green" | "amber" | "red" | "neutral";
	subValue?: string;
}) {
	return (
		<div className={`rounded-xl border px-4 py-4 ${detailToneClasses(tone)}`}>
			<p className="text-xs uppercase tracking-[0.18em] opacity-70">{label}</p>
			<p className="mt-2 text-lg font-semibold text-white">{value}</p>
			{subValue ? <p className="mt-1 text-sm opacity-90">{subValue}</p> : null}
		</div>
	);
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" | "neutral" }) {
	const toneClasses =
		tone === "green"
			? "border-green-700/30 bg-green-950/20 text-green-300"
			: tone === "amber"
				? "border-amber-700/30 bg-amber-950/20 text-amber-300"
				: tone === "red"
					? "border-red-700/30 bg-red-950/20 text-red-300"
					: "border-white/10 bg-[#1b1b1b] text-white";

	return (
		<div className={`rounded-xl border px-4 py-4 ${toneClasses}`}>
			<p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</p>
			<p className="mt-2 text-3xl font-black">{value}</p>
		</div>
	);
}

function DetailField({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
			<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
			<p className="mt-2 text-sm font-semibold text-white">{value}</p>
		</div>
	);
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
	return (
		<div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1b1b1b]">
			<table className="min-w-full border-separate border-spacing-0 text-left">
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column} scope="col" className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.length > 0 ? (
						rows.map((row, rowIndex) => (
							<tr key={rowIndex} className="transition hover:bg-white/5">
								{row.map((cell, cellIndex) => (
									<td key={cellIndex} className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
										{cell}
									</td>
								))}
							</tr>
						))
					) : (
						<tr>
							<td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-neutral-400">
								No records available.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
