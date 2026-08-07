"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SelectOption = {
	id: string;
	label: string;
};

type EditDeficiencyButtonProps = {
	deficiencyId: string;
	initialApparatusId: string | null;
	initialDescription: string | null;
	initialLocation: string | null;
	initialCategoryId: string | null;
	initialPriorityId: string | null;
	initialStatusId: string | null;
};

type FormState = {
	apparatusId: string;
	description: string;
	location: string;
	categoryId: string;
	priorityId: string;
	statusId: string;
};

const initialFormState: FormState = {
	apparatusId: "",
	description: "",
	location: "",
	categoryId: "",
	priorityId: "",
	statusId: "",
};

function getRecordString(record: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) {
			return value;
		}
	}

	return "";
}

function normalizeSelectOption(record: Record<string, unknown>): SelectOption {
	const idValue = record.id;
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

	return { id, label };
}

function resolveOptionId(options: SelectOption[], rawValue: string | null | undefined) {
	const normalizedRawValue = rawValue?.trim();

	if (!normalizedRawValue) {
		return "";
	}

	const exactIdMatch = options.find((option) => option.id === normalizedRawValue);

	if (exactIdMatch) {
		return exactIdMatch.id;
	}

	const labelMatch = options.find(
		(option) => option.label.trim().toLowerCase() === normalizedRawValue.toLowerCase()
	);

	return labelMatch?.id ?? normalizedRawValue;
}

export default function EditDeficiencyButton({
	deficiencyId,
	initialApparatusId,
	initialDescription,
	initialLocation,
	initialCategoryId,
	initialPriorityId,
	initialStatusId,
}: EditDeficiencyButtonProps) {
	const router = useRouter();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isOptionsLoading, setIsOptionsLoading] = useState(false);
	const [optionsError, setOptionsError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [apparatusOptions, setApparatusOptions] = useState<SelectOption[]>([]);
	const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);
	const [priorityOptions, setPriorityOptions] = useState<SelectOption[]>([]);
	const [statusOptions, setStatusOptions] = useState<SelectOption[]>([]);
	const [formState, setFormState] = useState<FormState>(initialFormState);
	const [photoUrl, setPhotoUrl] = useState<string | null>(null);
	const [isPhotoLoading, setIsPhotoLoading] = useState(false);

	useEffect(() => {
		if (!isModalOpen) {
			return;
		}

		let isMounted = true;

		async function loadOptions() {
			setIsOptionsLoading(true);
			setIsPhotoLoading(true);
			setOptionsError(null);

			const [apparatusResult, categoriesResult, prioritiesResult, statusesResult, deficiencyResult] =
				await Promise.all([
					supabase.from("apparatus").select("*").order("name"),
					supabase
						.from("deficiency_categories")
						.select("*")
						.order("display_order"),
					supabase
						.from("deficiency_priorities")
						.select("*")
						.order("display_order"),
					supabase
						.from("deficiency_statuses")
						.select("*")
						.order("display_order"),
					supabase
						.from("deficiencies")
						.select("photo_path")
						.eq("id", deficiencyId)
						.maybeSingle(),
				]);

			if (!isMounted) {
				return;
			}

			if (
				apparatusResult.error ||
				categoriesResult.error ||
				prioritiesResult.error ||
				statusesResult.error
			) {
				setOptionsError(
					apparatusResult.error?.message ||
						categoriesResult.error?.message ||
						prioritiesResult.error?.message ||
						statusesResult.error?.message ||
						"Unable to load edit options."
				);
				setIsOptionsLoading(false);
				setIsPhotoLoading(false);
				return;
			}

			setApparatusOptions(
				(apparatusResult.data ?? []).map((record) =>
					normalizeSelectOption(record as Record<string, unknown>)
				)
			);

			const normalizedCategoryOptions = (categoriesResult.data ?? []).map((record) =>
				normalizeSelectOption(record as Record<string, unknown>)
			);
			const normalizedPriorityOptions = (prioritiesResult.data ?? []).map((record) =>
				normalizeSelectOption(record as Record<string, unknown>)
			);
			const normalizedStatusOptions = (statusesResult.data ?? []).map((record) =>
				normalizeSelectOption(record as Record<string, unknown>)
			);

			setCategoryOptions(normalizedCategoryOptions);
			setPriorityOptions(normalizedPriorityOptions);
			setStatusOptions(normalizedStatusOptions);
			setFormState((current) => ({
				...current,
				priorityId: resolveOptionId(
					normalizedPriorityOptions,
					current.priorityId || initialPriorityId
				),
				statusId: resolveOptionId(
					normalizedStatusOptions,
					current.statusId || initialStatusId
				),
			}));

			if (deficiencyResult.error) {
				console.error("Unable to load deficiency photo path:", deficiencyResult.error);
				setPhotoUrl(null);
			} else {
				const photoPathValue = deficiencyResult.data?.photo_path;
				const photoPath = typeof photoPathValue === "string" ? photoPathValue : null;
				const resolvedPhotoUrl = photoPath
					? supabase.storage.from("deficiency-photos").getPublicUrl(photoPath).data
							.publicUrl
					: null;

				setPhotoUrl(resolvedPhotoUrl);
			}

			setIsOptionsLoading(false);
			setIsPhotoLoading(false);
		}

		loadOptions();

		return () => {
			isMounted = false;
		};
	}, [isModalOpen]);

	function openModal() {
		setSaveError(null);
		setOptionsError(null);

		const initializedFormState = {
			apparatusId: initialApparatusId ?? "",
			description: initialDescription ?? "",
			location: initialLocation ?? "",
			categoryId: initialCategoryId ?? "",
			priorityId: initialPriorityId ?? "",
			statusId: initialStatusId ?? "",
		};

		console.log("[edit-deficiency] selected deficiency snapshot", {
			deficiencyId,
			initialApparatusId,
			initialDescription,
			initialLocation,
			initialCategoryId,
			initialPriorityId,
			initialStatusId,
		});

		console.log("[edit-deficiency] initialized form state values", {
			priorityId: initializedFormState.priorityId,
			statusId: initializedFormState.statusId,
			formState: initializedFormState,
		});

		setFormState(initializedFormState);
		setPhotoUrl(null);
		setIsModalOpen(true);
	}

	function closeModal() {
		if (isSaving) {
			return;
		}

		setIsModalOpen(false);
		setSaveError(null);
		setOptionsError(null);
		setPhotoUrl(null);
	}

	async function handleSave(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (
			!formState.apparatusId ||
			!formState.categoryId ||
			!formState.priorityId ||
			!formState.statusId ||
			!formState.description.trim()
		) {
			setSaveError("Complete all required fields before saving.");
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		const updatePayload = {
			apparatus_id: formState.apparatusId,
			category_id: formState.categoryId,
			priority: formState.priorityId,
			status: formState.statusId,
			description: formState.description.trim(),
			location: formState.location.trim() || null,
		};

		const { error } = await supabase
			.from("deficiencies")
			.update(updatePayload)
			.eq("id", deficiencyId);

		if (error) {
			setSaveError(error.message);
			setIsSaving(false);
			return;
		}

		const { error: historyError } = await supabase
			.from("deficiency_history")
			.insert({
				deficiency_id: deficiencyId,
				member_id: null,
				event_type: "Edited",
				event_description: "Deficiency details updated.",
			});

		if (historyError) {
			console.error("Edit Deficiency history insert error:", historyError);
		}

		setIsSaving(false);
		setIsModalOpen(false);
		router.refresh();
	}

	return (
		<>
			<button
				type="button"
				onClick={openModal}
				className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
			>
				Edit
			</button>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-10 backdrop-blur-sm">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
					>
						<div className="border-b border-white/10 px-6 py-5">
							<h2 className="text-2xl font-black tracking-tight text-white">Edit Deficiency</h2>
							<p className="mt-2 text-sm text-zinc-400">
								Update deficiency details and readiness metadata.
							</p>
						</div>

						<form onSubmit={handleSave} className="space-y-6 px-6 py-6">
							{optionsError ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{optionsError}
								</div>
							) : null}

							{saveError ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{saveError}
								</div>
							) : null}

							{isOptionsLoading ? (
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
									Loading edit options...
								</div>
							) : null}

							<div className="grid gap-5 md:grid-cols-2">
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
												{option.label}
											</option>
										))}
									</select>
								</label>

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
										{categoryOptions.map((option) => (
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
										{priorityOptions.map((option) => (
											<option key={option.id} value={option.id}>
												{option.label}
											</option>
										))}
									</select>
								</label>

								<label className="block md:col-span-2">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">
										Status
									</span>
									<select
										value={formState.statusId}
										onChange={(event) =>
											setFormState((current) => ({
												...current,
												statusId: event.target.value,
											}))
										}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
									>
										<option value="">Select status</option>
										{statusOptions.map((option) => (
											<option key={option.id} value={option.id}>
												{option.label}
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
										Current Photo
									</span>

									{isPhotoLoading ? (
										<div className="rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-400">
											Loading photo...
										</div>
									) : photoUrl ? (
										<div>
											<a
												href={photoUrl}
												target="_blank"
												rel="noreferrer"
												className="inline-block overflow-hidden rounded-lg border border-white/10 transition hover:border-red-500/40"
											>
												<img
													src={photoUrl}
													alt="Deficiency photo"
													className="h-40 w-auto max-w-full object-cover"
												/>
											</a>
											<p className="mt-2 text-xs text-zinc-500">Click image to open full size.</p>
										</div>
									) : (
										<div className="rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-500">
											No photo uploaded.
										</div>
									)}
								</div>
							</div>

							<div className="flex justify-end gap-3 border-t border-white/10 pt-2">
								<button
									type="button"
									onClick={closeModal}
									disabled={isSaving}
									className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSaving || isOptionsLoading}
									className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{isSaving ? "Saving..." : "Save"}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</>
	);
}
