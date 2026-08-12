"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import BatteryFormModal, {
	BatteryFormValues,
	BatteryInitialAssignmentValues,
} from "@/components/inventory/BatteryFormModal";

export type BatteryRecord = {
	id: string;
	department_id: string;
	battery_number: string;
	serial_number: string | null;
	manufacturer: string | null;
	model: string | null;
	battery_type: string | null;
	compatible_equipment: string | null;
	in_service_date: string | null;
	status: string;
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type BatteryAssignmentRecord = {
	id: string;
	department_id: string;
	battery_id: string;
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
	battery: BatteryRecord;
	type: "Apparatus" | "Station" | "Equipment";
	apparatusId: string;
	stationName: string;
	equipmentReference: string;
	notes: string;
};

interface BatteryWorkspaceProps {
	departmentId: string | null;
	initialBatteries: BatteryRecord[];
	initialAssignments: BatteryAssignmentRecord[];
	apparatusOptions: ApparatusOption[];
}

function toTitleCase(value: string) {
	return value
		.split(" ")
		.filter(Boolean)
		.map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
		.join(" ");
}

function isProtectedBatteryStatus(status: string | null | undefined) {
	const normalized = normalizeStatus(status);
	return normalized === "Retired" || normalized === "Lost" || normalized === "Stolen";
}

function isOutOfServiceLikeStatus(status: string | null | undefined) {
	const normalized = normalizeStatus(status);
	return normalized === "Out of Service" || isProtectedBatteryStatus(normalized);
}

function getApparatusLabelFromOption(option: ApparatusOption | null | undefined) {
	if (!option) {
		return "Unknown Apparatus";
	}

	return option.name || "Unknown Apparatus";
}

function getAssignmentLabel(
	assignment: BatteryAssignmentRecord | null | undefined,
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

export default function BatteryWorkspace({
	departmentId,
	initialBatteries,
	initialAssignments,
	apparatusOptions,
}: BatteryWorkspaceProps) {
	const router = useRouter();
	const [batteries, setBatteries] = useState<BatteryRecord[]>(initialBatteries);
	const [assignments, setAssignments] = useState<BatteryAssignmentRecord[]>(initialAssignments);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [formMode, setFormMode] = useState<"add" | "edit">("add");
	const [formBattery, setFormBattery] = useState<BatteryRecord | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isSavingForm, setIsSavingForm] = useState(false);
	const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState | null>(null);
	const [historyBattery, setHistoryBattery] = useState<BatteryRecord | null>(null);
	const [isSavingAssignment, setIsSavingAssignment] = useState(false);

	const activeAssignmentByBatteryId = useMemo(() => {
		const entries = assignments
			.filter((assignment) => !assignment.ended_at)
			.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
			.map((assignment) => [assignment.battery_id, assignment] as const);

		return new Map<string, BatteryAssignmentRecord>(entries);
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

		for (const battery of batteries) {
			const status = normalizeStatus(battery.status);
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

		const total = batteries.length;
		const ready = inService;
		const readinessScore = total > 0 ? Math.round((ready / total) * 100) : 0;

		return {
			total,
			inService,
			unassigned,
			outOfService,
			accountabilityRisk,
			readinessScore,
		};
	}, [batteries]);

	const filteredBatteries = useMemo(() => {
		const search = searchTerm.trim().toLowerCase();
		const filter = statusFilter.toLowerCase();

		return batteries
			.filter((battery) => {
				const normalizedStatus = normalizeStatus(battery.status).toLowerCase();
				if (filter !== "all" && normalizedStatus !== filter) {
					return false;
				}

				if (!search) {
					return true;
				}

				const assignment = activeAssignmentByBatteryId.get(battery.id);
				const haystack = [
					battery.battery_number,
					battery.serial_number,
					battery.manufacturer,
					battery.model,
					battery.battery_type,
					battery.compatible_equipment,
					assignment?.station_name,
					assignment?.equipment_reference,
					assignment?.apparatus_id ? getApparatusLabelFromOption(apparatusLookupById.get(assignment.apparatus_id)) : null,
					assignment?.assignment_type,
				]
					.filter((value): value is string => Boolean(value))
					.join(" ")
					.toLowerCase();

				return haystack.includes(search);
			})
			.sort((a, b) => a.battery_number.localeCompare(b.battery_number));
	}, [activeAssignmentByBatteryId, apparatusLookupById, batteries, searchTerm, statusFilter]);

	const historyEntries = useMemo(() => {
		if (!historyBattery) {
			return [];
		}

		return assignments
			.filter((assignment) => assignment.battery_id === historyBattery.id)
			.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
	}, [assignments, historyBattery]);

	const formInitialValues: BatteryFormValues | undefined = formBattery
		? {
				batteryNumber: formBattery.battery_number,
				serialNumber: formBattery.serial_number ?? "",
				manufacturer: formBattery.manufacturer ?? "",
				model: formBattery.model ?? "",
				batteryType: formBattery.battery_type ?? "",
				compatibleEquipment: formBattery.compatible_equipment ?? "",
				inServiceDate: formBattery.in_service_date ?? "",
				status: normalizeStatus(formBattery.status) as BatteryFormValues["status"],
				notes: formBattery.notes ?? "",
			}
		: undefined;

	const canDelete = Boolean(formBattery);

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
		if (process.env.NODE_ENV === "production") {
			return;
		}

		console.info("[batteries] workspace apparatus options", {
			departmentId,
			count: apparatusOptions.length,
		});
	}, [departmentId, apparatusOptions.length]);

	function openAddModal() {
		setFormMode("add");
		setFormBattery(null);
		setIsFormOpen(true);
	}

	function openEditModal(battery: BatteryRecord) {
		setFormMode("edit");
		setFormBattery(battery);
		setIsFormOpen(true);
	}

	async function refreshAssignmentsForBattery(batteryId: string) {
		const { data, error } = await supabase
			.from("battery_assignments")
			.select(
				"id, department_id, battery_id, assignment_type, apparatus_id, station_name, equipment_reference, notes, assigned_at, ended_at, created_at",
			)
			.eq("department_id", departmentId)
			.eq("battery_id", batteryId)
			.order("assigned_at", { ascending: false });

		if (error) {
			throw error;
		}

		setAssignments((current) => {
			const withoutTarget = current.filter((entry) => entry.battery_id !== batteryId);
			return [...withoutTarget, ...((data ?? []) as BatteryAssignmentRecord[])];
		});
	}

	function resolveAssignedToLabelForApparatus(apparatusId: string) {
		return getApparatusLabelFromOption(apparatusLookupById.get(apparatusId));
	}

	async function handleSaveForm(
		values: BatteryFormValues,
		initialAssignment?: BatteryInitialAssignmentValues,
	) {
		if (!departmentId) {
			alert("Unable to determine department. Please refresh and try again.");
			return;
		}

		if (!values.batteryNumber.trim()) {
			alert("Battery Number / Asset Number is required.");
			return;
		}

		setIsSavingForm(true);

		try {
			if (formMode === "add") {
				const normalizedInServiceDate = normalizeInServiceDateForSave(values.inServiceDate);
				const assignmentType = initialAssignment?.assignmentType ?? "Unassigned";
				const hasOperationalAssignment = assignmentType !== "Unassigned";
				const computedStatus = isProtectedBatteryStatus(values.status)
					? values.status
					: hasOperationalAssignment
						? "In Service"
						: values.status === "In Service"
							? "Unassigned"
							: values.status;

				const payload = {
					department_id: departmentId,
					battery_number: values.batteryNumber.trim(),
					serial_number: values.serialNumber.trim() || null,
					manufacturer: values.manufacturer.trim() || null,
					model: values.model.trim() || null,
					battery_type: values.batteryType.trim() || null,
					compatible_equipment: values.compatibleEquipment.trim() || null,
					in_service_date: normalizedInServiceDate,
					status: computedStatus,
					notes: values.notes.trim() || null,
				};

				if (process.env.NODE_ENV !== "production") {
					console.info("[batteries][add] insert payload", {
						batteryNumber: payload.battery_number,
						status: payload.status,
						in_service_date: payload.in_service_date,
						rawInServiceDate: values.inServiceDate,
					});
				}

				const { data, error } = await supabase
					.from("batteries")
					.insert(payload)
					.select("*")
					.single();

				if (error) {
					throw error;
				}

				let newBattery = data as BatteryRecord;

				if (process.env.NODE_ENV !== "production") {
					console.info("[batteries][add] insert response", {
						id: newBattery.id,
						status: newBattery.status,
						in_service_date: newBattery.in_service_date,
					});
				}

				if (normalizedInServiceDate && !newBattery.in_service_date) {
					const { data: repairedRow, error: repairError } = await supabase
						.from("batteries")
						.update({ in_service_date: normalizedInServiceDate })
						.eq("id", newBattery.id)
						.eq("department_id", departmentId)
						.select("*")
						.single();

					if (repairError) {
						throw repairError;
					}

					newBattery = repairedRow as BatteryRecord;

					if (process.env.NODE_ENV !== "production") {
						console.info("[batteries][add] repaired in_service_date", {
							id: newBattery.id,
							in_service_date: newBattery.in_service_date,
						});
					}
				}

				setBatteries((current) => [newBattery, ...current]);

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

				const { error: assignmentError } = await supabase.from("battery_assignments").insert({
					department_id: departmentId,
					battery_id: newBattery.id,
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

				await refreshAssignmentsForBattery(newBattery.id);
			} else if (formBattery) {
				const payload = {
					in_service_date: normalizeInServiceDateForSave(values.inServiceDate),
					battery_number: values.batteryNumber.trim(),
					serial_number: values.serialNumber.trim() || null,
					manufacturer: values.manufacturer.trim() || null,
					model: values.model.trim() || null,
					battery_type: values.batteryType.trim() || null,
					compatible_equipment: values.compatibleEquipment.trim() || null,
					status: values.status,
					notes: values.notes.trim() || null,
				};

				const { data, error } = await supabase
					.from("batteries")
					.update(payload)
					.eq("id", formBattery.id)
					.eq("department_id", departmentId)
					.select("*")
					.single();

				if (error) {
					throw error;
				}

				const updatedBattery = data as BatteryRecord;
				setBatteries((current) =>
					current.map((battery) =>
						battery.id === updatedBattery.id ? updatedBattery : battery,
					),
				);
			}

			setIsFormOpen(false);
			setFormBattery(null);
		} catch (error) {
			console.error("[batteries][save] failed", error);
			alert("Unable to save battery record. Check console for details.");
		} finally {
			setIsSavingForm(false);
		}
	}

	async function handleDeleteBattery() {
		if (!formBattery) {
			return;
		}

		if (!window.confirm(`Delete battery ${formBattery.battery_number}? This cannot be undone.`)) {
			return;
		}

		setIsSavingForm(true);

		try {
			const { error } = await supabase
				.from("batteries")
				.delete()
				.eq("id", formBattery.id)
				.eq("department_id", departmentId);
			if (error) {
				throw error;
			}

			setBatteries((current) => current.filter((battery) => battery.id !== formBattery.id));
			setAssignments((current) => current.filter((entry) => entry.battery_id !== formBattery.id));
			setIsFormOpen(false);
			setFormBattery(null);
		} catch (error) {
			console.error("[batteries][delete] failed", error);
			alert("Unable to delete battery.");
		} finally {
			setIsSavingForm(false);
		}
	}

	async function handleRetireBattery() {
		if (!formBattery) {
			return;
		}

		setIsSavingForm(true);
		try {
			const { data, error } = await supabase
				.from("batteries")
				.update({ status: "Retired" })
				.eq("id", formBattery.id)
				.eq("department_id", departmentId)
				.select("*")
				.single();

			if (error) {
				throw error;
			}

			const retired = data as BatteryRecord;
			setBatteries((current) =>
				current.map((battery) => (battery.id === retired.id ? retired : battery)),
			);
			setFormBattery(retired);
		} catch (error) {
			console.error("[batteries][retire] failed", error);
			alert("Unable to retire battery.");
		} finally {
			setIsSavingForm(false);
		}
	}

	function openAssignmentModal(battery: BatteryRecord) {
		setAssignmentModal({
			battery,
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

		if (assignmentModal.type === "Apparatus") {
			if (!assignmentModal.apparatusId) {
				alert("Select an apparatus.");
				return;
			}
		}

		if (assignmentModal.type === "Station") {
			if (!assignmentModal.stationName.trim()) {
				alert("Enter a station.");
				return;
			}
		}

		if (assignmentModal.type === "Equipment") {
			if (!assignmentModal.equipmentReference.trim()) {
				alert("Enter an equipment reference.");
				return;
			}
		}

		setIsSavingAssignment(true);

		try {
			const batteryId = assignmentModal.battery.id;

			const { data: activeRows, error: activeQueryError } = await supabase
				.from("battery_assignments")
				.select("id")
				.eq("department_id", departmentId)
				.eq("battery_id", batteryId)
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
					.from("battery_assignments")
					.update({ ended_at: nowIso })
					.eq("department_id", departmentId)
					.in("id", activeIds);

				if (closeActiveError) {
					throw closeActiveError;
				}
			}

			const { error: insertAssignmentError } = await supabase
				.from("battery_assignments")
				.insert({
					department_id: departmentId,
					battery_id: batteryId,
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

			const { error: statusError } = await supabase
				.from("batteries")
				.update({ status: "In Service" })
				.eq("id", batteryId)
				.eq("department_id", departmentId)
				.not("status", "in", '("Lost","Stolen","Retired")');

			if (statusError) {
				throw statusError;
			}

			setBatteries((current) =>
				current.map((battery) =>
					battery.id === batteryId && !isProtectedBatteryStatus(battery.status)
						? { ...battery, status: "In Service" }
						: battery,
				),
			);

			await refreshAssignmentsForBattery(batteryId);
			setAssignmentModal(null);
		} catch (error) {
			console.error("[batteries][assign] failed", error);
			alert("Unable to save assignment.");
		} finally {
			setIsSavingAssignment(false);
		}
	}

	async function handleUnassignBattery(battery: BatteryRecord) {
		const activeAssignment = activeAssignmentByBatteryId.get(battery.id);
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
				.from("battery_assignments")
				.update({ ended_at: nowIso })
				.eq("department_id", departmentId)
				.eq("id", activeAssignment.id);

			if (closeError) {
				throw closeError;
			}

			const { error: unassignedInsertError } = await supabase
				.from("battery_assignments")
				.insert({
					department_id: departmentId,
					battery_id: battery.id,
					assignment_type: "Unassigned",
					apparatus_id: null,
					station_name: null,
					equipment_reference: null,
					notes: null,
				});

			if (unassignedInsertError) {
				throw unassignedInsertError;
			}

			const shouldSetUnassigned = !isOutOfServiceLikeStatus(battery.status);

			if (shouldSetUnassigned) {
				const { error: statusError } = await supabase
					.from("batteries")
					.update({ status: "Unassigned" })
					.eq("id", battery.id)
					.eq("department_id", departmentId)
					.not("status", "in", '("Out of Service","Lost","Stolen","Retired")');

				if (statusError) {
					throw statusError;
				}
			}

			setBatteries((current) =>
				current.map((entry) =>
					entry.id === battery.id && shouldSetUnassigned
						? { ...entry, status: "Unassigned" }
						: entry,
				),
			);

			await refreshAssignmentsForBattery(battery.id);
		} catch (error) {
			console.error("[batteries][unassign] failed", error);
			alert("Unable to unassign battery.");
		} finally {
			setIsSavingAssignment(false);
		}
	}

	function handleReportDeficiency(battery: BatteryRecord) {
		router.push(
			`/deficiencies/report?inventoryCategory=battery&inventoryItemId=${battery.id}&inventoryItemLabel=${encodeURIComponent(
				battery.battery_number,
			)}`,
		);
	}

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">Inventory Accountability</p>
						<h1 className="mt-2 text-3xl font-black tracking-tight text-white">Batteries</h1>
						<p className="mt-2 max-w-2xl text-sm text-neutral-400">Manage battery assets, assignment accountability, and readiness status without introducing test/calibration workflows.</p>
					</div>
					<button
						type="button"
						onClick={openAddModal}
						className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
					>
						<Plus size={16} />
						Add Battery
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
							placeholder="Search battery number, serial, assignment..."
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
								<th className="px-3 py-2">Battery</th>
								<th className="px-3 py-2">Type / Model</th>
								<th className="px-3 py-2">Assignment</th>
								<th className="px-3 py-2">Status</th>
								<th className="px-3 py-2">In Service Since</th>
								<th className="px-3 py-2 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{filteredBatteries.length === 0 ? (
								<tr>
									<td colSpan={6} className="px-3 py-8 text-center text-neutral-500">No batteries match your filters.</td>
								</tr>
							) : (
								filteredBatteries.map((battery) => {
									const assignment = activeAssignmentByBatteryId.get(battery.id);
									const status = normalizeStatus(battery.status);

									return (
										<tr key={battery.id} className="hover:bg-white/[0.03]">
											<td className="px-3 py-3">
												<p className="font-semibold text-white">{battery.battery_number}</p>
												<p className="text-xs text-neutral-500">SN: {battery.serial_number || "N/A"}</p>
											</td>
											<td className="px-3 py-3 text-neutral-300">
												<p>{battery.battery_type || "-"}</p>
												<p className="text-xs text-neutral-500">{battery.manufacturer || ""} {battery.model || ""}</p>
											</td>
											<td className="px-3 py-3 text-neutral-300">
												<p>{getAssignmentLabel(assignment, apparatusLookupById)}</p>
											</td>
											<td className="px-3 py-3">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(status)}`}>
													{status}
												</span>
											</td>
											<td className="px-3 py-3 text-neutral-300">{formatDate(battery.in_service_date)}</td>
											<td className="px-3 py-3">
												<div className="flex justify-end gap-2">
													<button
														type="button"
														onClick={() => openEditModal(battery)}
														className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														Edit
													</button>

													<button
														type="button"
														onClick={() => openAssignmentModal(battery)}
														className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														Assign
													</button>

													{assignment ? (
														<button
															type="button"
															onClick={() => handleUnassignBattery(battery)}
															disabled={isSavingAssignment}
															className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/30 disabled:opacity-60"
														>
															Unassign
														</button>
													) : null}

													<button
														type="button"
														onClick={() => setHistoryBattery(battery)}
														className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														History
													</button>

													<button
														type="button"
														onClick={() => handleReportDeficiency(battery)}
														className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-600/90 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
													>
														Deficiency <ArrowRight size={12} />
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

			<BatteryFormModal
				isOpen={isFormOpen}
				mode={formMode}
				initialValues={formInitialValues}
				isSaving={isSavingForm}
				canDelete={canDelete}
				apparatusOptions={formApparatusOptions}
				onClose={() => {
					setIsFormOpen(false);
					setFormBattery(null);
				}}
				onSave={handleSaveForm}
				onRetire={formMode === "edit" ? handleRetireBattery : undefined}
				onDelete={formMode === "edit" ? handleDeleteBattery : undefined}
				onReportDeficiency={
					formMode === "edit" && formBattery
						? () => handleReportDeficiency(formBattery)
						: undefined
				}
			/>

			{assignmentModal ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<h3 className="text-xl font-black text-white">Assign Battery</h3>
						<p className="mt-1 text-sm text-neutral-400">{assignmentModal.battery.battery_number}</p>

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

										setAssignmentModal((current) =>
											current
												? {
														...current,
														type: nextType,
													}
												: current,
										);
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
										onChange={(event) =>
											setAssignmentModal((current) =>
												current ? { ...current, apparatusId: event.target.value } : current,
											)
										}
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
										onChange={(event) =>
											setAssignmentModal((current) =>
												current ? { ...current, stationName: event.target.value } : current,
											)
										}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									/>
								</label>
							) : null}

								{assignmentModal.type === "Equipment" ? (
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Equipment</span>
									<input
										value={assignmentModal.equipmentReference}
										onChange={(event) =>
											setAssignmentModal((current) =>
												current ? { ...current, equipmentReference: event.target.value } : current,
											)
										}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									/>
								</label>
							) : null}

							<label className="block">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Notes</span>
								<textarea
									rows={3}
									value={assignmentModal.notes}
									onChange={(event) =>
										setAssignmentModal((current) =>
											current ? { ...current, notes: event.target.value } : current,
										)
									}
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						</div>

						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setAssignmentModal(null)}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSaveAssignment}
								disabled={isSavingAssignment}
								className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isSavingAssignment ? "Saving..." : "Save Assignment"}
							</button>
						</div>
					</div>
				</div>
			) : null}

			{historyBattery ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
					<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h3 className="text-xl font-black text-white">Assignment History</h3>
								<p className="mt-1 text-sm text-neutral-400">{historyBattery.battery_number}</p>
							</div>
							<button
								type="button"
								onClick={() => setHistoryBattery(null)}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Close
							</button>
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
										<tr>
											<td colSpan={5} className="px-3 py-8 text-center text-neutral-500">No assignment history.</td>
										</tr>
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
