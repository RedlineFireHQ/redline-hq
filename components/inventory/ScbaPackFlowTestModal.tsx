"use client";

import { useState } from "react";

export type ScbaPackFlowTestTesterOption = {
	id: string;
	label: string;
};

export interface ScbaPackFlowTestValues {
	testDate: string;
	testerType: "member" | "external";
	memberId: string;
	externalTesterName: string;
	externalTesterCompany: string;
	result: "Pass" | "Fail";
	notes: string;
}

interface ScbaPackFlowTestModalProps {
	isOpen: boolean;
	packNumber: string;
	testerOptions: ScbaPackFlowTestTesterOption[];
	isSaving?: boolean;
	errorMessage?: string | null;
	onClose: () => void;
	onSave: (values: ScbaPackFlowTestValues) => void;
}

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function ScbaPackFlowTestModalContent({
	packNumber,
	testerOptions,
	isSaving,
	errorMessage,
	onClose,
	onSave,
}: Omit<ScbaPackFlowTestModalProps, "isOpen">) {
	const [testDate, setTestDate] = useState(getTodayDate());
	const [selectedTesterType, setSelectedTesterType] = useState<"member" | "external" | "">("");
	const [selectedMemberId, setSelectedMemberId] = useState("");
	const [externalTesterName, setExternalTesterName] = useState("");
	const [externalTesterCompany, setExternalTesterCompany] = useState("");
	const [result, setResult] = useState<"Pass" | "Fail" | "">("");
	const [notes, setNotes] = useState("");

	const isExternalTester = selectedTesterType === "external";
	const isMemberTester = selectedTesterType === "member";

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<h3 className="text-xl font-black text-white">Record Flow Test</h3>
				<p className="mt-1 text-sm text-neutral-400">SCBA Pack {packNumber}</p>

				{errorMessage ? (
					<div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
						{errorMessage}
					</div>
				) : null}

				<div className="mt-5 grid gap-4">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Test Date *</span>
						<input
							type="date"
							value={testDate}
							onChange={(event) => setTestDate(event.target.value)}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tested By *</span>
						<select
							value={selectedTesterType}
							onChange={(event) => {
								const nextValue = event.target.value as "member" | "external" | "";
								setSelectedTesterType(nextValue);
								if (nextValue !== "member") {
									setSelectedMemberId("");
								}
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="">Select tester type</option>
							<option value="member">Department Member</option>
							<option value="external">External Tester</option>
						</select>
					</label>

					{isMemberTester ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Department Member *</span>
							<select
								value={selectedMemberId}
								onChange={(event) => setSelectedMemberId(event.target.value)}
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							>
								<option value="">Select department member</option>
								{testerOptions.map((option) => (
									<option key={option.id} value={option.id}>{option.label}</option>
								))}
							</select>
						</label>
					) : null}

					{isExternalTester ? (
						<>
							<label className="block">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Tester Name *</span>
								<input
									value={externalTesterName}
									onChange={(event) => setExternalTesterName(event.target.value)}
									placeholder="External tester name"
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>

							<label className="block">
								<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Company</span>
								<input
									value={externalTesterCompany}
									onChange={(event) => setExternalTesterCompany(event.target.value)}
									placeholder="External company or organization"
									className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
								/>
							</label>
						</>
					) : null}

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Result *</span>
						<select
							value={result}
							onChange={(event) => {
								const nextValue = event.target.value;
								setResult(nextValue === "Pass" || nextValue === "Fail" ? nextValue : "");
							}}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="">Select result</option>
							<option value="Pass">Pass</option>
							<option value="Fail">Fail</option>
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
						disabled={isSaving || !result}
						onClick={() => {
							if (!result) {
								return;
							}
							onSave({
								testDate,
								testerType: selectedTesterType === "external" ? "external" : "member",
								memberId: selectedTesterType === "member" ? selectedMemberId : "",
								externalTesterName,
								externalTesterCompany,
								result,
								notes,
							});
						}}
						className="rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? "Saving..." : "Save Flow Test"}
					</button>
				</div>
			</div>
		</div>
	);
}

export default function ScbaPackFlowTestModal({
	isOpen,
	packNumber,
	testerOptions,
	isSaving = false,
	errorMessage = null,
	onClose,
	onSave,
}: ScbaPackFlowTestModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<ScbaPackFlowTestModalContent
			key={`${packNumber}-open`}
			packNumber={packNumber}
			testerOptions={testerOptions}
			isSaving={isSaving}
			errorMessage={errorMessage}
			onClose={onClose}
			onSave={onSave}
		/>
	);
}
