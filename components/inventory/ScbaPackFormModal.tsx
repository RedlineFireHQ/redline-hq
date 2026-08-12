"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface ScbaPackFormValues {
	packNumber: string;
	manufacturer: string;
	model: string;
	serialNumber: string;
	inServiceDate: string;
	notes: string;
}

export interface ScbaPackInitialFlowTestValues {
	lastFlowTestDate: string;
	tester: string;
	result: "Pass" | "Fail" | "";
	notes: string;
}

interface ScbaPackFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: ScbaPackFormValues;
	currentStatus?: string;
	lastFlowTestDate?: string | null;
	nextFlowTestDueDate?: string | null;
	isSaving?: boolean;
	onClose: () => void;
	onSave: (values: ScbaPackFormValues, initialFlowTest: ScbaPackInitialFlowTestValues | null) => void;
	onReportDeficiency?: () => void;
	onRecordFlowTest?: () => void;
	onViewFlowTestHistory?: () => void;
	onRetire?: () => void;
	onDelete?: () => void;
	canDelete?: boolean;
}

const EMPTY_VALUES: ScbaPackFormValues = {
	packNumber: "",
	manufacturer: "",
	model: "",
	serialNumber: "",
	inServiceDate: "",
	notes: "",
};

const EMPTY_INITIAL_FLOW_TEST: ScbaPackInitialFlowTestValues = {
	lastFlowTestDate: "",
	tester: "",
	result: "",
	notes: "",
};

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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

function addOneYearToIsoDate(value: string) {
	if (!value) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	parsed.setFullYear(parsed.getFullYear() + 1);
	return parsed.toISOString().split("T")[0];
}

function statusBadgeClasses(status: string) {
	if (status === "Ready") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Flow Test Due") {
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

export default function ScbaPackFormModal({
	isOpen,
	mode,
	initialValues,
	currentStatus = "Ready",
	lastFlowTestDate = null,
	nextFlowTestDueDate = null,
	isSaving = false,
	onClose,
	onSave,
	onReportDeficiency,
	onRecordFlowTest,
	onViewFlowTestHistory,
	onRetire,
	onDelete,
	canDelete = false,
}: ScbaPackFormModalProps) {
	const [formValues, setFormValues] = useState<ScbaPackFormValues>({
		...EMPTY_VALUES,
		inServiceDate: getTodayDate(),
	});
	const [initialFlowTestValues, setInitialFlowTestValues] = useState<ScbaPackInitialFlowTestValues>(
		EMPTY_INITIAL_FLOW_TEST,
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				packNumber: initialValues.packNumber ?? "",
				manufacturer: initialValues.manufacturer ?? "",
				model: initialValues.model ?? "",
				serialNumber: initialValues.serialNumber ?? "",
				inServiceDate: initialValues.inServiceDate ?? "",
				notes: initialValues.notes ?? "",
			});
			setInitialFlowTestValues(EMPTY_INITIAL_FLOW_TEST);
			return;
		}

		setFormValues({
			...EMPTY_VALUES,
			inServiceDate: getTodayDate(),
		});
		setInitialFlowTestValues(EMPTY_INITIAL_FLOW_TEST);
	}, [
		isOpen,
		mode,
		initialValues?.packNumber,
		initialValues?.manufacturer,
		initialValues?.model,
		initialValues?.serialNumber,
		initialValues?.inServiceDate,
		initialValues?.notes,
	]);

	const previewLastFlowTestDate =
		mode === "add" && initialFlowTestValues.lastFlowTestDate.trim().length > 0
			? initialFlowTestValues.lastFlowTestDate.trim()
			: lastFlowTestDate;
	const previewNextFlowTestDueDate =
		mode === "add" && initialFlowTestValues.lastFlowTestDate.trim().length > 0
			? addOneYearToIsoDate(initialFlowTestValues.lastFlowTestDate.trim())
			: nextFlowTestDueDate;

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-xl font-black text-white">{mode === "add" ? "Add SCBA Pack" : "Edit SCBA Pack"}</h3>
						<p className="mt-1 text-sm text-neutral-400">Manage SCBA pack profile, service dates, and testing workflow.</p>
					</div>
					<span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClasses(currentStatus)}`}>
						{currentStatus}
					</span>
				</div>

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<FormField label="Pack Number" required>
						<input
							value={formValues.packNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, packNumber: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="In-Service Date">
						<input
							type="date"
							value={formValues.inServiceDate}
							onChange={(event) => setFormValues((current) => ({ ...current, inServiceDate: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Manufacturer">
						<input
							value={formValues.manufacturer}
							onChange={(event) => setFormValues((current) => ({ ...current, manufacturer: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Model">
						<input
							value={formValues.model}
							onChange={(event) => setFormValues((current) => ({ ...current, model: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Serial Number">
						<input
							value={formValues.serialNumber}
							onChange={(event) => setFormValues((current) => ({ ...current, serialNumber: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Notes" fullWidth>
						<textarea
							rows={3}
							value={formValues.notes}
							onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>
				</div>

				{mode === "add" ? (
					<div className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">Initial Flow Test (Optional)</p>
						<p className="mt-1 text-xs text-neutral-500">
							If provided, Redline will record one initial flow-test history entry when this pack is created.
						</p>

						<div className="mt-4 grid gap-3 md:grid-cols-2">
							<FormField label="Last Flow Test Date">
								<input
									type="date"
									value={initialFlowTestValues.lastFlowTestDate}
									onChange={(event) =>
										setInitialFlowTestValues((current) => ({
											...current,
											lastFlowTestDate: event.target.value,
										}))
									}
									className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</FormField>

							<FormField
								label="Tester"
								required={initialFlowTestValues.lastFlowTestDate.trim().length > 0}
							>
								<input
									value={initialFlowTestValues.tester}
									onChange={(event) =>
										setInitialFlowTestValues((current) => ({
											...current,
											tester: event.target.value,
										}))
									}
									placeholder="Name of tester"
									className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</FormField>

							<FormField
								label="Result"
								required={initialFlowTestValues.lastFlowTestDate.trim().length > 0}
							>
								<select
									value={initialFlowTestValues.result}
									onChange={(event) =>
										setInitialFlowTestValues((current) => ({
											...current,
											result: event.target.value === "Pass" || event.target.value === "Fail" ? event.target.value : "",
										}))
									}
									className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								>
									<option value="">Select result</option>
									<option value="Pass">Pass</option>
									<option value="Fail">Fail</option>
								</select>
							</FormField>

							<FormField label="Flow Test Notes" fullWidth>
								<textarea
									rows={2}
									value={initialFlowTestValues.notes}
									onChange={(event) =>
										setInitialFlowTestValues((current) => ({
											...current,
											notes: event.target.value,
										}))
									}
									className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</FormField>
						</div>
					</div>
				) : null}

				<div className="mt-5 grid gap-3 md:grid-cols-2">
					<PreviewCard label="Last Flow Test" value={formatDate(previewLastFlowTestDate)} />
					<PreviewCard label="Next Flow Test Due" value={formatDate(previewNextFlowTestDueDate)} />
				</div>

				<div className="mt-6 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						{mode === "edit" && onRecordFlowTest ? (
							<button
								type="button"
								onClick={onRecordFlowTest}
								className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
							>
								Record Flow Test
							</button>
						) : null}

						{mode === "edit" && onViewFlowTestHistory ? (
							<button
								type="button"
								onClick={onViewFlowTestHistory}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								View Flow Test History
							</button>
						) : null}

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
								Retire Pack
							</button>
						) : null}

						{mode === "edit" && canDelete && onDelete ? (
							<button
								type="button"
								onClick={onDelete}
								className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
							>
								Delete Pack
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
							onClick={() => onSave(formValues, mode === "add" ? initialFlowTestValues : null)}
							className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isSaving ? "Saving..." : "Save Pack"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
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
