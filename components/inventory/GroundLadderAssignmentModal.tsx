"use client";

import { useEffect, useState } from "react";

export type GroundLadderAssignmentValues = {
	assignmentType: "Apparatus" | "Station" | "Unassigned";
	apparatusId: string;
	stationName: string;
	notes: string;
};

type ApparatusOption = {
	id: string;
	label: string;
};

interface GroundLadderAssignmentModalProps {
	isOpen: boolean;
	ladderNumber: string;
	apparatusOptions: ApparatusOption[];
	initialValues?: GroundLadderAssignmentValues;
	isSaving?: boolean;
	onClose: () => void;
	onSave: (values: GroundLadderAssignmentValues) => void;
}

const EMPTY_VALUES: GroundLadderAssignmentValues = {
	assignmentType: "Apparatus",
	apparatusId: "",
	stationName: "Station Supply",
	notes: "",
};

function getAssignmentTitle(assignmentType: GroundLadderAssignmentValues["assignmentType"]) {
	if (assignmentType === "Station") {
		return "Station Supply";
	}

	if (assignmentType === "Unassigned") {
		return "Unassigned";
	}

	return "Apparatus";
}

export default function GroundLadderAssignmentModal({
	isOpen,
	ladderNumber,
	apparatusOptions,
	initialValues,
	isSaving = false,
	onClose,
	onSave,
}: GroundLadderAssignmentModalProps) {
	const [values, setValues] = useState<GroundLadderAssignmentValues>(EMPTY_VALUES);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (initialValues) {
			setValues({
				assignmentType: initialValues.assignmentType,
				apparatusId: initialValues.apparatusId ?? "",
				stationName: initialValues.stationName ?? "Station Supply",
				notes: initialValues.notes ?? "",
			});
			return;
		}

		setValues(EMPTY_VALUES);
	}, [initialValues, isOpen]);

	if (!isOpen) {
		return null;
	}

	const isApparatus = values.assignmentType === "Apparatus";
	const isStation = values.assignmentType === "Station";

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
			<div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
				<h3 className="text-xl font-black text-white">Assign Ground Ladder</h3>
				<p className="mt-1 text-sm text-neutral-400">Ladder {ladderNumber}</p>

				<div className="mt-5 grid gap-4">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Assignment Type</span>
						<select
							value={values.assignmentType}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									assignmentType: event.target.value === "Station" || event.target.value === "Unassigned" ? event.target.value : "Apparatus",
									apparatusId: event.target.value === "Apparatus" ? current.apparatusId : "",
									stationName: event.target.value === "Station" ? current.stationName || "Station Supply" : current.stationName,
								}))
							}
							className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							<option value="Apparatus">Apparatus</option>
							<option value="Station">Station Supply</option>
							<option value="Unassigned">Unassigned</option>
						</select>
					</label>

					{isApparatus ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Apparatus *</span>
							<select
								value={values.apparatusId}
								onChange={(event) => setValues((current) => ({ ...current, apparatusId: event.target.value }))}
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							>
								<option value="">Select apparatus</option>
								{apparatusOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
						</label>
					) : null}

					{isStation ? (
						<label className="block">
							<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Station Supply Label</span>
							<input
								value={values.stationName}
								onChange={(event) => setValues((current) => ({ ...current, stationName: event.target.value }))}
								placeholder="Station Supply"
								className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
							/>
						</label>
					) : null}

					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">Notes</span>
						<textarea
							rows={3}
							value={values.notes}
							onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
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
						onClick={() => onSave(values)}
						className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
					>
						{isSaving ? `Saving ${getAssignmentTitle(values.assignmentType)}...` : `Save ${getAssignmentTitle(values.assignmentType)}`}
					</button>
				</div>
			</div>
		</div>
	);
}
