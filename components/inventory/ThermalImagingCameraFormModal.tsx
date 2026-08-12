"use client";

import { useEffect, useState } from "react";

export type ThermalImagingCameraFormValues = {
	cameraNumber: string;
	serialNumber: string;
	manufacturer: string;
	model: string;
	cameraUnitId: string;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string;
};

export type ThermalImagingCameraInitialAssignmentValues = {
	assignmentType: "Unassigned" | "Member" | "Apparatus";
	memberId: string;
	apparatusId: string;
};

type ThermalImagingCameraMemberOption = {
	id: string;
	label: string;
};

type ThermalImagingCameraApparatusOption = {
	id: string;
	label: string;
};

interface ThermalImagingCameraFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: ThermalImagingCameraFormValues;
	isSaving?: boolean;
	canDelete?: boolean;
	memberOptions?: ThermalImagingCameraMemberOption[];
	apparatusOptions?: ThermalImagingCameraApparatusOption[];
	onClose: () => void;
	onSave: (
		values: ThermalImagingCameraFormValues,
		initialAssignment?: ThermalImagingCameraInitialAssignmentValues,
	) => void;
	onRetire?: () => void;
	onDelete?: () => void;
	onReportDeficiency?: () => void;
}

const EMPTY_VALUES: ThermalImagingCameraFormValues = {
	cameraNumber: "",
	serialNumber: "",
	manufacturer: "",
	model: "",
	cameraUnitId: "",
	status: "In Service",
	notes: "",
};

const EMPTY_INITIAL_ASSIGNMENT: ThermalImagingCameraInitialAssignmentValues = {
	assignmentType: "Unassigned",
	memberId: "",
	apparatusId: "",
};

const STATUS_OPTIONS: ThermalImagingCameraFormValues["status"][] = [
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

export default function ThermalImagingCameraFormModal({
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
}: ThermalImagingCameraFormModalProps) {
	const [formValues, setFormValues] = useState<ThermalImagingCameraFormValues>(EMPTY_VALUES);
	const [initialAssignment, setInitialAssignment] = useState<ThermalImagingCameraInitialAssignmentValues>(
		EMPTY_INITIAL_ASSIGNMENT,
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				cameraNumber: initialValues.cameraNumber ?? "",
				serialNumber: initialValues.serialNumber ?? "",
				manufacturer: initialValues.manufacturer ?? "",
				model: initialValues.model ?? "",
				cameraUnitId: initialValues.cameraUnitId ?? "",
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
		initialValues?.cameraNumber,
		initialValues?.cameraUnitId,
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
						<h3 className="text-xl font-black text-white">{mode === "add" ? "Add Thermal Imaging Camera" : "Edit Thermal Imaging Camera"}</h3>
						<p className="mt-1 text-sm text-neutral-400">Track thermal imaging camera identity, accountability status, and assignment readiness.</p>
					</div>
					<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(formValues.status)}`}>
						{formValues.status}
					</span>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Camera Number *</span>
						<input
							value={formValues.cameraNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, cameraNumber: event.target.value }))}
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
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Camera / Unit ID</span>
						<input
							value={formValues.cameraUnitId}
							onChange={(event) => setFormValues((current) => ({ ...current, cameraUnitId: event.target.value }))}
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
									status: STATUS_OPTIONS.includes(event.target.value as ThermalImagingCameraFormValues["status"])
										? (event.target.value as ThermalImagingCameraFormValues["status"])
										: "In Service",
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{STATUS_OPTIONS.map((status) => (
								<option key={status} value={status}>{status}</option>
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
							<p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">Initial Assignment</p>
							<p className="mt-1 text-xs text-neutral-500">Optionally assign this camera while creating it.</p>

							<div className="mt-4 grid gap-3 md:grid-cols-2">
								<label className="block md:col-span-2">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type</span>
									<select
										value={initialAssignment.assignmentType}
										onChange={(event) => {
											const nextType =
												event.target.value === "Member" ||
												event.target.value === "Apparatus"
													? event.target.value
													: "Unassigned";

											setInitialAssignment((current) => ({
												...current,
												assignmentType: nextType,
												memberId: nextType === "Member" ? current.memberId : "",
												apparatusId: nextType === "Apparatus" ? current.apparatusId : "",
											}));
										}}
										className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
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
											onChange={(event) =>
												setInitialAssignment((current) => ({
													...current,
													memberId: event.target.value,
												}))
											}
											className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										>
											<option value="">Select department member</option>
											{memberOptions.map((member) => (
												<option key={member.id} value={member.id}>{member.label}</option>
											))}
										</select>
									</label>
								) : null}

								{initialAssignment.assignmentType === "Apparatus" ? (
									<label className="block md:col-span-2">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Apparatus *</span>
										<select
											value={initialAssignment.apparatusId}
											onChange={(event) =>
												setInitialAssignment((current) => ({
													...current,
													apparatusId: event.target.value,
												}))
											}
											className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										>
											<option value="">Select apparatus</option>
											{apparatusOptions.map((apparatus) => (
												<option key={apparatus.id} value={apparatus.id}>{apparatus.label}</option>
											))}
										</select>
									</label>
								) : null}
							</div>
						</div>
					) : null}
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

						{mode === "edit" && onRetire ? (
							<button
								type="button"
								onClick={onRetire}
								className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
							>
								Retire Camera
							</button>
						) : null}

						{mode === "edit" && canDelete && onDelete ? (
							<button
								type="button"
								onClick={onDelete}
								className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
							>
								Delete Camera
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
							onClick={() => onSave(formValues, mode === "add" ? initialAssignment : undefined)}
							className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSaving ? "Saving..." : mode === "add" ? "Save Camera" : "Update Camera"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
