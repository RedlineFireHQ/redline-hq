"use client";

import { useEffect, useState } from "react";

export type PortableRadioFormValues = {
	radioNumber: string;
	serialNumber: string;
	manufacturer: string;
	model: string;
	radioUnitId: string;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string;
};

export type PortableRadioInitialAssignmentValues = {
	assignmentType: "Unassigned" | "Member" | "Apparatus";
	memberId: string;
	apparatusId: string;
};

type PortableRadioMemberOption = {
	id: string;
	label: string;
};

type PortableRadioApparatusOption = {
	id: string;
	label: string;
};

interface PortableRadioFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: PortableRadioFormValues;
	isSaving?: boolean;
	canDelete?: boolean;
	memberOptions?: PortableRadioMemberOption[];
	apparatusOptions?: PortableRadioApparatusOption[];
	onClose: () => void;
	onSave: (
		values: PortableRadioFormValues,
		initialAssignment?: PortableRadioInitialAssignmentValues,
	) => void;
	onRetire?: () => void;
	onDelete?: () => void;
	onReportDeficiency?: () => void;
}

const EMPTY_VALUES: PortableRadioFormValues = {
	radioNumber: "",
	serialNumber: "",
	manufacturer: "",
	model: "",
	radioUnitId: "",
	status: "In Service",
	notes: "",
};

const EMPTY_INITIAL_ASSIGNMENT: PortableRadioInitialAssignmentValues = {
	assignmentType: "Unassigned",
	memberId: "",
	apparatusId: "",
};

const STATUS_OPTIONS: PortableRadioFormValues["status"][] = [
	"In Service",
	"Unassigned",
	"Out of Service",
	"Lost",
	"Stolen",
	"Retired",
];

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

export default function PortableRadioFormModal({
	isOpen,
	mode,
	initialValues,
	isSaving = false,
	canDelete = false,
	memberOptions = [],
	apparatusOptions = [],
	onClose,
	onSave,
	onRetire,
	onDelete,
	onReportDeficiency,
}: PortableRadioFormModalProps) {
	const [formValues, setFormValues] = useState<PortableRadioFormValues>(EMPTY_VALUES);
	const [initialAssignment, setInitialAssignment] = useState<PortableRadioInitialAssignmentValues>(
		EMPTY_INITIAL_ASSIGNMENT,
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				radioNumber: initialValues.radioNumber ?? "",
				serialNumber: initialValues.serialNumber ?? "",
				manufacturer: initialValues.manufacturer ?? "",
				model: initialValues.model ?? "",
				radioUnitId: initialValues.radioUnitId ?? "",
				status: initialValues.status ?? "In Service",
				notes: initialValues.notes ?? "",
			});
			setInitialAssignment(EMPTY_INITIAL_ASSIGNMENT);
			return;
		}

		setFormValues(EMPTY_VALUES);
		setInitialAssignment(EMPTY_INITIAL_ASSIGNMENT);
	}, [
		initialValues?.manufacturer,
		initialValues?.model,
		initialValues?.notes,
		initialValues?.radioNumber,
		initialValues?.radioUnitId,
		initialValues?.serialNumber,
		initialValues?.status,
		isOpen,
		mode,
	]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-xl font-black text-white">{mode === "add" ? "Add Portable Radio" : "Edit Portable Radio"}</h3>
						<p className="mt-1 text-sm text-neutral-400">Track portable radio identity, accountability status, and assignment readiness.</p>
					</div>
					<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(formValues.status)}`}>
						{formValues.status}
					</span>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Radio Number *</span>
						<input
							value={formValues.radioNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, radioNumber: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Serial Number *</span>
						<input
							value={formValues.serialNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, serialNumber: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
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
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Radio / Unit ID</span>
						<input
							value={formValues.radioUnitId}
							onChange={(event) => setFormValues((current) => ({ ...current, radioUnitId: event.target.value }))}
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
									status: STATUS_OPTIONS.includes(event.target.value as PortableRadioFormValues["status"])
										? (event.target.value as PortableRadioFormValues["status"])
										: "In Service",
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

					<label className="block md:col-span-2">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Notes</span>
						<textarea
							rows={3}
							value={formValues.notes}
							onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					{mode === "add" ? (
						<div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4 md:col-span-2">
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Initial Assignment</p>
							<div className="mt-3 grid gap-3 md:grid-cols-2">
								<label className="block md:col-span-2">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type</span>
									<select
										value={initialAssignment.assignmentType}
										onChange={(event) => {
											const nextType =
												event.target.value === "Member" || event.target.value === "Apparatus" || event.target.value === "Unassigned"
													? (event.target.value as PortableRadioInitialAssignmentValues["assignmentType"])
													: "Unassigned";
											setInitialAssignment((current) => ({
												...current,
												assignmentType: nextType,
												memberId: nextType === "Member" ? current.memberId : "",
												apparatusId: nextType === "Apparatus" ? current.apparatusId : "",
											}));
										}}
										className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									>
										<option value="Unassigned">Unassigned</option>
										<option value="Member">Department Member</option>
										<option value="Apparatus">Apparatus</option>
									</select>
								</label>

								{initialAssignment.assignmentType === "Member" ? (
									<label className="block md:col-span-2">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Department Member *</span>
										<select
											value={initialAssignment.memberId}
											onChange={(event) => setInitialAssignment((current) => ({ ...current, memberId: event.target.value }))}
											className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										>
											<option value="">Select department member</option>
											{memberOptions.map((member) => (
												<option key={member.id} value={member.id}>
													{member.label}
												</option>
											))}
										</select>
									</label>
								) : null}

								{initialAssignment.assignmentType === "Apparatus" ? (
									<label className="block md:col-span-2">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Apparatus *</span>
										<select
											value={initialAssignment.apparatusId}
											onChange={(event) => setInitialAssignment((current) => ({ ...current, apparatusId: event.target.value }))}
											className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										>
											<option value="">Select apparatus</option>
											{apparatusOptions.map((apparatus) => (
												<option key={apparatus.id} value={apparatus.id}>
													{apparatus.label}
												</option>
											))}
										</select>
									</label>
								) : null}
							</div>
						</div>
					) : null}
				</div>

				<div className="mt-6 flex items-center justify-between">
					<div>
						{mode === "edit" && onReportDeficiency ? (
							<button type="button" onClick={onReportDeficiency} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Report Deficiency</button>
						) : null}
					</div>
					<div className="flex items-center gap-3">
						{mode === "edit" && canDelete && onDelete ? (
							<button type="button" onClick={onDelete} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20">Delete</button>
						) : null}
						{mode === "edit" && onRetire ? (
							<button type="button" onClick={onRetire} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Retire</button>
						) : null}
						<button type="button" onClick={onClose} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">Cancel</button>
						<button
							type="button"
							onClick={() => onSave(formValues, initialAssignment)}
							disabled={isSaving}
							className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSaving ? "Saving..." : mode === "add" ? "Add Radio" : "Save Changes"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
