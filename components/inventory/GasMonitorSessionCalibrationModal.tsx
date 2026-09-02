"use client";

import { useEffect, useMemo, useState } from "react";

export type GasMonitorSessionResult = "Passed" | "Failed" | "";

export interface GasMonitorSessionCalibrationValues {
	calibrationDate: string;
	testerMode: "member" | "external" | "name-company";
	memberId: string;
	externalTesterName: string;
	externalTesterCompany: string;
	sessionNotes: string;
	monitorResults: Record<string, GasMonitorSessionResult>;
	monitorNotes: Record<string, string>;
}

type GasMonitorSessionRow = {
	id: string;
	monitorNumber: string;
	currentStatus: string;
	hasActiveDeficiency: boolean;
};

type GasMonitorTesterOption = {
	id: string;
	label: string;
};

interface GasMonitorSessionCalibrationModalProps {
	isOpen: boolean;
	monitors: GasMonitorSessionRow[];
	testerOptions: GasMonitorTesterOption[];
	isSaving?: boolean;
	errorMessage?: string | null;
	onClose: () => void;
	onSave: (values: GasMonitorSessionCalibrationValues) => void;
	onSaveAndReportDeficiencies?: (values: GasMonitorSessionCalibrationValues) => void;
}

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

	if (status === "Out of Service") {
		return "border-red-700/40 bg-red-900/20 text-red-300";
	}

	if (status === "Retired") {
		return "border-neutral-600/40 bg-neutral-800 text-neutral-300";
	}

	return "border-white/15 bg-neutral-900 text-neutral-200";
}

export default function GasMonitorSessionCalibrationModal({
	isOpen,
	monitors,
	testerOptions,
	isSaving = false,
	errorMessage = null,
	onClose,
	onSave,
	onSaveAndReportDeficiencies,
}: GasMonitorSessionCalibrationModalProps) {
	const [calibrationDate, setCalibrationDate] = useState(getTodayDate());
	const [selectedTesterOption, setSelectedTesterOption] = useState("");
	const [externalTesterName, setExternalTesterName] = useState("");
	const [externalTesterCompany, setExternalTesterCompany] = useState("");
	const [sessionNotes, setSessionNotes] = useState("");
	const [monitorResults, setMonitorResults] = useState<Record<string, GasMonitorSessionResult>>({});
	const [monitorNotes, setMonitorNotes] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setCalibrationDate(getTodayDate());
		setSelectedTesterOption("");
		setExternalTesterName("");
		setExternalTesterCompany("");
		setSessionNotes("");
		setMonitorResults(Object.fromEntries(monitors.map((monitor) => [monitor.id, ""])));
		setMonitorNotes(Object.fromEntries(monitors.map((monitor) => [monitor.id, ""])));
	}, [isOpen, monitors]);

	const isExternal = selectedTesterOption === "external";
	const isNameCompany = selectedTesterOption === "name-company";

	const selectedCount = useMemo(
		() => Object.values(monitorResults).filter((result) => result === "Passed" || result === "Failed").length,
		[monitorResults],
	);

	const passCount = useMemo(
		() => Object.values(monitorResults).filter((result) => result === "Passed").length,
		[monitorResults],
	);

	const failCount = useMemo(
		() => Object.values(monitorResults).filter((result) => result === "Failed").length,
		[monitorResults],
	);

	if (!isOpen) {
		return null;
	}

	const setAllResults = (value: GasMonitorSessionResult) => {
		setMonitorResults(Object.fromEntries(monitors.map((monitor) => [monitor.id, value])));
	};

	const toggleResult = (monitorId: string, target: "Passed" | "Failed") => {
		setMonitorResults((current) => {
			const currentValue = current[monitorId] ?? "";
			const nextValue: GasMonitorSessionResult = currentValue === target ? "" : target;
			return { ...current, [monitorId]: nextValue };
		});
	};

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
			<div className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Gas Monitors</p>
						<h3 className="mt-2 text-3xl font-black tracking-tight text-white">Session Calibration</h3>
						<p className="mt-2 text-sm text-neutral-400">Set shared calibration details once, mark each monitor, and submit in one record.</p>
					</div>

					<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs text-neutral-300">
						<p className="uppercase tracking-[0.16em] text-neutral-500">Selected Monitors</p>
						<p className="mt-1 text-lg font-semibold text-white">{selectedCount}</p>
						<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-green-300">Passed {passCount}</p>
						<p className="text-[11px] uppercase tracking-[0.14em] text-red-300">Failed {failCount}</p>
					</div>
				</div>

				{errorMessage ? (
					<div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
						{errorMessage}
					</div>
				) : null}

				<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
					<div className="grid gap-4 md:grid-cols-2">
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Calibration Date *</span>
							<input
								type="date"
								value={calibrationDate}
								onChange={(event) => setCalibrationDate(event.target.value)}
								className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>

						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tested By *</span>
							<select
								value={selectedTesterOption}
								onChange={(event) => setSelectedTesterOption(event.target.value)}
								className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
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
									className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
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
									className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						) : null}
					</div>

					<label className="mt-4 block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Session Notes</span>
						<textarea
							rows={2}
							value={sessionNotes}
							onChange={(event) => setSessionNotes(event.target.value)}
							placeholder="Optional notes applied to each selected monitor history entry"
							className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</section>

				<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setAllResults("Passed")}
							className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
						>
							Select All Passed
						</button>
						<button
							type="button"
							onClick={() => setAllResults("Failed")}
							className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
						>
							Select All Failed
						</button>
						<button
							type="button"
							onClick={() => setAllResults("")}
							className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Clear All
						</button>
					</div>

					<div className="mt-4 overflow-x-auto">
						<table className="min-w-full border-separate border-spacing-0 text-left">
							<thead>
								<tr>
									{["Monitor", "Current Status", "Result", "Monitor Note"].map((label) => (
										<th
											key={label}
											scope="col"
											className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
										>
											{label}
										</th>
									))}
								</tr>
							</thead>

							<tbody>
								{monitors.map((monitor) => {
									const selectedResult = monitorResults[monitor.id] ?? "";

									return (
										<tr key={monitor.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<div>
													<p className="font-semibold">{monitor.monitorNumber}</p>
													{monitor.hasActiveDeficiency ? <p className="text-xs text-red-300">Active deficiency linked</p> : null}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(monitor.currentStatus)}`}>
													{monitor.currentStatus}
												</span>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													<button
														type="button"
														onClick={() => toggleResult(monitor.id, "Passed")}
														className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
															selectedResult === "Passed"
																? "border-emerald-500/40 bg-emerald-600 text-white"
																: "border-emerald-500/30 bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30"
														}`}
													>
														Passed
													</button>
													<button
														type="button"
														onClick={() => toggleResult(monitor.id, "Failed")}
														className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
															selectedResult === "Failed"
																? "border-red-500/40 bg-red-600 text-white"
																: "border-red-500/30 bg-red-900/20 text-red-100 hover:bg-red-900/30"
														}`}
													>
														Failed
													</button>
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<input
													value={monitorNotes[monitor.id] ?? ""}
													onChange={(event) =>
														setMonitorNotes((current) => ({
															...current,
															[monitor.id]: event.target.value,
														}))
													}
													placeholder="Optional note for this monitor"
													className="w-full min-w-[220px] rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>

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
								sessionNotes,
								monitorResults,
								monitorNotes,
							})
						}
						className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Saving..." : "Save Session"}
					</button>
					{onSaveAndReportDeficiencies ? (
						<button
							type="button"
							disabled={isSaving || failCount === 0}
							onClick={() =>
								onSaveAndReportDeficiencies({
									calibrationDate,
									testerMode: isExternal ? "external" : isNameCompany ? "name-company" : "member",
									memberId: isExternal || isNameCompany ? "" : selectedTesterOption,
									externalTesterName,
									externalTesterCompany,
									sessionNotes,
									monitorResults,
									monitorNotes,
								})
							}
							className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isSaving ? "Saving..." : "Save + Report Failed Monitors"}
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}
