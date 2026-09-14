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
	GroundLadderRecord,
	GroundLadderServiceTestRecord,
} from "@/app/inventory/ground-ladders/data";
import {
	buildGroundLadderInspectionNotes,
	getGroundLadderInspectionDateFromNotes,
	parseGroundLadderInspectionHistory,
} from "@/lib/inventory/ground-ladder-inspection";

const STATION_SUPPLY_OPTION = {
	id: "station-supply",
	label: "Station Supply",
};

const STATUS_FILTERS = ["All", "In Service", "Unassigned", "Out of Service", "Retired"];
const DETAIL_TABS = ["Overview", "Assignment", "Service Testing", "History"] as const;

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

type GroundLadderInspectionResult = "ready" | "out-of-service";
type GroundLadderInspectionChecklistStatus = "pass" | "fail" | "not_applicable";

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
	"Inspect beams and rails for damage, rust, or heat exposure",
	"Verify rungs are secure, straight, and free of excessive wear",
	"Check pawls, dogs, and locking components for proper operation",
	"Inspect halyard, pulley, and guide systems for wear or damage",
	"Confirm heat sensor labels and warning plates are present and legible",
	"Evaluate butt spurs, feet, and contact surfaces for condition",
	"Verify ladder clean, lubricated, and ready for safe deployment",
];

const GROUND_LADDER_INSPECTION_ITEMS: Array<{ key: string; label: string; allowNotApplicable?: boolean }> = [
	{ key: "beams-and-rails", label: "Beams & Rails" },
	{ key: "rungs", label: "Rungs" },
	{ key: "pawls-dogs", label: "Pawls / Dogs" },
	{ key: "halyard-pulley", label: "Halyard & Pulley" },
	{ key: "heat-sensors", label: "Heat Sensors" },
	{ key: "butt-spurs-feet", label: "Butt Spurs & Feet" },
	{ key: "guides-stops", label: "Guides & Stops" },
	{ key: "roof-hooks", label: "Roof Hooks / Folding Hooks", allowNotApplicable: true },
	{ key: "cleanliness", label: "Cleanliness" },
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
	apparatusOptions,
	selectedLadderNumber = null,
	canDeleteLadder,
}: GroundLadderWorkspaceProps) {
	const router = useRouter();
	const [rows, setRows] = useState<GroundLadderRecord[]>(initialRows);
	const [assignments, setAssignments] = useState<GroundLadderAssignmentRecord[]>(initialAssignments);
	const [serviceTests, setServiceTests] = useState<GroundLadderServiceTestRecord[]>(initialServiceTests);
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
	const [inspectionChecklist, setInspectionChecklist] = useState<Record<string, GroundLadderInspectionChecklistStatus>>({});
	const [inspectionChecklistOpen, setInspectionChecklistOpen] = useState(false);
	const [inspectionChecklistRequired, setInspectionChecklistRequired] = useState(false);
	const [inspectionHelpers, setInspectionHelpers] = useState<Array<{ memberId: string; name: string }>>([]);
	const [inspectionCertified, setInspectionCertified] = useState(false);
	const [showInspectionConfirmation, setShowInspectionConfirmation] = useState(false);
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
			const lastInspectionDate = getGroundLadderInspectionDateFromNotes(row.notes) ?? null;
			const serviceTestStatus = getServiceTestStatus(serviceTest);
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
			} else if (serviceTestStatus.tone === "red") {
				readinessTone = "red";
			} else if (displayStatus === "Unassigned" || serviceTestStatus.tone === "amber") {
				readinessTone = "amber";
			}

			return {
				...row,
				status,
				displayStatus,
				hasActiveDeficiency,
				assignmentLabel: getAssignmentLabel(assignment, apparatusLookup),
				serviceTestStatus,
				lastInspectionDate,
				assignment,
				serviceTest,
				readinessTone,
			};
		});
	}, [activeAssignmentByLadderId, activeDeficiencyByLadderId, apparatusLookup, latestServiceTestByLadderId, sortedRows]);

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

		return [...ladderAssignments, ...ladderTests, ...ladderDeficiencies].sort((left, right) => compareByDateDesc(left.occurredAt, right.occurredAt));
	}, [apparatusLookup, assignments, detailDeficiencies, detailLadder, detailServiceTests]);

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

	async function openInspectionModal(ladder?: GroundLadderRecord | null) {
		setInspectionLadder(ladder ?? null);
		setInspectionResult(null);
		setInspectionChecklist({});
		setInspectionChecklistOpen(false);
		setInspectionChecklistRequired(false);
		setInspectionHelpers([]);
		setInspectionCertified(false);
		setShowInspectionConfirmation(false);
		setInspectionNotes("");
		setInspectionErrorMessage(null);
		setIsInspectionOpen(true);

		if (!departmentId) {
			return;
		}

		const { data } = await supabase
			.from("ground_ladder_inspection_settings")
			.select("require_checklist")
			.eq("department_id", departmentId)
			.maybeSingle();

		setInspectionChecklistRequired(data?.require_checklist === true);
	}

	function closeInspectionModal() {
		setIsInspectionOpen(false);
		setInspectionLadder(null);
		setInspectionResult(null);
		setInspectionChecklist({});
		setInspectionChecklistOpen(false);
		setInspectionChecklistRequired(false);
		setInspectionHelpers([]);
		setInspectionCertified(false);
		setShowInspectionConfirmation(false);
		setInspectionNotes("");
		setInspectionErrorMessage(null);
	}

	function openInspectionCompletionDialog() {
		setInspectionErrorMessage(null);
		setShowInspectionConfirmation(true);
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
				const serviceDueDate = addOneYearToIsoDate(today) ?? today;

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

		setInspectionCertified(true);

		const checklistSubmissionAllowed = !inspectionChecklistRequired || GROUND_LADDER_INSPECTION_ITEMS.every((item) => inspectionChecklist[item.key] !== undefined);
		if (inspectionChecklistRequired && !checklistSubmissionAllowed) {
			setInspectionErrorMessage("Complete all required inspection checklist items before completing this inspection.");
			return;
		}

		if (inspectionResult === "out-of-service" && activeDeficiencyByLadderId[inspectionLadder.id] !== true) {
			setInspectionErrorMessage("Report at least one deficiency before placing this ladder out of service.");
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

		const helperSummary = inspectionHelpers.length > 0
			? `Inspection helpers: ${inspectionHelpers.map((helper) => helper.name).join(", ")}.`
			: "";
		const checklistSummary = Object.keys(inspectionChecklist).length > 0
			? `Checklist review: ${Object.entries(inspectionChecklist)
				.map(([itemId, status]) => `${itemId}:${status}`)
				.join("; ")}.`
			: "";
		const nextNotes = buildGroundLadderInspectionNotes({
			existingNotes: inspectionLadder.notes,
			helperSummary,
			checklistSummary,
			inspectionNotes,
			result: inspectionResult,
		});

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
			const params = new URLSearchParams();
			params.set("returnTo", "/inventory/ground-ladders");
			params.set("inventoryCategory", "ground-ladders");
			params.set("inventoryItemId", firstFailed.id);
			params.set("inventoryItemLabel", firstFailed.ladder_number);
			params.set("apparatusId", firstFailedAssignment?.assignment_type === "Apparatus" && firstFailedAssignment.apparatus_id ? firstFailedAssignment.apparatus_id : STATION_SUPPLY_OPTION.id);
			params.set("failedLadderIds", failedRowsMissingDeficiency.map((row) => row.id).join(","));
			params.set("failedIndex", "0");
			setToastMessage(`Session saved. Reporting ${failedRowsMissingDeficiency.length} failed ladder deficiency${failedRowsMissingDeficiency.length === 1 ? "" : "ies"}.`);
			router.push(`/deficiencies/report?${params.toString()}`);
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

	const currentAssignments = useMemo(() => {
		return filteredRows.map((row) => ({
			...row,
			detailLink: `/inventory/ground-ladders/${encodeURIComponent(row.ladder_number)}`,
			statusClass: statusClasses(row.status),
		}));
	}, [filteredRows]);

	if (detailLadder) {
		const detailServiceStatus = getServiceTestStatus(latestServiceTestByLadderId.get(detailLadder.id));
		const detailService = latestServiceTestByLadderId.get(detailLadder.id) ?? null;
		const detailLatestInspectionDate = getGroundLadderInspectionDateFromNotes(detailLadder.notes) ?? null;
		const detailInspectionHistory = parseGroundLadderInspectionHistory(detailLadder.notes);
		const detailAssignmentLabel = getAssignmentLabel(detailAssignment, apparatusLookup);
		const detailReturnTo = `/inventory/ground-ladders/${encodeURIComponent(detailLadder.ladder_number)}`;
		const detailDeficiencyHref = buildDeficiencyHref(detailLadder, detailAssignment, detailReturnTo);

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
							<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Ground Ladder</p>
							<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">{detailLadder.ladder_number}</h1>
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

					<div className="grid gap-3 md:grid-cols-3">
						<SummaryCard label="Current Assignment" value={detailAssignmentLabel} tone={detailAssignment?.assignment_type === "Apparatus" ? "green" : detailAssignment?.assignment_type === "Station" ? "amber" : "neutral"} />
						<SummaryCard
							label="Service Testing"
							value={detailService?.next_test_due_date ? formatDate(detailService.next_test_due_date) : "No service test on file"}
							tone={detailServiceStatus.tone}
							subValue={detailServiceStatus.label}
						/>
						<SummaryCard
							label="Ladder Inspection"
							value={detailLatestInspectionDate ? formatDate(detailLatestInspectionDate) : "Never"}
							tone={detailLatestInspectionDate ? "green" : "amber"}
							subValue={detailLatestInspectionDate ? "Most recent completed inspection" : "No completed inspection yet"}
						/>
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
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Inspection Records</p>
						<h2 className="mt-2 text-2xl font-black tracking-tight text-white">Inspection History</h2>
						{detailInspectionHistory.length > 0 ? (
							<DataTable
								columns={["Date", "Result", "Notes"]}
								rows={detailInspectionHistory.map((entry) => [
									formatDate(entry.date),
									entry.result,
									entry.details || "-",
								])}
							/>
						) : (
							<div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-sm text-neutral-400">
								No inspection history recorded for this ladder yet.
							</div>
						)}
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
					ladders={rows}
					selectedLadder={inspectionLadder}
					result={inspectionResult}
					notes={inspectionNotes}
					checklistState={inspectionChecklist}
					checklistOpen={inspectionChecklistOpen}
					checklistRequired={inspectionChecklistRequired}
					helperParticipants={inspectionHelpers}
					availableHelpers={memberDirectory
						.filter((member) => member.id !== currentMemberId)
						.map((member) => ({
							memberId: member.id,
							name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
						}))
						.filter((member) => !inspectionHelpers.some((helper) => helper.memberId === member.memberId))}
					isCertified={inspectionCertified}
					hasActiveDeficiency={inspectionLadder ? activeDeficiencyByLadderId[inspectionLadder.id] === true : false}
					isSaving={isSavingInspection}
					errorMessage={inspectionErrorMessage}
					onSelectLadder={(ladder) => {
						setInspectionLadder(ladder);
						setInspectionErrorMessage(null);
					}}
					onResultChange={setInspectionResult}
					onChecklistToggle={() => setInspectionChecklistOpen((current) => !current)}
					onChecklistStatusChange={(itemId, status) => {
						setInspectionChecklist((current) => ({ ...current, [itemId]: status }));
					}}
					onHelperAdd={(memberId) => {
						const member = memberDirectory.find((entry) => entry.id === memberId);
						if (!member) {
							return;
						}
						setInspectionHelpers((current) => [
							...current,
							{
								memberId: member.id,
								name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
							},
						]);
					}}
					onHelperRemove={(memberId) => {
						setInspectionHelpers((current) => current.filter((helper) => helper.memberId !== memberId));
					}}
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

			<div className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>
						<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Ground Ladders</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">
							Manage department ground ladder inventory.
						</p>
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
						<button
							type="button"
							onClick={() => openInspectionModal()}
							className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
						>
							Ladder Inspection
						</button>
						<Link
							href="/deficiencies/report"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
						>
							Report Deficiency
						</Link>

						<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
							<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Out of Service</p>
							<p className="mt-1 text-2xl font-[700] leading-none tracking-[-0.06em] text-white">{metrics.outOfService}</p>
						</div>
					</div>
				</div>
			</div>


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
								{["Ladder #", "Type", "Size", "Assignment", "Status", "Service Test", "Last Inspection", "Actions"].map((column) => (
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
												<div className="font-medium text-white">{row.lastInspectionDate ? formatDate(row.lastInspectionDate) : "Never"}</div>
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
									<td colSpan={8} className="border-b border-white/5 px-4 py-10 text-center text-sm text-neutral-400">
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
				ladders={rows}
				selectedLadder={inspectionLadder}
				result={inspectionResult}
				notes={inspectionNotes}
				checklistState={inspectionChecklist}
				checklistOpen={inspectionChecklistOpen}
				checklistRequired={inspectionChecklistRequired}
				helperParticipants={inspectionHelpers}
				availableHelpers={memberDirectory
					.filter((member) => member.id !== currentMemberId)
					.map((member) => ({
						memberId: member.id,
						name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
					}))
					.filter((member) => !inspectionHelpers.some((helper) => helper.memberId === member.memberId))}
				isCertified={inspectionCertified}
				hasActiveDeficiency={inspectionLadder ? activeDeficiencyByLadderId[inspectionLadder.id] === true : false}
				isSaving={isSavingInspection}
				errorMessage={inspectionErrorMessage}
				onSelectLadder={(ladder) => {
					setInspectionLadder(ladder);
					setInspectionErrorMessage(null);
				}}
				onResultChange={setInspectionResult}
				onChecklistToggle={() => setInspectionChecklistOpen((current) => !current)}
				onChecklistStatusChange={(itemId, status) => {
					setInspectionChecklist((current) => ({ ...current, [itemId]: status }));
				}}
				onHelperAdd={(memberId) => {
					const member = memberDirectory.find((entry) => entry.id === memberId);
					if (!member) {
						return;
					}
					setInspectionHelpers((current) => [
						...current,
						{
							memberId: member.id,
							name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id,
						},
					]);
				}}
				onHelperRemove={(memberId) => {
					setInspectionHelpers((current) => current.filter((helper) => helper.memberId !== memberId));
				}}
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
	ladders,
	selectedLadder,
	result,
	notes,
	checklistState,
	checklistOpen,
	checklistRequired,
	helperParticipants,
	availableHelpers,
	isCertified,
	hasActiveDeficiency,
	isSaving,
	errorMessage,
	onSelectLadder,
	onResultChange,
	onChecklistToggle,
	onChecklistStatusChange,
	onHelperAdd,
	onHelperRemove,
	onNotesChange,
	onCertifiedChange,
	onClose,
	onComplete,
	onReportDeficiency,
}: {
	isOpen: boolean;
	ladders: GroundLadderRecord[];
	selectedLadder: GroundLadderRecord | null;
	result: GroundLadderInspectionResult | null;
	notes: string;
	checklistState: Record<string, GroundLadderInspectionChecklistStatus>;
	checklistOpen: boolean;
	checklistRequired: boolean;
	helperParticipants: Array<{ memberId: string; name: string }>;
	availableHelpers: Array<{ memberId: string; name: string }>;
	isCertified: boolean;
	hasActiveDeficiency: boolean;
	isSaving: boolean;
	errorMessage: string | null;
	onSelectLadder: (ladder: GroundLadderRecord) => void;
	onResultChange: (value: GroundLadderInspectionResult) => void;
	onChecklistToggle: () => void;
	onChecklistStatusChange: (itemId: string, status: GroundLadderInspectionChecklistStatus) => void;
	onHelperAdd: (memberId: string) => void;
	onHelperRemove: (memberId: string) => void;
	onNotesChange: (value: string) => void;
	onCertifiedChange: (value: boolean) => void;
	onClose: () => void;
	onComplete: () => void;
	onReportDeficiency?: () => void;
}) {
	const [ladderPickerSearch, setLadderPickerSearch] = useState("");
	const [helperSearch, setHelperSearch] = useState("");
	const filteredLadders = useMemo(() => {
		const query = ladderPickerSearch.trim().toLowerCase();
		const sorted = [...ladders].sort((left, right) => {
			const leftNumber = left.ladder_number ?? "";
			const rightNumber = right.ladder_number ?? "";
			return leftNumber.localeCompare(rightNumber, undefined, { numeric: true, sensitivity: "base" });
		});

		if (!query) {
			return sorted;
		}

		return sorted.filter((ladder) => {
			const searchableText = [
				ladder.ladder_number,
				ladder.ladder_type,
				ladder.ladder_length_ft !== null && ladder.ladder_length_ft !== undefined ? `${ladder.ladder_length_ft} ft` : null,
				ladder.manufacturer,
				ladder.model,
				ladder.serial_number,
				ladder.status,
			].filter(Boolean).join(" ").toLowerCase();

			return searchableText.includes(query);
		});
	}, [ladderPickerSearch, ladders]);

	const filteredAvailableHelpers = useMemo(() => {
		const currentHelperIds = new Set(helperParticipants.map((helper) => helper.memberId));
		const available = availableHelpers.filter((member) => !currentHelperIds.has(member.memberId));
		const query = helperSearch.trim().toLowerCase();
		if (!query) {
			return available;
		}
		return available.filter((member) => member.name.toLowerCase().includes(query));
	}, [availableHelpers, helperParticipants, helperSearch]);
	const [showConfirmation, setShowConfirmation] = useState(false);

	if (!isOpen) {
		return null;
	}

	const resultCards: Array<{ value: GroundLadderInspectionResult; label: string; description: string }> = [
		{
			value: "ready",
			label: "Ready for Duty",
			description: "Ladder passed inspection and can return to service.",
		},
		{
			value: "out-of-service",
			label: "Out of Service",
			description: "The ladder is not safe for use and must be removed from service.",
		},
	];

	const checklistButtonClasses = (status: GroundLadderInspectionChecklistStatus | undefined) => {
		if (status === "pass") {
			return "border-emerald-500/35 bg-emerald-500/15 text-emerald-200";
		}
		if (status === "fail") {
			return "border-amber-500/35 bg-amber-500/15 text-amber-100";
		}
		if (status === "not_applicable") {
			return "border-sky-500/35 bg-sky-500/15 text-sky-100";
		}
		return "border-white/10 bg-[#1b1b1b] text-neutral-200";
	};

	const requiresDeficiency = result === "out-of-service";
	const checklistCompletedCount = Object.values(checklistState).filter((status) => status === "pass" || status === "fail" || status === "not_applicable").length;
	const checklistSubmissionAllowed = !checklistRequired || GROUND_LADDER_INSPECTION_ITEMS.every((item) => checklistState[item.key] !== undefined);

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-xl font-black text-white">Ground Ladder Inspection</h3>
						<p className="mt-1 text-sm text-neutral-400">Complete a quick inspection using the same workflow as the apparatus check.</p>
					</div>
					<button type="button" onClick={onClose} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Close</button>
				</div>

				{!selectedLadder ? (
					<div className="mt-5 rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Ladder</p>
								<h4 className="mt-1 text-lg font-bold text-white">Which ladder are you inspecting?</h4>
							</div>
						</div>

						<label htmlFor="ground-ladder-inspection-picker-search" className="mt-4 block">
							<span className="sr-only">Search ladders</span>
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
								<input
									id="ground-ladder-inspection-picker-search"
									type="text"
									value={ladderPickerSearch}
									onChange={(event) => setLadderPickerSearch(event.target.value)}
									placeholder="Search ladders..."
									className="w-full rounded-xl border border-white/10 bg-[#141414] py-3 pl-10 pr-4 text-base text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
								/>
							</div>
						</label>

						<div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-[#141414] p-2">
							{filteredLadders.length === 0 ? (
								<div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-neutral-400">
									No ladders match your search.
								</div>
							) : (
								<div className="space-y-2">
									{filteredLadders.map((ladder) => {
										const secondaryInfo = [
											ladder.ladder_type || "Ladder",
											ladder.ladder_length_ft !== null && ladder.ladder_length_ft !== undefined ? `${ladder.ladder_length_ft} ft` : null,
										].filter(Boolean).join(" • ");

										return (
											<button
												key={ladder.id}
												type="button"
												onClick={() => {
													setLadderPickerSearch("");
													onSelectLadder(ladder);
												}}
												className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-left transition hover:border-red-500/40 hover:bg-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-red-500/60"
											>
												<div className="min-w-0 flex-1">
													<p className="truncate text-base font-semibold text-white">{ladder.ladder_number}</p>
													<p className="mt-1 text-sm text-neutral-400">{secondaryInfo || "Ground ladder"}</p>
												</div>
												<span className="rounded-full border border-white/10 bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-300">
													Select
												</span>
											</button>
										);
									})}
								</div>
							)}
						</div>
					</div>
				) : null}

				{selectedLadder ? (
					<div className="mt-5 space-y-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Overall Result</p>
							<div className="mt-3 grid gap-3 md:grid-cols-2">
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
							{requiresDeficiency ? (
								<div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-300">
									<span>Out of Service requires a linked deficiency before completion.</span>
									{!hasActiveDeficiency && onReportDeficiency ? (
										<button type="button" onClick={onReportDeficiency} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Report Deficiency</button>
									) : null}
								</div>
							) : null}
						</div>

						<div className="rounded-xl border border-neutral-700 bg-[#1B1B1B] p-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-300">Inspection Checklist</h4>
									<p className="mt-1 text-sm text-neutral-400">{checklistCompletedCount}/{GROUND_LADDER_INSPECTION_ITEMS.length} completed</p>
								</div>
								<button type="button" onClick={onChecklistToggle} className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-100 transition hover:bg-neutral-800">{checklistOpen ? "Hide Inspection Items" : "Review Inspection Items"}</button>
							</div>
							{checklistOpen ? (
								<div className="mt-4 space-y-3">
									{GROUND_LADDER_INSPECTION_ITEMS.map((item) => {
										const status = checklistState[item.key];
										const buttons = [
											{ value: "pass", label: "PASS" },
											{ value: "fail", label: "FAIL" },
											...(item.allowNotApplicable ? [{ value: "not_applicable", label: "N/A" }] : []),
										] as const;

										return (
											<div key={item.key} className="rounded-xl border border-white/10 bg-[#171717] p-3">
												<div className="flex items-center justify-between gap-3">
													<p className="text-sm font-semibold text-white">{item.label}</p>
													<span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-300">
														{status === "pass" ? "PASS" : status === "fail" ? "FAIL" : status === "not_applicable" ? "N/A" : "Not Marked"}
													</span>
												</div>
												<div className="mt-3 grid gap-2 sm:grid-cols-3">
													{buttons.map((button) => (
														<button
															type="button"
															key={button.value}
															onClick={() => onChecklistStatusChange(item.key, button.value as GroundLadderInspectionChecklistStatus)}
															className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition ${checklistButtonClasses(status === button.value ? (button.value as GroundLadderInspectionChecklistStatus) : undefined)}`}
														>
															{button.label}
														</button>
													))}
												</div>
											</div>
										);
									})}
								</div>
							) : null}
						</div>

						<div className="mt-4 rounded-xl border border-neutral-700 bg-[#1B1B1B] p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Participants</p>
									<h4 className="mt-1 text-lg font-bold text-white">Inspection Helpers</h4>
								</div>
								<span className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300">{helperParticipants.length + 1} Total Participants</span>
							</div>
							<div className="mt-4 grid gap-4 lg:grid-cols-2">
										<div className="rounded-xl border border-neutral-700 bg-[#151515] p-3">
											<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Current Helpers</p>
											{helperParticipants.length === 0 ? (
												<p className="mt-2 text-sm text-neutral-400">No helpers added yet.</p>
											) : (
												<div className="mt-3 space-y-2">
													{helperParticipants.map((helper) => (
														<div key={helper.memberId} className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2">
															<p className="text-sm text-neutral-200">✓ {helper.name}</p>
															<button type="button" onClick={() => onHelperRemove(helper.memberId)} className="rounded-md border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800">Remove</button>
														</div>
													))}
												</div>
											)}
										</div>
										<div className="rounded-xl border border-neutral-700 bg-[#151515] p-3">
											<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Available Members</p>
											<input
												type="search"
												value={helperSearch}
												onChange={(event) => setHelperSearch(event.target.value)}
												placeholder="Search members..."
												className="mt-3 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
											/>
											{availableHelpers.length === 0 ? (
												<p className="mt-3 text-sm text-neutral-400">All available members are already added.</p>
											) : filteredAvailableHelpers.length === 0 ? (
												<p className="mt-3 text-sm text-neutral-400">No members match that search.</p>
											) : (
												<div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
													{filteredAvailableHelpers.map((member) => (
														<div key={member.memberId} className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2">
															<p className="text-sm text-neutral-200">{member.name}</p>
															<button type="button" onClick={() => onHelperAdd(member.memberId)} className="rounded-md border border-neutral-600 px-2 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800">Add</button>
														</div>
													))}
												</div>
											)}
										</div>
									</div>
								</div>

								<div>
									<label htmlFor="ground-ladder-inspection-notes" className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Inspection Notes (Optional)</label>
									<textarea
										id="ground-ladder-inspection-notes"
										value={notes}
										onChange={(event) => onNotesChange(event.target.value)}
										rows={4}
										placeholder="Enter noteworthy observations from this inspection..."
										className="mt-2 w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
									/>
								</div>
					</div>
				) : null}

				{errorMessage ? (
					<div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">{errorMessage}</div>
				) : null}

				<div className="mt-6 flex justify-end gap-2">
					<button type="button" onClick={onClose} className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Cancel</button>
					<button type="button" onClick={() => setShowConfirmation(true)} disabled={isSaving || !selectedLadder || !result || (checklistRequired && !checklistSubmissionAllowed)} className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">{isSaving ? "Completing..." : "Complete Inspection"}</button>
				</div>
				{showConfirmation ? (
					<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
						<div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#171717] p-6 shadow-2xl">
							<h3 className="text-xl font-bold text-white">Confirm Inspection Completion</h3>
							<p className="mt-4 text-sm text-neutral-300">By completing this inspection, I certify that the ladder was inspected in accordance with department policy and any defects were documented.</p>
							<div className="mt-6 flex justify-end gap-3">
								<button type="button" onClick={() => setShowConfirmation(false)} className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Cancel</button>
								<button type="button" onClick={() => { setShowConfirmation(false); onCertifiedChange(true); onComplete(); }} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">Confirm / Complete Inspection</button>
							</div>
						</div>
					</div>
				) : null}
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
		setSelectedLadderIds([]);
		setResults({});
		setIsSaving(false);
	}, [isOpen, ladders]);

	if (!isOpen) {
		return null;
	}

	const effectiveSelectedLadderIds = selectedLadderIds.length > 0
		? selectedLadderIds
		: Object.keys(results).filter((ladderId) => results[ladderId] === "Pass" || results[ladderId] === "Fail");
	const selectedCount = effectiveSelectedLadderIds.length;
	const passCount = effectiveSelectedLadderIds.filter((ladderId) => results[ladderId] === "Pass").length;
	const failCount = effectiveSelectedLadderIds.filter((ladderId) => results[ladderId] === "Fail").length;

	const setAllResults = (value: "Pass" | "Fail") => {
		const nextResults = Object.fromEntries(ladders.map((ladder) => [ladder.id, value]));
		setResults(nextResults);
		setSelectedLadderIds(ladders.map((ladder) => ladder.id));
	};

	const clearAllResults = () => {
		setResults({});
		setSelectedLadderIds([]);
	};

	const toggleResult = (ladderId: string, target: "Pass" | "Fail") => {
		setResults((current) => {
			const next = { ...current };
			if (current[ladderId] === target) {
				delete next[ladderId];
				setSelectedLadderIds((selected) => selected.filter((id) => id !== ladderId));
				return next;
			}
			next[ladderId] = target;
			setSelectedLadderIds((selected) => (selected.includes(ladderId) ? selected : [...selected, ladderId]));
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
						<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">GROUND LADDERS</p>
						<h3 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Service Testing</h3>
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
									const isSelected = effectiveSelectedLadderIds.includes(ladder.id);
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
						disabled={isSaving || effectiveSelectedLadderIds.length === 0 || !testerMode}
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
								selectedLadderIds: effectiveSelectedLadderIds,
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
							disabled={isSaving || effectiveSelectedLadderIds.length === 0 || failCount === 0 || !testerMode}
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
									selectedLadderIds: effectiveSelectedLadderIds,
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
				<p className="mt-1 text-sm text-neutral-400">Reference checklist for firefighter inspections and service testing.</p>

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
