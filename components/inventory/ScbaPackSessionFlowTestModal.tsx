"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScbaPackFlowTestTesterOption } from "@/components/inventory/ScbaPackFlowTestModal";

export type ScbaPackSessionResult = "Pass" | "Fail" | "";

export interface ScbaPackSessionFlowTestValues {
	testDate: string;
	testerMode: "member" | "external";
	memberId: string;
	externalTesterName: string;
	externalTesterCompany: string;
	sessionNotes: string;
	packResults: Record<string, ScbaPackSessionResult>;
	packNotes: Record<string, string>;
}

type ScbaPackSessionRow = {
	id: string;
	packNumber: string;
	currentStatus: string;
	hasActiveDeficiency: boolean;
};

interface ScbaPackSessionFlowTestModalProps {
	isOpen: boolean;
	packs: ScbaPackSessionRow[];
	testerOptions: ScbaPackFlowTestTesterOption[];
	isSaving?: boolean;
	errorMessage?: string | null;
	onClose: () => void;
	onSave: (values: ScbaPackSessionFlowTestValues) => void;
}

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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

export default function ScbaPackSessionFlowTestModal({
	isOpen,
	packs,
	testerOptions,
	isSaving = false,
	errorMessage = null,
	onClose,
	onSave,
}: ScbaPackSessionFlowTestModalProps) {
	const [testDate, setTestDate] = useState(getTodayDate());
	const [selectedTesterOption, setSelectedTesterOption] = useState("");
	const [externalTesterName, setExternalTesterName] = useState("");
	const [externalTesterCompany, setExternalTesterCompany] = useState("");
	const [sessionNotes, setSessionNotes] = useState("");
	const [packResults, setPackResults] = useState<Record<string, ScbaPackSessionResult>>({});
	const [packNotes, setPackNotes] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setTestDate(getTodayDate());
		setSelectedTesterOption("");
		setExternalTesterName("");
		setExternalTesterCompany("");
		setSessionNotes("");
		setPackResults(Object.fromEntries(packs.map((pack) => [pack.id, ""])));
		setPackNotes(Object.fromEntries(packs.map((pack) => [pack.id, ""])));
	}, [isOpen, packs]);

	const isExternalTester = selectedTesterOption === "external";

	const selectedCount = useMemo(
		() => Object.values(packResults).filter((result) => result === "Pass" || result === "Fail").length,
		[packResults],
	);

	const passCount = useMemo(
		() => Object.values(packResults).filter((result) => result === "Pass").length,
		[packResults],
	);

	const failCount = useMemo(
		() => Object.values(packResults).filter((result) => result === "Fail").length,
		[packResults],
	);

	if (!isOpen) {
		return null;
	}

	const setAllResults = (value: ScbaPackSessionResult) => {
		setPackResults(Object.fromEntries(packs.map((pack) => [pack.id, value])));
	};

	const toggleResult = (packId: string, target: "Pass" | "Fail") => {
		setPackResults((current) => {
			const currentValue = current[packId] ?? "";
			const nextValue: ScbaPackSessionResult = currentValue === target ? "" : target;

			return {
				...current,
				[packId]: nextValue,
			};
		});
	};

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
			<div className="max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">SCBA Packs</p>
						<h3 className="mt-2 text-3xl font-black tracking-tight text-white">Session Flow Test</h3>
						<p className="mt-2 text-sm text-neutral-400">Set shared test details once, mark each pack, and save all selected packs in one submit.</p>
					</div>

					<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-xs text-neutral-300">
						<p className="uppercase tracking-[0.16em] text-neutral-500">Selected Packs</p>
						<p className="mt-1 text-lg font-semibold text-white">{selectedCount}</p>
						<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-green-300">Pass {passCount}</p>
						<p className="text-[11px] uppercase tracking-[0.14em] text-red-300">Fail {failCount}</p>
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
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Test Date *</span>
							<input
								type="date"
								value={testDate}
								onChange={(event) => setTestDate(event.target.value)}
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
							placeholder="Optional notes applied to each selected pack history entry"
							className="w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>
				</section>

				<section className="mt-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setAllResults("Pass")}
							className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
						>
							Select All Pass
						</button>
						<button
							type="button"
							onClick={() => setAllResults("Fail")}
							className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
						>
							Select All Fail
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
									{["Pack", "Current Status", "Result", "Pack Note"].map((label) => (
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
								{packs.map((pack) => {
									const selectedResult = packResults[pack.id] ?? "";

									return (
										<tr key={pack.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
												<div>
													<p className="font-semibold">{pack.packNumber}</p>
													{pack.hasActiveDeficiency ? <p className="text-xs text-red-300">Active deficiency linked</p> : null}
												</div>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(pack.currentStatus)}`}>
													{pack.currentStatus}
												</span>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<div className="flex flex-wrap gap-2">
													<button
														type="button"
														onClick={() => toggleResult(pack.id, "Pass")}
														className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
															selectedResult === "Pass"
																? "border-emerald-500/40 bg-emerald-600 text-white"
																: "border-emerald-500/30 bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30"
														}`}
													>
														Pass
													</button>
													<button
														type="button"
														onClick={() => toggleResult(pack.id, "Fail")}
														className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
															selectedResult === "Fail"
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
													value={packNotes[pack.id] ?? ""}
													onChange={(event) =>
														setPackNotes((current) => ({
															...current,
															[pack.id]: event.target.value,
														}))
													}
													placeholder="Optional note for this pack"
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
								testDate,
								testerMode: selectedTesterOption === "external" ? "external" : "member",
								memberId: selectedTesterOption === "external" ? "" : selectedTesterOption,
								externalTesterName,
								externalTesterCompany,
								sessionNotes,
								packResults,
								packNotes,
							})
						}
						className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Saving..." : "Save Session"}
					</button>
				</div>
			</div>
		</div>
	);
}
