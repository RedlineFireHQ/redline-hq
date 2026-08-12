"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ThermalImagingCameraFormModal, {
	ThermalImagingCameraInitialAssignmentValues,
	ThermalImagingCameraFormValues,
} from "@/components/inventory/ThermalImagingCameraFormModal";

type ThermalImagingCameraRecord = {
	id: string;
	department_id: string;
	camera_number: string;
	serial_number: string;
	manufacturer: string | null;
	model: string | null;
	camera_unit_id: string | null;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string | null;
	created_at: string;
	updated_at: string;
};

type ThermalImagingCameraAssignmentRecord = {
	id: string;
	department_id: string;
	thermal_imaging_camera_id: string;
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

interface ThermalImagingCameraWorkspaceProps {
	departmentId: string | null;
	departmentName: string | null;
	initialRows: ThermalImagingCameraRecord[];
	initialError?: string | null;
	canDeleteCamera: boolean;
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

export default function ThermalImagingCameraWorkspace({
	departmentId: initialDepartmentId,
	departmentName = null,
	initialRows,
	initialError = null,
	canDeleteCamera,
}: ThermalImagingCameraWorkspaceProps) {
	const router = useRouter();
	const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
	const [rows, setRows] = useState<ThermalImagingCameraRecord[]>(initialRows);
	const [assignmentRows, setAssignmentRows] = useState<ThermalImagingCameraAssignmentRecord[]>([]);
	const [memberOptions, setMemberOptions] = useState<MemberRecord[]>([]);
	const [apparatusOptions, setApparatusOptions] = useState<ApparatusRecord[]>([]);
	const [activeDeficiencyByCameraId, setActiveDeficiencyByCameraId] = useState<Record<string, boolean>>({});
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [isFormModalOpen, setIsFormModalOpen] = useState(false);
	const [editCameraId, setEditCameraId] = useState<string | null>(null);
	const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
	const [assignmentCameraId, setAssignmentCameraId] = useState<string | null>(null);
	const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>({
		assignmentType: "Member",
		memberId: "",
		apparatusId: "",
		notes: "",
	});
	const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
	const [historyCameraId, setHistoryCameraId] = useState<string | null>(null);
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

	const refreshCameras = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("thermal_imaging_cameras")
			.select("id, department_id, camera_number, serial_number, manufacturer, model, camera_unit_id, status, notes, created_at, updated_at")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			setToastMessage(error.message || "Unable to load portable cameras.");
			return;
		}

		setRows((data ?? []) as ThermalImagingCameraRecord[]);
	};

	const refreshAssignments = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("thermal_imaging_camera_assignments")
			.select("id, department_id, thermal_imaging_camera_id, assignment_type, member_id, apparatus_id, assigned_at, ended_at, assigned_by, notes, created_at")
			.eq("department_id", departmentId)
			.order("assigned_at", { ascending: false });

		if (error) {
			setToastMessage(error.message || "Unable to load camera assignment history.");
			return;
		}

		setAssignmentRows((data ?? []) as ThermalImagingCameraAssignmentRecord[]);
	};

	const refreshDeficiencies = async (cameraIds: string[]) => {
		if (cameraIds.length === 0) {
			setActiveDeficiencyByCameraId({});
			return;
		}

		const { data, error } = await supabase
			.from("deficiencies")
			.select("thermal_imaging_camera_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
			.in("thermal_imaging_camera_id", cameraIds);

		if (error) {
			setToastMessage(error.message || "Unable to verify linked deficiencies.");
			return;
		}

		const nextMap: Record<string, boolean> = {};

		for (const row of data ?? []) {
			const cameraId = row.thermal_imaging_camera_id;
			if (typeof cameraId !== "string" || !cameraId) {
				continue;
			}

			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

			if (statusName === "resolved" || statusName === "closed") {
				continue;
			}

			if (statusInfo?.active === true || !statusName) {
				nextMap[cameraId] = true;
			}
		}

		setActiveDeficiencyByCameraId(nextMap);
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

			return left.camera_number.localeCompare(right.camera_number, undefined, {
				numeric: true,
				sensitivity: "base",
			});
		});
	}, [rows]);

	const openAssignmentsByCameraId = useMemo(() => {
		const map = new Map<string, ThermalImagingCameraAssignmentRecord>();
		for (const assignment of assignmentRows) {
			if (assignment.ended_at === null && !map.has(assignment.thermal_imaging_camera_id)) {
				map.set(assignment.thermal_imaging_camera_id, assignment);
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
					row.camera_number,
					row.serial_number,
					row.manufacturer,
					row.model,
					row.camera_unit_id,
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
	}, [activeSummaryFilter, searchTerm, sortedRows, statusFilter]);

	const activeRows = useMemo(() => sortedRows.filter((row) => row.status !== "Retired"), [sortedRows]);
	const totalCount = sortedRows.length;
	const inServiceCount = activeRows.filter((row) => row.status === "In Service").length;
	const unassignedCount = activeRows.filter((row) => row.status === "Unassigned").length;
	const outOfServiceCount = activeRows.filter((row) => row.status === "Out of Service").length;
	const lostStolenCount = activeRows.filter((row) => row.status === "Lost" || row.status === "Stolen").length;
	const retiredCount = sortedRows.filter((row) => row.status === "Retired").length;
	const inServiceReadyCount = activeRows.filter(
		(row) => row.status === "In Service" && activeDeficiencyByCameraId[row.id] !== true,
	).length;
	const readinessPercentage = activeRows.length > 0 ? Math.round((inServiceReadyCount / activeRows.length) * 100) : 100;

	const editingRow = useMemo(
		() => (editCameraId ? sortedRows.find((row) => row.id === editCameraId) ?? null : null),
		[editCameraId, sortedRows],
	);

	const assignmentRow = useMemo(
		() => (assignmentCameraId ? sortedRows.find((row) => row.id === assignmentCameraId) ?? null : null),
		[assignmentCameraId, sortedRows],
	);

	const historyRow = useMemo(
		() => (historyCameraId ? sortedRows.find((row) => row.id === historyCameraId) ?? null : null),
		[historyCameraId, sortedRows],
	);

	const historyRowsForSelectedCamera = useMemo(() => {
		if (!historyCameraId) {
			return [] as ThermalImagingCameraAssignmentRecord[];
		}

		return assignmentRows
			.filter((row) => row.thermal_imaging_camera_id === historyCameraId)
			.sort((left, right) => {
				const leftTime = new Date(left.assigned_at).getTime();
				const rightTime = new Date(right.assigned_at).getTime();
				return rightTime - leftTime;
			});
	}, [assignmentRows, historyCameraId]);

	const openAddModal = () => {
		setEditCameraId(null);
		setIsFormModalOpen(true);
	};

	const openEditModal = (camera: ThermalImagingCameraRecord) => {
		setEditCameraId(camera.id);
		setIsFormModalOpen(true);
	};

	const closeFormModal = () => {
		setIsFormModalOpen(false);
		setEditCameraId(null);
	};

	const openAssignmentModal = (camera: ThermalImagingCameraRecord) => {
		const currentAssignment = openAssignmentsByCameraId.get(camera.id);
		setAssignmentCameraId(camera.id);
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
		setAssignmentCameraId(null);
	};

	const openHistoryModal = (camera: ThermalImagingCameraRecord) => {
		setHistoryCameraId(camera.id);
		setIsHistoryModalOpen(true);
	};

	const closeHistoryModal = () => {
		setIsHistoryModalOpen(false);
		setHistoryCameraId(null);
	};

	const saveCamera = (
		values: ThermalImagingCameraFormValues,
		initialAssignment?: ThermalImagingCameraInitialAssignmentValues,
	) => {
		void (async () => {
			if (!departmentId) {
				setToastMessage("Unable to determine department. Please refresh and try again.");
				return;
			}

			const cameraNumber = normalizeOptionalText(values.cameraNumber);
			const serialNumber = normalizeOptionalText(values.serialNumber);

			if (!cameraNumber) {
				setToastMessage("Camera Number is required.");
				return;
			}

			if (!serialNumber) {
				setToastMessage("Serial Number is required.");
				return;
			}

			const payload = {
				department_id: departmentId,
				camera_number: cameraNumber,
				serial_number: serialNumber,
				manufacturer: normalizeOptionalText(values.manufacturer) || null,
				model: normalizeOptionalText(values.model) || null,
				camera_unit_id: normalizeOptionalText(values.cameraUnitId) || null,
				status: values.status,
				notes: normalizeOptionalText(values.notes) || null,
			};

			setIsSaving(true);

			if (!editingRow) {
				const { data, error } = await supabase
					.from("thermal_imaging_cameras")
					.insert(payload)
					.select("id, camera_number")
					.single();

				if (error || !data) {
					setIsSaving(false);
					setToastMessage(error?.message || "Unable to save portable camera.");
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
						.from("thermal_imaging_camera_assignments")
						.insert({
							department_id: departmentId,
							thermal_imaging_camera_id: data.id,
							assignment_type: initialAssignment.assignmentType,
							member_id:
								initialAssignment.assignmentType === "Member"
									? initialAssignment.memberId
									: null,
							apparatus_id:
								initialAssignment.assignmentType === "Apparatus"
									? initialAssignment.apparatusId
									: null,
							assigned_by: currentMemberId,
							notes: null,
						})
						.select("id")
						.single();

					if (insertAssignmentResult.error || !insertAssignmentResult.data) {
						setIsSaving(false);
						setToastMessage(insertAssignmentResult.error?.message || "Camera saved, but initial assignment could not be created.");
						await refreshCameras();
						await refreshAssignments();
						closeFormModal();
						return;
					}
				}

				setIsSaving(false);

				await refreshCameras();
				await refreshAssignments();
				closeFormModal();
				setToastMessage(`Camera ${data.camera_number} saved successfully.`);
				return;
			}

			const { data, error } = await supabase
				.from("thermal_imaging_cameras")
				.update(payload)
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, camera_number")
				.single();

			setIsSaving(false);
			if (error || !data || data.id !== editingRow.id) {
				setToastMessage(error?.message || "Unable to update portable camera.");
				return;
			}

			await refreshCameras();
			closeFormModal();
			setToastMessage(`Camera ${data.camera_number} updated successfully.`);
		})();
	};

	const retireCamera = async () => {
		if (!departmentId || !editingRow) {
			return;
		}

		const confirmed = window.confirm(
			`Retire Camera ${editingRow.camera_number}?\n\nThis camera will stay in inventory as a retired record.`,
		);

		if (!confirmed) {
			return;
		}

		const { data, error } = await supabase
			.from("thermal_imaging_cameras")
			.update({ status: "Retired" })
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (error || !data || data.id !== editingRow.id) {
			setToastMessage(error?.message || "Unable to retire camera.");
			return;
		}

		await refreshCameras();
		closeFormModal();
	};

	const deleteCamera = async () => {
		if (!departmentId || !editingRow || !canDeleteCamera) {
			return;
		}

		const confirmed = window.confirm(
			`Delete Camera ${editingRow.camera_number}?\n\nThis permanently removes the inventory record.`,
		);

		if (!confirmed) {
			return;
		}

		const { data, error } = await supabase
			.from("thermal_imaging_cameras")
			.delete()
			.eq("id", editingRow.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (error || !data || data.id !== editingRow.id) {
			setToastMessage(error?.message || "Unable to delete camera.");
			return;
		}

		await refreshCameras();
		await refreshAssignments();
		closeFormModal();
	};

	const saveAssignment = () => {
		void (async () => {
			if (!departmentId || !assignmentCameraId || !assignmentRow) {
				setToastMessage("Unable to determine camera assignment context.");
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
				.from("thermal_imaging_camera_assignments")
				.update({ ended_at: new Date().toISOString() })
				.eq("department_id", departmentId)
				.eq("thermal_imaging_camera_id", assignmentCameraId)
				.is("ended_at", null);

			if (closeResult.error) {
				setIsSavingAssignment(false);
				setToastMessage(closeResult.error.message || "Unable to close current assignment.");
				return;
			}

			const insertResult = await supabase
				.from("thermal_imaging_camera_assignments")
				.insert({
					department_id: departmentId,
					thermal_imaging_camera_id: assignmentCameraId,
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
				.eq("thermal_imaging_camera_id", assignmentCameraId);

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
				const nextStatus =
					assignmentDraft.assignmentType === "Unassigned" ? "Unassigned" : "In Service";

				const updateStatusResult = await supabase
					.from("thermal_imaging_cameras")
					.update({ status: nextStatus })
					.eq("id", assignmentCameraId)
					.eq("department_id", departmentId)
					.select("id")
					.single();

				if (updateStatusResult.error || !updateStatusResult.data) {
					setIsSavingAssignment(false);
					setToastMessage(updateStatusResult.error?.message || "Unable to update portable camera status.");
					return;
				}
			}

			setIsSavingAssignment(false);
			await refreshCameras();
			await refreshAssignments();
			closeAssignmentModal();
			setToastMessage(`Assignment saved for ${assignmentRow.camera_number}.`);
		})();
	};

	const reportDeficiencyForRow = (row: ThermalImagingCameraRecord) => {
		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/thermal-cameras");
		params.set("inventoryCategory", "thermal-cameras");
		params.set("inventoryItemId", row.id);
		params.set("inventoryItemLabel", row.camera_number);
		params.set("apparatusId", "station-supply");
		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const getAssignmentLabel = (row: ThermalImagingCameraRecord) => {
		const assignment = openAssignmentsByCameraId.get(row.id);
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
	const scoreWidth = `${Math.max(0, Math.min(100, readinessPercentage))}%`;

	return (
		<div className="mx-auto max-w-7xl space-y-8 pb-16">
			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">Inventory Module</p>
						<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Portable Cameras</h1>
						<p className="mt-2 max-w-3xl text-sm text-neutral-400">Manage portable camera accountability, custody assignments, and deficiency linkage across your department.</p>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={openAddModal}
								className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
							>
								+ Add Camera
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

					<div className="w-full max-w-[220px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Accountability</p>
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
				<div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
					<button
						type="button"
						onClick={() => setActiveSummaryFilter("all")}
						className={summaryCardClasses(activeSummaryFilter === "all", "neutral")}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Total Cameras</p>
						<p className="mt-2 text-2xl font-black text-white">{totalCount}</p>
					</button>

					<button
						type="button"
						onClick={() => setActiveSummaryFilter("in-service")}
						className={summaryCardClasses(activeSummaryFilter === "in-service", "good")}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">In Service</p>
						<p className="mt-2 text-2xl font-black text-white">{inServiceCount}</p>
					</button>

					<button
						type="button"
						onClick={() => setActiveSummaryFilter("unassigned")}
						className={summaryCardClasses(activeSummaryFilter === "unassigned", "warn")}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Unassigned</p>
						<p className="mt-2 text-2xl font-black text-white">{unassignedCount}</p>
					</button>

					<button
						type="button"
						onClick={() => setActiveSummaryFilter("out-of-service")}
						className={summaryCardClasses(activeSummaryFilter === "out-of-service", "bad")}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Out of Service</p>
						<p className="mt-2 text-2xl font-black text-white">{outOfServiceCount}</p>
					</button>

					<button
						type="button"
						onClick={() => setActiveSummaryFilter("lost-stolen")}
						className={summaryCardClasses(activeSummaryFilter === "lost-stolen", "bad")}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Lost / Stolen</p>
						<p className="mt-2 text-2xl font-black text-white">{lostStolenCount}</p>
					</button>

					<button
						type="button"
						onClick={() => setActiveSummaryFilter("retired")}
						className={summaryCardClasses(activeSummaryFilter === "retired", "neutral")}
					>
						<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Retired</p>
						<p className="mt-2 text-2xl font-black text-white">{retiredCount}</p>
					</button>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0 flex-1">
						<label htmlFor="portable-camera-search" className="sr-only">Search portable cameras</label>
						<input
							id="portable-camera-search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search camera number, serial number, manufacturer, model, or unit ID..."
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
								{["Camera Number", "Serial Number", "Manufacturer", "Model", "Camera Unit ID", "Status", "Current Assignment", "Actions"].map((label) => (
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
									<td colSpan={8} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
										No portable cameras have been added yet.
									</td>
								</tr>
							) : !hasVisibleRows ? (
								<tr>
									<td colSpan={8} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
										No cameras match the current filters.
									</td>
								</tr>
							) : (
								filteredRows.map((row) => {
									const hasActiveDeficiency = activeDeficiencyByCameraId[row.id] === true;
									return (
										<tr key={row.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">{row.camera_number}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.serial_number}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.manufacturer ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.model ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.camera_unit_id ?? "-"}</td>
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
													<button
														type="button"
														onClick={() => openEditModal(row)}
														className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => openAssignmentModal(row)}
														className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
													>
														Assign
													</button>
													<button
														type="button"
														onClick={() => openHistoryModal(row)}
														className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														History
													</button>
													<button
														type="button"
														onClick={() => reportDeficiencyForRow(row)}
														className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														Report Deficiency
													</button>
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

			<ThermalImagingCameraFormModal
				isOpen={isFormModalOpen}
				mode={editingRow ? "edit" : "add"}
				isSaving={isSaving}
				canDelete={canDeleteCamera}
				memberOptions={memberSelectOptions}
				apparatusOptions={apparatusSelectOptions}
				initialValues={
					editingRow
						? {
							cameraNumber: editingRow.camera_number,
							serialNumber: editingRow.serial_number,
							manufacturer: editingRow.manufacturer ?? "",
							model: editingRow.model ?? "",
							cameraUnitId: editingRow.camera_unit_id ?? "",
							status: editingRow.status,
							notes: editingRow.notes ?? "",
						}
						: undefined
				}
				onClose={closeFormModal}
				onSave={saveCamera}
				onRetire={editingRow ? () => void retireCamera() : undefined}
				onDelete={editingRow ? () => void deleteCamera() : undefined}
				onReportDeficiency={editingRow ? () => reportDeficiencyForRow(editingRow) : undefined}
			/>

			{isAssignmentModalOpen && assignmentRow ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<h3 className="text-xl font-black text-white">Assign Portable Camera</h3>
						<p className="mt-1 text-sm text-neutral-400">{assignmentRow.camera_number} • {assignmentRow.serial_number}</p>

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
							<button
								type="button"
								onClick={closeAssignmentModal}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={isSavingAssignment}
								onClick={saveAssignment}
								className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isSavingAssignment ? "Saving..." : "Save Assignment"}
							</button>
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
								<p className="mt-1 text-sm text-neutral-400">{historyRow.camera_number} • {historyRow.serial_number}</p>
							</div>
							<button
								type="button"
								onClick={closeHistoryModal}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Close
							</button>
						</div>

						<div className="mt-5 overflow-x-auto">
							<table className="min-w-full border-separate border-spacing-0 text-left">
								<thead>
									<tr>
										{["Assignment", "Type", "Date Assigned", "Date Ended", "Assigned By", "Notes"].map((label) => (
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
									{historyRowsForSelectedCamera.length === 0 ? (
										<tr>
											<td colSpan={6} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">No assignment history recorded yet.</td>
										</tr>
									) : (
										historyRowsForSelectedCamera.map((assignment) => {
											let assignmentLabel = "Unassigned";
											if (assignment.assignment_type === "Member") {
												assignmentLabel = assignment.member_id
													? getMemberName(membersById.get(assignment.member_id))
													: "Member";
											} else if (assignment.assignment_type === "Apparatus") {
												const apparatus = assignment.apparatus_id
													? apparatusById.get(assignment.apparatus_id)
													: undefined;
												assignmentLabel = apparatus?.name ?? "Apparatus";
											}

											const assignedBy = assignment.assigned_by
												? getMemberName(membersById.get(assignment.assigned_by))
												: "-";

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
