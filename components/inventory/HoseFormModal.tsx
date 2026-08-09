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

const EXTENDED_HOSE_SIZE_OPTIONS = ["1\"", "1.5\"", "1.75\"", "2\"", "2.5\"", "3\"", "4\"", "5\"", "6\""];
const LENGTH_OPTIONS = ["25 ft", "50 ft", "100 ft"];

const EMPTY_VALUES: HoseFormValues = {
	inventoryNumber: "",
	hoseSize: "1\"",
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
	const [formValues, setFormValues] = useState<HoseFormValues>(() => ({
		...EMPTY_VALUES,
		inServiceDate: new Date().toISOString().split("T")[0],
	}));

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (mode !== "edit" || !initialValues) {
			return;
		}

		const nextValues = initialValues;
		console.log("setFormValues:open-initial-or-empty", nextValues);
		setFormValues(nextValues);
	}, [initialValues, isOpen, mode]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		console.log("Hose form state updated", {
			inventoryNumber: formValues.inventoryNumber,
			hoseSize: formValues.hoseSize,
			length: formValues.length,
			inServiceDate: formValues.inServiceDate,
			boosterReel: formValues.boosterReelHose,
		});
		console.log("1 - Modal state", formValues);
	}, [formValues, isOpen]);

	if (!isOpen) {
		return null;
	}

	const displayLength = formValues.boosterReelHose ? "N/A (Booster Reel Hose)" : formValues.length;

	const updateInServiceDate = (nextValue: string) => {
		console.log("In Service Date changed", nextValue);
		setFormValues((current) => {
			const nextValues = {
				...current,
				inServiceDate: nextValue,
			};
			console.log("setFormValues:updateInServiceDate", nextValues);
			return nextValues;
		});
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
			<div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="flex items-center justify-between">
					<h3 className="text-xl font-black text-white">{mode === "add" ? "Add Hose" : "Edit Hose"}</h3>
				</div>

				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<FormField label="Inventory Number">
						<input
							value={formValues.inventoryNumber}
							onChange={(event) => {
								console.log("Inventory Number changed", event.target.value);
								setFormValues((current) => {
									const nextValues = {
										...current,
										inventoryNumber: event.target.value,
									};
									console.log("setFormValues:inventoryNumber-onChange", nextValues);
									return nextValues;
								});
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>

					<FormField label="Hose Size">
						<select
							value={formValues.hoseSize}
							onChange={(event) => {
								console.log("Hose Size changed", event.target.value);
								setFormValues((current) => {
									const nextValues = {
										...current,
										hoseSize: event.target.value,
									};
									console.log("setFormValues:hoseSize-onChange", nextValues);
									return nextValues;
								});
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
								console.log("Length changed", event.target.value);
								setFormValues((current) => {
									const nextValues = {
										...current,
										length: event.target.value,
									};
									console.log("setFormValues:length-onChange", nextValues);
									return nextValues;
								});
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-70 focus:border-red-500/50 focus:outline-none"
						>
							{formValues.boosterReelHose ? (
								<option value="N/A (Booster Reel Hose)">N/A (Booster Reel Hose)</option>
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
								console.log("In Service Date changed", event.target.value);
								setFormValues((current) => {
									const nextValues = {
										...current,
										inServiceDate: event.target.value,
									};
									console.log("setFormValues:inServiceDate-onChange", nextValues);
									return nextValues;
								});
							}}
							onInput={(event) => updateInServiceDate((event.target as HTMLInputElement).value)}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</FormField>
				</div>

				<label className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-300">
					<input
						type="checkbox"
						checked={formValues.boosterReelHose}
						onChange={(event) => {
							console.log("Booster Reel changed", event.target.checked);
							setFormValues((current) => {
								const nextValues = {
									...current,
									boosterReelHose: event.target.checked,
									length: event.target.checked ? "N/A (Booster Reel Hose)" : "25 ft",
								};
								console.log("setFormValues:boosterReel-onChange", nextValues);
								return nextValues;
							});
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
							onClick={() => {
								console.log("2 - Passing to onSave", formValues);
								onSave(formValues);
							}}
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

function FormField({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className="grid gap-1.5">
			<span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</span>
			{children}
		</label>
	);
}
