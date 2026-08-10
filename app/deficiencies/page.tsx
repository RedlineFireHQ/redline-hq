"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageLayout from "@/components/layout/PageLayout";

type Deficiency = {
	id: string;
	deficiency_number: string | null;
	description: string | null;
	location: string | null;
	fire_hose_id: string | null;
	fire_hose: {
		inventory_number: string | null;
	} | null;
	apparatus: {
		name: string | null;
	} | null;
	priority: {
		name: string | null;
	} | null;
	status: {
		name: string | null;
	} | null;
	reported_at: string | null;
};

type SelectOption = {
	id: string;
	label: string;
	value: string;
};

type ApparatusOption = {
	id: string;
	name: string;
};

type DeficiencyStatusOption = {
	id: string;
	name: string;
};

type ReportFormState = {
	categoryId: string;
	priorityId: string;
	apparatusId: string;
	description: string;
	location: string;
	photo: File | null;
};

const initialFormState: ReportFormState = {
	categoryId: "",
	priorityId: "",
	apparatusId: "",
	description: "",
	location: "",
	photo: null,
};

function getRecordString(
	record: Record<string, unknown>,
	keys: string[]
) {
	for (const key of keys) {
		const value = record[key];

		if (typeof value === "string" && value.trim()) {
			return value;
		}
	}

	return "";
}

function normalizeSelectOption(record: Record<string, unknown>): SelectOption {
	const idValue = record.id ?? record.category_id ?? record.priority_id;
	const id = typeof idValue === "string" ? idValue : String(idValue ?? "");
	const label =
		getRecordString(record, [
			"name",
			"label",
			"title",
			"value",
			"category_name",
			"priority_name",
		]) || id;
	const value =
		getRecordString(record, [
			"value",
			"name",
			"label",
			"title",
			"category_name",
			"priority_name",
		]) || label;

	return { id, label, value };
}

function normalizeApparatusOption(record: Record<string, unknown>): ApparatusOption {
	const idValue = record.id;
	const id = typeof idValue === "string" ? idValue : String(idValue ?? "");
	const name =
		getRecordString(record, ["name", "unit", "apparatus_name", "label"]) ||
		id;

	return { id, name };
}

function normalizeDeficiencyRelation(value: unknown): { name: string | null } | null {
	if (Array.isArray(value)) {
		const first = value[0] as Record<string, unknown> | undefined;
		if (!first) {
			return null;
		}

		const nameValue = first.name;
		return {
			name: typeof nameValue === "string" ? nameValue : null,
		};
	}

	if (value && typeof value === "object") {
		const relation = value as Record<string, unknown>;
		const nameValue = relation.name;

		return {
			name: typeof nameValue === "string" ? nameValue : null,
		};
	}

	return null;
}

function normalizeFireHoseRelation(
	value: unknown,
): { inventory_number: string | null } | null {
	if (Array.isArray(value)) {
		const first = value[0] as Record<string, unknown> | undefined;
		if (!first) {
			return null;
		}

		const inventoryNumber = first.inventory_number;
		return {
			inventory_number:
				typeof inventoryNumber === "string" ? inventoryNumber : null,
		};
	}

	if (value && typeof value === "object") {
		const relation = value as Record<string, unknown>;
		const inventoryNumber = relation.inventory_number;

		return {
			inventory_number:
				typeof inventoryNumber === "string" ? inventoryNumber : null,
		};
	}

	return null;
}

function normalizeDeficienciesData(data: unknown[] | null): Deficiency[] {
	return (data ?? []).map((record) => {
		const row = record as Record<string, unknown>;
		const idValue = row.id;
		const fireHoseIdValue = row.fire_hose_id;

		return {
			id: typeof idValue === "string" ? idValue : String(idValue ?? ""),
			deficiency_number:
				typeof row.deficiency_number === "string" ? row.deficiency_number : null,
			description: typeof row.description === "string" ? row.description : null,
			location: typeof row.location === "string" ? row.location : null,
			fire_hose_id: typeof fireHoseIdValue === "string" ? fireHoseIdValue : null,
			fire_hose: normalizeFireHoseRelation(row.fire_hose),
			apparatus: normalizeDeficiencyRelation(row.apparatus),
			priority: normalizeDeficiencyRelation(row.priority),
			status: normalizeDeficiencyRelation(row.status),
			reported_at: typeof row.reported_at === "string" ? row.reported_at : null,
		};
	});
}

type DeficiencyStatusFilter = "all" | "open" | "in progress" | "resolved";

async function fetchDeficiencies() {
	const result = await supabase
		.from("deficiencies")
		.select(
			"id, deficiency_number, description, reported_at, fire_hose_id, fire_hose:fire_hose_id(inventory_number), priority:deficiency_priorities!fk_deficiencies_priority(name), status:deficiency_statuses!fk_deficiencies_status(name), apparatus:apparatus!fk_deficiencies_apparatus(name)"
		)
		.order("reported_at", { ascending: false });

	console.log("fetchDeficiencies data:", result.data);
	console.log("fetchDeficiencies error:", result.error);

	if (result.error) {
		console.error("fetchDeficiencies error message:", result.error.message);
		console.error("fetchDeficiencies error details:", result.error.details);
		console.error("fetchDeficiencies error hint:", result.error.hint);
		console.error("fetchDeficiencies error code:", result.error.code);
		console.error("fetchDeficiencies full error:", result.error);
	}

	return result;
}

async function fetchModalOptions() {
	const [categoriesResult, prioritiesResult, apparatusResult] = await Promise.all([
		supabase.from("deficiency_categories").select("*").order("display_order"),
		supabase.from("deficiency_priorities").select("*").order("display_order"),
		supabase.from("apparatus").select("*").order("name"),
	]);

	return {
		categoriesResult,
		prioritiesResult,
		apparatusResult,
	};
}

async function fetchDeficiencyStatuses() {
	return supabase
		.from("deficiency_statuses")
		.select("*")
		.order("display_order");
}

function formatReportedDate(value: string | null) {
	if (!value) {
		return "Not reported";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
}

function getStatusBadgeClasses(status: string) {
	const normalizedStatus = status.trim().toLowerCase();

	if (normalizedStatus === "open") {
		return "bg-red-500/20 text-red-200";
	}

	if (normalizedStatus === "in progress") {
		return "bg-amber-400/25 text-amber-100";
	}

	if (normalizedStatus === "resolved") {
		return "bg-emerald-500/20 text-emerald-200";
	}

	return "bg-zinc-500/20 text-zinc-200";
}

function getPriorityBadgeClasses(priority: string) {
	const normalizedPriority = priority.trim().toLowerCase();

	if (normalizedPriority === "critical") {
		return "bg-red-500/20 text-red-200";
	}

	if (normalizedPriority === "high") {
		return "bg-orange-500/20 text-orange-200";
	}

	if (normalizedPriority === "medium") {
		return "bg-amber-400/25 text-amber-100";
	}

	if (normalizedPriority === "low") {
		return "bg-blue-500/20 text-blue-200";
	}

	if (normalizedPriority === "informational") {
		return "bg-zinc-500/20 text-zinc-200";
	}

	return "bg-zinc-500/20 text-zinc-200";
}

export default function DeficienciesPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnToParam = searchParams.get("returnTo");
	const apparatusIdParam = searchParams.get("apparatusId");
	const safeReturnTo =
		typeof returnToParam === "string" && returnToParam.startsWith("/")
			? returnToParam
			: null;
	const hasInspectionReturnTarget = Boolean(safeReturnTo);
	const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<DeficiencyStatusFilter>("all");
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [categories, setCategories] = useState<SelectOption[]>([]);
	const [priorities, setPriorities] = useState<SelectOption[]>([]);
	const [apparatusOptions, setApparatusOptions] = useState<ApparatusOption[]>([]);
	const [openStatusId, setOpenStatusId] = useState("");
	const [isOptionsLoading, setIsOptionsLoading] = useState(false);
	const [optionsErrorMessage, setOptionsErrorMessage] = useState<string | null>(null);
	const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formState, setFormState] = useState<ReportFormState>(initialFormState);
	const [hasAutoOpenedFromReturnTarget, setHasAutoOpenedFromReturnTarget] = useState(false);

	function buildReportDeficiencyHref() {
		const params = new URLSearchParams();

		if (safeReturnTo) {
			params.set("returnTo", safeReturnTo);
		}

		if (apparatusIdParam) {
			params.set("apparatusId", apparatusIdParam);
		}

		const query = params.toString();
		return query ? `/deficiencies/report?${query}` : "/deficiencies/report";
	}

	const filteredDeficiencies = useMemo(() => {
		const normalizedSearch = searchQuery.trim().toLowerCase();

		return deficiencies.filter((deficiency) => {
			const statusName = (deficiency.status?.name ?? "").trim().toLowerCase();
			const statusMatches =
				statusFilter === "all" || statusName === statusFilter;

			if (!statusMatches) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			const searchableFields = [
				deficiency.deficiency_number ?? "",
				deficiency.apparatus?.name ?? "",
				deficiency.fire_hose?.inventory_number ?? "",
				deficiency.description ?? "",
				deficiency.location ?? "",
			];

			return searchableFields.some((field) =>
				field.toLowerCase().includes(normalizedSearch)
			);
		});
	}, [deficiencies, searchQuery, statusFilter]);

	useEffect(() => {
		let isMounted = true;

		async function loadDeficiencyStatuses() {
			const { data, error } = await fetchDeficiencyStatuses();

			console.log("RAW STATUS DATA:", JSON.stringify(data, null, 2));
			console.log("STATUS ERROR:", JSON.stringify(error, null, 2));

			console.log("Raw data from fetchDeficiencyStatuses:", data);
			console.table(data ?? []);

			if (!isMounted) {
				return;
			}

			if (error) {
				console.error("Failed to load deficiency statuses:", error);
				return;
			}

			const statuses: DeficiencyStatusOption[] = (data ?? []).map((record) => {
				const statusRecord = record as Record<string, unknown>;
				const idValue = statusRecord.id;
				const id =
					typeof idValue === "string" ? idValue : String(idValue ?? "");
				const name =
					getRecordString(statusRecord, ["name", "label", "title", "value"]) ||
					id;

				return { id, name };
			});

			console.log("Mapped statuses:");
			console.table(statuses);

			const { data: directQueryOpenStatus, error: openStatusError } = await supabase
				.from("deficiency_statuses")
				.select("id, name")
				.eq("name", "Open")
				.maybeSingle();

			console.log(
				"DIRECT OPEN QUERY:",
				JSON.stringify(directQueryOpenStatus, null, 2)
			);

			console.log(
				"DIRECT OPEN ERROR:",
				JSON.stringify(openStatusError, null, 2)
			);

			console.log("Direct query Open:");
			console.log(directQueryOpenStatus);

			console.log("Direct query error:");
			console.log(openStatusError);

			if (openStatusError) {
				console.error("Failed querying Open status directly:", openStatusError);
				return;
			}

			const normalizedLookupOpenStatus = statuses.find(
				(status) => status.name.trim().toLowerCase() === "open"
			);

			console.log(
				"Normalized lookup:",
				JSON.stringify(normalizedLookupOpenStatus, null, 2)
			);

			const resolvedOpenStatusId =
				typeof directQueryOpenStatus?.id === "string" && directQueryOpenStatus.id
					? directQueryOpenStatus.id
					: normalizedLookupOpenStatus?.id;

			console.log("Resolved Open Status ID:");
			console.log(resolvedOpenStatusId);

			if (!resolvedOpenStatusId) {
				console.error('Unable to find "Open" record in deficiency_statuses.');
				return;
			}

			setOpenStatusId(resolvedOpenStatusId);
		}

		loadDeficiencyStatuses();

		return () => {
			isMounted = false;
		};
	}, []);

	async function reloadDeficiencies() {
		setIsLoading(true);
		setErrorMessage(null);

		const { data, error } = await fetchDeficiencies();

		console.log("fetchDeficiencies data:", data);
		console.log("fetchDeficiencies error:", error);

		if (error) {
			console.error("Code:", error.code);
			console.error("Message:", error.message);
			console.error("Details:", error.details);
			console.error("Hint:", error.hint);
		}

		if (error) {
			setErrorMessage("Unable to load deficiencies right now.");
			setDeficiencies([]);
			setIsLoading(false);
			return;
		}

		setDeficiencies(normalizeDeficienciesData(data as unknown[] | null));
		setIsLoading(false);
	}

	function closeModal() {
		setIsModalOpen(false);
		setSubmitErrorMessage(null);
		setOptionsErrorMessage(null);
		setFormState(initialFormState);
	}

	function openModal() {
		setSubmitErrorMessage(null);
		setOptionsErrorMessage(null);
		if (apparatusIdParam) {
			setFormState((current) => ({
				...current,
				apparatusId: current.apparatusId || apparatusIdParam,
			}));
		}
		setIsModalOpen(true);
	}

	useEffect(() => {
		if (!hasInspectionReturnTarget || hasAutoOpenedFromReturnTarget || isModalOpen) {
			return;
		}

		router.push(buildReportDeficiencyHref());
		setHasAutoOpenedFromReturnTarget(true);
	}, [
		hasAutoOpenedFromReturnTarget,
		hasInspectionReturnTarget,
		isModalOpen,
		router,
		safeReturnTo,
		apparatusIdParam,
	]);

	useEffect(() => {
		let isMounted = true;

		async function loadDeficiencies() {
			setIsLoading(true);
			setErrorMessage(null);

			const { data, error } = await fetchDeficiencies();

			console.log("fetchDeficiencies data:", data);
			console.log("fetchDeficiencies error:", error);

			if (error) {
				console.error("Code:", error.code);
				console.error("Message:", error.message);
				console.error("Details:", error.details);
				console.error("Hint:", error.hint);
			}

			if (!isMounted) {
				return;
			}

			if (error) {
				setErrorMessage("Unable to load deficiencies right now.");
				setDeficiencies([]);
				setIsLoading(false);
				return;
			}

			setDeficiencies(normalizeDeficienciesData(data as unknown[] | null));
			setIsLoading(false);
		}

		loadDeficiencies();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (!isModalOpen) {
			return;
		}

		let isMounted = true;

		async function loadModalOptions() {
			setIsOptionsLoading(true);
			setOptionsErrorMessage(null);

			const { categoriesResult, prioritiesResult, apparatusResult } =
				await fetchModalOptions();

			console.log("Categories:", categoriesResult);
			console.log("Priorities:", prioritiesResult);
			console.log("Apparatus:", apparatusResult);
			console.log(categoriesResult.data);
			console.log(prioritiesResult.data);
			console.log(apparatusResult.data);

			if (!isMounted) {
				return;
			}

			if (
				categoriesResult.error ||
				prioritiesResult.error ||
				apparatusResult.error
			) {
				setOptionsErrorMessage(
					categoriesResult.error?.message ||
						prioritiesResult.error?.message ||
						apparatusResult.error?.message ||
						"Unable to load form options."
				);
				setIsOptionsLoading(false);
				return;
			}

			setCategories(
				(categoriesResult.data ?? []).map((record) =>
					normalizeSelectOption(record as Record<string, unknown>)
				)
			);
			setPriorities(
				(prioritiesResult.data ?? []).map((record) =>
					normalizeSelectOption(record as Record<string, unknown>)
				)
			);
			setApparatusOptions(
				(apparatusResult.data ?? []).map((record) =>
					normalizeApparatusOption(record as Record<string, unknown>)
				)
			);

			if (apparatusIdParam) {
				setFormState((current) => ({
					...current,
					apparatusId: current.apparatusId || apparatusIdParam,
				}));
			}
			setIsOptionsLoading(false);
		}

		loadModalOptions();

		return () => {
			isMounted = false;
		};
	}, [isModalOpen, apparatusIdParam]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const formStateWithOptionalPhoto = formState as ReportFormState & {
			photo?: File | null | string;
		};

		console.log("Validation values:", {
			categoryId: formState.categoryId,
			priorityId: formState.priorityId,
			apparatusId: formState.apparatusId,
			description: formState.description,
			location: formState.location,
			openStatusId,
			photo: formStateWithOptionalPhoto.photo,
		});

		console.log("Validation booleans:", {
			missingCategory: !formState.categoryId,
			missingPriority: !formState.priorityId,
			missingApparatus: !formState.apparatusId,
			missingDescription: !formState.description.trim(),
			missingLocation: !formState.location.trim(),
			missingOpenStatus: !openStatusId,
			missingPhoto: !formStateWithOptionalPhoto.photo,
		});

		if (
			!formState.categoryId ||
			!formState.priorityId ||
			!formState.apparatusId ||
			!openStatusId ||
			!formState.description.trim()
		) {
			setSubmitErrorMessage("Complete all required fields before submitting.");
			return;
		}

		setIsSubmitting(true);
		setSubmitErrorMessage(null);

		const deficiencyId = crypto.randomUUID();
		let uploadedPhotoPath: string | null = null;
		let didPhotoUploadSucceed = false;

		if (formState.photo) {
			const originalName = formState.photo.name || "photo.jpg";
			const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
			const photoPath = `${deficiencyId}/${Date.now()}-${sanitizedName}`;

			const { data: sessionData } = await supabase.auth.getSession();
			console.log("SESSION:", sessionData);

			const { data: userData } = await supabase.auth.getUser();
			console.log("USER:", userData);

			const { error: uploadError } = await supabase.storage
				.from("deficiency-photos")
				.upload(photoPath, formState.photo, {
					cacheControl: "3600",
					upsert: false,
				});

			console.log("uploadError:", uploadError);
			console.log("uploadError?.message:", uploadError?.message);
			console.log("uploadError?.statusCode:", uploadError?.statusCode);
			console.log("uploadError?.error:", (uploadError as any)?.error);
			console.log("photoPath:", photoPath);
			console.log("formState.photo?.name:", formState.photo?.name);
			console.log("formState.photo?.size:", formState.photo?.size);
			console.log("formState.photo?.type:", formState.photo?.type);

			if (uploadError) {
				console.error("Deficiency photo upload error:", uploadError);
			} else {
				uploadedPhotoPath = photoPath;
				didPhotoUploadSucceed = true;
			}
		}

		const now = new Date().toISOString();
		const payload = {
			id: deficiencyId,
			category_id: formState.categoryId,
			priority: formState.priorityId,
			apparatus_id: formState.apparatusId,
			description: formState.description.trim(),
			location: formState.location.trim() || null,
			reported_at: now,
			created_at: now,
			status: openStatusId,
			photo_path: uploadedPhotoPath,
		};

		console.log("Deficiency insert payload:", payload);
		console.log("INSERT PRE-CALL payload object:", payload);
		console.log("INSERT PRE-CALL payload id:", payload.id);
		console.log("INSERT PRE-CALL payload photo_path:", payload.photo_path);
		console.log("INSERT PRE-CALL upload success:", didPhotoUploadSucceed);

		let insertResult;

		try {
			insertResult = await supabase
				.from("deficiencies")
				.insert(payload)
				.select("id")
				.single();
		} catch (insertException) {
			console.error("INSERT threw exception (full):", insertException);
			throw insertException;
		}

		console.log("INSERT POST-CALL Supabase result:", insertResult);
		console.log("INSERT POST-CALL data:", insertResult.data);
		console.log("INSERT POST-CALL error:", insertResult.error);
		console.log("INSERT POST-CALL status:", insertResult.status);
		console.log("INSERT POST-CALL statusText:", insertResult.statusText);

		const { error } = insertResult;

		if (error) {
			console.error("error.code:", error.code);
			console.error("error.message:", error.message);
			console.error("error.details:", error.details);
			console.error("error.hint:", error.hint);
			console.error("error.fullJson:", JSON.stringify(error, null, 2));
			setSubmitErrorMessage("Unable to submit deficiency right now.");
			setIsSubmitting(false);
			return;
		}

		const insertedDeficiencyId =
			typeof insertResult.data?.id === "string" ? insertResult.data.id : deficiencyId;

		if (insertedDeficiencyId) {
			const { error: historyError } = await supabase
				.from("deficiency_history")
				.insert({
					deficiency_id: insertedDeficiencyId,
					event_type: "Reported",
					event_description: "Deficiency reported.",
					member_id: null,
				});

			if (historyError) {
				console.error("Deficiency history insert full error:", historyError);
			}
		} else {
			console.error(
				"Deficiency history insert skipped: inserted deficiency id missing.",
				insertResult.data
			);
		}

		if (safeReturnTo) {
			setIsSubmitting(false);
			router.push(safeReturnTo);
			return;
		}

		await reloadDeficiencies();
		closeModal();
		setIsSubmitting(false);
	}

	return (
		<PageLayout>
			<main className="min-h-screen bg-[#090909] px-6 py-10 text-white">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">
							Operations
						</p>

						<h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
							Deficiency Management
						</h1>

						<p className="mt-3 max-w-2xl text-base text-zinc-400 md:text-lg">
							Track critical apparatus and equipment issues before they affect readiness.
						</p>
					</div>

					<button
						type="button"
						onClick={() => router.push(buildReportDeficiencyHref())}
						className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(184,18,18,0.25)] transition hover:bg-red-500"
					>
						Report Deficiency
					</button>
				</div>

				<div className="rounded-2xl border border-white/10 bg-[#111111] px-5 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.25)]">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="w-full lg:max-w-lg">
							<label htmlFor="deficiency-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
								Search Active Deficiencies
							</label>
							<input
								id="deficiency-search"
								type="text"
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Search by deficiency #, apparatus, description, or location"
								className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
							/>
						</div>

						<div className="flex flex-wrap gap-2">
							{([
								{ key: "all", label: "All" },
								{ key: "open", label: "Open" },
								{ key: "in progress", label: "In Progress" },
								{ key: "resolved", label: "Resolved" },
							] as Array<{ key: DeficiencyStatusFilter; label: string }>).map((filter) => {
								const isActive = statusFilter === filter.key;

								return (
									<button
										key={filter.key}
										type="button"
										onClick={() => setStatusFilter(filter.key)}
										className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
											isActive
												? "border-red-500/60 bg-red-500/20 text-red-100"
												: "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
										}`}
									>
										{filter.label}
									</button>
								);
							})}
						</div>
					</div>
				</div>

				<div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
					<div className="border-b border-white/10 px-6 py-4">
						<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">
							Active Log
						</h2>
					</div>

					{isLoading ? (
						<div className="px-6 py-10 text-sm text-zinc-400">Loading deficiencies...</div>
					) : errorMessage ? (
						<div className="px-6 py-10 text-sm text-red-300">{errorMessage}</div>
					) : filteredDeficiencies.length === 0 ? (
						<div className="px-6 py-10 text-sm text-zinc-400">No deficiencies found.</div>
					) : (
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-white/10 text-sm">
								<thead className="bg-[#0d0d0d] text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
									<tr>
										<th className="px-6 py-4">Deficiency #</th>
										<th className="px-6 py-4">Apparatus</th>
										<th className="px-6 py-4">Description</th>
										<th className="px-6 py-4">Priority</th>
										<th className="px-6 py-4">Status</th>
										<th className="px-6 py-4">Reported</th>
									</tr>
								</thead>

								<tbody className="divide-y divide-white/5">
									{filteredDeficiencies.map((deficiency) => (
										<tr
											key={deficiency.id}
											onClick={() => router.push(`/operations/deficiencies/${deficiency.id}`)}
											className="transition hover:bg-white/[0.03] cursor-pointer"
										>
											<td className="px-6 py-4 font-semibold text-white">
												{deficiency.deficiency_number ?? "Unassigned"}
											</td>
											<td className="px-6 py-4 text-zinc-300">
														{deficiency.apparatus?.name ? (
															deficiency.apparatus.name
														) : deficiency.fire_hose_id ? (
															<div>
																<p>Station Supply</p>
																<p>
																	Fire Hose - {deficiency.fire_hose?.inventory_number ?? "Unknown"}
																</p>
															</div>
														) : (
															"Unknown Apparatus"
														)}
											</td>
											<td className="px-6 py-4 text-zinc-300">
												{deficiency.description ?? "No description provided."}
											</td>
											<td className="px-6 py-4 text-zinc-300">
												{(() => {
													const priorityName = deficiency.priority?.name ?? "Not set";

													return (
														<span
															className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClasses(
																priorityName
															)}`}
														>
															{priorityName}
														</span>
													);
												})()}
											</td>
											<td className="px-6 py-4 text-zinc-300">
												{(() => {
													const statusName = deficiency.status?.name ?? "Unknown";

													return (
														<span
															className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(
																statusName
															)}`}
														>
															{statusName}
														</span>
													);
												})()}
											</td>
											<td className="px-6 py-4 text-zinc-400">
												{formatReportedDate(deficiency.reported_at)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
				</div>

				{isModalOpen ? (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-10 backdrop-blur-sm">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
					>
						<div className="border-b border-white/10 px-6 py-5">
							<h2 className="text-2xl font-black tracking-tight text-white">
								Report Deficiency
							</h2>
							<p className="mt-2 text-sm text-zinc-400">
								Document operational issues and route them into the readiness workflow.
							</p>
						</div>

						<form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
							{optionsErrorMessage ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{optionsErrorMessage}
								</div>
							) : null}

							{submitErrorMessage ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{submitErrorMessage}
								</div>
							) : null}

							{isOptionsLoading ? (
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
									Loading form options...
								</div>
							) : null}

							<div className="grid gap-5 md:grid-cols-2">
								<label className="block">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Category
									</span>
									<select
										value={formState.categoryId}
										onChange={(event) =>
											setFormState((current) => ({
												...current,
												categoryId: event.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
									>
										<option value="">Select category</option>
										{categories.map((option) => (
											<option key={option.id} value={option.id}>
												{option.label}
											</option>
										))}
									</select>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Priority
									</span>
									<select
										value={formState.priorityId}
										onChange={(event) =>
											setFormState((current) => ({
												...current,
												priorityId: event.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
									>
										<option value="">Select priority</option>
										{priorities.map((option) => (
											<option key={option.id} value={option.id}>
												{option.label}
											</option>
										))}
									</select>
								</label>

								<label className="block md:col-span-2">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Apparatus
									</span>
									<select
										value={formState.apparatusId}
										onChange={(event) =>
											setFormState((current) => ({
												...current,
												apparatusId: event.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
									>
										<option value="">Select apparatus</option>
										{apparatusOptions.map((option) => (
											<option key={option.id} value={option.id}>
												{option.name}
											</option>
										))}
									</select>
								</label>

								<label className="block md:col-span-2">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Description
									</span>
									<textarea
										rows={5}
										value={formState.description}
										onChange={(event) =>
											setFormState((current) => ({
												...current,
												description: event.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
										placeholder="Describe the issue, impact, and any immediate hazards."
									/>
								</label>

								<label className="block md:col-span-2">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Location
									</span>
									<input
										type="text"
										value={formState.location}
										onChange={(event) =>
											setFormState((current) => ({
												...current,
												location: event.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
										placeholder="Example: Officer side compartment 3"
									/>
								</label>

								<div className="block md:col-span-2">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Photo
									</span>
									<div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
										<input
											type="file"
											accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
											onChange={(event) => {
												const selectedFile = event.target.files?.[0] ?? null;
												setFormState((current) => ({
													...current,
													photo: selectedFile,
												}));
											}}
											className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-red-500"
										/>
										<p className="mt-2 text-xs text-zinc-500">
											Photo is optional. Supported formats include JPG, PNG, and HEIC (when supported by your browser).
										</p>
									</div>
								</div>
							</div>

							<div className="flex justify-end gap-3 border-t border-white/10 pt-2">
								<button
									type="button"
									onClick={closeModal}
									className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSubmitting || isOptionsLoading}
									className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isSubmitting ? "Submitting..." : "Submit Deficiency"}
								</button>
							</div>
						</form>
					</div>
					</div>
				) : null}
			</main>
		</PageLayout>
	);
}
