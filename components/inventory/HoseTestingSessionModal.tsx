"use client";

import { useEffect, useMemo, useState } from "react";

export type HoseTestingStatus = "untested" | "passed" | "failed";

export type HoseTestingSessionValues = {
	testingDate: string;
	tester: string;
	hoseStatuses: Record<string, HoseTestingStatus>;
};

type HoseTestingItem = {
	id: string;
	inventoryNumber: string;
	hoseSize: string;
	length: string;
	hasActiveDeficiency?: boolean;
};

interface HoseTestingSessionModalProps {
	isOpen: boolean;
	hoses: HoseTestingItem[];
	defaultTester: string;
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

export default function HoseTestingSessionModal({
	isOpen,
	hoses,
	defaultTester,
	departmentName = "Department",
	onClose,
	onSave,
	onCreateDeficiencies,
	resumeValues = null,
}: HoseTestingSessionModalProps) {
	const [testingDate, setTestingDate] = useState(todayIsoDate());
	const [tester, setTester] = useState("");
	const [hoseStatuses, setHoseStatuses] = useState<Record<string, HoseTestingStatus>>({});
	const [sessionStep, setSessionStep] = useState<"testing" | "summary">("testing");
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
			setTester(resumeValues.tester || defaultTester);
			setHoseStatuses(
				Object.fromEntries(
					hoses.map((hose) => [hose.id, resumeValues.hoseStatuses[hose.id] ?? "untested"]),
				),
			);
			setSessionStep("summary");
		} else {
			setTestingDate(todayIsoDate());
			setTester(defaultTester);
			setHoseStatuses(Object.fromEntries(hoses.map((hose) => [hose.id, "untested"])));
			setSessionStep("testing");
		}

		setIsFinishing(false);
		setIsCreatingDeficiencies(false);
		setMode("session");
		setQuickInput("");
		setQuickSelectedHoseId("");
	}, [isOpen, resumeValues]);

	const selectedCount = useMemo(
		() => Object.values(hoseStatuses).filter((status) => status !== "untested").length,
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

	const passedRows = useMemo(
		() => summaryRows.filter((row) => row.status === "passed"),
		[summaryRows],
	);

	const failedRows = useMemo(
		() => summaryRows.filter((row) => row.status === "failed"),
		[summaryRows],
	);

	const untestedRows = useMemo(
		() => summaryRows.filter((row) => row.status === "untested"),
		[summaryRows],
	);

	const quickPassedCount = useMemo(
		() => Object.values(hoseStatuses).filter((status) => status === "passed").length,
		[hoseStatuses],
	);

	const quickFailedCount = useMemo(
		() => Object.values(hoseStatuses).filter((status) => status === "failed").length,
		[hoseStatuses],
	);

	const failedRowsMissingDeficiency = useMemo(
		() => failedRows.filter((row) => !row.hasActiveDeficiency),
		[failedRows],
	);

	const hasBlockingFailedHoses = failedRowsMissingDeficiency.length > 0;
	const createDeficienciesDisabled =
		failedRowsMissingDeficiency.length === 0 || isFinishing || isCreatingDeficiencies;
	const finishDisabled = selectedCount === 0 || !testingDate || isFinishing || hasBlockingFailedHoses;

	useEffect(() => {
		if (!isOpen || sessionStep !== "summary") {
			return;
		}

		for (const row of failedRows) {
			console.log("[hose-test][summary-deficiency-check]", {
				inventoryNumber: row.inventoryNumber,
				fireHoseId: row.id,
				hasActiveDeficiency: row.hasActiveDeficiency === true,
			});
		}

		console.log("[hose-test][summary-blocker]", {
			failedRowsMissingDeficiency: failedRowsMissingDeficiency.map((row) => ({
				inventoryNumber: row.inventoryNumber,
				fireHoseId: row.id,
			})),
			hasBlockingFailedHoses,
		});
	}, [failedRows, failedRowsMissingDeficiency, hasBlockingFailedHoses, isOpen, sessionStep]);

	if (!isOpen) {
		return null;
	}

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
	const quickRemainingCount = Math.max(0, hoses.length - quickPassedCount - quickFailedCount);

	const formatSummaryDate = (isoDate: string) => {
		if (!isoDate) {
			return "-";
		}

		const parsed = new Date(`${isoDate}T00:00:00`);
		if (Number.isNaN(parsed.getTime())) {
			return isoDate;
		}

		return parsed.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	};

	const createPrintHtml = () => {
		const reportDate = formatSummaryDate(testingDate);
		const detailRows = summaryRows
			.map((row) => {
				const resultLabel =
					row.status === "passed" ? "PASS" : row.status === "failed" ? "FAIL" : "NOT TESTED";

				return `<tr><td>${row.inventoryNumber}</td><td>${row.hoseSize}</td><td>${row.length}</td><td>${resultLabel}</td></tr>`;
			})
			.join("");

		return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Fire Hose Testing Summary</title>
  <style>
    body { font-family: "Helvetica Neue", Arial, sans-serif; color: #111; margin: 24px; }
    h1, h2 { margin: 0; }
    .muted { color: #555; }
    .section { margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 10px; }
    .summary-item { border: 1px solid #e3e3e3; border-radius: 8px; padding: 10px; }
    .footer { margin-top: 28px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>REDLINE HQ</h1>
  <h2 style="margin-top:8px;">Fire Hose Testing Summary</h2>
  <div class="section muted">
    <div>${departmentName}</div>
    <div>Testing Date: ${reportDate}</div>
    <div>Tester: ${tester || "-"}</div>
  </div>

  <div class="section">
    <h2 style="font-size:16px;">Summary</h2>
    <div class="summary-grid">
      <div class="summary-item"><div class="muted">Total Hoses</div><div>${summaryRows.length}</div></div>
      <div class="summary-item"><div class="muted">Passed</div><div>${passedRows.length}</div></div>
      <div class="summary-item"><div class="muted">Failed</div><div>${failedRows.length}</div></div>
      <div class="summary-item"><div class="muted">Untested</div><div>${untestedRows.length}</div></div>
    </div>
  </div>

  <div class="section">
    <h2 style="font-size:16px;">Detailed Inventory</h2>
    <table>
      <thead>
        <tr>
          <th>Inventory #</th>
          <th>Hose Size</th>
          <th>Length</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${detailRows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>Generated by Redline HQ</div>
    <div>Less Paperwork. More Readiness.</div>
  </div>
</body>
</html>`;
	};

	const printSummary = () => {
		const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
		if (!printWindow) {
			return;
		}

		printWindow.document.open();
		printWindow.document.write(createPrintHtml());
		printWindow.document.close();
		printWindow.focus();
		printWindow.print();
	};

	const finishSession = async () => {
		try {
			const failedHoses = summaryRows.filter((row) => row.status === "failed");
			const failedRowsMissingDeficiency = failedHoses.filter(
				(row) => row.hasActiveDeficiency !== true,
			);
			const hasBlockingFailedHoses = failedRowsMissingDeficiency.length > 0;

			console.log("[hose-test][finish-runtime-guard]", {
				failedHoses: failedHoses.map((row) => ({
					inventoryNumber: row.inventoryNumber,
					id: row.id,
					hasActiveDeficiency: row.hasActiveDeficiency,
				})),
				failedRowsMissingDeficiency: failedRowsMissingDeficiency.map((row) => ({
					inventoryNumber: row.inventoryNumber,
					id: row.id,
					hasActiveDeficiency: row.hasActiveDeficiency,
				})),
				hasBlockingFailedHoses,
			});

			if (hasBlockingFailedHoses) {
				return;
			}

			setIsFinishing(true);
			const saved = await onSave({
				testingDate,
				tester,
				hoseStatuses,
			});
			setIsFinishing(false);

			if (!saved) {
				return;
			}

			setSessionStep("testing");
		} catch (err) {
			setIsFinishing(false);
			console.error("START HOSE TEST ERROR", err);
			throw err;
		}
	};

	const saveThenCreateDeficiencies = async () => {
		try {
			if (failedRowsMissingDeficiency.length === 0) {
				return;
			}

			setIsCreatingDeficiencies(true);
			const saved = await onCreateDeficiencies(
				failedRowsMissingDeficiency.map((row) => ({
					id: row.id,
					inventoryNumber: row.inventoryNumber,
					hoseSize: row.hoseSize,
					length: row.length,
					hasActiveDeficiency: row.hasActiveDeficiency,
				})),
				{
				testingDate,
				tester,
				hoseStatuses,
				},
			);
			setIsCreatingDeficiencies(false);

			if (!saved) {
				return;
			}

			setSessionStep("testing");
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

	if (isOpen && sessionStep === "summary") {
		console.log("[hose-test][summary-render-state]", {
			summaryRows: summaryRows.map((row) => ({
				inventoryNumber: row.inventoryNumber,
				id: row.id,
				status: row.status,
				hasActiveDeficiency: row.hasActiveDeficiency,
				deficiencyStatus: (row as { deficiencyStatus?: string }).deficiencyStatus,
			})),
			failedRows: failedRows.map((row) => ({
				inventoryNumber: row.inventoryNumber,
				id: row.id,
				status: row.status,
				hasActiveDeficiency: row.hasActiveDeficiency,
				deficiencyStatus: (row as { deficiencyStatus?: string }).deficiencyStatus,
			})),
			failedRowsMissingDeficiency: failedRowsMissingDeficiency.map((row) => ({
				inventoryNumber: row.inventoryNumber,
				id: row.id,
				hasActiveDeficiency: row.hasActiveDeficiency,
				deficiencyStatus: (row as { deficiencyStatus?: string }).deficiencyStatus,
			})),
			hasBlockingFailedHoses,
			selectedCount,
			testingDate,
			isFinishing,
			isCreatingDeficiencies,
			createDeficienciesDisabled,
			finishDisabled,
		});
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
			<div className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
				<div className="flex items-center justify-between">
					<h3 className="text-xl font-black text-white">Fire Hose Testing Session</h3>
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

				{sessionStep === "summary" ? (
					<div className="mt-4 rounded-lg border border-white/10 bg-[#1b1b1b] p-4">
						<h4 className="text-lg font-black text-white">Fire Hose Testing Summary</h4>
						<div className="mt-4 grid gap-3 md:grid-cols-2">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Testing Date</p>
								<p className="mt-1 text-sm text-neutral-200">{formatSummaryDate(testingDate)}</p>
							</div>
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Tester</p>
								<p className="mt-1 text-sm text-neutral-200">{tester || "-"}</p>
							</div>
						</div>

						<div className="mt-4 grid grid-cols-3 gap-3 border-y border-white/10 py-4">
							<div>
								<p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Passed</p>
								<p className="text-lg font-semibold text-green-200">{passedRows.length}</p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Failed</p>
								<p className="text-lg font-semibold text-red-200">{failedRows.length}</p>
							</div>
							<div>
								<p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Untested</p>
								<p className="text-lg font-semibold text-amber-200">{untestedRows.length}</p>
							</div>
						</div>

						<div className="mt-4 space-y-4">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-300">Passed</p>
								<div className="mt-2 space-y-1">
									{passedRows.map((row) => (
										<div key={row.id} className="rounded-md border border-green-700/30 bg-green-900/10 px-3 py-2 text-sm text-green-100">
											✓ {row.inventoryNumber} {"  "}{row.hoseSize} {"  "}{row.length}
										</div>
									))}
									{passedRows.length === 0 ? <p className="text-xs text-neutral-500">No passed hoses.</p> : null}
								</div>
							</div>

							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-300">Failed</p>
								<div className="mt-2 space-y-1">
									{failedRows.map((row) => (
										<div key={row.id} className="rounded-md border border-red-700/30 bg-red-900/10 px-3 py-2 text-sm text-red-100">
											✗ {row.inventoryNumber} {"  "}{row.hoseSize} {"  "}{row.length}
										</div>
									))}
									{failedRows.length === 0 ? <p className="text-xs text-neutral-500">No failed hoses.</p> : null}
								</div>
							</div>

							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Untested</p>
								<div className="mt-2 space-y-1">
									{untestedRows.map((row) => (
										<div key={row.id} className="rounded-md border border-amber-700/30 bg-amber-900/10 px-3 py-2 text-sm text-amber-100">
											○ {row.inventoryNumber} {"  "}{row.hoseSize} {"  "}{row.length}
										</div>
									))}
									{untestedRows.length === 0 ? <p className="text-xs text-neutral-500">No untested hoses.</p> : null}
								</div>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap items-center justify-end gap-2">
							{hasBlockingFailedHoses ? (
								<p className="mr-auto text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
									Failed hoses require deficiencies before finishing.
								</p>
							) : null}
							<button
								type="button"
								onClick={() => setSessionStep("testing")}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								{mode === "quick" ? "Back to Quick Test" : "Back to Testing"}
							</button>
							<button
								type="button"
								onClick={printSummary}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Print Summary
							</button>
							<button
								type="button"
								disabled={createDeficienciesDisabled}
								onClick={() => void saveThenCreateDeficiencies()}
								className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isCreatingDeficiencies ? "Saving..." : "Create Deficiencies"}
							</button>
							<button
								type="button"
								disabled={finishDisabled}
								onClick={() => void finishSession()}
								className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isFinishing ? "Finishing..." : "Finish"}
							</button>
						</div>
					</div>
				) : mode === "session" ? (
					<>
						<div className="mt-4 grid gap-3 md:grid-cols-3">
					<label className="grid gap-1.5">
						<span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
							Testing Date
						</span>
						<input
							type="date"
							value={testingDate}
							onChange={(event) => setTestingDate(event.target.value)}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="grid gap-1.5 md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Tester</span>
						<input
							type="text"
							value={tester}
							onChange={(event) => setTester(event.target.value)}
							placeholder="Tester name"
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</div>

						<div className="mt-4 rounded-lg border border-white/10 bg-[#1b1b1b] p-4">
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Hoses</p>
						<p className="text-xs text-neutral-500">Tap PASS or FAIL. Tap again to clear back to Untested.</p>
					</div>

					<div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
						{hoses.map((hose) => {
							const status = hoseStatuses[hose.id] ?? "untested";
							const isPassed = status === "passed";
							const isFailed = status === "failed";

							return (
							<label
								key={hose.id}
								className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2 text-sm text-neutral-200"
							>
								<span className="font-semibold text-white">{hose.inventoryNumber}</span>
								<span className="text-neutral-400">{hose.hoseSize}</span>
								<span className="text-neutral-400">{hose.length}</span>
								<div className="ml-auto flex items-center gap-2">
									<button
										type="button"
										onClick={() => toggleStatus(hose.id, "passed")}
										className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
											isPassed
												? "border-green-700/40 bg-green-900/20 text-green-200"
												: "border-white/10 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
										}`}
									>
										🟢 PASS
									</button>
									<button
										type="button"
										onClick={() => toggleStatus(hose.id, "failed")}
										className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
											isFailed
												? "border-red-700/40 bg-red-900/20 text-red-200"
												: "border-white/10 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
										}`}
									>
										🔴 FAIL
									</button>
								</div>
							</label>
							);
						})}
					</div>

					<p className="mt-3 text-sm font-semibold text-neutral-200">Selected: {selectedCount} hoses</p>
				</div>

						<div className="mt-6 flex flex-wrap items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={selectedCount === 0 || !testingDate}
						onClick={() => setSessionStep("summary")}
						className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Save Test Session
					</button>
				</div>
					</>
				) : (
					<div className="mt-4 rounded-lg border border-white/10 bg-[#1b1b1b] p-4">
						<h4 className="text-lg font-black text-white">Fire Hose Quick Test</h4>
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
								🟢 PASS
							</button>
							<button
								type="button"
								disabled={!quickSelectedHoseId}
								onClick={() => handleQuickMark("failed")}
								className="rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-60"
							>
								🔴 FAIL
							</button>
						</div>

						<div className="mt-5 border-t border-white/10 pt-4">
							<p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Today's Progress</p>
							<div className="mt-2 space-y-1 text-sm text-neutral-200">
								<p>Passed: {quickPassedCount}</p>
								<p>Failed: {quickFailedCount}</p>
								<p>Remaining: {quickRemainingCount}</p>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap items-center justify-end gap-2">
							<button
								type="button"
								disabled={selectedCount === 0 || !testingDate}
								onClick={() => setSessionStep("summary")}
								className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								Finish Quick Test
							</button>
							<button
								type="button"
								onClick={onClose}
								className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
							>
								Close
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
