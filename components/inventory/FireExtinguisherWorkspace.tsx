"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import FireExtinguisherFormModal, {
	type FireExtinguisherApparatusOption,
	type FireExtinguisherFormValues,
} from "@/components/inventory/FireExtinguisherFormModal";
import { calculateFireExtinguisherReadiness } from "@/lib/inventory/fire-extinguishers-readiness";

export type FireExtinguisherRow = {
	id: string;
	extinguisher_number: string;
	extinguisher_type: string;
	location_type: "Apparatus" | "Station Storage" | "Station/Building" | "Other";
	apparatus_id: string | null;
	apparatus_name: string | null;
	other_location: string | null;
	status: "Active" | "Inactive" | "Out of Service";
	notes: string | null;
	photo_path: string | null;
	created_at: string;
	updated_at: string;
	open_deficiency_count: number;
};

type FireExtinguisherDeficiencyRow = {
	id: string;
	deficiency_number: string | null;
	description: string | null;
	priority_name: string | null;
	reported_at: string | null;
	status_name: string | null;
};

type FireExtinguisherDetailResponse = {
	item: FireExtinguisherRow;
	photoUrl: string | null;
};

type FireExtinguisherDeficienciesResponse = {
	rows: FireExtinguisherDeficiencyRow[];
};

type WorkspaceProps = {
	departmentName: string | null;
	canManageFireExtinguishers: boolean;
	apparatusOptions: FireExtinguisherApparatusOption[];
	initialRows: FireExtinguisherRow[];
	initialError?: string | null;
};

type StatusFilter = "All" | "Active" | "Inactive" | "Out of Service";

const knownTypeOptions = new Set([
	"Water",
	"Foam",
	"Carbon Dioxide",
	"Dry Chemical",
	"Wet Chemical",
	"Clean Agent",
]);

function compareNames(left: string | null | undefined, right: string | null | undefined): number {
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

function normalizeApiError(payload: unknown, fallback: string) {
	if (!payload || typeof payload !== "object") {
		return fallback;
	}

	const error = (payload as { error?: unknown }).error;
	return typeof error === "string" && error.trim() ? error : fallback;
}

function statusBadgeClasses(status: StatusFilter) {
	if (status === "Active") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Out of Service") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}

	return "border-neutral-600/40 bg-neutral-900 text-neutral-300";
}

function summaryCardClasses(active: boolean, tone: "all" | "active" | "inactive" | "out") {
	const base = "rounded-xl border px-4 py-3 text-left transition";

	if (active) {
		return `${base} border-white/20 bg-white/[0.06]`;
	}

	if (tone === "active") {
		return `${base} border-green-700/30 bg-green-950/20 hover:bg-green-950/30`;
	}

	if (tone === "inactive") {
		return `${base} border-neutral-700/30 bg-neutral-900/40 hover:bg-neutral-900/60`;
	}

	if (tone === "out") {
		return `${base} border-red-700/30 bg-red-950/20 hover:bg-red-950/30`;
	}

	return `${base} border-white/10 bg-[#1b1b1b] hover:bg-[#202020]`;
}

function deficiencyStatusClasses(value: string | null | undefined) {
	const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (normalized === "open") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}
	if (normalized === "in progress") {
		return "border-amber-700/40 bg-amber-900/20 text-amber-300";
	}
	if (normalized === "resolved" || normalized === "closed") {
		return "border-emerald-700/40 bg-emerald-900/20 text-emerald-300";
	}
	return "border-neutral-600/40 bg-neutral-900 text-neutral-300";
}

function getDisplayExtinguisherType(row: FireExtinguisherRow) {
	return row.extinguisher_type || "Unknown";
}

function toFormValues(row: FireExtinguisherRow): FireExtinguisherFormValues {
	const storedType = row.extinguisher_type ?? "";
	const typeIsCustom = storedType.length > 0 && !knownTypeOptions.has(storedType);

	return {
		extinguisherNumber: row.extinguisher_number,
		extinguisherType: typeIsCustom ? "Other" : storedType || "Water",
		customExtinguisherType: typeIsCustom ? storedType : "",
		locationType: row.location_type,
		apparatusId: row.apparatus_id ?? "",
		otherLocation: row.other_location ?? "",
		status: row.status,
		notes: row.notes ?? "",
		photoFile: null,
		removePhoto: false,
	};
}

async function fileToUploadPayload(file: File) {
	const arrayBuffer = await file.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);
	let binary = "";
	for (let index = 0; index < bytes.length; index += 1) {
		binary += String.fromCharCode(bytes[index]);
	}

	return {
		fileName: file.name,
		mimeType: file.type || "application/octet-stream",
		base64Data: btoa(binary),
	};
}

export default function FireExtinguisherWorkspace({
	departmentName,
	canManageFireExtinguishers,
	apparatusOptions,
	initialRows,
	initialError = null,
}: WorkspaceProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [rows, setRows] = useState<FireExtinguisherRow[]>(initialRows);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
	const [toastMessage, setToastMessage] = useState<string | null>(initialError);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [selectedItem, setSelectedItem] = useState<FireExtinguisherRow | null>(null);
	const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
	const [selectedDeficiencies, setSelectedDeficiencies] = useState<FireExtinguisherDeficiencyRow[]>([]);
	const [isDetailLoading, setIsDetailLoading] = useState(false);
	const [isDeficienciesLoading, setIsDeficienciesLoading] = useState(false);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<"add" | "edit">("add");
	const [isFormSaving, setIsFormSaving] = useState(false);
	const [formInstanceKey, setFormInstanceKey] = useState(0);

	const readinessState = useMemo(
		() =>
			calculateFireExtinguisherReadiness(
				rows.map((row) => ({
					status: row.status,
					hasOpenDeficiency: row.open_deficiency_count > 0,
				})),
			),
		[rows],
	);

	const activeRows = useMemo(
		() => rows.filter((row) => row.status === "Active"),
		[rows],
	);

	const filteredRows = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLowerCase();

		return rows
			.filter((row) => {
				if (statusFilter !== "All" && row.status !== statusFilter) {
					return false;
				}

				if (!normalizedSearch) {
					return true;
				}

				const searchableFields = [
					row.extinguisher_number,
					row.extinguisher_type,
					row.apparatus_name,
					row.other_location,
					row.notes,
				];

				return searchableFields.some((field) => (field ?? "").toLowerCase().includes(normalizedSearch));
			})
			.sort((left, right) => compareNames(left.extinguisher_number, right.extinguisher_number));
	}, [rows, searchTerm, statusFilter]);

	const formInitialValues = formMode === "edit" && selectedItem ? toFormValues(selectedItem) : undefined;

	const openDeficiencyCount = useMemo(
		() => selectedDeficiencies.filter((row) => {
			const normalized = typeof row.status_name === "string" ? row.status_name.trim().toLowerCase() : "";
			return normalized !== "resolved" && normalized !== "closed";
		}).length,
		[selectedDeficiencies],
	);
	const openDeficiencies = useMemo(
		() => selectedDeficiencies.filter((row) => {
			const normalized = typeof row.status_name === "string" ? row.status_name.trim().toLowerCase() : "";
			return normalized !== "resolved" && normalized !== "closed";
		}),
		[selectedDeficiencies],
	);
	const deficiencyHistory = useMemo(
		() => selectedDeficiencies.filter((row) => {
			const normalized = typeof row.status_name === "string" ? row.status_name.trim().toLowerCase() : "";
			return normalized === "resolved" || normalized === "closed";
		}),
		[selectedDeficiencies],
	);
	const refreshToken = searchParams.get("refresh");
	const preferredSelectedItemId = searchParams.get("selectedItemId");

	const launchDeficiencyReport = () => {
		if (!selectedItem) {
			return;
		}

		const params = new URLSearchParams({
			inventoryCategory: "fire-extinguishers",
			inventoryItemId: selectedItem.id,
			inventoryItemLabel: selectedItem.extinguisher_number,
			returnTo: `/inventory/fire-extinguishers?selectedItemId=${encodeURIComponent(selectedItem.id)}`,
		});

		router.push(`/deficiencies/report?${params.toString()}`);
	};

	const loadDetail = async (itemId: string) => {
		setSelectedItemId(itemId);
		setIsDetailLoading(true);
		setIsDeficienciesLoading(true);
		setSelectedDeficiencies([]);

		try {
			const [detailResponse, deficienciesResponse] = await Promise.all([
				fetch(`/api/fire-extinguishers/${itemId}`, { method: "GET" }),
				fetch(`/api/fire-extinguishers/${itemId}/deficiencies`, { method: "GET" }),
			]);

			const payload = (await detailResponse.json().catch(() => ({}))) as
				| ({ error?: unknown } & Partial<FireExtinguisherDetailResponse>)
				| null;

			if (!detailResponse.ok || !payload || !payload.item) {
				setToastMessage(normalizeApiError(payload, "Unable to load fire extinguisher detail."));
				return;
			}

			setSelectedItem(payload.item);
			setSelectedPhotoUrl(typeof payload.photoUrl === "string" ? payload.photoUrl : null);

			const deficienciesPayload = (await deficienciesResponse.json().catch(() => ({}))) as
				| ({ error?: unknown } & Partial<FireExtinguisherDeficienciesResponse>)
				| null;

			if (!deficienciesResponse.ok || !deficienciesPayload || !Array.isArray(deficienciesPayload.rows)) {
				setSelectedDeficiencies([]);
				setRows((current) =>
					current.map((row) =>
						row.id === itemId ? { ...row, open_deficiency_count: 0 } : row,
					),
				);
			} else {
				setSelectedDeficiencies(deficienciesPayload.rows);
				const openCount = deficienciesPayload.rows.filter((row) => {
					const normalized = typeof row.status_name === "string" ? row.status_name.trim().toLowerCase() : "";
					return normalized !== "resolved" && normalized !== "closed";
				}).length;

				setRows((current) =>
					current.map((row) =>
						row.id === itemId ? { ...row, open_deficiency_count: openCount } : row,
					),
				);
			}
		} catch {
			setToastMessage("Unable to load fire extinguisher detail.");
		} finally {
			setIsDeficienciesLoading(false);
			setIsDetailLoading(false);
		}
	};

	useEffect(() => {
		if (selectedItemId || rows.length === 0) {
			return;
		}

		const initialSelectedItemId =
			typeof preferredSelectedItemId === "string" && rows.some((row) => row.id === preferredSelectedItemId)
				? preferredSelectedItemId
				: rows[0].id;

		const timeout = window.setTimeout(() => {
			void loadDetail(initialSelectedItemId);
		}, 0);

		return () => window.clearTimeout(timeout);
	}, [preferredSelectedItemId, rows, selectedItemId]);

	useEffect(() => {
		if (!refreshToken) {
			return;
		}

		const targetItemId =
			selectedItemId ??
			(typeof preferredSelectedItemId === "string" && preferredSelectedItemId ? preferredSelectedItemId : null);

		if (!targetItemId) {
			return;
		}

		const timeout = window.setTimeout(() => {
			void loadDetail(targetItemId);
		}, 0);

		return () => window.clearTimeout(timeout);
	}, [preferredSelectedItemId, refreshToken, selectedItemId]);

	const openAddForm = () => {
		setFormMode("add");
		setFormInstanceKey((current) => current + 1);
		setIsFormOpen(true);
	};

	const openEditForm = () => {
		if (!selectedItem || !canManageFireExtinguishers) {
			return;
		}

		setFormMode("edit");
		setFormInstanceKey((current) => current + 1);
		setIsFormOpen(true);
	};

	const closeForm = () => {
		if (isFormSaving) {
			return;
		}

		setIsFormOpen(false);
	};

	const handleDelete = async () => {
		if (!selectedItem || !canManageFireExtinguishers || isFormSaving) {
			return;
		}

		const confirmed = window.confirm(
			`Delete ${selectedItem.extinguisher_number}? This action cannot be undone.`,
		);
		if (!confirmed) {
			return;
		}

		setIsFormSaving(true);

		try {
			const response = await fetch(`/api/fire-extinguishers/${selectedItem.id}`, {
				method: "DELETE",
			});
			const payload = (await response.json().catch(() => ({}))) as { error?: unknown };

			if (!response.ok) {
				setToastMessage(normalizeApiError(payload, "Unable to delete fire extinguisher."));
				return;
			}

			setRows((current) => current.filter((row) => row.id !== selectedItem.id));
			setSelectedItemId(null);
			setSelectedItem(null);
			setSelectedPhotoUrl(null);
			setSelectedDeficiencies([]);
			setIsFormOpen(false);
			setToastMessage("Fire extinguisher deleted.");
		} finally {
			setIsFormSaving(false);
		}
	};

	const handleSave = async (values: FireExtinguisherFormValues) => {
		if (!canManageFireExtinguishers || isFormSaving) {
			return;
		}

		if (!values.extinguisherNumber.trim()) {
			setToastMessage("Extinguisher number is required.");
			return;
		}

		if (values.extinguisherType === "Other" && !values.customExtinguisherType.trim()) {
			setToastMessage("Custom extinguisher type is required.");
			return;
		}

		if (values.locationType === "Apparatus" && !values.apparatusId.trim()) {
			setToastMessage("Select an apparatus location.");
			return;
		}

		if (values.locationType === "Other" && !values.otherLocation.trim()) {
			setToastMessage("Other location is required.");
			return;
		}

		setIsFormSaving(true);

		try {
			const photoUpload = values.photoFile ? await fileToUploadPayload(values.photoFile) : null;
			const requestPayload = {
				extinguisherNumber: values.extinguisherNumber,
				extinguisherType: values.extinguisherType,
				customExtinguisherType: values.customExtinguisherType,
				locationType: values.locationType,
				apparatusId: values.apparatusId,
				otherLocation: values.otherLocation,
				status: values.status,
				notes: values.notes,
				photoUpload,
				removePhoto: values.removePhoto,
			};

			const endpoint = formMode === "add" ? "/api/fire-extinguishers" : `/api/fire-extinguishers/${selectedItem?.id ?? ""}`;
			const method = formMode === "add" ? "POST" : "PATCH";

			const response = await fetch(endpoint, {
				method,
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify(requestPayload),
			});

			const payload = (await response.json().catch(() => ({}))) as
				| ({ error?: unknown } & { item?: FireExtinguisherRow })
				| null;

			if (!response.ok || !payload?.item) {
				setToastMessage(
					normalizeApiError(
						payload,
						formMode === "add"
							? "Unable to create fire extinguisher."
							: "Unable to update fire extinguisher.",
					),
				);
				return;
			}

			const savedItem = payload.item;

			setRows((current) => {
				if (formMode === "add") {
					return [...current, savedItem].sort((left, right) => compareNames(left.extinguisher_number, right.extinguisher_number));
				}

				return current
					.map((row) => (row.id === savedItem.id ? savedItem : row))
					.sort((left, right) => compareNames(left.extinguisher_number, right.extinguisher_number));
			});

			setSelectedItemId(savedItem.id);
			if (formMode === "add") {
				setSearchTerm("");
				setStatusFilter("All");
			}

			await loadDetail(savedItem.id);
			setIsFormOpen(false);
			setToastMessage(formMode === "add" ? "Fire extinguisher created." : "Fire extinguisher updated.");
		} finally {
			setIsFormSaving(false);
		}
	};

	return (
		<main className="min-h-screen bg-[#090909] px-6 py-10 text-white">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
				{toastMessage ? (
					<div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
						<div className="flex items-center justify-between gap-3">
							<span>{toastMessage}</span>
							<button
								type="button"
								onClick={() => setToastMessage(null)}
								className="text-red-200/80 transition hover:text-red-100"
							>
								Dismiss
							</button>
						</div>
					</div>
				) : null}

				<div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(225,24,27,0.16),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-3">
						<p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>
						<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Fire Extinguishers</h1>
						<p className="max-w-2xl text-sm text-zinc-400">
							Track extinguisher readiness, locations, photos, and shared deficiencies in one place.
						</p>
						{departmentName ? (
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{departmentName}</p>
						) : null}
					</div>

					<div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[460px]">
						<div className="rounded-2xl border border-white/10 bg-[#121212] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Readiness</p>
							<p className="mt-1 text-3xl font-black text-white">
								{readinessState.readinessPercent === null ? "NR" : `${Math.round(readinessState.readinessPercent)}%`}
							</p>
							<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
								{readinessState.readinessPercent === null ? "Not Rated" : readinessState.readinessPercent >= 100 ? "Ready" : "Needs Attention"}
							</p>
						</div>

						<div className="rounded-2xl border border-white/10 bg-[#121212] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Tracked</p>
							<p className="mt-1 text-3xl font-black text-white">{readinessState.trackedExtinguisherCount}</p>
							<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Active</p>
						</div>

						<div className="rounded-2xl border border-white/10 bg-[#121212] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Open Deficiencies</p>
							<p className="mt-1 text-3xl font-black text-white">{readinessState.openDeficiencyCount}</p>
							<p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
								{readinessState.readyExtinguisherCount} ready
							</p>
						</div>
					</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
					<section className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
						<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
							<div>
								<p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Inventory List</p>
								<h2 className="mt-2 text-2xl font-black tracking-tight text-white">Extinguisher Records</h2>
							</div>
							<div className="flex gap-3">
								<button
									type="button"
									onClick={openAddForm}
									disabled={!canManageFireExtinguishers}
									className="rounded-xl border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Add Extinguisher
								</button>
							</div>
						</div>

						<div className="mt-5 grid gap-3 sm:grid-cols-3">
							<button type="button" onClick={() => setStatusFilter("All")} className={summaryCardClasses(statusFilter === "All", "all")}>
								<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">All</p>
								<p className="mt-1 text-lg font-black text-white">{rows.length}</p>
							</button>
							<button type="button" onClick={() => setStatusFilter("Active")} className={summaryCardClasses(statusFilter === "Active", "active")}>
								<p className="text-xs uppercase tracking-[0.18em] text-green-400">Active</p>
								<p className="mt-1 text-lg font-black text-white">{activeRows.length}</p>
							</button>
							<button type="button" onClick={() => setStatusFilter("Out of Service")} className={summaryCardClasses(statusFilter === "Out of Service", "out")}>
								<p className="text-xs uppercase tracking-[0.18em] text-red-400">Out of Service</p>
								<p className="mt-1 text-lg font-black text-white">{rows.filter((row) => row.status === "Out of Service").length}</p>
							</button>
						</div>

						<div className="mt-5 flex flex-col gap-3 md:flex-row">
							<div className="min-w-0 flex-1">
								<label htmlFor="extinguisher-search" className="sr-only">
									Search extinguishers
								</label>
								<input
									id="extinguisher-search"
									type="text"
									placeholder="Search by extinguisher number, type, location, or notes..."
									value={searchTerm}
									onChange={(event) => setSearchTerm(event.target.value)}
									className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none"
								/>
							</div>
							<select
								value={statusFilter}
								onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
								className="rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
							>
								{["All", "Active", "Inactive", "Out of Service"].map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>

						<div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
							<div className="max-h-[56vh] overflow-y-auto">
								<div className="sticky top-0 grid grid-cols-[1.1fr_1fr_1fr_0.7fr_0.7fr] gap-0 border-b border-white/10 bg-[#151515] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
									<div>Number</div>
									<div>Type</div>
									<div>Location</div>
									<div>Status</div>
									<div>Deficiencies</div>
								</div>

								<div className="divide-y divide-white/5 bg-[#0d0d0d]">
									{filteredRows.length === 0 ? (
										<div className="px-4 py-10 text-sm text-zinc-400">No extinguishers match the current filters.</div>
									) : (
										filteredRows.map((row) => {
											const isSelected = selectedItemId === row.id;

											return (
												<button
													key={row.id}
													type="button"
													onClick={() => void loadDetail(row.id)}
													className={`grid w-full grid-cols-[1.1fr_1fr_1fr_0.7fr_0.7fr] gap-0 px-4 py-4 text-left transition ${isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
												>
													<div className="pr-3">
														<p className="font-semibold text-white">{row.extinguisher_number}</p>
														<p className="mt-1 text-xs text-zinc-500">{row.created_at ? formatDate(row.created_at) : "-"}</p>
													</div>
													<div className="pr-3 text-sm text-zinc-300">{getDisplayExtinguisherType(row)}</div>
													<div className="pr-3 text-sm text-zinc-300">
														{row.location_type === "Apparatus"
															? row.apparatus_name ?? "Unknown apparatus"
															: row.location_type === "Other"
																? row.other_location ?? "Other"
																: row.location_type}
													</div>
													<div className="pr-3">
														<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.status)}`}>{row.status}</span>
													</div>
													<div className="pr-3 text-sm text-zinc-300">{row.open_deficiency_count}</div>
												</button>
											);
										})
									)}
								</div>
							</div>
						</div>
					</section>

					<section className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] lg:sticky lg:top-5 lg:self-start">
						{selectedItem ? (
							<div className="space-y-5">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Selected Extinguisher</p>
										<h3 className="mt-2 text-2xl font-black tracking-tight text-white">{selectedItem.extinguisher_number}</h3>
									</div>
									<div className="flex flex-wrap gap-2">
										<span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusBadgeClasses(selectedItem.status)}`}>{selectedItem.status}</span>
										{canManageFireExtinguishers ? (
											<button
												type="button"
												onClick={openEditForm}
												className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
											>
												Edit
											</button>
										) : null}
									</div>
								</div>

								<div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<div>
											<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Type</p>
											<p className="mt-2 text-sm font-semibold text-white">{getDisplayExtinguisherType(selectedItem)}</p>
										</div>
										<div>
											<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Location</p>
											<p className="mt-2 text-sm font-semibold text-white">
												{selectedItem.location_type === "Apparatus"
													? selectedItem.apparatus_name ?? "Unknown apparatus"
													: selectedItem.location_type === "Other"
														? selectedItem.other_location ?? "Other location"
														: selectedItem.location_type}
											</p>
										</div>
										<div>
											<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Added</p>
											<p className="mt-2 text-sm font-semibold text-white">{formatDate(selectedItem.created_at)}</p>
										</div>
										<div>
											<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Updated</p>
											<p className="mt-2 text-sm font-semibold text-white">{formatDate(selectedItem.updated_at)}</p>
										</div>
										<div>
											<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Open Deficiencies</p>
											<p className="mt-2 text-sm font-semibold text-white">{openDeficiencyCount}</p>
										</div>
									</div>
								</div>

								<div className="flex gap-3">
									<button
										type="button"
										onClick={launchDeficiencyReport}
										className="rounded-xl border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
									>
										Report Deficiency
									</button>
								</div>

								<div className="overflow-hidden rounded-2xl border border-white/10">
									<div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
										<span>Shared Deficiencies</span>
										<span>{openDeficiencyCount} Open</span>
									</div>
									<div className="divide-y divide-white/5 bg-[#0d0d0d]">
										{isDeficienciesLoading ? (
											<div className="px-4 py-8 text-sm text-zinc-400">Loading deficiencies...</div>
										) : selectedDeficiencies.length === 0 ? (
											<div className="px-4 py-8 text-sm text-zinc-400">No shared deficiencies recorded.</div>
										) : (
											openDeficiencies.map((row) => (
												<div key={row.id} className="px-4 py-4">
													<div className="flex items-start justify-between gap-3">
														<div>
															<p className="text-sm font-semibold text-white">{row.deficiency_number ?? "Unassigned"}</p>
															<p className="mt-1 text-sm text-zinc-300">{row.description ?? "No description provided."}</p>
															<p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">Priority {row.priority_name ?? "Unknown"}</p>
														</div>
														<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${deficiencyStatusClasses(row.status_name)}`}>{row.status_name ?? "Unknown"}</span>
													</div>
													<p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Reported {formatDate(row.reported_at)}</p>
												</div>
											))
										)}

										{!isDeficienciesLoading && deficiencyHistory.length > 0 ? (
											<div className="border-t border-white/10 px-4 py-3">
												<p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">History</p>
												<div className="mt-3 space-y-3">
													{deficiencyHistory.map((row) => (
														<div key={row.id} className="rounded-lg border border-white/10 bg-[#111111] px-3 py-3">
															<div className="flex items-start justify-between gap-3">
																<div>
																	<p className="text-sm font-semibold text-white">{row.deficiency_number ?? "Unassigned"}</p>
																	<p className="mt-1 text-sm text-zinc-300">{row.description ?? "No description provided."}</p>
																	<p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">Priority {row.priority_name ?? "Unknown"}</p>
																</div>
																<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${deficiencyStatusClasses(row.status_name)}`}>{row.status_name ?? "Unknown"}</span>
															</div>
															<p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Reported {formatDate(row.reported_at)}</p>
														</div>
													))}
												</div>
											</div>
										) : null}
									</div>
								</div>

								<div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4">
									<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Notes</p>
									<p className="mt-2 text-sm leading-6 text-zinc-200">{selectedItem.notes ?? "No notes provided."}</p>
								</div>

								{selectedPhotoUrl ? (
									<div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4">
										<p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Photo</p>
										<a href={selectedPhotoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block overflow-hidden rounded-xl border border-white/10 transition hover:border-red-500/40">
											<Image src={selectedPhotoUrl} alt="Fire extinguisher" width={1200} height={720} unoptimized className="h-56 w-full object-cover" />
										</a>
									</div>
								) : null}
							</div>
						) : isDetailLoading ? (
							<div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0d0d0d] px-6 py-10 text-center text-zinc-400">
								<div>
									<p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">Loading Detail</p>
									<p className="mt-3 max-w-sm text-sm text-zinc-400">Fetching extinguisher details and linked deficiencies.</p>
								</div>
							</div>
						) : (
							<div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0d0d0d] px-6 py-10 text-center text-zinc-400">
								<div>
									<p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">No Selection</p>
									<p className="mt-3 max-w-sm text-sm text-zinc-400">Select an extinguisher to review details, photos, and linked deficiencies.</p>
								</div>
							</div>
						)}
					</section>
				</div>
			</div>

			<FireExtinguisherFormModal
				key={formInstanceKey}
				isOpen={isFormOpen}
				mode={formMode}
				initialValues={formInitialValues}
				apparatusOptions={apparatusOptions}
				canDelete={Boolean(canManageFireExtinguishers && formMode === "edit")}
				isSaving={isFormSaving}
				onClose={closeForm}
				onSave={handleSave}
				onDelete={handleDelete}
				hasExistingPhoto={Boolean(selectedItem?.photo_path)}
			/>
		</main>
	);
}
