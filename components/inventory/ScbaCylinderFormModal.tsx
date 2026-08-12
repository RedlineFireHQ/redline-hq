"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface ScbaCylinderFormValues {
	cylinderNumber: string;
	cylinderType: "Composite" | "Steel";
	inServiceDate: string;
	lastHydrostaticTestDate: string;
	manufacturer: string;
	model: string;
	serialNumber: string;
	notes: string;
}

interface ScbaCylinderFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: ScbaCylinderFormValues;
	currentStatus?: string;
	isSaving?: boolean;
	onClose: () => void;
	onSave: (values: ScbaCylinderFormValues) => void;
	onReportDeficiency?: () => void;
	onRetire?: () => void;
	onDelete?: () => void;
	canDelete?: boolean;
}

const EMPTY_VALUES: ScbaCylinderFormValues = {
	cylinderNumber: "",
	cylinderType: "Composite",
	inServiceDate: "",
	lastHydrostaticTestDate: "",
	manufacturer: "",
	model: "",
	serialNumber: "",
	notes: "",
};

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function addYearsToIsoDate(value: string, years: number) {
	if (!value) {
		return "";
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return "";
	}

	parsed.setFullYear(parsed.getFullYear() + years);
	return parsed.toISOString().split("T")[0];
}

function formatDate(value: string) {
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

function deriveNextHydroDate(values: ScbaCylinderFormValues) {
	if (!values.lastHydrostaticTestDate) {
		return "";
	}

	return addYearsToIsoDate(values.lastHydrostaticTestDate, values.cylinderType === "Composite" ? 3 : 5);
}

function deriveServiceLifeEnd(values: ScbaCylinderFormValues) {
	if (values.cylinderType !== "Composite" || !values.inServiceDate) {
		return "";
	}

	return addYearsToIsoDate(values.inServiceDate, 15);
}

function isOnOrBeforeToday(value: string) {
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

function deriveProjectedStatus(values: ScbaCylinderFormValues, currentStatus?: string) {
	if (currentStatus === "Out of Service" || currentStatus === "Retired") {
		return currentStatus;
	}

	const nextHydroDate = deriveNextHydroDate(values);
	if (!nextHydroDate) {
		return "Ready";
	}

	return isOnOrBeforeToday(nextHydroDate) ? "Testing Due" : "Ready";
}

export default function ScbaCylinderFormModal({
	isOpen,
	mode,
	initialValues,
	currentStatus,
	isSaving = false,
	onClose,
	onSave,
	onReportDeficiency,
	onRetire,
	onDelete,
	canDelete = false,
}: ScbaCylinderFormModalProps) {
	const [formValues, setFormValues] = useState<ScbaCylinderFormValues>({
		...EMPTY_VALUES,
		inServiceDate: getTodayDate(),
	});

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				cylinderNumber: initialValues.cylinderNumber ?? "",
				cylinderType: initialValues.cylinderType ?? "Composite",
				inServiceDate: initialValues.inServiceDate ?? "",
				lastHydrostaticTestDate: initialValues.lastHydrostaticTestDate ?? "",
				manufacturer: initialValues.manufacturer ?? "",
				model: initialValues.model ?? "",
				serialNumber: initialValues.serialNumber ?? "",
				notes: initialValues.notes ?? "",
			});
			return;
		}

		if (mode === "add") {
			setFormValues({
				...EMPTY_VALUES,
				inServiceDate: getTodayDate(),
			});
		}
	}, [
		isOpen,
		mode,
		initialValues?.cylinderNumber,
		initialValues?.cylinderType,
		initialValues?.inServiceDate,
		initialValues?.lastHydrostaticTestDate,
		initialValues?.manufacturer,
		initialValues?.model,
		initialValues?.serialNumber,
		initialValues?.notes,
	]);

	const projectedNextHydroDate = useMemo(() => deriveNextHydroDate(formValues), [formValues]);
	const projectedServiceLifeEndDate = useMemo(() => deriveServiceLifeEnd(formValues), [formValues]);
	const projectedStatus = useMemo(
		() => deriveProjectedStatus(formValues, currentStatus),
		[formValues, currentStatus],
	);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-xl font-black text-white">{mode === "add" ? "Add Cylinder" : "Edit Cylinder"}</h3>
						<p className="mt-1 text-sm text-neutral-400">
							Track SCBA cylinder dates, identifiers, and inspection context.
						</p>
					</div>
					<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(projectedStatus)}`}>
						{projectedStatus}
					</span>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<FormField label="Cylinder Number" required>
						<input
							value={formValues.cylinderNumber}
							onChange={(event) =>
								setFormValues((current) => ({ ...current, cylinderNumber: event.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Cylinder Type" required>
						<select
							value={formValues.cylinderType}
							onChange={(event) =>
								setFormValues((current) => ({
									...current,
									cylinderType: event.target.value === "Steel" ? "Steel" : "Composite",
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="Composite">Composite</option>
							<option value="Steel">Steel</option>
						</select>
					</FormField>

					<FormField label="In-Service Date" required>
						<input
							type="date"
							value={formValues.inServiceDate}
							onChange={(event) =>
								setFormValues((current) => ({ ...current, inServiceDate: event.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Last Hydrostatic Test Date">
						<input
							type="date"
							value={formValues.lastHydrostaticTestDate}
							onChange={(event) =>
								setFormValues((current) => ({
									...current,
									lastHydrostaticTestDate: event.target.value,
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Manufacturer">
						<input
							value={formValues.manufacturer}
							onChange={(event) =>
								setFormValues((current) => ({ ...current, manufacturer: event.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Model">
						<input
							value={formValues.model}
							onChange={(event) =>
								setFormValues((current) => ({ ...current, model: event.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Serial Number">
						<input
							value={formValues.serialNumber}
							onChange={(event) =>
								setFormValues((current) => ({ ...current, serialNumber: event.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Notes" fullWidth>
						<textarea
							rows={3}
							value={formValues.notes}
							onChange={(event) =>
								setFormValues((current) => ({ ...current, notes: event.target.value }))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-3">
					<PreviewCard
						label="Next Hydrostatic Test Due"
						value={projectedNextHydroDate ? formatDate(projectedNextHydroDate) : "Pending"}
					/>
					<PreviewCard
						label="Service Life End"
						value={
							projectedServiceLifeEndDate
								? formatDate(projectedServiceLifeEndDate)
								: formValues.cylinderType === "Steel"
									? "No steel limit established"
									: "Pending"
						}
					/>
					<PreviewCard label="Projected Status" value={projectedStatus} />
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
								Retire Cylinder
							</button>
						) : null}

						{mode === "edit" && canDelete && onDelete ? (
							<button
								type="button"
								onClick={onDelete}
								className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
							>
								Delete Cylinder
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
							{isSaving ? "Saving..." : "Save Cylinder"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
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

function FormField({
	label,
	required = false,
	fullWidth = false,
	children,
}: {
	label: string;
	required?: boolean;
	fullWidth?: boolean;
	children: ReactNode;
}) {
	return (
		<div className={fullWidth ? "md:col-span-2" : ""}>
			<label className="mb-1.5 block text-xs font-semibold text-neutral-300">
				{label}
				{required ? <span className="ml-1 text-red-400">*</span> : null}
			</label>
			{children}
		</div>
	);
}

function PreviewCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
			<p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">{label}</p>
			<p className="mt-2 text-sm font-semibold text-white">{value}</p>
		</div>
	);
}
