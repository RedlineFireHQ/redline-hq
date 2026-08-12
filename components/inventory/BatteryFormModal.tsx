"use client";

import { useEffect, useState } from "react";

export type BatteryFormValues = {
	batteryNumber: string;
	serialNumber: string;
	manufacturer: string;
	model: string;
	batteryType: string;
	compatibleEquipment: string;
	inServiceDate: string;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string;
};

export type BatteryInitialAssignmentValues = {
	assignmentType: "Unassigned" | "Apparatus" | "Station" | "Equipment";
	apparatusId: string;
	stationName: string;
	equipmentReference: string;
};

type BatteryApparatusOption = {
	id: string;
	label: string;
};

interface BatteryFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: BatteryFormValues;
	isSaving?: boolean;
	canDelete?: boolean;
	apparatusOptions?: BatteryApparatusOption[];
	onClose: () => void;
	onSave: (
		values: BatteryFormValues,
		initialAssignment?: BatteryInitialAssignmentValues,
	) => void;
	onRetire?: () => void;
	onDelete?: () => void;
	onReportDeficiency?: () => void;
}

const EMPTY_VALUES: BatteryFormValues = {
	batteryNumber: "",
	serialNumber: "",
	manufacturer: "",
	model: "",
	batteryType: "",
	compatibleEquipment: "",
	inServiceDate: "",
	status: "Unassigned",
	notes: "",
};

const EMPTY_INITIAL_ASSIGNMENT: BatteryInitialAssignmentValues = {
	assignmentType: "Unassigned",
	apparatusId: "",
	stationName: "",
	equipmentReference: "",
};

const STATUS_OPTIONS: BatteryFormValues["status"][] = [
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

export default function BatteryFormModal({
	isOpen,
	mode,
	initialValues,
	isSaving = false,
	canDelete = false,
	apparatusOptions = [],
	onClose,
	onSave,
	onRetire,
	onDelete,
	onReportDeficiency,
}: BatteryFormModalProps) {
	const [formValues, setFormValues] = useState<BatteryFormValues>(EMPTY_VALUES);
	const [initialAssignment, setInitialAssignment] = useState<BatteryInitialAssignmentValues>(
		EMPTY_INITIAL_ASSIGNMENT,
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				batteryNumber: initialValues.batteryNumber ?? "",
				serialNumber: initialValues.serialNumber ?? "",
				manufacturer: initialValues.manufacturer ?? "",
				model: initialValues.model ?? "",
				batteryType: initialValues.batteryType ?? "",
				compatibleEquipment: initialValues.compatibleEquipment ?? "",
				inServiceDate: initialValues.inServiceDate ?? "",
				status: initialValues.status ?? "Unassigned",
				notes: initialValues.notes ?? "",
			});
			setInitialAssignment(EMPTY_INITIAL_ASSIGNMENT);
			return;
		}

		setFormValues(EMPTY_VALUES);
		setInitialAssignment(EMPTY_INITIAL_ASSIGNMENT);
	}, [
		initialValues?.batteryNumber,
		initialValues?.serialNumber,
		initialValues?.manufacturer,
		initialValues?.model,
		initialValues?.batteryType,
		initialValues?.compatibleEquipment,
		initialValues?.inServiceDate,
		initialValues?.status,
		initialValues?.notes,
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
						<h3 className="text-xl font-black text-white">{mode === "add" ? "Add Battery" : "Edit Battery"}</h3>
						<p className="mt-1 text-sm text-neutral-400">Track battery identity, assignment, and accountability status.</p>
					</div>
					<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(formValues.status)}`}>
						{formValues.status}
					</span>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Battery Number / Asset Number *</span>
						<input
							value={formValues.batteryNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, batteryNumber: event.target.value }))}
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
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Battery Platform / Type</span>
						<input
							value={formValues.batteryType}
							onChange={(event) => setFormValues((current) => ({ ...current, batteryType: event.target.value }))}
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
									status: STATUS_OPTIONS.includes(event.target.value as BatteryFormValues["status"])
										? (event.target.value as BatteryFormValues["status"])
										: "Unassigned",
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
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Compatible Equipment</span>
						<input
							value={formValues.compatibleEquipment}
							onChange={(event) => setFormValues((current) => ({ ...current, compatibleEquipment: event.target.value }))}
							placeholder="Radio pack battery, thermal camera"
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
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
							<p className="mt-1 text-xs text-neutral-500">Optionally assign this battery while creating it.</p>

							<div className="mt-4 grid gap-3 md:grid-cols-2">
								<label className="block md:col-span-2">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Assignment Type</span>
									<select
										value={initialAssignment.assignmentType}
										onChange={(event) => {
											const nextType =
												event.target.value === "Apparatus" ||
												event.target.value === "Station" ||
												event.target.value === "Equipment"
													? event.target.value
													: "Unassigned";

											setInitialAssignment((current) => ({
												...current,
												assignmentType: nextType,
												apparatusId: nextType === "Apparatus" ? current.apparatusId : "",
												stationName: nextType === "Station" ? current.stationName : "",
												equipmentReference: nextType === "Equipment" ? current.equipmentReference : "",
											}));
										}}
										className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
									>
										<option value="Unassigned">Unassigned</option>
										<option value="Apparatus">Apparatus</option>
										<option value="Station">Station</option>
										<option value="Equipment">Equipment</option>
									</select>
								</label>

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

								{initialAssignment.assignmentType === "Station" ? (
									<label className="block md:col-span-2">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Station *</span>
										<input
											value={initialAssignment.stationName}
											onChange={(event) =>
												setInitialAssignment((current) => ({
													...current,
													stationName: event.target.value,
												}))
											}
											placeholder="Station 1"
											className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										/>
									</label>
								) : null}

								{initialAssignment.assignmentType === "Equipment" ? (
									<label className="block md:col-span-2">
										<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">Equipment *</span>
										<input
											value={initialAssignment.equipmentReference}
											onChange={(event) =>
												setInitialAssignment((current) => ({
													...current,
													equipmentReference: event.target.value,
												}))
											}
											placeholder="Extrication Saw #1"
											className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
										/>
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
								Retire Battery
							</button>
						) : null}

						{mode === "edit" && canDelete && onDelete ? (
							<button
								type="button"
								onClick={onDelete}
								className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
							>
								Delete Battery
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
							{isSaving ? "Saving..." : mode === "add" ? "Save Battery" : "Update Battery"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
