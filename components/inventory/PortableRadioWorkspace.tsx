"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveApparatusOptions } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import PortableRadioFormModal, {
	PortableRadioInitialAssignmentValues,
	PortableRadioFormValues,
} from "@/components/inventory/PortableRadioFormModal";

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

type PortableRadioAssignmentRecord = {
	id: string;
	department_id: string;
	portable_radio_id: string;
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

interface PortableRadioWorkspaceProps {
	departmentId: string | null;
	departmentName: string | null;
	initialRows: PortableRadioRecord[];
	initialError?: string | null;
	canManageRadios: boolean;
}

type AssignmentDraft = {
	assignmentType: "Member" | "Apparatus" | "Unassigned";
	memberId: string;
	apparatusId: string;
	notes: string;
};

const STATUS_FILTERS = ["All", "In Service", "Unassigned", "Out of Service", "Lost", "Stolen", "Retired"];

function normalizeOptionalText(value: string) {
	return value.trim();
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

export default function PortableRadioWorkspace({
	departmentId: initialDepartmentId,
	initialRows,
	initialError = null,
	canManageRadios,
}: PortableRadioWorkspaceProps) {
	const router = useRouter();
	const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
	const [rows, setRows] = useState<PortableRadioRecord[]>(initialRows);
	const [assignmentRows, setAssignmentRows] = useState<PortableRadioAssignmentRecord[]>([]);
	const [memberOptions, setMemberOptions] = useState<MemberRecord[]>([]);
	const [apparatusOptions, setApparatusOptions] = useState<ApparatusRecord[]>([]);
	const [activeDeficiencyByRadioId, setActiveDeficiencyByRadioId] = useState<Record<string, boolean>>({});
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [isFormModalOpen, setIsFormModalOpen] = useState(false);
	const [editRadioId, setEditRadioId] = useState<string | null>(null);
	const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
	const [assignmentRadioId, setAssignmentRadioId] = useState<string | null>(null);
	const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>({
		assignmentType: "Member",
		memberId: "",
		apparatusId: "",
		notes: "",
	});
	const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
	const [historyRadioId, setHistoryRadioId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isSavingAssignment, setIsSavingAssignment] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(initialError);
	const [toastVisible, setToastVisible] = useState(Boolean(initialError));
	const [activeSummaryFilter, setActiveSummaryFilter] = useState<
		"all" | "in-service" | "unassigned" | "out-of-service" | "lost-stolen" | "retired"
	>("all");
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

	const refreshRadios = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("portable_radios")
			.select("id, department_id, radio_number, serial_number, manufacturer, model, radio_unit_id, status, notes, created_at, updated_at")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			setToastMessage(error.message || "Unable to load portable radios.");
			return;
		}

		setRows((data ?? []) as PortableRadioRecord[]);
	};

	const refreshAssignments = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("portable_radio_assignments")
			.select("id, department_id, portable_radio_id, assignment_type, member_id, apparatus_id, assigned_at, ended_at, assigned_by, notes, created_at")
			.eq("department_id", departmentId)
			.order("assigned_at", { ascending: false });

		if (error) {
			setToastMessage(error.message || "Unable to load radio assignment history.");
			return;
		}

		setAssignmentRows(data ?? []);
	};

	const refreshDeficiencies = async (radioIds: string[]) => {
		if (radioIds.length === 0) {
			setActiveDeficiencyByRadioId({});
			return;
		}

		const { data, error } = await supabase
			.from("deficiencies")
			.select("portable_radio_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
			.in("portable_radio_id", radioIds);

		if (error) {
			setToastMessage(error.message || "Unable to verify linked deficiencies.");
			return;
		}

		const nextMap: Record<string, boolean> = {};
		for (const row of data ?? []) {
			const radioId = row.portable_radio_id;
			if (typeof radioId !== "string" || !radioId) {
				continue;
			}
			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
			if (statusName === "resolved" || statusName === "closed") {
				continue;
			}
			if (statusInfo?.active === true || !statusName) {
				nextMap[radioId] = true;
			}
		}
		setActiveDeficiencyByRadioId(nextMap);
	};

	const refreshOptions = async () => {
		if (!departmentId) {
			setMemberOptions([]);
			setApparatusOptions([]);
			return;
		}

		const [membersResult, apparatusOptionsResult] = await Promise.all([
			supabase
				.from("members")
				.select("id, first_name, last_name")
				.eq("department_id", departmentId)
				.order("last_name", { ascending: true })
				.order("first_name", { ascending: true }),
			getActiveApparatusOptions({ departmentId }),
		]);

		if (membersResult.error) {
			setToastMessage(membersResult.error.message || "Unable to load member options.");
		} else {
			setMemberOptions(membersResult.data ?? []);
		}

		setApparatusOptions(apparatusOptionsResult as ApparatusRecord[]);
	};

	useEffect(() => {
		if (!departmentId) {
			return;
		}
		void refreshAssignments();
		void refreshOptions();
	}, [departmentId]);

	useEffect(() => {
		void refreshDeficiencies(rows.map((row) => row.id));
	}, [rows]);

	const membersById = useMemo(() => {
		return new Map(memberOptions.map((member) => [member.id, member]));
	}, [memberOptions]);

	const memberSelectOptions = useMemo(() => {
		return memberOptions.map((member) => ({
			id: member.id,
			label: getMemberName(member),
		}));
	}, [memberOptions]);

	const apparatusById = useMemo(() => {
		return new Map(apparatusOptions.map((apparatus) => [apparatus.id, apparatus]));
	}, [apparatusOptions]);

	const apparatusSelectOptions = useMemo(() => {
		return apparatusOptions.map((apparatus) => ({
			id: apparatus.id,
			label: apparatus.name?.trim() || apparatus.id,
		}));
	}, [apparatusOptions]);

	const sortedRows = useMemo(() => {
		return [...rows].sort((left, right) => {
			const leftRetired = left.status === "Retired";
			const rightRetired = right.status === "Retired";
			if (leftRetired !== rightRetired) {
				return leftRetired ? 1 : -1;
			}
			return left.radio_number.localeCompare(right.radio_number, undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
	}, [rows]);

	const openAssignmentsByRadioId = useMemo(() => {
		const map = new Map<string, PortableRadioAssignmentRecord>();
		for (const assignment of assignmentRows) {
			if (assignment.ended_at === null && !map.has(assignment.portable_radio_id)) {
				map.set(assignment.portable_radio_id, assignment);
			}
		}
		return map;
	}, [assignmentRows]);

	const filteredRows = useMemo(() => {
		let workingRows = sortedRows;
		if (searchTerm.trim()) {
			const normalized = searchTerm.trim().toLowerCase();
			workingRows = workingRows.filter((row) => {
				const haystack = [
					row.radio_number,
					row.serial_number,
					row.manufacturer,
					row.model,
					row.radio_unit_id,
				].map((value) => (typeof value === "string" ? value.toLowerCase() : "")).join(" ");
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
	}, [activeSummaryFilter, searchTerm, sortedRows, statusFilter]);

	const activeRows = useMemo(
		() => sortedRows.filter((row) => row.status !== "Retired"),
		[sortedRows],
	);

	const outOfServiceCount = activeRows.filter((row) => row.status === "Out of Service").length;
	const editingRow = useMemo(
		() => (editRadioId ? sortedRows.find((row) => row.id === editRadioId) ?? null : null),
		[editRadioId, sortedRows],
	);
	const assignmentRow = useMemo(
		() => (assignmentRadioId ? sortedRows.find((row) => row.id === assignmentRadioId) ?? null : null),
		[assignmentRadioId, sortedRows],
	);
	const historyRow = useMemo(
		() => (historyRadioId ? sortedRows.find((row) => row.id === historyRadioId) ?? null : null),
		[historyRadioId, sortedRows],
	);
	const historyRowsForSelectedRadio = useMemo(() => {
		if (!historyRadioId) {
			return [];
		}
		return assignmentRows
			.filter((row) => row.portable_radio_id === historyRadioId)
			.sort((left, right) => {
				const leftTime = new Date(left.assigned_at).getTime();
				const rightTime = new Date(right.assigned_at).getTime();
				return rightTime - leftTime;
			});
	}, [assignmentRows, historyRadioId]);

	const openAddModal = () => {
		if (!canManageRadios) {
			return;
		}
		setEditRadioId(null);
		setIsFormModalOpen(true);
	};

	const openEditModal = (radio: PortableRadioRecord) => {
		if (!canManageRadios) {
			return;
		}
		setEditRadioId(radio.id);
		setIsFormModalOpen(true);
	};

	const closeFormModal = () => {
		setIsFormModalOpen(false);
		setEditRadioId(null);
	};

	const openAssignmentModal = (radio: PortableRadioRecord) => {
		if (!canManageRadios) {
			return;
		}
		const currentAssignment = openAssignmentsByRadioId.get(radio.id);
		setAssignmentRadioId(radio.id);
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
		setAssignmentRadioId(null);
	};

	const openHistoryModal = (radio: PortableRadioRecord) => {
		setHistoryRadioId(radio.id);
		setIsHistoryModalOpen(true);
	};

	const closeHistoryModal = () => {
		setIsHistoryModalOpen(false);
		setHistoryRadioId(null);
	};

	const saveRadio = (values: PortableRadioFormValues, initialAssignment?: PortableRadioInitialAssignmentValues) => {
		void (async () => {
			if (!canManageRadios) {
				setToastMessage("You do not have permission to manage portable radios.");
				return;
			}
			if (!departmentId) {
				setToastMessage("Unable to determine department. Please refresh and try again.");
				return;
			}
			const radioNumber = normalizeOptionalText(values.radioNumber);
			const serialNumber = normalizeOptionalText(values.serialNumber);
			if (!radioNumber) {
				setToastMessage("Radio Number is required.");
				return;
			}
			if (!serialNumber) {
				setToastMessage("Serial Number is required.");
				return;
			}
			const payload = {
				department_id: departmentId,
				radio_number: radioNumber,
				serial_number: serialNumber,
				manufacturer: normalizeOptionalText(values.manufacturer) || null,
				model: normalizeOptionalText(values.model) || null,
				radio_unit_id: normalizeOptionalText(values.radioUnitId) || null,
				status: values.status,
				notes: normalizeOptionalText(values.notes) || null,
			};
			setIsSaving(true);
			if (!editingRow) {
				const { data, error } = await supabase
					.from("portable_radios")
					.insert(payload)
					.select("id, radio_number")
					.single();
				if (error || !data) {
					setIsSaving(false);
					setToastMessage(error?.message || "Unable to save portable radio.");
					return;
				}
				if (initialAssignment && initialAssignment.assignmentType !== "Unassigned") {
					if (initialAssignment.assignmentType === "Member" && !initialAssignment.memberId) {
						setIsSaving(false);
						setToastMessage("Select a department member for initial assignment.");
						return;
					}
					if (initialAssignment.assignmentType === "Apparatus" && !initialAssignment.apparatusId) {
						setIsSaving(false);
						setToastMessage("Select an apparatus for initial assignment.");
						return;
					}
					const insertAssignmentResult = await supabase
						.from("portable_radio_assignments")
						.insert({
							department_id: departmentId,
							portable_radio_id: data.id,
							assignment_type: initialAssignment.assignmentType,
							member_id: initialAssignment.assignmentType === "Member" ? initialAssignment.memberId : null,
							apparatus_id: initialAssignment.assignmentType === "Apparatus" ? initialAssignment.apparatusId : null,
							assigned_by: currentMemberId,
							notes: null,
						})
						.select("id")
						.single();
					if (insertAssignmentResult.error || !insertAssignmentResult.data) {
						setIsSaving(false);
						setToastMessage(
							insertAssignmentResult.error?.message ||
								"Radio saved, but initial assignment could not be created.",
						);
						await refreshRadios();
						await refreshAssignments();
						closeFormModal();
						return;
					}
				}
				setIsSaving(false);
				await refreshRadios();
				await refreshAssignments();
				closeFormModal();
				setToastMessage(`Radio ${data.radio_number} saved successfully.`);
				return;
			}
			const { data, error } = await supabase
				.from("portable_radios")
				.update(payload)
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, radio_number")
				.single();
			setIsSaving(false);
			if (error || !data || data.id !== editingRow.id) {
				setToastMessage(error?.message || "Unable to update portable radio.");
				return;
			}
			await refreshRadios();
			closeFormModal();
			setToastMessage(`Radio ${data.radio_number} updated successfully.`);
		})();
	};

	const retireRadio = async () => {
		if (!canManageRadios) {
			setToastMessage("You do not have permission to manage portable radios.");
			return;
		}
		if (!departmentId || !editingRow) {
			return;
		}
		const confirmed = window.confirm(`Retire Radio ${editingRow.radio_number}?\n\nThis radio will stay in inventory as a retired record.`);
		if (!confirmed) {
			return;
		}
		const { data, error } = await supabase
			.from("portable_radios")
			.update({ status: "Retired" })
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();
		if (error || !data || data.id !== editingRow.id) {
			setToastMessage(error?.message || "Unable to retire radio.");
			return;
		}
		await refreshRadios();
		closeFormModal();
	};

	const deleteRadio = async () => {
		if (!canManageRadios) {
			setToastMessage("You do not have permission to manage portable radios.");
			return;
		}
		if (!departmentId || !editingRow) {
			return;
		}
		const confirmed = window.confirm(`Delete Radio ${editingRow.radio_number}?\n\nThis permanently removes the inventory record.`);
		if (!confirmed) {
			return;
		}
		const { data, error } = await supabase
			.from("portable_radios")
			.delete()
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();
		if (error || !data || data.id !== editingRow.id) {
			setToastMessage(error?.message || "Unable to delete radio.");
			return;
		}
		await refreshRadios();
		await refreshAssignments();
		closeFormModal();
	};

	const saveAssignment = () => {
		void (async () => {
			if (!canManageRadios) {
				setToastMessage("You do not have permission to manage portable radios.");
				return;
			}
			if (!departmentId || !assignmentRadioId || !assignmentRow) {
				setToastMessage("Unable to determine radio assignment context.");
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
				.from("portable_radio_assignments")
				.update({ ended_at: new Date().toISOString() })
				.eq("department_id", departmentId)
				.eq("portable_radio_id", assignmentRadioId)
				.is("ended_at", null);
			if (closeResult.error) {
				setIsSavingAssignment(false);
				setToastMessage(closeResult.error.message || "Unable to close current assignment.");
				return;
			}
			const insertResult = await supabase
				.from("portable_radio_assignments")
				.insert({
					department_id: departmentId,
					portable_radio_id: assignmentRadioId,
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
				.eq("portable_radio_id", assignmentRadioId);
			if (linkedDeficienciesError) {
				setIsSavingAssignment(false);
				setToastMessage(linkedDeficienciesError.message || "Unable to verify linked deficiencies.");
				return;
			}
			const hasActiveDeficiency = (linkedDeficiencies ?? []).some((row) => {
				const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
				const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
				if (statusName === "resolved" || statusName === "closed") {
					return false;
				}
				if (statusInfo?.active === false) {
					return false;
				}
				return true;
			});
			if (!hasActiveDeficiency) {
				const nextStatus = assignmentDraft.assignmentType === "Unassigned" ? "Unassigned" : "In Service";
				const updateStatusResult = await supabase
					.from("portable_radios")
					.update({ status: nextStatus })
					.eq("id", assignmentRadioId)
					.eq("department_id", departmentId)
					.select("id")
					.single();
				if (updateStatusResult.error || !updateStatusResult.data) {
					setIsSavingAssignment(false);
					setToastMessage(updateStatusResult.error?.message || "Unable to update portable radio status.");
					return;
				}
			}
			setIsSavingAssignment(false);
			await refreshRadios();
			await refreshAssignments();
			closeAssignmentModal();
			setToastMessage(`Assignment saved for ${assignmentRow.radio_number}.`);
		})();
	};

	const reportDeficiencyForRow = (row: PortableRadioRecord) => {
		const activeAssignment = openAssignmentsByRadioId.get(row.id);
		const resolvedApparatusId =
			activeAssignment?.assignment_type === "Apparatus" && activeAssignment.apparatus_id
				? activeAssignment.apparatus_id
				: "station-supply";

		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/portable-radios");
		params.set("inventoryCategory", "portable-radios");
		params.set("inventoryItemId", row.id);
		params.set("inventoryItemLabel", row.radio_number);
		params.set("apparatusId", resolvedApparatusId);
		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const getAssignmentLabel = (row: PortableRadioRecord) => {
		const assignment = openAssignmentsByRadioId.get(row.id);
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

	const hasRows = rows.length > 0;
	const hasVisibleRows = filteredRows.length > 0;

	return (
		<div className="mx-auto max-w-7xl space-y-8 pb-16">
			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">Inventory Module</p>
						<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Portable Radios</h1>
						<p className="mt-2 max-w-3xl text-sm text-neutral-400">
							Manage portable radio accountability, custody assignments, and deficiency linkage across your department.
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={openAddModal}
								disabled={!canManageRadios}
								className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
							>
								+ Add Radio
							</button>
							<button
								type="button"
								onClick={() => router.push("/deficiencies/report")}
								className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Report Deficiency
							</button>
						</div>
					</div>

					<button
						type="button"
						onClick={() => setActiveSummaryFilter("out-of-service")}
						className={`${summaryCardClasses(activeSummaryFilter === "out-of-service", "bad")} w-full max-w-[220px] shrink-0`}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Out of Service</p>
						<p className="mt-2 text-2xl font-black text-white">{outOfServiceCount}</p>
					</button>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex-1">
						<label htmlFor="radio-search" className="sr-only">
							Search radios
						</label>
						<input
							id="radio-search"
							type="text"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search by radio number, serial number, manufacturer, model, or unit ID..."
							className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>
					<div>
						<select
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value)}
							className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{STATUS_FILTERS.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				{toastVisible && toastMessage ? (
					<div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
						{toastMessage}
					</div>
				) : null}

				<div className="max-h-[420px] overflow-x-auto overflow-y-auto">
					<table className="min-w-full border-separate border-spacing-0 text-left">
						<thead>
							<tr>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Radio #</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Serial</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Manufacturer</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Model</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Unit ID</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Status</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Assigned To</th>
								<th className="border-b border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Actions</th>
							</tr>
						</thead>
						<tbody>
							{!hasRows ? (
								<tr>
									<td colSpan={8} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
										No portable radios have been added yet.
									</td>
								</tr>
							) : !hasVisibleRows ? (
								<tr>
									<td colSpan={8} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
										No radios match the current filters.
									</td>
								</tr>
							) : (
								filteredRows.map((row) => {
									const hasActiveDeficiency = activeDeficiencyByRadioId[row.id] === true;
									return (
										<tr key={row.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">{row.radio_number}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.serial_number}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.manufacturer ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.model ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.radio_unit_id ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex items-center gap-2">
													<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.status, hasActiveDeficiency)}`}>
														{row.status}
													</span>
													{hasActiveDeficiency ? <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-300">Deficiency</span> : null}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{getAssignmentLabel(row)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													{canManageRadios ? (
														<button type="button" onClick={() => openEditModal(row)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">Edit</button>
													) : null}
													{canManageRadios ? (
														<button type="button" onClick={() => openAssignmentModal(row)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/20">Assign</button>
													) : null}
													<button type="button" onClick={() => openHistoryModal(row)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">History</button>
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

			<PortableRadioFormModal
				isOpen={isFormModalOpen}
				mode={editingRow ? "edit" : "add"}
				isSaving={isSaving}
				canDelete={canManageRadios}
				memberOptions={memberSelectOptions}
				apparatusOptions={apparatusSelectOptions}
				initialValues={
					editingRow
						? {
								radioNumber: editingRow.radio_number,
								serialNumber: editingRow.serial_number,
								manufacturer: editingRow.manufacturer ?? "",
								model: editingRow.model ?? "",
								radioUnitId: editingRow.radio_unit_id ?? "",
								status: editingRow.status,
								notes: editingRow.notes ?? "",
							}
						: undefined
				}
				onClose={closeFormModal}
				onSave={saveRadio}
				onRetire={editingRow && canManageRadios ? () => void retireRadio() : undefined}
				onDelete={editingRow && canManageRadios ? () => void deleteRadio() : undefined}
				onReportDeficiency={editingRow ? () => reportDeficiencyForRow(editingRow) : undefined}
			/>

			{isAssignmentModalOpen && assignmentRow ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<h3 className="text-xl font-black text-white">Assign Portable Radio</h3>
						<p className="mt-1 text-sm text-neutral-400">{assignmentRow.radio_number} • {assignmentRow.serial_number}</p>

						<div className="mt-5 grid gap-3 md:grid-cols-2">
							<label className="block md:col-span-2">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type *</span>
								<select
									value={assignmentDraft.assignmentType}
									onChange={(event) => {
										const nextType =
											event.target.value === "Apparatus" || event.target.value === "Unassigned"
												? event.target.value
												: "Member";
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
										{memberSelectOptions.map((member) => (
											<option key={member.id} value={member.id}>
												{member.label}
											</option>
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
										{apparatusSelectOptions.map((apparatus) => (
											<option key={apparatus.id} value={apparatus.id}>
												{apparatus.label}
											</option>
										))}
									</select>
								</label>
							) : null}

							<label className="block md:col-span-2">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Notes</span>
								<textarea
									rows={3}
									value={assignmentDraft.notes}
									onChange={(event) => setAssignmentDraft((current) => ({ ...current, notes: event.target.value }))}
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						</div>

						<div className="mt-6 flex items-center justify-end gap-3">
							<button type="button" onClick={closeAssignmentModal} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Cancel</button>
							<button type="button" onClick={saveAssignment} disabled={isSavingAssignment} className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
								{isSavingAssignment ? "Saving..." : "Save Assignment"}
							</button>
						</div>
					</div>
				</div>
			) : null}

			{isHistoryModalOpen && historyRow ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<h3 className="text-xl font-black text-white">Assignment History</h3>
						<p className="mt-1 text-sm text-neutral-400">{historyRow.radio_number} • {historyRow.serial_number}</p>
						<div className="mt-5 overflow-hidden rounded-xl border border-white/10">
							<table className="min-w-full text-left text-sm">
								<thead className="bg-[#1b1b1b] text-neutral-400">
									<tr>
										<th className="px-4 py-3">Assigned</th>
										<th className="px-4 py-3">Type</th>
										<th className="px-4 py-3">Details</th>
										<th className="px-4 py-3">Ended</th>
									</tr>
								</thead>
								<tbody>
									{historyRowsForSelectedRadio.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
												No assignment history recorded.
											</td>
										</tr>
									) : (
										historyRowsForSelectedRadio.map((entry) => {
											const assignmentType = entry.assignment_type === "Member" ? "Member" : entry.assignment_type === "Apparatus" ? "Apparatus" : "Unassigned";
											let details = "Unassigned";
											if (entry.assignment_type === "Member" && entry.member_id) {
												details = getMemberName(membersById.get(entry.member_id));
											} else if (entry.assignment_type === "Apparatus" && entry.apparatus_id) {
												const apparatus = apparatusById.get(entry.apparatus_id);
												details = typeof apparatus?.name === "string" ? apparatus.name.trim() || "Apparatus" : "Apparatus";
											}
											return (
												<tr key={entry.id} className="border-t border-white/10">
													<td className="px-4 py-3 text-neutral-200">{formatDateTime(entry.assigned_at)}</td>
													<td className="px-4 py-3 text-neutral-200">{assignmentType}</td>
													<td className="px-4 py-3 text-neutral-200">{details}</td>
													<td className="px-4 py-3 text-neutral-200">{entry.ended_at ? formatDateTime(entry.ended_at) : "Open"}</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
						<div className="mt-6 flex justify-end">
							<button type="button" onClick={closeHistoryModal} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Close</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
