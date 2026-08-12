"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ScbaCylinderFormModal, { ScbaCylinderFormValues } from "@/components/inventory/ScbaCylinderFormModal";

type ScbaCylinderRecord = {
	id: string;
	department_id: string;
	cylinder_number: string;
	cylinder_type: "Composite" | "Steel" | string;
	in_service_date: string;
	last_hydrostatic_test_date: string | null;
	next_hydrostatic_test_due_date: string | null;
	service_life_end_date: string | null;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
	status: string;
	notes: string | null;
	created_at: string;
};

interface ScbaCylinderWorkspaceProps {
	departmentId: string | null;
	departmentName: string | null;
	initialRows: ScbaCylinderRecord[];
	initialError?: string | null;
	canDeleteCylinder: boolean;
}

type RowTone = "ready" | "testing-due" | "out-of-service" | "retired";

function compareCylinderNumbers(left: string | null | undefined, right: string | null | undefined) {
	const leftValue = typeof left === "string" ? left.trim() : "";
	const rightValue = typeof right === "string" ? right.trim() : "";

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

function addYearsToIsoDate(value: string | null | undefined, years: number) {
	if (!value) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	parsed.setFullYear(parsed.getFullYear() + years);
	return parsed.toISOString().split("T")[0];
}

function isDueOnOrBeforeToday(value: string | null | undefined) {
	if (!value) {
		return false;
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return false;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return parsed.getTime() <= today.getTime();
}

function isHydroDue(row: ScbaCylinderRecord) {
	if (row.status === "Retired") {
		return false;
	}

	if (row.status === "Testing Due") {
		return true;
	}

	return isDueOnOrBeforeToday(row.next_hydrostatic_test_due_date);
}

function isCylinderReady(row: ScbaCylinderRecord) {
	if (row.status === "Retired") {
		return false;
	}

	if (row.status === "Out of Service") {
		return false;
	}

	if (isHydroDue(row)) {
		return false;
	}

	if (row.cylinder_type === "Composite" && row.service_life_end_date) {
		return !isDueOnOrBeforeToday(row.service_life_end_date);
	}

	return true;
}

function statusTone(status: string, due: boolean): RowTone {
	if (status === "Retired") {
		return "retired";
	}

	if (status === "Out of Service") {
		return "out-of-service";
	}

	if (status === "Testing Due" || due) {
		return "testing-due";
	}

	return "ready";
}

function statusBadgeClasses(status: string) {
	if (status === "Ready") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Testing Due") {
		return "border-amber-700/40 bg-amber-900/20 text-amber-300";
	}

	if (status === "Out of Service") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}

	if (status === "Retired") {
		return "border-neutral-600/40 bg-neutral-800 text-neutral-300";
	}

	return "border-white/15 bg-neutral-900 text-neutral-200";
}

function cylinderTypeBadgeClasses(cylinderType: string) {
	if (cylinderType === "Composite") {
		return "border-cyan-700/40 bg-cyan-900/20 text-cyan-200";
	}

	return "border-slate-700/40 bg-slate-900/20 text-slate-200";
}

function summaryCardClasses(active: boolean, tone: RowTone) {
	const base = "rounded-xl border px-4 py-3 text-left transition";

	if (active) {
		return `${base} border-white/20 bg-white/[0.06]`;
	}

	if (tone === "testing-due") {
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

function normalizeOptionalText(value: string) {
	return value.trim();
}

export default function ScbaCylinderWorkspace({
	departmentId: initialDepartmentId = null,
	departmentName = null,
	initialRows,
	initialError = null,
	canDeleteCylinder,
}: ScbaCylinderWorkspaceProps) {
	const router = useRouter();
	const [departmentId, setDepartmentId] = useState<string | null>(initialDepartmentId);
	const [inventoryRows, setInventoryRows] = useState<ScbaCylinderRecord[]>(initialRows);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("All");
	const [typeFilter, setTypeFilter] = useState("All");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editCylinderId, setEditCylinderId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(initialError);
	const [toastVisible, setToastVisible] = useState(Boolean(initialError));
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setDepartmentId(initialDepartmentId);
	}, [initialDepartmentId]);

	useEffect(() => {
		setInventoryRows(initialRows);
	}, [initialRows]);

	useEffect(() => {
		if (departmentId) {
			return;
		}

		let isMounted = true;

		const loadDepartmentId = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			const email = user?.email?.trim();
			if (!email) {
				return;
			}

			const { data, error } = await supabase
				.from("members")
				.select("department_id")
				.eq("email", email)
				.maybeSingle();

			if (error || !isMounted) {
				return;
			}

			const nextDepartmentId = typeof data?.department_id === "string" ? data.department_id : null;
			if (nextDepartmentId) {
				setDepartmentId(nextDepartmentId);
			}
		};

		void loadDepartmentId();

		return () => {
			isMounted = false;
		};
	}, [departmentId]);

	useEffect(() => {
		if (!toastMessage) {
			return;
		}

		setToastVisible(true);
		const timeout = window.setTimeout(() => setToastVisible(false), 4000);
		return () => window.clearTimeout(timeout);
	}, [toastMessage]);

	const sortedRows = useMemo(() => {
		return [...inventoryRows].sort((left, right) => {
			const leftRetired = left.status === "Retired";
			const rightRetired = right.status === "Retired";

			if (leftRetired !== rightRetired) {
				return leftRetired ? 1 : -1;
			}

			return compareCylinderNumbers(left.cylinder_number, right.cylinder_number);
		});
	}, [inventoryRows]);

	const filteredRows = useMemo(() => {
		let workingRows = sortedRows;

		if (searchTerm.trim()) {
			const normalized = searchTerm.trim().toLowerCase();
			workingRows = workingRows.filter((row) => {
				const haystack = [row.cylinder_number, row.manufacturer, row.model, row.serial_number]
					.map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
					.join(" ");

				return haystack.includes(normalized);
			});
		}

		if (statusFilter !== "All") {
			workingRows = workingRows.filter((row) => row.status === statusFilter);
		}

		if (typeFilter !== "All") {
			workingRows = workingRows.filter((row) => row.cylinder_type === typeFilter);
		}

		return workingRows;
	}, [searchTerm, sortedRows, statusFilter, typeFilter]);

	const activeRows = useMemo(() => inventoryRows.filter((row) => row.status !== "Retired"), [inventoryRows]);
	const totalCount = inventoryRows.length;
	const hydroDueCount = activeRows.filter((row) => isHydroDue(row)).length;
	const outOfServiceCount = inventoryRows.filter((row) => row.status === "Out of Service").length;
	const retiredCount = inventoryRows.filter((row) => row.status === "Retired").length;
	const readyCount = activeRows.filter((row) => isCylinderReady(row)).length;
	const activeCylinderCount = activeRows.length;
	const readinessPercentage =
		activeCylinderCount > 0 ? Math.round((readyCount / activeCylinderCount) * 100) : 100;
	const scoreWidth = `${Math.max(0, Math.min(100, readinessPercentage))}%`;

	const editingRow = useMemo(
		() => (editCylinderId ? inventoryRows.find((row) => row.id === editCylinderId) ?? null : null),
		[editCylinderId, inventoryRows],
	);

	const hasRows = inventoryRows.length > 0;
	const hasVisibleRows = filteredRows.length > 0;

	const typeOptions = useMemo(
		() => ["All", ...Array.from(new Set(inventoryRows.map((row) => row.cylinder_type))).sort()],
		[inventoryRows],
	);

	const refreshCylinders = async () => {
		if (!departmentId) {
			return;
		}

		const { data, error } = await supabase
			.from("scba_cylinders")
			.select(
				"id, department_id, cylinder_number, cylinder_type, in_service_date, last_hydrostatic_test_date, next_hydrostatic_test_due_date, service_life_end_date, manufacturer, model, serial_number, status, notes, created_at",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[scba-cylinders] failed to refresh rows", error);
			setToastMessage(error.message || "Unable to load SCBA cylinders.");
			return;
		}

		setInventoryRows((data ?? []) as ScbaCylinderRecord[]);
	};

	const openAddModal = () => {
		setEditCylinderId(null);
		setIsModalOpen(true);
	};

	const openEditModal = (row: ScbaCylinderRecord) => {
		setEditCylinderId(row.id);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setEditCylinderId(null);
	};

	const reportDeficiencyForRow = (row: ScbaCylinderRecord) => {
		const params = new URLSearchParams();
		params.set("returnTo", "/inventory/scba-cylinders");
		params.set("inventoryCategory", "scba-cylinders");
		params.set("inventoryItemId", row.id);
		params.set("inventoryItemLabel", row.cylinder_number);
		params.set("apparatusId", "station-supply");

		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const retireCylinderForRow = async (row: ScbaCylinderRecord) => {
		if (!departmentId) {
			setToastMessage("Unable to determine department. Please refresh and try again.");
			return;
		}

		const confirmed = window.confirm(
			`Retire Cylinder ${row.cylinder_number}?\n\nThis cylinder will stay in inventory as a retired record.`,
		);

		if (!confirmed) {
			return;
		}

		const { data: retiredRow, error } = await supabase
			.from("scba_cylinders")
			.update({ status: "Retired" })
			.eq("id", row.id)
			.eq("department_id", departmentId)
			.select("id, status")
			.single();

		if (error || !retiredRow || retiredRow.id !== row.id || retiredRow.status !== "Retired") {
			setToastMessage(error?.message || "Unable to retire cylinder.");
			return;
		}

		await refreshCylinders();
		if (editCylinderId === row.id) {
			closeModal();
		}
	};

	const deleteCylinderForRow = async (row: ScbaCylinderRecord) => {
		if (!canDeleteCylinder) {
			setToastMessage("Only administrators can delete cylinders.");
			return;
		}

		if (!departmentId) {
			setToastMessage("Unable to determine department. Please refresh and try again.");
			return;
		}

		const confirmed = window.confirm(
			`Delete Cylinder ${row.cylinder_number}?\n\nThis permanently removes the cylinder record. This action cannot be undone.`,
		);

		if (!confirmed) {
			return;
		}

		const { data: deletedRow, error } = await supabase
			.from("scba_cylinders")
			.delete()
			.eq("id", row.id)
			.eq("department_id", departmentId)
			.select("id")
			.single();

		if (error || !deletedRow || deletedRow.id !== row.id) {
			setToastMessage(error?.message || "Unable to delete cylinder.");
			return;
		}

		await refreshCylinders();
		if (editCylinderId === row.id) {
			closeModal();
		}
	};

	const saveCylinder = (values: ScbaCylinderFormValues) => {
		void (async () => {
			if (!departmentId) {
				setToastMessage("Unable to determine department. Please refresh and try again.");
				return;
			}

			const cylinderNumber = values.cylinderNumber.trim();
			if (!cylinderNumber || !values.cylinderType || !values.inServiceDate) {
				setToastMessage("Cylinder Number, Cylinder Type, and In-Service Date are required.");
				return;
			}

			const lastHydrostaticTestDate = normalizeOptionalText(values.lastHydrostaticTestDate);
			const nextHydrostaticTestDueDate = lastHydrostaticTestDate
				? addYearsToIsoDate(lastHydrostaticTestDate, values.cylinderType === "Composite" ? 3 : 5)
				: null;
			const serviceLifeEndDate =
				values.cylinderType === "Composite"
					? addYearsToIsoDate(values.inServiceDate, 15)
					: null;
			const projectedStatus =
				editingRow?.status === "Out of Service" || editingRow?.status === "Retired"
					? editingRow.status
					: nextHydrostaticTestDueDate && isDueOnOrBeforeToday(nextHydrostaticTestDueDate)
						? "Testing Due"
						: "Ready";

			const payload = {
				department_id: departmentId,
				cylinder_number: cylinderNumber,
				cylinder_type: values.cylinderType,
				in_service_date: values.inServiceDate,
				last_hydrostatic_test_date: lastHydrostaticTestDate || null,
				next_hydrostatic_test_due_date: nextHydrostaticTestDueDate,
				service_life_end_date: serviceLifeEndDate,
				manufacturer: normalizeOptionalText(values.manufacturer) || null,
				model: normalizeOptionalText(values.model) || null,
				serial_number: normalizeOptionalText(values.serialNumber) || null,
				status: projectedStatus,
				notes: normalizeOptionalText(values.notes) || null,
			};

			setIsSaving(true);

			if (!editingRow) {
				const { data, error } = await supabase
					.from("scba_cylinders")
					.insert(payload)
					.select("id, cylinder_number")
					.single();

				setIsSaving(false);
				if (error || !data) {
					setToastMessage(error?.message || "Unable to save cylinder.");
					return;
				}

				await refreshCylinders();
				closeModal();
				setToastMessage(`Cylinder ${data.cylinder_number} saved successfully.`);
				return;
			}

			const { data, error } = await supabase
				.from("scba_cylinders")
				.update(payload)
				.eq("id", editingRow.id)
				.eq("department_id", departmentId)
				.select("id, cylinder_number")
				.single();

			setIsSaving(false);
			if (error || !data || data.id !== editingRow.id) {
				setToastMessage(error?.message || "Unable to update cylinder.");
				return;
			}

			await refreshCylinders();
			closeModal();
			setToastMessage(`Cylinder ${data.cylinder_number} updated successfully.`);
		})();
	};

	const topSummaryCards = [
		{ label: "Total Cylinders", value: totalCount, tone: "ready" as RowTone, filter: "All" },
		{ label: "Hydro Tests Due", value: hydroDueCount, tone: "testing-due" as RowTone, filter: "Testing Due" },
		{ label: "Out of Service", value: outOfServiceCount, tone: "out-of-service" as RowTone, filter: "Out of Service" },
		{ label: "Retired", value: retiredCount, tone: "retired" as RowTone, filter: "Retired" },
	];

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

			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Inventory</p>
					<h1 className="mt-2 text-5xl font-black tracking-tight text-white">SCBA Cylinders</h1>
					<p className="mt-3 max-w-2xl text-lg text-neutral-400">Manage department SCBA cylinder inventory.</p>
					{departmentName ? <p className="mt-2 text-sm text-neutral-500">Department: {departmentName}</p> : null}
				</div>

				<button
					type="button"
					onClick={openAddModal}
					className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
				>
					+ Add Cylinder
				</button>
			</div>

			<section className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div className="min-w-0 flex-1">
						<h2 className="text-2xl font-bold text-white">Cylinder Readiness</h2>
						<p className="mt-2 max-w-3xl text-sm text-neutral-400">
							Readiness is calculated from live cylinder records using ready cylinders divided by active cylinders.
						</p>

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
						<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">SCBA Cylinder Readiness</p>
						<p className="mt-1 text-4xl font-black text-white">{readinessPercentage}%</p>
						<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
							{readyCount} Ready / {activeCylinderCount} Active
						</p>
						<p className="mt-3 text-sm text-neutral-400">
							Hydro due, out-of-service, and expired service-life cylinders are excluded from readiness.
						</p>

						<div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
							<div className="h-full rounded-full bg-red-500 transition-all" style={{ width: scoreWidth }} />
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="min-w-0 flex-1">
						<label htmlFor="scba-search" className="sr-only">
							Search cylinders
						</label>
						<input
							id="scba-search"
							type="text"
							placeholder="Search by cylinder number, manufacturer, model, or serial number..."
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
						<select
							value={statusFilter}
							onChange={(event) => setStatusFilter(event.target.value)}
							className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
						>
							<option value="All">All Statuses</option>
							<option value="Ready">Ready</option>
							<option value="Testing Due">Testing Due</option>
							<option value="Out of Service">Out of Service</option>
							<option value="Retired">Retired</option>
						</select>

						<select
							value={typeFilter}
							onChange={(event) => setTypeFilter(event.target.value)}
							className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
						>
							{typeOptions.map((option) => (
								<option key={option} value={option}>
									{option === "All" ? "All Types" : option}
								</option>
							))}
						</select>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="overflow-x-auto">
					<table className="min-w-full border-separate border-spacing-0 text-left">
						<thead>
							<tr>
								{[
									"Cylinder Number",
									"Type",
									"In-Service Date",
									"Last Hydrostatic Test",
									"Next Hydrostatic Test Due",
									"Service Life End",
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
									<td colSpan={8} className="border-b border-white/5 px-4 py-10">
										<div className="flex flex-col items-start gap-4 text-left sm:items-center sm:text-center">
											<div>
												<p className="text-lg font-bold text-white">No SCBA Cylinders</p>
												<p className="mt-2 max-w-2xl text-sm text-neutral-400">
													Add your department's SCBA cylinder inventory to track hydro dates, service life, and deficiencies.
												</p>
											</div>

											<button
												type="button"
												onClick={openAddModal}
												className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
											>
												Add Cylinder
											</button>
										</div>
									</td>
								</tr>
							) : !hasVisibleRows ? (
								<tr>
									<td colSpan={8} className="border-b border-white/5 px-4 py-10">
										<div className="flex flex-col items-start gap-2 text-left sm:items-center sm:text-center">
											<p className="text-lg font-bold text-white">No Cylinders Found</p>
											<p className="max-w-2xl text-sm text-neutral-400">No cylinders currently match the selected filters.</p>
										</div>
									</td>
								</tr>
							) : (
								filteredRows.map((row) => {
									const due = isHydroDue(row);
									const tone = statusTone(row.status, due);
									const rowClassName =
										tone === "testing-due"
											? "cursor-pointer bg-amber-950/15 transition hover:bg-white/5"
											: tone === "out-of-service"
												? "cursor-pointer bg-red-950/15 transition hover:bg-white/5"
												: tone === "retired"
													? "cursor-pointer opacity-75 transition hover:bg-white/5"
													: "cursor-pointer transition hover:bg-white/5";

									return (
										<tr
											key={row.id}
											className={rowClassName}
											onClick={() => openEditModal(row)}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													openEditModal(row);
												}
											}}
											tabIndex={0}
										>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<div className="space-y-1">
													<p className="font-semibold text-white">{row.cylinder_number}</p>
													<p className="text-xs text-neutral-400">
														{[row.manufacturer, row.model, row.serial_number].filter(Boolean).join(" • ") || "-"}
													</p>
												</div>
											</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cylinderTypeBadgeClasses(row.cylinder_type)}`}>
													{row.cylinder_type}
												</span>
											</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatDate(row.in_service_date)}</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatHydroCell(row.last_hydrostatic_test_date)}</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												{formatHydroDueCell(row.next_hydrostatic_test_due_date, due)}
											</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												{row.cylinder_type === "Composite" ? formatHydroCell(row.service_life_end_date) : "No limit established"}
											</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.status)}`}>
													{row.status}
												</span>
											</td>

											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															openEditModal(row);
														}}
														className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														Edit
													</button>

													{row.status !== "Retired" ? (
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																reportDeficiencyForRow(row);
															}}
															className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
														>
														Report Deficiency
														</button>
													) : null}

													{row.status !== "Retired" ? (
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																void retireCylinderForRow(row);
															}}
															className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
														>
														Retire
														</button>
													) : null}

													{canDeleteCylinder ? (
														<button
															type="button"
															onClick={(event) => {
																event.stopPropagation();
																void deleteCylinderForRow(row);
															}}
															className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
														>
														Delete
														</button>
													) : null}
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

			<ScbaCylinderFormModal
				isOpen={isModalOpen}
				mode={editingRow ? "edit" : "add"}
				initialValues={
					editingRow
						? {
							cylinderNumber: editingRow.cylinder_number ?? "",
							cylinderType: editingRow.cylinder_type === "Steel" ? "Steel" : "Composite",
							inServiceDate: editingRow.in_service_date ?? "",
							lastHydrostaticTestDate: editingRow.last_hydrostatic_test_date ?? "",
							manufacturer: editingRow.manufacturer ?? "",
							model: editingRow.model ?? "",
							serialNumber: editingRow.serial_number ?? "",
							notes: editingRow.notes ?? "",
						}
						: undefined
				}
				currentStatus={editingRow?.status}
				isSaving={isSaving}
				onClose={closeModal}
				onSave={saveCylinder}
				onReportDeficiency={editingRow ? () => reportDeficiencyForRow(editingRow) : undefined}
				onRetire={editingRow ? () => void retireCylinderForRow(editingRow) : undefined}
				onDelete={editingRow && canDeleteCylinder ? () => void deleteCylinderForRow(editingRow) : undefined}
				canDelete={canDeleteCylinder}
			/>
		</div>
	);
}

function formatHydroCell(value: string | null | undefined) {
	return formatDate(value);
}

function formatHydroDueCell(value: string | null | undefined, due: boolean) {
	if (!value) {
		return <span className="text-neutral-500">Pending</span>;
	}

	const base = formatDate(value);
	if (!due) {
		return <span>{base}</span>;
	}

	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-amber-700/40 bg-amber-900/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
			<span>Due</span>
			<span className="text-amber-100">{base}</span>
		</span>
	);
}
