"use client";

import { useEffect, useState } from "react";

export type GasMonitorCalibrationTesterOption = {
	id: string;
	label: string;
};

export interface GasMonitorCalibrationValues {
	calibrationDate: string;
	testerMode: "member" | "external" | "name-company";
	memberId: string;
	externalTesterName: string;
	externalTesterCompany: string;
	result: "Passed" | "Failed";
	notes: string;
}

interface GasMonitorCalibrationModalProps {
	isOpen: boolean;
	monitorNumber: string;
	testerOptions: GasMonitorCalibrationTesterOption[];
	isSaving?: boolean;
	errorMessage?: string | null;
	onClose: () => void;
	onSave: (values: GasMonitorCalibrationValues) => void;
}

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export default function GasMonitorCalibrationModal({
	isOpen,
	monitorNumber,
	testerOptions,
	isSaving = false,
	errorMessage = null,
	onClose,
	onSave,
}: GasMonitorCalibrationModalProps) {
	const [calibrationDate, setCalibrationDate] = useState(getTodayDate());
	const [selectedTesterOption, setSelectedTesterOption] = useState("");
	const [externalTesterName, setExternalTesterName] = useState("");
	const [externalTesterCompany, setExternalTesterCompany] = useState("");
	const [result, setResult] = useState<"Passed" | "Failed">("Passed");
	const [notes, setNotes] = useState("");

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setCalibrationDate(getTodayDate());
		setSelectedTesterOption("");
		setExternalTesterName("");
		setExternalTesterCompany("");
		setResult("Passed");
		setNotes("");
	}, [isOpen, monitorNumber]);

	const isExternal = selectedTesterOption === "external";
	const isNameCompany = selectedTesterOption === "name-company";

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<h3 className="text-xl font-black text-white">Record Calibration</h3>
				<p className="mt-1 text-sm text-neutral-400">Gas Monitor {monitorNumber}</p>

				{errorMessage ? (
					<div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
						{errorMessage}
					</div>
				) : null}

				<div className="mt-5 grid gap-4">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Calibration Date *</span>
						<input
							type="date"
							value={calibrationDate}
							onChange={(event) => setCalibrationDate(event.target.value)}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tested By *</span>
						<select
							value={selectedTesterOption}
							onChange={(event) => setSelectedTesterOption(event.target.value)}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="">Select department member</option>
							{testerOptions.map((option) => (
								<option key={option.id} value={option.id}>{option.label}</option>
							))}
							<option value="external">External Tester</option>
							<option value="name-company">Name / Company</option>
						</select>
					</label>

					{isExternal || isNameCompany ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Name *</span>
							<input
								value={externalTesterName}
								onChange={(event) => setExternalTesterName(event.target.value)}
								placeholder="External tester name"
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>
					) : null}

					{isNameCompany ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Company / Organization *</span>
							<input
								value={externalTesterCompany}
								onChange={(event) => setExternalTesterCompany(event.target.value)}
								placeholder="External company or organization"
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>
					) : null}

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Result *</span>
						<select
							value={result}
							onChange={(event) => setResult(event.target.value === "Failed" ? "Failed" : "Passed")}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="Passed">Passed</option>
							<option value="Failed">Failed</option>
						</select>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Notes</span>
						<textarea
							rows={3}
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</div>

				<div className="mt-6 flex justify-end gap-2">
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
						onClick={() =>
							onSave({
								calibrationDate,
								testerMode: isExternal ? "external" : isNameCompany ? "name-company" : "member",
								memberId: isExternal || isNameCompany ? "" : selectedTesterOption,
								externalTesterName,
								externalTesterCompany,
								result,
								notes,
							})
						}
						className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Saving..." : "Save Calibration"}
					</button>
				</div>
			</div>
		</div>
	);
}
