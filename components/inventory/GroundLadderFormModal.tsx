"use client";

import { useEffect, useMemo, useState } from "react";

export type GroundLadderFormValues = {
	ladderNumber: string;
	ladderType: string;
	ladderLengthFt: string;
	manufacturer: string;
	model: string;
	serialNumber: string;
	inServiceDate: string;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	assignmentType: "Apparatus" | "Station" | "Unassigned";
	apparatusId: string;
	stationName: string;
	notes: string;
};

interface GroundLadderFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: GroundLadderFormValues;
	apparatusOptions?: Array<{ id: string; label: string }>;
	isSaving?: boolean;
	onClose: () => void;
	onSave: (values: GroundLadderFormValues) => void;
	onReportDeficiency?: () => void;
	onDelete?: () => void;
	canDelete?: boolean;
}

const LADDER_TYPE_OPTIONS = ["Folding / Attic", "Roof", "Extension"] as const;

const LADDER_LENGTH_OPTIONS: Record<string, string[]> = {
	"Folding / Attic": ["8", "10", "12", "14"],
	Roof: ["14", "16", "20"],
	Extension: ["24", "28", "35", "40"],
};

const STATUS_OPTIONS: GroundLadderFormValues["status"][] = [
	"In Service",
	"Unassigned",
	"Out of Service",
	"Lost",
	"Stolen",
	"Retired",
];

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function statusBadgeClasses(status: string) {
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

function getLengthOptions(ladderType: string) {
	return LADDER_LENGTH_OPTIONS[ladderType] ?? [];
}

export default function GroundLadderFormModal({
	isOpen,
	mode,
	initialValues,
	apparatusOptions = [],
	isSaving = false,
	onClose,
	onSave,
	onReportDeficiency,
	onDelete,
	canDelete = false,
}: GroundLadderFormModalProps) {
	const [formValues, setFormValues] = useState<GroundLadderFormValues>({
		ladderNumber: "",
		ladderType: LADDER_TYPE_OPTIONS[0],
		ladderLengthFt: LADDER_LENGTH_OPTIONS[LADDER_TYPE_OPTIONS[0]][0],
		manufacturer: "",
		model: "",
		serialNumber: "",
		inServiceDate: getTodayDate(),
		status: "Unassigned",
		assignmentType: "Unassigned",
		apparatusId: "",
		stationName: "Station Supply",
		notes: "",
	});

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				ladderNumber: initialValues.ladderNumber ?? "",
				ladderType: initialValues.ladderType || LADDER_TYPE_OPTIONS[0],
				ladderLengthFt: initialValues.ladderLengthFt || getLengthOptions(initialValues.ladderType)[0] || LADDER_LENGTH_OPTIONS[LADDER_TYPE_OPTIONS[0]][0],
				manufacturer: initialValues.manufacturer ?? "",
				model: initialValues.model ?? "",
				serialNumber: initialValues.serialNumber ?? "",
				inServiceDate: initialValues.inServiceDate ?? "",
				status: initialValues.status ?? "Unassigned",
				assignmentType: initialValues.assignmentType ?? "Unassigned",
				apparatusId: initialValues.apparatusId ?? "",
				stationName: initialValues.stationName ?? "Station Supply",
				notes: initialValues.notes ?? "",
			});
			return;
		}

		setFormValues({
			ladderNumber: "",
			ladderType: LADDER_TYPE_OPTIONS[0],
			ladderLengthFt: LADDER_LENGTH_OPTIONS[LADDER_TYPE_OPTIONS[0]][0],
			manufacturer: "",
			model: "",
			serialNumber: "",
			inServiceDate: getTodayDate(),
			status: "Unassigned",
			assignmentType: "Unassigned",
			apparatusId: "",
			stationName: "Station Supply",
			notes: "",
		});
	}, [
		initialValues?.ladderLengthFt,
		initialValues?.ladderNumber,
		initialValues?.ladderType,
		initialValues?.manufacturer,
		initialValues?.model,
		initialValues?.serialNumber,
		initialValues?.inServiceDate,
		initialValues?.status,
		initialValues?.notes,
		isOpen,
		mode,
	]);

	const lengthOptions = useMemo(() => getLengthOptions(formValues.ladderType), [formValues.ladderType]);

	useEffect(() => {
		if (!lengthOptions.includes(formValues.ladderLengthFt)) {
			setFormValues((current) => ({
				...current,
				ladderLengthFt: lengthOptions[0] ?? "",
			}));
		}
	}, [formValues.ladderLengthFt, lengthOptions]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-xl font-black text-white">{mode === "add" ? "Add Ground Ladder" : "Edit Ground Ladder"}</h3>
						<p className="mt-1 text-sm text-neutral-400">Track ladder identity, size, and operational status.</p>
					</div>
					<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(formValues.status)}`}>
						{formValues.status}
					</span>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<label className="block md:col-span-2">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Ladder Number *</span>
						<input
							value={formValues.ladderNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, ladderNumber: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Ladder Type *</span>
						<select
							value={formValues.ladderType}
							onChange={(event) => {
								const nextType = event.target.value;
								const nextLengthOptions = getLengthOptions(nextType);
								setFormValues((current) => ({
									...current,
									ladderType: nextType,
									ladderLengthFt: nextLengthOptions.includes(current.ladderLengthFt)
										? current.ladderLengthFt
										: nextLengthOptions[0] ?? "",
								}));
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{LADDER_TYPE_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Length *</span>
						<select
							value={formValues.ladderLengthFt}
							onChange={(event) => setFormValues((current) => ({ ...current, ladderLengthFt: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{lengthOptions.map((length) => (
								<option key={length} value={length}>
									{length} ft
								</option>
							))}
						</select>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Manufacturer</span>
						<input
							value={formValues.manufacturer}
							onChange={(event) => setFormValues((current) => ({ ...current, manufacturer: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Model</span>
						<input
							value={formValues.model}
							onChange={(event) => setFormValues((current) => ({ ...current, model: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Serial Number</span>
						<input
							value={formValues.serialNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, serialNumber: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">In-Service Date</span>
						<input
							type="date"
							value={formValues.inServiceDate}
							onChange={(event) => setFormValues((current) => ({ ...current, inServiceDate: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Status *</span>
						<select
							value={formValues.status}
							onChange={(event) =>
								setFormValues((current) => ({
									...current,
									status: STATUS_OPTIONS.includes(event.target.value as GroundLadderFormValues["status"])
										? (event.target.value as GroundLadderFormValues["status"])
										: "Unassigned",
									assignmentType: event.target.value === "In Service" ? current.assignmentType || "Unassigned" : current.assignmentType,
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{STATUS_OPTIONS.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</label>

					{formValues.status === "In Service" ? (
						<div className="md:col-span-2 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Initial Assignment</p>
							<div className="mt-3 grid gap-3 md:grid-cols-2">
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type</span>
									<select
										value={formValues.assignmentType}
										onChange={(event) =>
											setFormValues((current) => ({
												...current,
												assignmentType: event.target.value === "Station" || event.target.value === "Unassigned" ? event.target.value : "Apparatus",
												apparatusId: current.assignmentType === "Apparatus" && !event.target.value ? "" : current.apparatusId,
											}))
										}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									>
										<option value="Unassigned">Unassigned</option>
										<option value="Station">Station</option>
										<option value="Apparatus">Apparatus</option>
									</select>
								</label>

								{formValues.assignmentType === "Apparatus" ? (
									<label className="block">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Apparatus *</span>
										<select
											value={formValues.apparatusId}
											onChange={(event) => setFormValues((current) => ({ ...current, apparatusId: event.target.value }))}
											className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										>
											<option value="">Select apparatus</option>
											{apparatusOptions.map((option) => (
												<option key={option.id} value={option.id}>{option.label}</option>
											))}
										</select>
									</label>
								) : null}

								{formValues.assignmentType === "Station" ? (
									<label className="block md:col-span-2">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Station</span>
										<input
											value={formValues.stationName}
											onChange={(event) => setFormValues((current) => ({ ...current, stationName: event.target.value }))}
											placeholder="Station Supply"
											className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										/>
									</label>
								) : null}
							</div>
						</div>
					) : null}

					<label className="block md:col-span-2">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Notes</span>
						<textarea
							rows={3}
							value={formValues.notes}
							onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</div>

				<div className="mt-6 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						{mode === "edit" && onReportDeficiency ? (
							<button
								type="button"
								onClick={onReportDeficiency}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Report Deficiency
							</button>
						) : null}

						{mode === "edit" && canDelete && onDelete ? (
							<button
								type="button"
								onClick={onDelete}
								className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
							>
								Delete Ladder
							</button>
						) : null}
					</div>

					<div className="flex gap-2">
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
							onClick={() => onSave(formValues)}
							className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isSaving ? "Saving..." : "Save Ladder"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
