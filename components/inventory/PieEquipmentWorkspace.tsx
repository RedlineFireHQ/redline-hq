"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PieEquipmentFormModal, {
	PieEquipmentFormValues,
	PieEquipmentInitialAssignmentValues,
} from "@/components/inventory/PieEquipmentFormModal";

export type PieEquipmentRecord = {
	id: string;
	department_id: string;
	equipment_number: string;
	serial_number: string | null;
	manufacturer: string | null;
	model: string | null;
	equipment_type: string | null;
	power_source: string | null;
	location: string | null;
	in_service_date: string | null;
	status: string;
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type PieEquipmentAssignmentRecord = {
	id: string;
	department_id: string;
	pie_equipment_id: string;
	assignment_type: "Apparatus" | "Station" | "Equipment" | "Unassigned";
	apparatus_id: string | null;
	station_name: string | null;
	equipment_reference: string | null;
	notes: string | null;
	assigned_at: string;
	ended_at: string | null;
	created_at: string;
};

type ApparatusOption = {
	id: string;
	name: string | null;
};

type AssignmentModalState = {
	pieEquipment: PieEquipmentRecord;
	type: "Apparatus" | "Station" | "Equipment";
	apparatusId: string;
	stationName: string;
	equipmentReference: string;
	notes: string;
};

interface PieEquipmentWorkspaceProps {
	departmentId: string | null;
	initialEquipment: PieEquipmentRecord[];
	initialAssignments: PieEquipmentAssignmentRecord[];
	apparatusOptions: ApparatusOption[];
}

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
	if (normalized === "unassigned") {
		return "Unassigned";
	}

	return toTitleCase(status);
}

function isProtectedStatus(status: string | null | undefined) {
	const normalized = normalizeStatus(status);
	return normalized === "Retired" || normalized === "Lost" || normalized === "Stolen";
}

function isOutOfServiceLikeStatus(status: string | null | undefined) {
	const normalized = normalizeStatus(status);
	return normalized === "Out of Service" || isProtectedStatus(normalized);
}

function getApparatusLabelFromOption(option: ApparatusOption | null | undefined) {
	if (!option) {
		return "Unknown Apparatus";
	}

	return option.name || "Unknown Apparatus";
}

function getAssignmentLabel(
	assignment: PieEquipmentAssignmentRecord | null | undefined,
	apparatusLookup: Map<string, ApparatusOption>,
) {
	if (!assignment) {
		return "Unassigned";
	}

	if (assignment.assignment_type === "Apparatus") {
		return `Apparatus: ${getApparatusLabelFromOption(apparatusLookup.get(assignment.apparatus_id ?? ""))}`;
	}

	if (assignment.assignment_type === "Station") {
		return `Station: ${assignment.station_name?.trim() || "Unspecified"}`;
	}

	if (assignment.assignment_type === "Equipment") {
		return `Equipment: ${assignment.equipment_reference?.trim() || "Unspecified"}`;
	}

	return "Unassigned";
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

function formatDate(value: string | null | undefined) {
	if (!value) {
		return "-";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "2-digit",
	});
}

function getCurrentDateIso() {
	return new Date().toISOString().slice(0, 10);
}

function normalizeInServiceDateForSave(value: string | null | undefined) {
	const raw = typeof value === "string" ? value.trim() : "";
	if (!raw) {
		return null;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		return raw;
	}
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return parsed.toISOString().slice(0, 10);
}

export default function PieEquipmentWorkspace({
	departmentId,
	initialEquipment,
	initialAssignments,
	apparatusOptions,
}: PieEquipmentWorkspaceProps) {
	const router = useRouter();
	const [equipment, setEquipment] = useState<PieEquipmentRecord[]>(initialEquipment);
	const [assignments, setAssignments] = useState<PieEquipmentAssignmentRecord[]>(initialAssignments);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [formMode, setFormMode] = useState<"add" | "edit">("add");
	const [formEquipment, setFormEquipment] = useState<PieEquipmentRecord | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isSavingForm, setIsSavingForm] = useState(false);
	const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState | null>(null);
	const [historyEquipment, setHistoryEquipment] = useState<PieEquipmentRecord | null>(null);
	const [isSavingAssignment, setIsSavingAssignment] = useState(false);

	const activeAssignmentByEquipmentId = useMemo(() => {
		const entries = assignments
			.filter((assignment) => !assignment.ended_at)
			.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
			.map((assignment) => [assignment.pie_equipment_id, assignment] as const);
		return new Map<string, PieEquipmentAssignmentRecord>(entries);
	}, [assignments]);

	const apparatusLookupById = useMemo(
		() => new Map(apparatusOptions.map((option) => [option.id, option] as const)),
		[apparatusOptions],
	);

	const metrics = useMemo(() => {
		let inService = 0;
		let unassigned = 0;
		let outOfService = 0;
		let accountabilityRisk = 0;

		for (const item of equipment) {
			const status = normalizeStatus(item.status);
			if (status === "In Service") {
				inService += 1;
			}
			if (status === "Unassigned") {
				unassigned += 1;
			}
			if (status === "Out of Service") {
				outOfService += 1;
			}
			if (status === "Lost" || status === "Stolen") {
				accountabilityRisk += 1;
			}
		}

		const total = equipment.length;
		const readinessScore = total > 0 ? Math.round((inService / total) * 100) : 0;
		return { total, inService, unassigned, outOfService, accountabilityRisk, readinessScore };
	}, [equipment]);

	const filteredEquipment = useMemo(() => {
		const search = searchTerm.trim().toLowerCase();
		const filter = statusFilter.toLowerCase();

		return equipment
			.filter((item) => {
				const normalizedStatus = normalizeStatus(item.status).toLowerCase();
				if (filter !== "all" && normalizedStatus !== filter) {
					return false;
				}

				if (!search) {
					return true;
				}

				const assignment = activeAssignmentByEquipmentId.get(item.id);
				const haystack = [
					item.equipment_number,
					item.serial_number,
					item.manufacturer,
					item.model,
					item.equipment_type,
					item.power_source,
					item.location,
					assignment?.station_name,
					assignment?.equipment_reference,
					assignment?.apparatus_id
						? getApparatusLabelFromOption(apparatusLookupById.get(assignment.apparatus_id))
						: null,
					assignment?.assignment_type,
				]
					.filter((value): value is string => Boolean(value))
					.join(" ")
					.toLowerCase();

				return haystack.includes(search);
			})
			.sort((a, b) => a.equipment_number.localeCompare(b.equipment_number));
	}, [activeAssignmentByEquipmentId, apparatusLookupById, equipment, searchTerm, statusFilter]);

	const historyEntries = useMemo(() => {
		if (!historyEquipment) {
			return [];
		}
		return assignments
			.filter((assignment) => assignment.pie_equipment_id === historyEquipment.id)
			.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
	}, [assignments, historyEquipment]);

	const formInitialValues: PieEquipmentFormValues | undefined = formEquipment
		? {
				equipmentNumber: formEquipment.equipment_number,
				serialNumber: formEquipment.serial_number ?? "",
				manufacturer: formEquipment.manufacturer ?? "",
				model: formEquipment.model ?? "",
				equipmentType: formEquipment.equipment_type ?? "",
				inServiceDate: formEquipment.in_service_date ?? "",
				status: normalizeStatus(formEquipment.status) as PieEquipmentFormValues["status"],
				notes: formEquipment.notes ?? "",
			}
		: undefined;

	const canDelete = Boolean(formEquipment);

	const formApparatusOptions = useMemo(
		() =>
			apparatusOptions
				.map((option) => ({
					id: option.id,
					label: option.name || "Unknown Apparatus",
				}))
				.sort((a, b) => a.label.localeCompare(b.label)),
		[apparatusOptions],
	);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") {
			console.info("[pie] workspace apparatus options", {
				departmentId,
				count: apparatusOptions.length,
			});
		}
	}, [departmentId, apparatusOptions.length]);

	function openAddModal() {
		setFormMode("add");
		setFormEquipment(null);
		setIsFormOpen(true);
	}

	function openEditModal(item: PieEquipmentRecord) {
		setFormMode("edit");
		setFormEquipment(item);
		setIsFormOpen(true);
	}

	async function refreshAssignmentsForEquipment(equipmentId: string) {
		const { data, error } = await supabase
			.from("pie_equipment_assignments")
			.select(
				"id, department_id, pie_equipment_id, assignment_type, apparatus_id, station_name, equipment_reference, notes, assigned_at, ended_at, created_at",
			)
			.eq("department_id", departmentId)
			.eq("pie_equipment_id", equipmentId)
			.order("assigned_at", { ascending: false });

		if (error) {
			throw error;
		}

		setAssignments((current) => {
			const withoutTarget = current.filter((entry) => entry.pie_equipment_id !== equipmentId);
			return [...withoutTarget, ...((data ?? []) as PieEquipmentAssignmentRecord[])];
		});
	}

	async function handleSaveForm(
		values: PieEquipmentFormValues,
		initialAssignment?: PieEquipmentInitialAssignmentValues,
	) {
		if (!departmentId) {
			alert("Unable to determine department. Please refresh and try again.");
			return;
		}
		if (!values.equipmentNumber.trim()) {
			alert("Equipment / Asset Number is required.");
			return;
		}

		setIsSavingForm(true);
		try {
			if (formMode === "add") {
				const normalizedInServiceDate = normalizeInServiceDateForSave(values.inServiceDate);
				const assignmentType = initialAssignment?.assignmentType ?? "Unassigned";
				const hasOperationalAssignment = assignmentType !== "Unassigned";
				const computedStatus = isOutOfServiceLikeStatus(values.status)
					? values.status
					: hasOperationalAssignment
						? "In Service"
						: values.status === "In Service"
							? "Unassigned"
							: values.status;

				const initialInServiceDate = normalizedInServiceDate ??
					(computedStatus === "In Service" && hasOperationalAssignment ? getCurrentDateIso() : null);

				const payload = {
					department_id: departmentId,
					equipment_number: values.equipmentNumber.trim(),
					serial_number: values.serialNumber.trim() || null,
					manufacturer: values.manufacturer.trim() || null,
					model: values.model.trim() || null,
					equipment_type: values.equipmentType.trim() || null,
					power_source: null,
					location: null,
					in_service_date: initialInServiceDate,
					status: computedStatus,
					notes: values.notes.trim() || null,
				};

				const { data, error } = await supabase
					.from("pie_equipment")
					.insert(payload)
					.select("*")
					.single();

				if (error) {
					throw error;
				}

				let newEquipment = data as PieEquipmentRecord;
				if (!newEquipment.in_service_date && (normalizedInServiceDate || initialInServiceDate)) {
					const repairValue = normalizedInServiceDate ?? initialInServiceDate ?? null;
					const { data: repairedRow, error: repairError } = await supabase
						.from("pie_equipment")
						.update({ in_service_date: repairValue })
						.eq("id", newEquipment.id)
						.eq("department_id", departmentId)
						.select("*")
						.single();
					if (repairError) {
						throw repairError;
					}
					newEquipment = repairedRow as PieEquipmentRecord;
				}

				setEquipment((current) => [newEquipment, ...current]);

				if (assignmentType === "Apparatus" && !initialAssignment?.apparatusId) {
					alert("Select an apparatus for initial assignment.");
					setIsSavingForm(false);
					return;
				}
				if (assignmentType === "Station" && !initialAssignment?.stationName.trim()) {
					alert("Enter a station for initial assignment.");
					setIsSavingForm(false);
					return;
				}
				if (assignmentType === "Equipment" && !initialAssignment?.equipmentReference.trim()) {
					alert("Enter an equipment reference for initial assignment.");
					setIsSavingForm(false);
					return;
				}

				const { error: assignmentError } = await supabase.from("pie_equipment_assignments").insert({
					department_id: departmentId,
					pie_equipment_id: newEquipment.id,
					assignment_type: assignmentType,
					apparatus_id: assignmentType === "Apparatus" ? initialAssignment?.apparatusId ?? null : null,
					station_name: assignmentType === "Station" ? initialAssignment?.stationName.trim() || null : null,
					equipment_reference:
						assignmentType === "Equipment"
							? initialAssignment?.equipmentReference.trim() || null
							: null,
					notes: null,
				});

				if (assignmentError) {
					throw assignmentError;
				}

				await refreshAssignmentsForEquipment(newEquipment.id);
			} else if (formEquipment) {
				const payload = {
					in_service_date: normalizeInServiceDateForSave(values.inServiceDate),
					equipment_number: values.equipmentNumber.trim(),
					serial_number: values.serialNumber.trim() || null,
					manufacturer: values.manufacturer.trim() || null,
					model: values.model.trim() || null,
					equipment_type: values.equipmentType.trim() || null,
					status: values.status,
					notes: values.notes.trim() || null,
				};

				const { data, error } = await supabase
					.from("pie_equipment")
					.update(payload)
					.eq("id", formEquipment.id)
					.eq("department_id", departmentId)
					.select("*")
					.single();

				if (error) {
					throw error;
				}

				const updatedEquipment = data as PieEquipmentRecord;
				setEquipment((current) =>
					current.map((item) => (item.id === updatedEquipment.id ? updatedEquipment : item)),
				);
			}

			setIsFormOpen(false);
			setFormEquipment(null);
		} catch (error) {
			console.error("[pie][save] failed", error);
			alert("Unable to save PIE equipment record. Check console for details.");
		} finally {
			setIsSavingForm(false);
		}
	}

	async function handleDeleteEquipment() {
		if (!formEquipment) {
			return;
		}
		if (!window.confirm(`Delete PIE equipment ${formEquipment.equipment_number}? This cannot be undone.`)) {
			return;
		}

		setIsSavingForm(true);
		try {
			const { error } = await supabase
				.from("pie_equipment")
				.delete()
				.eq("id", formEquipment.id)
				.eq("department_id", departmentId);
			if (error) {
				throw error;
			}

			setEquipment((current) => current.filter((item) => item.id !== formEquipment.id));
			setAssignments((current) => current.filter((entry) => entry.pie_equipment_id !== formEquipment.id));
			setIsFormOpen(false);
			setFormEquipment(null);
		} catch (error) {
			console.error("[pie][delete] failed", error);
			alert("Unable to delete PIE equipment.");
		} finally {
			setIsSavingForm(false);
		}
	}

	async function handleRetireEquipment() {
		if (!formEquipment) {
			return;
		}
		setIsSavingForm(true);
		try {
			const { data, error } = await supabase
				.from("pie_equipment")
				.update({ status: "Retired" })
				.eq("id", formEquipment.id)
				.eq("department_id", departmentId)
				.select("*")
				.single();

			if (error) {
				throw error;
			}

			const retired = data as PieEquipmentRecord;
			setEquipment((current) => current.map((item) => (item.id === retired.id ? retired : item)));
			setFormEquipment(retired);
		} catch (error) {
			console.error("[pie][retire] failed", error);
			alert("Unable to retire PIE equipment.");
		} finally {
			setIsSavingForm(false);
		}
	}

	function openAssignmentModal(item: PieEquipmentRecord) {
		setAssignmentModal({
			pieEquipment: item,
			type: "Apparatus",
			apparatusId: "",
			stationName: "",
			equipmentReference: "",
			notes: "",
		});
	}

	async function handleSaveAssignment() {
		if (!assignmentModal) {
			return;
		}
		if (!departmentId) {
			alert("Unable to determine department. Please refresh and try again.");
			return;
		}
		if (assignmentModal.type === "Apparatus" && !assignmentModal.apparatusId) {
			alert("Select an apparatus.");
			return;
		}
		if (assignmentModal.type === "Station" && !assignmentModal.stationName.trim()) {
			alert("Enter a station.");
			return;
		}
		if (assignmentModal.type === "Equipment" && !assignmentModal.equipmentReference.trim()) {
			alert("Enter an equipment reference.");
			return;
		}

		setIsSavingAssignment(true);
		try {
			const equipmentId = assignmentModal.pieEquipment.id;
			const { data: activeRows, error: activeQueryError } = await supabase
				.from("pie_equipment_assignments")
				.select("id")
				.eq("department_id", departmentId)
				.eq("pie_equipment_id", equipmentId)
				.is("ended_at", null);

			if (activeQueryError) {
				throw activeQueryError;
			}

			const nowIso = new Date().toISOString();
			const activeIds = (activeRows ?? [])
				.map((row) => (row as { id?: string }).id)
				.filter((id): id is string => Boolean(id));

			if (activeIds.length > 0) {
				const { error: closeActiveError } = await supabase
					.from("pie_equipment_assignments")
					.update({ ended_at: nowIso })
					.eq("department_id", departmentId)
					.in("id", activeIds);
				if (closeActiveError) {
					throw closeActiveError;
				}
			}

			const { error: insertAssignmentError } = await supabase
				.from("pie_equipment_assignments")
				.insert({
					department_id: departmentId,
					pie_equipment_id: equipmentId,
					assignment_type: assignmentModal.type,
					apparatus_id: assignmentModal.type === "Apparatus" ? assignmentModal.apparatusId : null,
					station_name:
						assignmentModal.type === "Station"
							? assignmentModal.stationName.trim() || null
							: null,
					equipment_reference:
						assignmentModal.type === "Equipment"
							? assignmentModal.equipmentReference.trim() || null
							: null,
					notes: assignmentModal.notes.trim() || null,
				});

			if (insertAssignmentError) {
				throw insertAssignmentError;
			}

			const shouldSetInServiceDate = !assignmentModal.pieEquipment.in_service_date;
			const { data: updatedRow, error: statusError } = await supabase
				.from("pie_equipment")
				.update({
					status: "In Service",
					...(shouldSetInServiceDate ? { in_service_date: getCurrentDateIso() } : {}),
				})
				.eq("id", equipmentId)
				.eq("department_id", departmentId)
				.not("status", "in", '("Out of Service","Lost","Stolen","Retired")')
				.select("*")
				.single();

			if (statusError) {
				throw statusError;
			}

			const updatedEquipment = updatedRow as PieEquipmentRecord;
			setEquipment((current) =>
				current.map((item) =>
					item.id === equipmentId && !isOutOfServiceLikeStatus(item.status)
						? { ...item, ...updatedEquipment }
						: item,
				),
			);

			await refreshAssignmentsForEquipment(equipmentId);
			setAssignmentModal(null);
		} catch (error) {
			console.error("[pie][assign] failed", error);
			alert("Unable to save assignment.");
		} finally {
			setIsSavingAssignment(false);
		}
	}

	async function handleUnassignEquipment(item: PieEquipmentRecord) {
		const activeAssignment = activeAssignmentByEquipmentId.get(item.id);
		if (!activeAssignment) {
			return;
		}
		if (!departmentId) {
			alert("Unable to determine department. Please refresh and try again.");
			return;
		}

		setIsSavingAssignment(true);
		try {
			const nowIso = new Date().toISOString();
			const { error: closeError } = await supabase
				.from("pie_equipment_assignments")
				.update({ ended_at: nowIso })
				.eq("department_id", departmentId)
				.eq("id", activeAssignment.id);

			if (closeError) {
				throw closeError;
			}

			const { error: unassignedInsertError } = await supabase
				.from("pie_equipment_assignments")
				.insert({
					department_id: departmentId,
					pie_equipment_id: item.id,
					assignment_type: "Unassigned",
					apparatus_id: null,
					station_name: null,
					equipment_reference: null,
					notes: null,
				});

			if (unassignedInsertError) {
				throw unassignedInsertError;
			}

			const shouldSetUnassigned = !isOutOfServiceLikeStatus(item.status);
			if (shouldSetUnassigned) {
				const { error: statusError } = await supabase
					.from("pie_equipment")
					.update({ status: "Unassigned" })
					.eq("id", item.id)
					.eq("department_id", departmentId)
					.not("status", "in", '("Out of Service","Lost","Stolen","Retired")');
				if (statusError) {
					throw statusError;
				}
			}

			setEquipment((current) =>
				current.map((entry) =>
					entry.id === item.id && shouldSetUnassigned
						? { ...entry, status: "Unassigned" }
						: entry,
				),
			);

			await refreshAssignmentsForEquipment(item.id);
		} catch (error) {
			console.error("[pie][unassign] failed", error);
			alert("Unable to unassign PIE equipment.");
		} finally {
			setIsSavingAssignment(false);
		}
	}

	function handleReportDeficiency(item: PieEquipmentRecord) {
		router.push(
			`/deficiencies/report?inventoryCategory=pie&inventoryItemId=${item.id}&inventoryItemLabel=${encodeURIComponent(item.equipment_number)}`,
		);
	}

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">PIE Asset Tracking</p>
						<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Power & Industrial Equipment</h1>
						<p className="mt-2 max-w-2xl text-sm text-neutral-400">Track assignments, accountability, and readiness for portable power and industrial tools.</p>
					</div>
					<button
						type="button"
						onClick={openAddModal}
						className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
					>
						<Plus size={16} />
						Add PIE Unit
					</button>
				</div>

				<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-neutral-400">Total</p>
						<p className="mt-2 text-2xl font-black text-white">{metrics.total}</p>
					</div>
					<div className="rounded-xl border border-green-800/30 bg-green-900/10 p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-green-300">In Service</p>
						<p className="mt-2 text-2xl font-black text-green-200">{metrics.inService}</p>
					</div>
					<div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-amber-300">Unassigned</p>
						<p className="mt-2 text-2xl font-black text-amber-200">{metrics.unassigned}</p>
					</div>
					<div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-red-300">Out of Service</p>
						<p className="mt-2 text-2xl font-black text-red-200">{metrics.outOfService}</p>
					</div>
					<div className="rounded-xl border border-blue-800/30 bg-blue-900/10 p-4">
						<p className="text-xs uppercase tracking-[0.12em] text-blue-300">Readiness</p>
						<p className="mt-2 text-2xl font-black text-blue-200">{metrics.readinessScore}%</p>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="relative w-full md:max-w-md">
						<Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
						<input
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search equipment number, serial, assignment..."
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] py-2 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>

					<select
						value={statusFilter}
						onChange={(event) => setStatusFilter(event.target.value)}
						className="rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
					>
						<option value="All">All Statuses</option>
						<option value="In Service">In Service</option>
						<option value="Unassigned">Unassigned</option>
						<option value="Out of Service">Out of Service</option>
						<option value="Lost">Lost</option>
						<option value="Stolen">Stolen</option>
						<option value="Retired">Retired</option>
					</select>
				</div>

				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full divide-y divide-white/10 text-sm">
						<thead>
							<tr className="text-left text-xs uppercase tracking-[0.14em] text-neutral-400">
								<th className="px-3 py-2">Equipment</th>
								<th className="px-3 py-2">Type / Model</th>
								<th className="px-3 py-2">Assignment</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2">In Service Since</th>
								<th className="px-3 py-2 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{filteredEquipment.length === 0 ? (
								<tr>
									<td colSpan={6} className="px-3 py-8 text-center text-neutral-500">No PIE equipment matches your filters.</td>
								</tr>
							) : (
								filteredEquipment.map((item) => {
									const assignment = activeAssignmentByEquipmentId.get(item.id);
									const status = normalizeStatus(item.status);
									return (
										<tr key={item.id} className="hover:bg-white/[0.03]">
											<td className="px-3 py-3">
												<p className="font-semibold text-white">{item.equipment_number}</p>
												<p className="text-xs text-neutral-500">SN: {item.serial_number || "N/A"}</p>
											</td>
											<td className="px-3 py-3 text-neutral-300">
												<p>{item.equipment_type || "-"}</p>
												<p className="text-xs text-neutral-500">{item.manufacturer || ""} {item.model || ""}</p>
											</td>
											<td className="px-3 py-3 text-neutral-300">
												<p>{getAssignmentLabel(assignment, apparatusLookupById)}</p>
											</td>
											<td className="px-3 py-3">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
													{status}
												</span>
											</td>
											<td className="px-3 py-3 text-neutral-300">{formatDate(item.in_service_date)}</td>
											<td className="px-3 py-3">
												<div className="flex justify-end gap-2">
													<button type="button" onClick={() => openEditModal(item)} className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">Edit</button>
													<button type="button" onClick={() => openAssignmentModal(item)} className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">Assign</button>
													{assignment ? (
														<button type="button" onClick={() => handleUnassignEquipment(item)} disabled={isSavingAssignment} className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/30 disabled:opacity-60">Unassign</button>
													) : null}
													<button type="button" onClick={() => setHistoryEquipment(item)} className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">History</button>
													<button type="button" onClick={() => handleReportDeficiency(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-600/90 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700">Deficiency <ArrowRight size={12} /></button>
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

			<PieEquipmentFormModal
				isOpen={isFormOpen}
				mode={formMode}
				initialValues={formInitialValues}
				isSaving={isSavingForm}
				canDelete={canDelete}
				apparatusOptions={formApparatusOptions}
				onClose={() => {
					setIsFormOpen(false);
					setFormEquipment(null);
				}}
				onSave={handleSaveForm}
				onRetire={formMode === "edit" ? handleRetireEquipment : undefined}
				onDelete={formMode === "edit" ? handleDeleteEquipment : undefined}
				onReportDeficiency={
					formMode === "edit" && formEquipment
						? () => handleReportDeficiency(formEquipment)
						: undefined
				}
			/>

			{assignmentModal ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<h3 className="text-xl font-black text-white">Assign PIE Equipment</h3>
						<p className="mt-1 text-sm text-neutral-400">{assignmentModal.pieEquipment.equipment_number}</p>

						<div className="mt-4 grid gap-3">
							<label className="block">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type</span>
								<select
									value={assignmentModal.type}
									onChange={(event) => {
										const nextType =
											event.target.value === "Station" || event.target.value === "Equipment"
												? event.target.value
												: "Apparatus";
										setAssignmentModal((current) => (current ? { ...current, type: nextType } : current));
									}}
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								>
									<option value="Apparatus">Apparatus</option>
									<option value="Station">Station</option>
									<option value="Equipment">Equipment</option>
								</select>
							</label>

							{assignmentModal.type === "Apparatus" ? (
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Apparatus</span>
									<select
										value={assignmentModal.apparatusId}
										onChange={(event) => setAssignmentModal((current) => (current ? { ...current, apparatusId: event.target.value } : current))}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									>
										<option value="">Select apparatus</option>
										{formApparatusOptions.map((option) => (
											<option key={option.id} value={option.id}>{option.label}</option>
										))}
									</select>
								</label>
							) : null}

							{assignmentModal.type === "Station" ? (
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Station</span>
									<input
										value={assignmentModal.stationName}
										onChange={(event) => setAssignmentModal((current) => (current ? { ...current, stationName: event.target.value } : current))}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									/>
								</label>
							) : null}

							{assignmentModal.type === "Equipment" ? (
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Equipment</span>
									<input
										value={assignmentModal.equipmentReference}
										onChange={(event) => setAssignmentModal((current) => (current ? { ...current, equipmentReference: event.target.value } : current))}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									/>
								</label>
							) : null}

							<label className="block">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Notes</span>
								<textarea
									rows={3}
									value={assignmentModal.notes}
									onChange={(event) => setAssignmentModal((current) => (current ? { ...current, notes: event.target.value } : current))}
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						</div>

						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={() => setAssignmentModal(null)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Cancel</button>
							<button type="button" onClick={handleSaveAssignment} disabled={isSavingAssignment} className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{isSavingAssignment ? "Saving..." : "Save Assignment"}</button>
						</div>
					</div>
				</div>
			) : null}

			{historyEquipment ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h3 className="text-xl font-black text-white">Assignment History</h3>
								<p className="mt-1 text-sm text-neutral-400">{historyEquipment.equipment_number}</p>
							</div>
							<button type="button" onClick={() => setHistoryEquipment(null)} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Close</button>
						</div>

						<div className="mt-4 max-h-[55vh] overflow-y-auto">
							<table className="min-w-full divide-y divide-white/10 text-sm">
								<thead>
									<tr className="text-left text-xs uppercase tracking-[0.14em] text-neutral-400">
										<th className="px-3 py-2">Type</th>
										<th className="px-3 py-2">Assigned To</th>
										<th className="px-3 py-2">Assigned</th>
										<th className="px-3 py-2">Unassigned</th>
										<th className="px-3 py-2">Notes</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/5">
									{historyEntries.length === 0 ? (
										<tr><td colSpan={5} className="px-3 py-8 text-center text-neutral-500">No assignment history.</td></tr>
									) : (
										historyEntries.map((entry) => (
											<tr key={entry.id}>
												<td className="px-3 py-3 text-neutral-300">{toTitleCase(entry.assignment_type)}</td>
												<td className="px-3 py-3 text-white">{getAssignmentLabel(entry, apparatusLookupById)}</td>
												<td className="px-3 py-3 text-neutral-300">{formatDate(entry.assigned_at)}</td>
												<td className="px-3 py-3 text-neutral-300">{formatDate(entry.ended_at)}</td>
												<td className="px-3 py-3 text-neutral-400">{entry.notes || "-"}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
