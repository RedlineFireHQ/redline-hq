"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GasMonitorFormModal, {
	GasMonitorInitialAssignmentValues,
	GasMonitorFormValues,
} from "@/components/inventory/GasMonitorFormModal";
import GasMonitorCalibrationModal, {
	GasMonitorCalibrationValues,
	GasMonitorCalibrationTesterOption,
} from "@/components/inventory/GasMonitorCalibrationModal";
import GasMonitorSessionCalibrationModal, {
	GasMonitorSessionCalibrationValues,
} from "@/components/inventory/GasMonitorSessionCalibrationModal";

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

type GasMonitorAssignmentRecord = {
	id: string;
	department_id: string;
	gas_monitor_id: string;
	assignment_type: "Member" | "Apparatus" | "Unassigned";
	member_id: string | null;
	apparatus_id: string | null;
	assigned_at: string;
	ended_at: string | null;
	assigned_by: string | null;
	notes: string | null;
	created_at: string;
};

type MemberRecord = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

type ApparatusRecord = {
	id: string;
	name: string | null;
};

type AssignmentDraft = {
	assignmentType: "Member" | "Apparatus" | "Unassigned";
	memberId: string;
	apparatusId: string;
	notes: string;
};

interface GasMonitorWorkspaceProps {
	departmentId: string | null;
	departmentName: string | null;
	initialRows: GasMonitorRecord[];
	initialError?: string | null;
	canDeleteMonitor: boolean;
}

const STATUS_FILTERS = ["All", "In Service", "Unassigned", "Out of Service", "Lost", "Stolen", "Retired"];

function normalizeOptionalText(value: string) {
	return value.trim();
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

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
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

function isOnOrBeforeToday(dateValue: string | null | undefined) {
	if (!dateValue) {
		return false;
	}

	const parsed = new Date(`${dateValue}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return false;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return parsed.getTime() <= today.getTime();
}

function statusBadgeClasses(status: string, hasActiveDeficiency: boolean) {
	if (hasActiveDeficiency && status !== "Retired") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}

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

function summaryCardClasses(active: boolean, tone: "good" | "warn" | "bad" | "neutral") {
	const base = "rounded-xl border px-4 py-3 text-left transition";

	if (active) {
		return `${base} border-white/20 bg-white/[0.06]`;
	}

	if (tone === "good") {
		return `${base} border-green-700/30 bg-green-950/20 hover:bg-green-950/30`;
	}

	if (tone === "warn") {
		return `${base} border-amber-700/30 bg-amber-950/20 hover:bg-amber-950/30`;
	}

	if (tone === "bad") {
		return `${base} border-red-700/30 bg-red-950/20 hover:bg-red-950/30`;
	}

	return `${base} border-neutral-700/30 bg-neutral-900/40 hover:bg-neutral-900/60`;
}

function getMemberName(member: MemberRecord | undefined) {
	if (!member) {
		return "Unknown Member";
	}

	const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
	const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
	const fullName = `${firstName} ${lastName}`.trim();
	return fullName || member.id;
}

function isProtectedMonitorStatus(status: string) {
	return status === "Retired" || status === "Lost" || status === "Stolen";
}

function buildCalibrationTesterPayload(
	values: GasMonitorCalibrationValues | GasMonitorSessionCalibrationValues,
	testerOptions: GasMonitorCalibrationTesterOption[],
) {
	if (values.testerMode === "member") {
		if (!values.memberId) {
			return { error: "Select a department member for calibration." };
		}

		const selectedMember = testerOptions.find((option) => option.id === values.memberId);
		return {
			payload: {
				tester_mode: "Department Person",
				tester_member_id: values.memberId,
				external_tester_name: null,
				external_tester_company: null,
				testerLabel: selectedMember?.label ?? values.memberId,
			},
		};
	}

	const externalTesterName = normalizeOptionalText(values.externalTesterName);
	if (!externalTesterName) {
		return { error: "Tester Name is required for external calibration entries." };
	}

	if (values.testerMode === "name-company") {
		const externalTesterCompany = normalizeOptionalText(values.externalTesterCompany);
		if (!externalTesterCompany) {
			return { error: "Company / Organization is required for Name / Company entries." };
		}

		return {
			payload: {
				tester_mode: "Name/Company",
				tester_member_id: null,
				external_tester_name: externalTesterName,
				external_tester_company: externalTesterCompany,
				testerLabel: `${externalTesterName} / ${externalTesterCompany}`,
			},
		};
	}

	return {
		payload: {
			tester_mode: "External",
			tester_member_id: null,
			external_tester_name: externalTesterName,
			external_tester_company: null,
			testerLabel: externalTesterName,
		},
	};
}

function buildSessionCalibrationNotes(sessionNotes: string, monitorNotes: string) {
	const normalizedSessionNotes = normalizeOptionalText(sessionNotes);
	const normalizedMonitorNotes = normalizeOptionalText(monitorNotes);

	if (normalizedSessionNotes && normalizedMonitorNotes) {
		return `${normalizedSessionNotes}\n\n${normalizedMonitorNotes}`;
	}

	return normalizedSessionNotes || normalizedMonitorNotes;
}

export default function GasMonitorWorkspace({
	departmentId: initialDepartmentId,
	departmentName = null,
	initialRows,
	initialError = null,
	canDeleteMonitor,
}: GasMonitorWorkspaceProps) {
	const router = useRouter();
	const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
	const [rows, setRows] = useState<GasMonitorRecord[]>(initialRows);
	const [assignmentRows, setAssignmentRows] = useState<GasMonitorAssignmentRecord[]>([]);
	const [memberOptions, setMemberOptions] = useState<MemberRecord[]>([]);
	const [apparatusOptions, setApparatusOptions] = useState<ApparatusRecord[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [activeSummaryFilter, setActiveSummaryFilter] = useState<
		"all" | "in-service" | "unassigned" | "out-of-service" | "lost-stolen" | "retired"
	>("all");

	const [activeDeficiencyByMonitorId, setActiveDeficiencyByMonitorId] = useState<Record<string, boolean>>({});
	const [lastCalibrationByMonitorId, setLastCalibrationByMonitorId] = useState<Record<string, string | null>>({});
	const [calibrationIntervalMonths, setCalibrationIntervalMonths] = useState(6);

	const [isFormModalOpen, setIsFormModalOpen] = useState(false);
	const [editMonitorId, setEditMonitorId] = useState<string | null>(null);
	const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
	const [assignmentMonitorId, setAssignmentMonitorId] = useState<string | null>(null);
	const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>({
		assignmentType: "Member",
		memberId: "",
		apparatusId: "",
		notes: "",
	});
	const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
	const [historyMonitorId, setHistoryMonitorId] = useState<string | null>(null);

	const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
	const [calibrationMonitorId, setCalibrationMonitorId] = useState<string | null>(null);
	const [isSavingCalibration, setIsSavingCalibration] = useState(false);
	const [calibrationErrorMessage, setCalibrationErrorMessage] = useState<string | null>(null);

	const [isSessionCalibrationModalOpen, setIsSessionCalibrationModalOpen] = useState(false);
	const [isSavingSessionCalibration, setIsSavingSessionCalibration] = useState(false);
	const [sessionCalibrationErrorMessage, setSessionCalibrationErrorMessage] = useState<string | null>(null);

	const [isSaving, setIsSaving] = useState(false);
	const [isSavingAssignment, setIsSavingAssignment] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(initialError);
	const [toastVisible, setToastVisible] = useState(Boolean(initialError));
	const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

	useEffect(() => {
		setDepartmentId(initialDepartmentId);
	}, [initialDepartmentId]);

	useEffect(() => {
		setRows(initialRows);
	}, [initialRows]);

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

	const refreshMonitors = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("gas_monitors")
			.select("id, department_id, monitor_number, serial_number, manufacturer, model, status, notes, created_at, updated_at")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			setToastMessage(error.message || "Unable to load gas monitors.");
			return;
		}

		setRows((data ?? []) as GasMonitorRecord[]);
	};

	const refreshAssignments = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("gas_monitor_assignments")
			.select("id, department_id, gas_monitor_id, assignment_type, member_id, apparatus_id, assigned_at, ended_at, assigned_by, notes, created_at")
			.eq("department_id", departmentId)
			.order("assigned_at", { ascending: false });

		if (error) {
			setToastMessage(error.message || "Unable to load gas monitor assignment history.");
			return;
		}

		setAssignmentRows((data ?? []) as GasMonitorAssignmentRecord[]);
	};

	const refreshOptions = async () => {
		if (!departmentId) {
			setMemberOptions([]);
			setApparatusOptions([]);
			return;
		}

		const [membersResult, apparatusResult] = await Promise.all([
			supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", departmentId)
				.order("last_name", { ascending: true })
				.order("first_name", { ascending: true }),
			supabase
				.from("apparatus")
				.select("id, name")
				.eq("department_id", departmentId)
				.order("name", { ascending: true }),
		]);

		if (membersResult.error) {
			setToastMessage(membersResult.error.message || "Unable to load member options.");
		} else {
			setMemberOptions((membersResult.data ?? []) as MemberRecord[]);
		}

		if (apparatusResult.error) {
			setToastMessage(apparatusResult.error.message || "Unable to load apparatus options.");
		} else {
			setApparatusOptions((apparatusResult.data ?? []) as ApparatusRecord[]);
		}
	};

	const refreshCalibrationSettings = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("gas_monitor_calibration_settings")
			.select("calibration_interval_months")
			.eq("department_id", departmentId)
			.maybeSingle();

		if (error) {
			setToastMessage(error.message || "Unable to load calibration settings.");
			return;
		}

		const interval = typeof data?.calibration_interval_months === "number" ? data.calibration_interval_months : 6;
		setCalibrationIntervalMonths(interval > 0 ? interval : 6);
	};

	const refreshDeficiencies = async (monitorIds: string[]) => {
		if (monitorIds.length === 0) {
			setActiveDeficiencyByMonitorId({});
			return;
		}

		const { data, error } = await supabase
			.from("deficiencies")
			.select("gas_monitor_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
			.in("gas_monitor_id", monitorIds);

		if (error) {
			setToastMessage(error.message || "Unable to verify linked deficiencies.");
			return;
		}

		const nextMap: Record<string, boolean> = {};

		for (const row of data ?? []) {
			const monitorId = row.gas_monitor_id;
			if (typeof monitorId !== "string" || !monitorId) {
				continue;
			}

			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
			if (statusName === "resolved" || statusName === "closed") {
				continue;
			}

			if (statusInfo?.active === true || !statusName) {
				nextMap[monitorId] = true;
			}
		}

		setActiveDeficiencyByMonitorId(nextMap);
	};

	const refreshLastCalibrationMap = async () => {
		if (!departmentId) {
			setLastCalibrationByMonitorId({});
			return;
		}

		const [singleCalResult, sessionCalResult] = await Promise.all([
			supabase
				.from("gas_monitor_calibrations")
				.select("gas_monitor_id, calibration_date")
				.eq("department_id", departmentId),
			supabase
				.from("gas_monitor_calibration_session_results")
				.select("gas_monitor_id, calibration_date")
				.eq("department_id", departmentId),
		]);

		if (singleCalResult.error || sessionCalResult.error) {
			setToastMessage(
				singleCalResult.error?.message ||
					sessionCalResult.error?.message ||
					"Unable to load calibration history summary.",
			);
			return;
		}

		const nextMap: Record<string, string | null> = {};
		const allRows = [
			...((singleCalResult.data ?? []) as Array<{ gas_monitor_id: string | null; calibration_date: string | null }>),
			...((sessionCalResult.data ?? []) as Array<{ gas_monitor_id: string | null; calibration_date: string | null }>),
		];

		for (const row of allRows) {
			if (typeof row.gas_monitor_id !== "string" || !row.gas_monitor_id) {
				continue;
			}

			const current = nextMap[row.gas_monitor_id];
			const nextDate = row.calibration_date;
			if (!nextDate) {
				continue;
			}

			if (!current || nextDate > current) {
				nextMap[row.gas_monitor_id] = nextDate;
			}
		}

		setLastCalibrationByMonitorId(nextMap);
	};

	useEffect(() => {
		if (!departmentId) {
			return;
		}

		void refreshAssignments();
		void refreshOptions();
		void refreshCalibrationSettings();
		void refreshLastCalibrationMap();
	}, [departmentId]);

	useEffect(() => {
		void refreshDeficiencies(rows.map((row) => row.id));
	}, [rows]);

	const membersById = useMemo(() => new Map(memberOptions.map((member) => [member.id, member])), [memberOptions]);
	const apparatusById = useMemo(() => new Map(apparatusOptions.map((apparatus) => [apparatus.id, apparatus])), [apparatusOptions]);

	const testerOptions = useMemo(
		() =>
			memberOptions.map((member) => ({
				id: member.id,
				label: getMemberName(member),
			})),
		[memberOptions],
	);

	const sortedRows = useMemo(() => {
		return [...rows].sort((left, right) => {
			const leftRetired = left.status === "Retired";
			const rightRetired = right.status === "Retired";

			if (leftRetired !== rightRetired) {
				return leftRetired ? 1 : -1;
			}

			return left.monitor_number.localeCompare(right.monitor_number, undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
	}, [rows]);

	const openAssignmentsByMonitorId = useMemo(() => {
		const map = new Map<string, GasMonitorAssignmentRecord>();
		for (const assignment of assignmentRows) {
			if (assignment.ended_at === null && !map.has(assignment.gas_monitor_id)) {
				map.set(assignment.gas_monitor_id, assignment);
			}
		}
		return map;
	}, [assignmentRows]);

	const derivedRows = useMemo(() => {
		return sortedRows.map((row) => {
			const lastCalibrationDate = lastCalibrationByMonitorId[row.id] ?? null;
			const nextCalibrationDueDate = lastCalibrationDate
				? addMonthsToIsoDate(lastCalibrationDate, calibrationIntervalMonths)
				: null;
			const isCalibrationDue = row.status !== "Retired" && (!nextCalibrationDueDate || isOnOrBeforeToday(nextCalibrationDueDate));
			return {
				...row,
				lastCalibrationDate,
				nextCalibrationDueDate,
				isCalibrationDue,
			};
		});
	}, [calibrationIntervalMonths, lastCalibrationByMonitorId, sortedRows]);

	const filteredRows = useMemo(() => {
		let workingRows = derivedRows;

		if (searchTerm.trim()) {
			const normalized = searchTerm.trim().toLowerCase();
			workingRows = workingRows.filter((row) => {
				const assignment = openAssignmentsByMonitorId.get(row.id);
				const assignmentType = assignment?.assignment_type ?? "Unassigned";
				const assignmentHolder = assignment?.assignment_type === "Member"
					? assignment.member_id
						? getMemberName(membersById.get(assignment.member_id))
						: "Member"
					: assignment?.assignment_type === "Apparatus"
						? assignment.apparatus_id
							? apparatusById.get(assignment.apparatus_id)?.name ?? "Apparatus"
							: "Apparatus"
						: "Unassigned";
				const haystack = [
					row.monitor_number,
					row.serial_number,
					row.manufacturer,
					row.model,
					assignmentType,
					assignmentHolder,
				]
					.map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
					.join(" ");
				return haystack.includes(normalized);
			});
		}

		if (statusFilter !== "All") {
			workingRows = workingRows.filter((row) => row.status === statusFilter);
		}

		if (activeSummaryFilter !== "all") {
			workingRows = workingRows.filter((row) => {
				if (activeSummaryFilter === "in-service") {
					return row.status === "In Service";
				}
				if (activeSummaryFilter === "unassigned") {
					return row.status === "Unassigned";
				}
				if (activeSummaryFilter === "out-of-service") {
					return row.status === "Out of Service";
				}
				if (activeSummaryFilter === "lost-stolen") {
					return row.status === "Lost" || row.status === "Stolen";
				}
				return row.status === "Retired";
			});
		}

		return workingRows;
	}, [activeSummaryFilter, apparatusById, derivedRows, membersById, openAssignmentsByMonitorId, searchTerm, statusFilter]);

	const activeRows = useMemo(() => derivedRows.filter((row) => row.status !== "Retired"), [derivedRows]);
	const totalCount = derivedRows.length;
	const inServiceCount = activeRows.filter((row) => row.status === "In Service").length;
	const unassignedCount = activeRows.filter((row) => row.status === "Unassigned").length;
	const outOfServiceCount = activeRows.filter((row) => row.status === "Out of Service").length;
	const lostStolenCount = activeRows.filter((row) => row.status === "Lost" || row.status === "Stolen").length;
	const retiredCount = derivedRows.filter((row) => row.status === "Retired").length;
	const calibrationDueCount = activeRows.filter((row) => row.isCalibrationDue).length;
	const inServiceReadyCount = activeRows.filter(
		(row) => row.status === "In Service" && activeDeficiencyByMonitorId[row.id] !== true,
	).length;
	const readinessPercentage = activeRows.length > 0 ? Math.round((inServiceReadyCount / activeRows.length) * 100) : 100;

	const editingRow = useMemo(
		() => (editMonitorId ? derivedRows.find((row) => row.id === editMonitorId) ?? null : null),
		[derivedRows, editMonitorId],
	);

	const assignmentRow = useMemo(
		() => (assignmentMonitorId ? derivedRows.find((row) => row.id === assignmentMonitorId) ?? null : null),
		[assignmentMonitorId, derivedRows],
	);

	const historyRow = useMemo(
		() => (historyMonitorId ? derivedRows.find((row) => row.id === historyMonitorId) ?? null : null),
		[derivedRows, historyMonitorId],
	);

	const calibrationRow = useMemo(
		() => (calibrationMonitorId ? derivedRows.find((row) => row.id === calibrationMonitorId) ?? null : null),
		[calibrationMonitorId, derivedRows],
	);

	const historyRowsForSelectedMonitor = useMemo(() => {
		if (!historyMonitorId) {
			return [] as GasMonitorAssignmentRecord[];
		}

		return assignmentRows
			.filter((row) => row.gas_monitor_id === historyMonitorId)
			.sort((left, right) => {
				const leftTime = new Date(left.assigned_at).getTime();
				const rightTime = new Date(right.assigned_at).getTime();
				return rightTime - leftTime;
			});
	}, [assignmentRows, historyMonitorId]);

	const hasRows = rows.length > 0;
	const hasVisibleRows = filteredRows.length > 0;
	const scoreWidth = `${Math.max(0, Math.min(100, readinessPercentage))}%`;

	const reportDeficiencyForRow = (row: GasMonitorRecord) => {
		const activeAssignment = openAssignmentsByMonitorId.get(row.id);
		const defaultApparatusId =
			activeAssignment?.assignment_type === "Apparatus" && activeAssignment.apparatus_id
				? activeAssignment.apparatus_id
				: "station-supply";

		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/gas-monitors");
		params.set("inventoryCategory", "gas-monitors");
		params.set("inventoryItemId", row.id);
		params.set("inventoryItemLabel", row.monitor_number);
		params.set("apparatusId", defaultApparatusId);
		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const openAddModal = () => {
		setEditMonitorId(null);
		setIsFormModalOpen(true);
	};

	const openEditModal = (monitor: GasMonitorRecord) => {
		setEditMonitorId(monitor.id);
		setIsFormModalOpen(true);
	};

	const closeFormModal = () => {
		setIsFormModalOpen(false);
		setEditMonitorId(null);
	};

	const openAssignmentModal = (monitor: GasMonitorRecord) => {
		const currentAssignment = openAssignmentsByMonitorId.get(monitor.id);
		setAssignmentMonitorId(monitor.id);
		setAssignmentDraft({
			assignmentType: currentAssignment?.assignment_type ?? "Member",
			memberId: currentAssignment?.member_id ?? "",
			apparatusId: currentAssignment?.apparatus_id ?? "",
			notes: "",
		});
		setIsAssignmentModalOpen(true);
	};

	const closeAssignmentModal = () => {
		setIsAssignmentModalOpen(false);
		setAssignmentMonitorId(null);
	};

	const openHistoryModal = (monitor: GasMonitorRecord) => {
		setHistoryMonitorId(monitor.id);
		setIsHistoryModalOpen(true);
	};

	const closeHistoryModal = () => {
		setIsHistoryModalOpen(false);
		setHistoryMonitorId(null);
	};

	const openCalibrationModal = (monitor: GasMonitorRecord) => {
		setCalibrationMonitorId(monitor.id);
		setCalibrationErrorMessage(null);
		setIsCalibrationModalOpen(true);
	};

	const closeCalibrationModal = () => {
		setCalibrationMonitorId(null);
		setCalibrationErrorMessage(null);
		setIsCalibrationModalOpen(false);
	};

	const closeSessionCalibrationModal = () => {
		setSessionCalibrationErrorMessage(null);
		setIsSessionCalibrationModalOpen(false);
	};

	const saveMonitor = (
		values: GasMonitorFormValues,
		initialAssignment?: GasMonitorInitialAssignmentValues,
	) => {
		void (async () => {
			if (!departmentId) {
				setToastMessage("Unable to determine department. Please refresh and try again.");
				return;
			}

			const monitorNumber = normalizeOptionalText(values.monitorNumber);
			const serialNumber = normalizeOptionalText(values.serialNumber);

			if (!monitorNumber) {
				setToastMessage("Monitor Number is required.");
				return;
			}

			if (!serialNumber) {
				setToastMessage("Serial Number is required.");
				return;
			}

			if (initialAssignment?.assignmentType === "Member" && !initialAssignment.memberId) {
				setToastMessage("Select a department member for initial assignment.");
				return;
			}

			if (initialAssignment?.assignmentType === "Apparatus" && !initialAssignment.apparatusId) {
				setToastMessage("Select an apparatus for initial assignment.");
				return;
			}

			const hasOperationalAssignment =
				initialAssignment?.assignmentType === "Member" || initialAssignment?.assignmentType === "Apparatus";

			const computedStatus = isProtectedMonitorStatus(values.status)
				? values.status
				: hasOperationalAssignment
					? "In Service"
					: "Unassigned";

			const payload = {
				department_id: departmentId,
				monitor_number: monitorNumber,
				serial_number: serialNumber,
				manufacturer: normalizeOptionalText(values.manufacturer) || null,
				model: normalizeOptionalText(values.model) || null,
				status: computedStatus,
				notes: normalizeOptionalText(values.notes) || null,
			};

			setIsSaving(true);

			if (!editingRow) {
				const { data, error } = await supabase
					.from("gas_monitors")
					.insert(payload)
					.select("id, monitor_number")
					.single();

				if (error || !data) {
					setIsSaving(false);
					setToastMessage(error?.message || "Unable to save gas monitor.");
					return;
				}

				const assignmentType = initialAssignment?.assignmentType ?? "Unassigned";

				const insertAssignmentResult = await supabase
					.from("gas_monitor_assignments")
					.insert({
						department_id: departmentId,
						gas_monitor_id: data.id,
						assignment_type: assignmentType,
						member_id: assignmentType === "Member" ? initialAssignment?.memberId ?? null : null,
						apparatus_id: assignmentType === "Apparatus" ? initialAssignment?.apparatusId ?? null : null,
						assigned_by: currentMemberId,
						notes: null,
					})
					.select("id")
					.single();

				if (insertAssignmentResult.error || !insertAssignmentResult.data) {
					setIsSaving(false);
					setToastMessage(insertAssignmentResult.error?.message || "Monitor saved, but initial assignment could not be created.");
					await refreshMonitors();
					await refreshAssignments();
					closeFormModal();
					return;
				}

				setIsSaving(false);
				await refreshMonitors();
				await refreshAssignments();
				closeFormModal();
				setToastMessage(`Monitor ${data.monitor_number} saved successfully.`);
				return;
			}

			const { data, error } = await supabase
				.from("gas_monitors")
				.update(payload)
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, monitor_number")
				.single();

			setIsSaving(false);
			if (error || !data || data.id !== editingRow.id) {
				setToastMessage(error?.message || "Unable to update gas monitor.");
				return;
			}

			await refreshMonitors();
			closeFormModal();
			setToastMessage(`Monitor ${data.monitor_number} updated successfully.`);
		})();
	};

	const retireMonitor = async () => {
		if (!departmentId || !editingRow) {
			return;
		}

		const confirmed = window.confirm(
			`Retire Monitor ${editingRow.monitor_number}?\n\nThis monitor will stay in inventory as a retired record.`,
		);

		if (!confirmed) {
			return;
		}

		const { data, error } = await supabase
			.from("gas_monitors")
			.update({ status: "Retired" })
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (error || !data || data.id !== editingRow.id) {
			setToastMessage(error?.message || "Unable to retire monitor.");
			return;
		}

		await refreshMonitors();
		closeFormModal();
	};

	const deleteMonitor = async () => {
		if (!departmentId || !editingRow || !canDeleteMonitor) {
			return;
		}

		const confirmed = window.confirm(
			`Delete Monitor ${editingRow.monitor_number}?\n\nThis permanently removes the inventory record.`,
		);

		if (!confirmed) {
			return;
		}

		const { data, error } = await supabase
			.from("gas_monitors")
			.delete()
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (error || !data || data.id !== editingRow.id) {
			setToastMessage(error?.message || "Unable to delete monitor.");
			return;
		}

		await refreshMonitors();
		await refreshAssignments();
		closeFormModal();
	};

	const saveAssignment = () => {
		void (async () => {
			if (!departmentId || !assignmentMonitorId || !assignmentRow) {
				setToastMessage("Unable to determine monitor assignment context.");
				return;
			}

			if (assignmentDraft.assignmentType === "Member" && !assignmentDraft.memberId) {
				setToastMessage("Select a department member for member assignment.");
				return;
			}

			if (assignmentDraft.assignmentType === "Apparatus" && !assignmentDraft.apparatusId) {
				setToastMessage("Select an apparatus for apparatus assignment.");
				return;
			}

			setIsSavingAssignment(true);

			const closeResult = await supabase
				.from("gas_monitor_assignments")
				.update({ ended_at: new Date().toISOString() })
				.eq("department_id", departmentId)
				.eq("gas_monitor_id", assignmentMonitorId)
				.is("ended_at", null);

			if (closeResult.error) {
				setIsSavingAssignment(false);
				setToastMessage(closeResult.error.message || "Unable to close current assignment.");
				return;
			}

			const insertResult = await supabase
				.from("gas_monitor_assignments")
				.insert({
					department_id: departmentId,
					gas_monitor_id: assignmentMonitorId,
					assignment_type: assignmentDraft.assignmentType,
					member_id: assignmentDraft.assignmentType === "Member" ? assignmentDraft.memberId : null,
					apparatus_id: assignmentDraft.assignmentType === "Apparatus" ? assignmentDraft.apparatusId : null,
					assigned_by: currentMemberId,
					notes: normalizeOptionalText(assignmentDraft.notes) || null,
				})
				.select("id")
				.single();

			if (insertResult.error || !insertResult.data) {
				setIsSavingAssignment(false);
				setToastMessage(insertResult.error?.message || "Unable to save assignment.");
				return;
			}

			const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
				.from("deficiencies")
				.select("status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
				.eq("gas_monitor_id", assignmentMonitorId);

			if (linkedDeficienciesError) {
				setIsSavingAssignment(false);
				setToastMessage(linkedDeficienciesError.message || "Unable to verify linked deficiencies.");
				return;
			}

			const hasActiveDeficiency = (linkedDeficiencies ?? []).some((row) => {
				const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
				const statusName =
					typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

				if (statusName === "resolved" || statusName === "closed") {
					return false;
				}

				if (statusInfo?.active === false) {
					return false;
				}

				return true;
			});

			if (!hasActiveDeficiency) {
				const { data: monitorRow, error: monitorRowError } = await supabase
					.from("gas_monitors")
					.select("id, status")
					.eq("id", assignmentMonitorId)
					.eq("department_id", departmentId)
					.maybeSingle();

				if (monitorRowError || !monitorRow) {
					setIsSavingAssignment(false);
					setToastMessage(monitorRowError?.message || "Unable to verify monitor status.");
					return;
				}

				const currentStatus = (monitorRow.status ?? "").trim();
				const nextStatus = isProtectedMonitorStatus(currentStatus)
					? currentStatus
					: assignmentDraft.assignmentType === "Unassigned"
						? "Unassigned"
						: "In Service";

				const updateStatusResult = await supabase
					.from("gas_monitors")
					.update({ status: nextStatus })
					.eq("id", assignmentMonitorId)
					.eq("department_id", departmentId)
					.select("id")
					.single();

				if (updateStatusResult.error || !updateStatusResult.data) {
					setIsSavingAssignment(false);
					setToastMessage(updateStatusResult.error?.message || "Unable to update gas monitor status.");
					return;
				}
			}

			setIsSavingAssignment(false);
			await refreshMonitors();
			await refreshAssignments();
			closeAssignmentModal();
			setToastMessage(`Assignment saved for ${assignmentRow.monitor_number}.`);
		})();
	};

	const saveCalibration = (values: GasMonitorCalibrationValues) => {
		void (async () => {
			if (!departmentId || !calibrationRow) {
				setCalibrationErrorMessage("Unable to determine calibration context.");
				return;
			}

			const calibrationDate = normalizeOptionalText(values.calibrationDate);
			if (!calibrationDate) {
				setCalibrationErrorMessage("Calibration Date is required.");
				return;
			}

			const testerResolution = buildCalibrationTesterPayload(values, testerOptions);
			if (testerResolution.error || !testerResolution.payload) {
				setCalibrationErrorMessage(testerResolution.error ?? "Unable to resolve tester.");
				return;
			}

			setIsSavingCalibration(true);
			setCalibrationErrorMessage(null);

			const insertResult = await supabase
				.from("gas_monitor_calibrations")
				.insert({
					department_id: departmentId,
					gas_monitor_id: calibrationRow.id,
					calibration_date: calibrationDate,
					result: values.result,
					tester_mode: testerResolution.payload.tester_mode,
					tester_member_id: testerResolution.payload.tester_member_id,
					external_tester_name: testerResolution.payload.external_tester_name,
					external_tester_company: testerResolution.payload.external_tester_company,
					notes: normalizeOptionalText(values.notes) || null,
					created_by: currentMemberId,
				})
				.select("id")
				.single();

			if (insertResult.error || !insertResult.data) {
				setIsSavingCalibration(false);
				setCalibrationErrorMessage(insertResult.error?.message || "Unable to save calibration.");
				return;
			}

			let nextStatus = calibrationRow.status;
			if (!isProtectedMonitorStatus(calibrationRow.status)) {
				if (values.result === "Failed") {
					nextStatus = "Out of Service";
				} else if (activeDeficiencyByMonitorId[calibrationRow.id] === true) {
					nextStatus = "Out of Service";
				} else {
					const openAssignment = openAssignmentsByMonitorId.get(calibrationRow.id);
					nextStatus =
						openAssignment?.assignment_type === "Member" || openAssignment?.assignment_type === "Apparatus"
							? "In Service"
							: "Unassigned";
				}
			}

			const updateResult = await supabase
				.from("gas_monitors")
				.update({ status: nextStatus })
				.eq("id", calibrationRow.id)
				.eq("department_id", departmentId)
				.select("id")
				.single();

			setIsSavingCalibration(false);

			if (updateResult.error || !updateResult.data) {
				setCalibrationErrorMessage(updateResult.error?.message || "Unable to update monitor after calibration save.");
				return;
			}

			await refreshMonitors();
			await refreshLastCalibrationMap();
			closeCalibrationModal();
			setToastMessage(`Calibration saved for Monitor ${calibrationRow.monitor_number}.`);
		})();
	};

	const saveSessionCalibrations = async (
		values: GasMonitorSessionCalibrationValues,
		options?: {
			routeToDeficiencyReport?: boolean;
			closeModalOnSuccess?: boolean;
		},
	) => {
		if (!departmentId) {
			setSessionCalibrationErrorMessage("Unable to determine department context.");
			return false;
		}

		const calibrationDate = normalizeOptionalText(values.calibrationDate);
		if (!calibrationDate) {
			setSessionCalibrationErrorMessage("Calibration Date is required.");
			return false;
		}

		const testerResolution = buildCalibrationTesterPayload(values, testerOptions);
		if (testerResolution.error || !testerResolution.payload) {
			setSessionCalibrationErrorMessage(testerResolution.error ?? "Unable to resolve tester.");
			return false;
		}

		const selectedRows = derivedRows.filter((row) => {
			const result = values.monitorResults[row.id] ?? "";
			return result === "Passed" || result === "Failed";
		});

		if (selectedRows.length === 0) {
			setSessionCalibrationErrorMessage("Mark at least one monitor as Passed or Failed before saving.");
			return false;
		}

		const failedRowsMissingDeficiency = selectedRows.filter((row) => {
			const result = values.monitorResults[row.id] ?? "";
			return result === "Failed" && activeDeficiencyByMonitorId[row.id] !== true;
		});

		if (failedRowsMissingDeficiency.length > 0 && !options?.routeToDeficiencyReport) {
			setSessionCalibrationErrorMessage(
				"Failed monitors must have deficiency reports. Use Save + Report Failed Monitors.",
			);
			return false;
		}

		setIsSavingSessionCalibration(true);
		setSessionCalibrationErrorMessage(null);

		const sessionInsertResult = await supabase
			.from("gas_monitor_calibration_sessions")
			.insert({
				department_id: departmentId,
				calibration_date: calibrationDate,
				tester_mode: testerResolution.payload.tester_mode,
				tester_member_id: testerResolution.payload.tester_member_id,
				external_tester_name: testerResolution.payload.external_tester_name,
				external_tester_company: testerResolution.payload.external_tester_company,
				session_notes: normalizeOptionalText(values.sessionNotes) || null,
				created_by: currentMemberId,
			})
			.select("id")
			.single();

		if (sessionInsertResult.error || !sessionInsertResult.data?.id) {
			setIsSavingSessionCalibration(false);
			setSessionCalibrationErrorMessage(
				sessionInsertResult.error?.message || "Unable to save gas monitor calibration session.",
			);
			return false;
		}

		const sessionId = sessionInsertResult.data.id;
		let processedCount = 0;

		for (const row of selectedRows) {
			const result = values.monitorResults[row.id];
			if (result !== "Passed" && result !== "Failed") {
				continue;
			}

			const notes = buildSessionCalibrationNotes(values.sessionNotes, values.monitorNotes[row.id] ?? "");

			const insertResult = await supabase
				.from("gas_monitor_calibration_session_results")
				.insert({
					department_id: departmentId,
					calibration_session_id: sessionId,
					gas_monitor_id: row.id,
					calibration_date: calibrationDate,
					result,
					tester_mode: testerResolution.payload.tester_mode,
					tester_member_id: testerResolution.payload.tester_member_id,
					external_tester_name: testerResolution.payload.external_tester_name,
					external_tester_company: testerResolution.payload.external_tester_company,
					notes: notes || null,
					created_by: currentMemberId,
				})
				.select("id")
				.single();

			if (insertResult.error || !insertResult.data) {
				await supabase.from("gas_monitor_calibration_sessions").delete().eq("id", sessionId);
				setIsSavingSessionCalibration(false);
				setSessionCalibrationErrorMessage(
					insertResult.error?.message || `Unable to save calibration for Monitor ${row.monitor_number}.`,
				);
				return false;
			}

			let nextStatus = row.status;
			if (!isProtectedMonitorStatus(row.status)) {
				if (result === "Failed") {
					nextStatus = "Out of Service";
				} else if (activeDeficiencyByMonitorId[row.id] === true) {
					nextStatus = "Out of Service";
				} else {
					const openAssignment = openAssignmentsByMonitorId.get(row.id);
					nextStatus =
						openAssignment?.assignment_type === "Member" || openAssignment?.assignment_type === "Apparatus"
							? "In Service"
							: "Unassigned";
				}
			}

			const updateResult = await supabase
				.from("gas_monitors")
				.update({ status: nextStatus })
				.eq("id", row.id)
				.eq("department_id", departmentId)
				.select("id")
				.single();

			if (updateResult.error || !updateResult.data) {
				await supabase.from("gas_monitor_calibration_sessions").delete().eq("id", sessionId);
				setIsSavingSessionCalibration(false);
				setSessionCalibrationErrorMessage(
					updateResult.error?.message || `Unable to update Monitor ${row.monitor_number} after calibration save.`,
				);
				return false;
			}

			processedCount += 1;
		}

		setIsSavingSessionCalibration(false);
		await refreshMonitors();
		await refreshLastCalibrationMap();

		if (options?.routeToDeficiencyReport && failedRowsMissingDeficiency.length > 0) {
			const firstFailedMonitor = failedRowsMissingDeficiency[0];
			closeSessionCalibrationModal();
			setToastMessage(
				`Session saved. Report deficiencies for failed monitors starting with Monitor ${firstFailedMonitor.monitor_number}.`,
			);

			const params = new URLSearchParams();
			params.set("returnTo", "/inventory/gas-monitors");
			params.set("inventoryCategory", "gas-monitors");
			params.set("inventoryItemId", firstFailedMonitor.id);
			params.set("inventoryItemLabel", firstFailedMonitor.monitor_number ?? "");
			params.set("apparatusId", "station-supply");
			router.push(`/deficiencies/report?${params.toString()}`);
			return true;
		}

		if (options?.closeModalOnSuccess !== false) {
			closeSessionCalibrationModal();
		}

		setToastMessage(`Session calibration saved for ${processedCount} monitor${processedCount === 1 ? "" : "s"}.`);
		return true;
	};

	const saveSessionCalibrationsFromModal = (values: GasMonitorSessionCalibrationValues) => {
		void saveSessionCalibrations(values);
	};

	const saveSessionCalibrationsAndReportDeficiencies = (values: GasMonitorSessionCalibrationValues) => {
		void saveSessionCalibrations(values, {
			routeToDeficiencyReport: true,
		});
	};

	const getAssignmentLabel = (row: GasMonitorRecord) => {
		const assignment = openAssignmentsByMonitorId.get(row.id);
		if (!assignment) {
			return "Unassigned";
		}
		return assignment.assignment_type;
	};

	const getAssignmentHolderLabel = (row: GasMonitorRecord) => {
		const assignment = openAssignmentsByMonitorId.get(row.id);
		if (!assignment) {
			return "Unassigned";
		}

		if (assignment.assignment_type === "Member") {
			return assignment.member_id ? getMemberName(membersById.get(assignment.member_id)) : "Member";
		}

		if (assignment.assignment_type === "Apparatus") {
			const apparatus = assignment.apparatus_id ? apparatusById.get(assignment.apparatus_id) : undefined;
			const apparatusName = typeof apparatus?.name === "string" ? apparatus.name.trim() : "";
			return apparatusName || "Apparatus";
		}

		return "Unassigned";
	};

	return (
		<div className="mx-auto max-w-7xl space-y-8 pb-16">
			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">Inventory Module</p>
						<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Gas Monitors</h1>
						<p className="mt-2 max-w-3xl text-sm text-neutral-400">Manage gas monitor accountability, assignment, calibration intervals, and shared deficiency linkage.</p>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={openAddModal}
								className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
							>
								+ Add Monitor
							</button>
							<button
								type="button"
								onClick={() => setIsSessionCalibrationModalOpen(true)}
								className="inline-flex rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
							>
								Session Calibration
							</button>
							<button
								type="button"
								onClick={() => router.push("/inventory/gas-monitors/session-history")}
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								View Session History
							</button>
						</div>
					</div>

					<div className="w-full max-w-[240px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Readiness</p>
						<p className="mt-1 text-4xl font-black text-white">{readinessPercentage}%</p>
						<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">In Service Ready</p>
						<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
							<div className="h-full rounded-full bg-red-500 transition-all" style={{ width: scoreWidth }} />
						</div>
						<p className="mt-2 text-[11px] text-neutral-500">{departmentName ?? "Department"}</p>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
					<button type="button" onClick={() => setActiveSummaryFilter("all")} className={summaryCardClasses(activeSummaryFilter === "all", "neutral")}>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Total Monitors</p>
						<p className="mt-2 text-2xl font-black text-white">{totalCount}</p>
					</button>
					<button type="button" onClick={() => setActiveSummaryFilter("in-service")} className={summaryCardClasses(activeSummaryFilter === "in-service", "good")}>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">In Service</p>
						<p className="mt-2 text-2xl font-black text-white">{inServiceCount}</p>
					</button>
					<button type="button" onClick={() => setActiveSummaryFilter("unassigned")} className={summaryCardClasses(activeSummaryFilter === "unassigned", "warn")}>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Unassigned</p>
						<p className="mt-2 text-2xl font-black text-white">{unassignedCount}</p>
					</button>
					<button type="button" onClick={() => setActiveSummaryFilter("out-of-service")} className={summaryCardClasses(activeSummaryFilter === "out-of-service", "bad")}>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Out of Service</p>
						<p className="mt-2 text-2xl font-black text-white">{outOfServiceCount}</p>
					</button>
					<button type="button" onClick={() => setActiveSummaryFilter("lost-stolen")} className={summaryCardClasses(activeSummaryFilter === "lost-stolen", "bad")}>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Lost / Stolen</p>
						<p className="mt-2 text-2xl font-black text-white">{lostStolenCount}</p>
					</button>
					<button type="button" onClick={() => setActiveSummaryFilter("retired")} className={summaryCardClasses(activeSummaryFilter === "retired", "neutral")}>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Retired</p>
						<p className="mt-2 text-2xl font-black text-white">{retiredCount}</p>
					</button>
					<div className="rounded-xl border border-amber-700/30 bg-amber-950/20 px-4 py-3">
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Calibration Due</p>
						<p className="mt-2 text-2xl font-black text-white">{calibrationDueCount}</p>
						<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-amber-200">Interval {calibrationIntervalMonths} months</p>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0 flex-1">
						<label htmlFor="gas-monitor-search" className="sr-only">Search gas monitors</label>
						<input
							id="gas-monitor-search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search monitor number, serial number, manufacturer, model, assignment type, or assignment holder..."
							className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/40 focus:outline-none"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<select
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value)}
							className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/40 focus:outline-none"
						>
							{STATUS_FILTERS.map((status) => (
								<option key={status} value={status}>{status}</option>
							))}
						</select>
					</div>
				</div>

				<div className="mt-5 overflow-x-auto">
					<table className="min-w-full border-separate border-spacing-0 text-left">
						<thead>
							<tr>
								{[
									"Monitor Number",
									"Serial Number",
									"Manufacturer",
									"Model",
									"Last Calibration",
									"Next Due",
									"Current Assignment",
									"Assignment Holder / Location",
									"Status",
									"Actions",
								].map((label) => (
									<th
										key={label}
										scope="col"
										className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
									>
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{!hasRows ? (
								<tr>
									<td colSpan={10} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
										No gas monitors have been added yet.
									</td>
								</tr>
							) : !hasVisibleRows ? (
								<tr>
									<td colSpan={10} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
										No monitors match the current filters.
									</td>
								</tr>
							) : (
								filteredRows.map((row) => {
									const hasActiveDeficiency = activeDeficiencyByMonitorId[row.id] === true;
									return (
										<tr key={row.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">{row.monitor_number}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.serial_number}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.manufacturer ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.model ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatDate(row.lastCalibrationDate)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex items-center gap-2">
													<span>{formatDate(row.nextCalibrationDueDate)}</span>
													{row.isCalibrationDue ? (
														<span className="rounded-full border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">Due</span>
													) : null}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{getAssignmentLabel(row)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{getAssignmentHolderLabel(row)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex items-center gap-2">
													<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.status, hasActiveDeficiency)}`}>
														{row.status}
													</span>
													{hasActiveDeficiency ? <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-300">Deficiency</span> : null}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													<button type="button" onClick={() => openEditModal(row)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">Edit</button>
													<button type="button" onClick={() => openAssignmentModal(row)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/20">Assign</button>
													<button type="button" onClick={() => openCalibrationModal(row)} className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30">Calibrate</button>
													<button type="button" onClick={() => openHistoryModal(row)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">History</button>
													<button type="button" onClick={() => router.push(`/inventory/gas-monitors/calibration-history?monitorId=${encodeURIComponent(row.id)}`)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">Calibration History</button>
													<button type="button" onClick={() => reportDeficiencyForRow(row)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">Report Deficiency</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</section>

			<GasMonitorFormModal
				isOpen={isFormModalOpen}
				mode={editingRow ? "edit" : "add"}
				isSaving={isSaving}
				canDelete={canDeleteMonitor}
				memberOptions={testerOptions}
				apparatusOptions={apparatusOptions.map((apparatus) => ({ id: apparatus.id, label: apparatus.name?.trim() || apparatus.id }))}
				initialValues={
					editingRow
						? {
							monitorNumber: editingRow.monitor_number,
							serialNumber: editingRow.serial_number,
							manufacturer: editingRow.manufacturer ?? "",
							model: editingRow.model ?? "",
							status: editingRow.status,
							notes: editingRow.notes ?? "",
						}
						: undefined
				}
				onClose={closeFormModal}
				onSave={saveMonitor}
				onRetire={editingRow ? () => void retireMonitor() : undefined}
				onDelete={editingRow ? () => void deleteMonitor() : undefined}
				onReportDeficiency={editingRow ? () => reportDeficiencyForRow(editingRow) : undefined}
			/>

			<GasMonitorCalibrationModal
				isOpen={isCalibrationModalOpen && Boolean(calibrationRow)}
				monitorNumber={calibrationRow?.monitor_number ?? ""}
				testerOptions={testerOptions}
				isSaving={isSavingCalibration}
				errorMessage={calibrationErrorMessage}
				onClose={closeCalibrationModal}
				onSave={saveCalibration}
			/>

			<GasMonitorSessionCalibrationModal
				isOpen={isSessionCalibrationModalOpen}
				monitors={derivedRows
					.filter((row) => row.status !== "Retired")
					.map((row) => ({
						id: row.id,
						monitorNumber: row.monitor_number,
						currentStatus: row.status,
						hasActiveDeficiency: activeDeficiencyByMonitorId[row.id] === true,
					}))}
				testerOptions={testerOptions}
				isSaving={isSavingSessionCalibration}
				errorMessage={sessionCalibrationErrorMessage}
				onClose={closeSessionCalibrationModal}
				onSave={saveSessionCalibrationsFromModal}
				onSaveAndReportDeficiencies={saveSessionCalibrationsAndReportDeficiencies}
			/>

			{isAssignmentModalOpen && assignmentRow ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<h3 className="text-xl font-black text-white">Assign Gas Monitor</h3>
						<p className="mt-1 text-sm text-neutral-400">{assignmentRow.monitor_number} • {assignmentRow.serial_number}</p>

						<div className="mt-5 grid gap-3 md:grid-cols-2">
							<label className="block md:col-span-2">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type *</span>
								<select
									value={assignmentDraft.assignmentType}
									onChange={(event) => {
										const nextType = event.target.value === "Apparatus" || event.target.value === "Unassigned" ? event.target.value : "Member";
										setAssignmentDraft((current) => ({
											...current,
											assignmentType: nextType,
											memberId: nextType === "Member" ? current.memberId : "",
											apparatusId: nextType === "Apparatus" ? current.apparatusId : "",
										}));
									}}
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								>
									<option value="Member">Department Member</option>
									<option value="Apparatus">Apparatus</option>
									<option value="Unassigned">Unassigned</option>
								</select>
							</label>

							{assignmentDraft.assignmentType === "Member" ? (
								<label className="block md:col-span-2">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Member *</span>
									<select
										value={assignmentDraft.memberId}
										onChange={(event) => setAssignmentDraft((current) => ({ ...current, memberId: event.target.value }))}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									>
										<option value="">Select department member</option>
										{memberOptions.map((member) => (
											<option key={member.id} value={member.id}>{getMemberName(member)}</option>
										))}
									</select>
								</label>
							) : null}

							{assignmentDraft.assignmentType === "Apparatus" ? (
								<label className="block md:col-span-2">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Apparatus *</span>
									<select
										value={assignmentDraft.apparatusId}
										onChange={(event) => setAssignmentDraft((current) => ({ ...current, apparatusId: event.target.value }))}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									>
										<option value="">Select apparatus</option>
										{apparatusOptions.map((apparatus) => (
											<option key={apparatus.id} value={apparatus.id}>{apparatus.name ?? apparatus.id}</option>
										))}
									</select>
								</label>
							) : null}

							<label className="block md:col-span-2">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Notes</span>
								<textarea
									rows={3}
									value={assignmentDraft.notes}
									onChange={(event) => setAssignmentDraft((current) => ({ ...current, notes: event.target.value }))}
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						</div>

						<div className="mt-6 flex justify-end gap-2">
							<button type="button" onClick={closeAssignmentModal} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Cancel</button>
							<button type="button" disabled={isSavingAssignment} onClick={saveAssignment} className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{isSavingAssignment ? "Saving..." : "Save Assignment"}</button>
						</div>
					</div>
				</div>
			) : null}

			{isHistoryModalOpen && historyRow ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-5xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<div className="flex items-end justify-between gap-3">
							<div>
								<h3 className="text-xl font-black text-white">Assignment History</h3>
								<p className="mt-1 text-sm text-neutral-400">{historyRow.monitor_number} • {historyRow.serial_number}</p>
							</div>
							<button type="button" onClick={closeHistoryModal} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Close</button>
						</div>

						<div className="mt-5 overflow-x-auto">
							<table className="min-w-full border-separate border-spacing-0 text-left">
								<thead>
									<tr>
										{["Assignment", "Type", "Date Assigned", "Date Ended", "Assigned By", "Notes"].map((label) => (
											<th key={label} scope="col" className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{historyRowsForSelectedMonitor.length === 0 ? (
										<tr>
											<td colSpan={6} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">No assignment history recorded yet.</td>
										</tr>
									) : (
										historyRowsForSelectedMonitor.map((assignment) => {
											let assignmentLabel = "Unassigned";
											if (assignment.assignment_type === "Member") {
												assignmentLabel = assignment.member_id ? getMemberName(membersById.get(assignment.member_id)) : "Member";
											} else if (assignment.assignment_type === "Apparatus") {
												const apparatus = assignment.apparatus_id ? apparatusById.get(assignment.apparatus_id) : undefined;
												assignmentLabel = apparatus?.name ?? "Apparatus";
											}

											const assignedBy = assignment.assigned_by ? getMemberName(membersById.get(assignment.assigned_by)) : "-";

											return (
												<tr key={assignment.id} className="transition hover:bg-white/5">
													<td className="border-b border-white/5 px-4 py-3 text-sm text-white">{assignmentLabel}</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{assignment.assignment_type}</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatDateTime(assignment.assigned_at)}</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{assignment.ended_at ? formatDateTime(assignment.ended_at) : "Current"}</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{assignedBy}</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{assignment.notes?.trim() ? assignment.notes : "-"}</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			) : null}

			<div
				className={`fixed bottom-6 right-6 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg transition-all ${
					toastVisible && toastMessage
						? "translate-y-0 opacity-100"
						: "pointer-events-none translate-y-2 opacity-0"
				} border-red-500/30 bg-[#1f1f1f] text-white`}
			>
				{toastMessage}
			</div>
		</div>
	);
}
