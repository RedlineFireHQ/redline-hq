"use client";

import { useEffect, useMemo, useState } from "react";

export type HoseTestingStatus = "untested" | "passed" | "failed";

export type HoseTestingSessionTesterOption = {
	id: string;
	label: string;
};

export type HoseTestingSessionValues = {
	testingDate: string;
	testerMode: "member" | "external";
	memberId: string;
	externalTesterName: string;
	externalTesterCompany: string;
	sessionNotes: string;
	hoseStatuses: Record<string, HoseTestingStatus>;
	hoseNotes: Record<string, string>;
};

type HoseTestingItem = {
	id: string;
	inventoryNumber: string;
	hoseSize: string;
	length: string;
	currentStatus: string;
	hasActiveDeficiency?: boolean;
};

interface HoseTestingSessionModalProps {
	isOpen: boolean;
	hoses: HoseTestingItem[];
	testerOptions: HoseTestingSessionTesterOption[];
	defaultTesterOptionId?: string;
	initialMode?: "session" | "quick";
	departmentName?: string;
	onClose: () => void;
	onSave: (values: HoseTestingSessionValues) => Promise<boolean>;
	onCreateDeficiencies: (
		failedHoses: HoseTestingItem[],
		values: HoseTestingSessionValues,
	) => Promise<boolean>;
	resumeValues?: HoseTestingSessionValues | null;
}

function todayIsoDate() {
	return new Date().toISOString().split("T")[0];
}

function statusBadgeClasses(status: string) {
	if (status === "Ready") {
		return "border-green-700/40 bg-green-900/20 text-green-300";
	}

	if (status === "Test Due") {
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

export default function HoseTestingSessionModal({
	isOpen,
	hoses,
	testerOptions,
	defaultTesterOptionId = "",
	initialMode = "session",
	onClose,
	onSave,
	onCreateDeficiencies,
	resumeValues = null,
}: HoseTestingSessionModalProps) {
	const [testingDate, setTestingDate] = useState(todayIsoDate());
	const [selectedTesterOption, setSelectedTesterOption] = useState("");
	const [externalTesterName, setExternalTesterName] = useState("");
	const [externalTesterCompany, setExternalTesterCompany] = useState("");
	const [sessionNotes, setSessionNotes] = useState("");
	const [hoseStatuses, setHoseStatuses] = useState<Record<string, HoseTestingStatus>>({});
	const [hoseNotes, setHoseNotes] = useState<Record<string, string>>({});
	const [isFinishing, setIsFinishing] = useState(false);
	const [isCreatingDeficiencies, setIsCreatingDeficiencies] = useState(false);
	const [mode, setMode] = useState<"session" | "quick">("session");
	const [quickInput, setQuickInput] = useState("");
	const [quickSelectedHoseId, setQuickSelectedHoseId] = useState("");

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (resumeValues) {
			setTestingDate(resumeValues.testingDate || todayIsoDate());
			setSelectedTesterOption(
				resumeValues.testerMode === "member" && resumeValues.memberId
					? resumeValues.memberId
					: resumeValues.testerMode === "external"
						? "external"
						: defaultTesterOptionId,
			);
			setExternalTesterName(resumeValues.externalTesterName || "");
			setExternalTesterCompany(resumeValues.externalTesterCompany || "");
			setSessionNotes(resumeValues.sessionNotes || "");
			setHoseStatuses(
				Object.fromEntries(
					hoses.map((hose) => [hose.id, resumeValues.hoseStatuses[hose.id] ?? "untested"]),
				),
			);
			setHoseNotes(
				Object.fromEntries(
					hoses.map((hose) => [hose.id, resumeValues.hoseNotes[hose.id] ?? ""]),
				),
			);
		} else {
			setTestingDate(todayIsoDate());
			setSelectedTesterOption(defaultTesterOptionId || "");
			setExternalTesterName("");
			setExternalTesterCompany("");
			setSessionNotes("");
			setHoseStatuses(Object.fromEntries(hoses.map((hose) => [hose.id, "untested"])));
			setHoseNotes(Object.fromEntries(hoses.map((hose) => [hose.id, ""])));
		}

		setIsFinishing(false);
		setIsCreatingDeficiencies(false);
		setMode(initialMode);
		setQuickInput("");
		setQuickSelectedHoseId("");
	}, [defaultTesterOptionId, hoses, initialMode, isOpen, resumeValues]);

	const isExternalTester = selectedTesterOption === "external";

	const selectedCount = useMemo(
		() => Object.values(hoseStatuses).filter((status) => status !== "untested").length,
		[hoseStatuses],
	);

	const passCount = useMemo(
		() => Object.values(hoseStatuses).filter((status) => status === "passed").length,
		[hoseStatuses],
	);

	const failCount = useMemo(
		() => Object.values(hoseStatuses).filter((status) => status === "failed").length,
		[hoseStatuses],
	);

	const quickMatches = useMemo(() => {
		const normalized = quickInput.trim().toLowerCase();
		if (!normalized) {
			return [] as HoseTestingItem[];
		}

		return hoses.filter((hose) => hose.inventoryNumber.toLowerCase().includes(normalized));
	}, [hoses, quickInput]);

	useEffect(() => {
		if (mode !== "quick") {
			return;
		}

		if (!quickInput.trim()) {
			setQuickSelectedHoseId("");
			return;
		}

		if (quickMatches.length === 1) {
			setQuickSelectedHoseId(quickMatches[0].id);
			return;
		}

		setQuickSelectedHoseId("");
	}, [mode, quickInput, quickMatches]);

	const summaryRows = useMemo(
		() =>
			hoses.map((hose) => ({
				...hose,
				status: hoseStatuses[hose.id] ?? "untested",
			})),
		[hoseStatuses, hoses],
	);

	const failedRows = useMemo(
		() => summaryRows.filter((row) => row.status === "failed"),
		[summaryRows],
	);

	if (!isOpen) {
		return null;
	}

	const setAllStatuses = (target: "passed" | "failed" | "untested") => {
		setHoseStatuses(Object.fromEntries(hoses.map((hose) => [hose.id, target])));
	};

	const toggleStatus = (hoseId: string, target: "passed" | "failed") => {
		setHoseStatuses((current) => {
			const existing = current[hoseId] ?? "untested";
			const next = existing === target ? "untested" : target;

			return {
				...current,
				[hoseId]: next,
			};
		});
	};

	const quickSelectedHose = hoses.find((hose) => hose.id === quickSelectedHoseId) ?? null;
	const quickRemainingCount = Math.max(0, hoses.length - passCount - failCount);

	const buildValues = (): HoseTestingSessionValues => ({
		testingDate,
		testerMode: selectedTesterOption === "external" ? "external" : "member",
		memberId: selectedTesterOption === "external" ? "" : selectedTesterOption,
		externalTesterName,
		externalTesterCompany,
		sessionNotes,
		hoseStatuses,
		hoseNotes,
	});

	const saveSession = async () => {
		try {
			setIsFinishing(true);
			const saved = await onSave(buildValues());
			setIsFinishing(false);

			if (!saved) {
				return;
			}

			onClose();
		} catch (err) {
			setIsFinishing(false);
			console.error("START HOSE TEST ERROR", err);
			throw err;
		}
	};

	const saveAndCreateDeficiencies = async () => {
		try {
			if (failedRows.length === 0) {
				return;
			}

			setIsCreatingDeficiencies(true);
			const saved = await onCreateDeficiencies(
				failedRows.map((row) => ({
					id: row.id,
					inventoryNumber: row.inventoryNumber,
					hoseSize: row.hoseSize,
					length: row.length,
					currentStatus: row.currentStatus,
					hasActiveDeficiency: row.hasActiveDeficiency,
				})),
				buildValues(),
			);
			setIsCreatingDeficiencies(false);

			if (!saved) {
				return;
			}

			onClose();
		} catch (err) {
			setIsCreatingDeficiencies(false);
			console.error("START HOSE TEST ERROR", err);
			throw err;
		}
	};

	const handleQuickMark = (status: "passed" | "failed") => {
		if (!quickSelectedHoseId) {
			return;
		}

		setHoseStatuses((current) => ({
			...current,
			[quickSelectedHoseId]: status,
		}));

		setQuickInput("");
		setQuickSelectedHoseId("");
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
			<div className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h3 className="mt-2 text-3xl font-black tracking-tight text-white">Session Testing</h3>
						<p className="mt-2 text-sm text-neutral-400">Set shared test details once, mark each hose, and save all selected hoses in one submit.</p>
					</div>

					<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs text-neutral-300">
						<p className="uppercase tracking-[0.16em] text-neutral-500">Selected Hoses</p>
						<p className="mt-1 text-lg font-semibold text-white">{selectedCount}</p>
						<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-green-300">Pass {passCount}</p>
						<p className="text-[11px] uppercase tracking-[0.14em] text-red-300">Fail {failCount}</p>
					</div>
				</div>

				<div className="mt-4 flex items-center gap-2">
					<button
						type="button"
						onClick={() => setMode("session")}
						className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
							mode === "session"
								? "border-red-500/40 bg-red-600 text-white"
								: "border-white/15 bg-neutral-900 text-white hover:bg-neutral-800"
						}`}
					>
						Session Mode
					</button>
					<button
						type="button"
						onClick={() => setMode("quick")}
						className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
							mode === "quick"
								? "border-red-500/40 bg-red-600 text-white"
								: "border-white/15 bg-neutral-900 text-white hover:bg-neutral-800"
						}`}
					>
						Quick Test Mode
					</button>
				</div>

				{mode === "session" ? (
					<>
						<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
							<div className="grid gap-4 md:grid-cols-2">
								<label className="block">
									<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Test Date *</span>
									<input
										type="date"
										value={testingDate}
										onChange={(event) => setTestingDate(event.target.value)}
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
									</select>
								</label>

								{isExternalTester ? (
									<>
										<label className="block">
											<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Name *</span>
											<input
												value={externalTesterName}
												onChange={(event) => setExternalTesterName(event.target.value)}
												placeholder="External tester name"
												className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
											/>
										</label>

										<label className="block">
											<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Company / Organization</span>
											<input
												value={externalTesterCompany}
												onChange={(event) => setExternalTesterCompany(event.target.value)}
												placeholder="External company or organization"
												className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
											/>
										</label>
									</>
								) : null}
							</div>

							<label className="mt-4 block">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Session Notes</span>
								<textarea
									rows={2}
									value={sessionNotes}
									onChange={(event) => setSessionNotes(event.target.value)}
									placeholder="Optional notes applied to each selected hose history entry"
									className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						</section>

						<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => setAllStatuses("passed")}
									className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
								>
									Select All Pass
								</button>
								<button
									type="button"
									onClick={() => setAllStatuses("failed")}
									className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
								>
									Select All Fail
								</button>
								<button
									type="button"
									onClick={() => setAllStatuses("untested")}
									className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
								>
									Clear All
								</button>
							</div>

							<div className="mt-4 overflow-x-auto">
								<table className="min-w-full border-separate border-spacing-0 text-left">
									<thead>
										<tr>
											{["Hose", "Current Status", "Result", "Hose Note"].map((label) => (
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
										{hoses.map((hose) => {
											const status = hoseStatuses[hose.id] ?? "untested";

											return (
												<tr key={hose.id} className="transition hover:bg-white/5">
													<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
														<div>
															<p className="font-semibold">{hose.inventoryNumber}</p>
															<p className="text-xs text-neutral-400">{hose.hoseSize} • {hose.length}</p>
															{hose.hasActiveDeficiency ? <p className="text-xs text-red-300">Active deficiency linked</p> : null}
														</div>
													</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
														<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(hose.currentStatus)}`}>
															{hose.currentStatus}
														</span>
													</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
														<div className="flex flex-wrap gap-2">
															<button
																type="button"
																onClick={() => toggleStatus(hose.id, "passed")}
																className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
																	status === "passed"
																		? "border-emerald-500/40 bg-emerald-600 text-white"
																		: "border-emerald-500/30 bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30"
																}`}
															>
																Pass
															</button>
															<button
																type="button"
																onClick={() => toggleStatus(hose.id, "failed")}
																className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
																	status === "failed"
																		? "border-red-500/40 bg-red-600 text-white"
																		: "border-red-500/30 bg-red-900/20 text-red-100 hover:bg-red-900/30"
																}`}
															>
																Fail
															</button>
														</div>
													</td>
													<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
														<input
															value={hoseNotes[hose.id] ?? ""}
															onChange={(event) =>
																setHoseNotes((current) => ({
																	...current,
																	[hose.id]: event.target.value,
																}))
															}
															placeholder="Optional note for this hose"
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
								disabled={isFinishing || selectedCount === 0 || !testingDate}
								onClick={() => void saveSession()}
								className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{isFinishing ? "Saving..." : "Save Session"}
							</button>
							<button
								type="button"
								disabled={isCreatingDeficiencies || failCount === 0 || !testingDate}
								onClick={() => void saveAndCreateDeficiencies()}
								className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{isCreatingDeficiencies ? "Saving..." : "Save + Report Failed Hoses"}
							</button>
						</div>
					</>
				) : (
					<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
						<h4 className="text-lg font-black text-white">Fire Hose Quick Test</h4>
						<p className="mt-1 text-xs text-neutral-500">Quickly mark one hose at a time, then switch to Session Mode to save or report failed hoses.</p>
						<div className="mt-4">
							<label className="block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
								Inventory Number
							</label>
							<input
								autoFocus
								type="text"
								value={quickInput}
								onChange={(event) => setQuickInput(event.target.value)}
								className="mt-2 w-full rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
							/>

							{quickInput.trim().length > 0 && quickMatches.length > 1 && (
								<div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-[#121212]">
									{quickMatches.map((hose) => (
										<button
											key={hose.id}
											type="button"
											onClick={() => {
												setQuickSelectedHoseId(hose.id);
												setQuickInput(hose.inventoryNumber);
											}}
											className="block w-full border-b border-white/5 px-3 py-2 text-left text-sm text-neutral-200 transition last:border-b-0 hover:bg-white/5"
										>
											{hose.inventoryNumber}
										</button>
									))}
								</div>
							)}

							{quickSelectedHose ? (
								<p className="mt-2 text-xs text-neutral-400">
									Selected: {quickSelectedHose.inventoryNumber} • {quickSelectedHose.hoseSize} • {quickSelectedHose.length}
								</p>
							) : null}
						</div>

						<div className="mt-4 flex flex-wrap gap-2">
							<button
								type="button"
								disabled={!quickSelectedHoseId}
								onClick={() => handleQuickMark("passed")}
								className="rounded-lg border border-green-500/40 bg-green-600/20 px-3 py-2 text-sm font-semibold text-green-200 transition hover:bg-green-600/30 disabled:cursor-not-allowed disabled:opacity-60"
							>
								PASS
							</button>
							<button
								type="button"
								disabled={!quickSelectedHoseId}
								onClick={() => handleQuickMark("failed")}
								className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-60"
							>
								FAIL
							</button>
						</div>

						<div className="mt-5 border-t border-white/10 pt-4">
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Today's Progress</p>
							<div className="mt-2 space-y-1 text-sm text-neutral-200">
								<p>Passed: {passCount}</p>
								<p>Failed: {failCount}</p>
								<p>Remaining: {quickRemainingCount}</p>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap items-center justify-end gap-2">
							<button
								type="button"
								onClick={() => setMode("session")}
								className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Review in Session Mode
							</button>
							<button
								type="button"
								onClick={onClose}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Close
							</button>
						</div>
					</section>
				)}
			</div>
		</div>
	);
}
