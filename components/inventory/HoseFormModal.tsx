"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface HoseFormValues {
	inventoryNumber: string;
	hoseSize: string;
	length: string;
	inServiceDate: string;
	boosterReelHose: boolean;
}

interface HoseFormModalProps {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: HoseFormValues;
	onClose: () => void;
	onSave: (values: HoseFormValues) => void;
	onRetire?: () => void;
	onReportDeficiency?: () => void;
}

const EXTENDED_HOSE_SIZE_OPTIONS = [
	'1"',
	'1.5"',
	'1.75"',
	'2"',
	'2.5"',
	'3"',
	'4"',
	'5"',
	'6"',
];

const LENGTH_OPTIONS = ["25 ft", "50 ft", "100 ft"];

const getTodayDate = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
};

const EMPTY_VALUES: HoseFormValues = {
	inventoryNumber: "",
	hoseSize: '1"',
	length: "25 ft",
	inServiceDate: "",
	boosterReelHose: false,
};

export default function HoseFormModal({
	isOpen,
	mode,
	initialValues,
	onClose,
	onSave,
	onRetire,
	onReportDeficiency,
}: HoseFormModalProps) {
	const [formValues, setFormValues] = useState<HoseFormValues>({
		...EMPTY_VALUES,
		inServiceDate: getTodayDate(),
	});

	/*
	 * IMPORTANT:
	 * Only reinitialize the form when the actual values being edited change.
	 *
	 * The parent creates a new initialValues object on every render.
	 * Depending directly on [initialValues] caused the form to reset while
	 * the user was editing it, which is why the date appeared to require
	 * being clicked before changes would save.
	 */
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode === "edit" && initialValues) {
			setFormValues({
				inventoryNumber: initialValues.inventoryNumber ?? "",
				hoseSize: initialValues.hoseSize ?? '1"',
				length: initialValues.length ?? "25 ft",
				inServiceDate: initialValues.inServiceDate ?? "",
				boosterReelHose: Boolean(initialValues.boosterReelHose),
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
		initialValues?.inventoryNumber,
		initialValues?.hoseSize,
		initialValues?.length,
		initialValues?.inServiceDate,
		initialValues?.boosterReelHose,
	]);

	if (!isOpen) {
		return null;
	}

	const displayLength = formValues.boosterReelHose
		? "N/A (Booster Reel Hose)"
		: formValues.length;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
			<div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="flex items-center justify-between">
					<h3 className="text-xl font-black text-white">
						{mode === "add" ? "Add Hose" : "Edit Hose"}
					</h3>
				</div>

				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<FormField label="Inventory Number">
						<input
							value={formValues.inventoryNumber}
							onChange={(event) => {
								setFormValues((current) => ({
									...current,
									inventoryNumber: event.target.value,
								}));
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Hose Size">
						<select
							value={formValues.hoseSize}
							onChange={(event) => {
								setFormValues((current) => ({
									...current,
									hoseSize: event.target.value,
								}));
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{EXTENDED_HOSE_SIZE_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</FormField>

					<FormField label="Length">
						<select
							value={displayLength}
							disabled={formValues.boosterReelHose}
							onChange={(event) => {
								setFormValues((current) => ({
									...current,
									length: event.target.value,
								}));
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-70 focus:border-red-500/50 focus:outline-none"
						>
							{formValues.boosterReelHose ? (
								<option value="N/A (Booster Reel Hose)">
									N/A (Booster Reel Hose)
								</option>
							) : (
								LENGTH_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))
							)}
						</select>
					</FormField>

					<FormField label="In Service Date">
						<input
							type="date"
							value={formValues.inServiceDate}
							onChange={(event) => {
								setFormValues((current) => ({
									...current,
									inServiceDate: event.target.value,
								}));
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>
				</div>

				<label className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-300">
					<input
						type="checkbox"
						checked={formValues.boosterReelHose}
						onChange={(event) => {
							setFormValues((current) => ({
								...current,
								boosterReelHose: event.target.checked,
								length: event.target.checked ? "N/A (Booster Reel Hose)" : "25 ft",
							}));
						}}
						className="h-4 w-4 rounded border-white/20 bg-[#1b1b1b]"
					/>
					Booster Reel Hose
				</label>

				<div className="mt-6 flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						{mode === "edit" && onReportDeficiency && (
							<button
								type="button"
								onClick={onReportDeficiency}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Report Deficiency
							</button>
						)}

						{mode === "edit" && onRetire && (
							<button
								type="button"
								onClick={onRetire}
								className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
							>
								Retire Hose
							</button>
						)}
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
							onClick={() => onSave(formValues)}
							className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
						>
							Save Hose
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function FormField({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div>
			<label className="mb-1.5 block text-xs font-semibold text-neutral-300">
				{label}
			</label>
			{children}
		</div>
	);
}