"use client";

import { useState } from "react";

export type FireExtinguisherApparatusOption = {
	id: string;
	name: string;
};

export type FireExtinguisherFormValues = {
	extinguisherNumber: string;
	extinguisherType: string;
	customExtinguisherType: string;
	locationType: "Apparatus" | "Station Storage" | "Station/Building" | "Other";
	apparatusId: string;
	otherLocation: string;
	status: "Active" | "Inactive" | "Out of Service";
	notes: string;
	photoFile: File | null;
	removePhoto: boolean;
};

type FireExtinguisherFormModalProps = {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: FireExtinguisherFormValues;
	apparatusOptions: FireExtinguisherApparatusOption[];
	canDelete: boolean;
	isSaving: boolean;
	onClose: () => void;
	onSave: (values: FireExtinguisherFormValues) => void;
	onDelete?: () => void;
	hasExistingPhoto?: boolean;
};

const extinguisherTypeOptions = [
	"Water",
	"Foam",
	"Carbon Dioxide",
	"Dry Chemical",
	"Wet Chemical",
	"Clean Agent",
	"Other",
] as const;

const locationTypeOptions = ["Apparatus", "Station Storage", "Station/Building", "Other"] as const;
const statusOptions = ["Active", "Inactive", "Out of Service"] as const;

export default function FireExtinguisherFormModal({
	isOpen,
	mode,
	initialValues,
	apparatusOptions,
	canDelete,
	isSaving,
	onClose,
	onSave,
	onDelete,
	hasExistingPhoto = false,
}: FireExtinguisherFormModalProps) {
	const [extinguisherNumber, setExtinguisherNumber] = useState(initialValues?.extinguisherNumber ?? "");
	const [extinguisherType, setExtinguisherType] = useState(initialValues?.extinguisherType ?? "Water");
	const [customExtinguisherType, setCustomExtinguisherType] = useState(initialValues?.customExtinguisherType ?? "");
	const [locationType, setLocationType] = useState<FireExtinguisherFormValues["locationType"]>(initialValues?.locationType ?? "Station Storage");
	const [apparatusId, setApparatusId] = useState(initialValues?.apparatusId ?? "");
	const [otherLocation, setOtherLocation] = useState(initialValues?.otherLocation ?? "");
	const [status, setStatus] = useState<FireExtinguisherFormValues["status"]>(initialValues?.status ?? "Active");
	const [notes, setNotes] = useState(initialValues?.notes ?? "");
	const [photoFile, setPhotoFile] = useState<File | null>(null);
	const [removePhoto, setRemovePhoto] = useState(Boolean(initialValues?.removePhoto));

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
			<div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
				<div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">
							{mode === "add" ? "New Fire Extinguisher" : "Edit Fire Extinguisher"}
						</p>
						<h2 className="mt-1 text-2xl font-black tracking-tight text-white">
							{mode === "add" ? "Add extinguisher" : extinguisherNumber || "Update extinguisher"}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={isSaving}
						className="rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
					>
						Close
					</button>
				</div>

				<div className="grid gap-5 px-6 py-6 md:grid-cols-2">
					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Extinguisher Number</span>
						<input
							type="text"
							value={extinguisherNumber}
							onChange={(event) => setExtinguisherNumber(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
							placeholder="EXT-001"
						/>
					</label>

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Status</span>
						<select
							value={status}
							onChange={(event) => setStatus(event.target.value as FireExtinguisherFormValues["status"])}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{statusOptions.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</label>

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Extinguisher Type</span>
						<select
							value={extinguisherType}
							onChange={(event) => setExtinguisherType(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{extinguisherTypeOptions.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</label>

					{extinguisherType === "Other" ? (
						<label className="space-y-2">
							<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Custom Type</span>
							<input
								type="text"
								value={customExtinguisherType}
								onChange={(event) => setCustomExtinguisherType(event.target.value)}
								className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
								placeholder="Enter extinguisher type"
							/>
						</label>
					) : null}

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Location</span>
						<select
							value={locationType}
							onChange={(event) => setLocationType(event.target.value as FireExtinguisherFormValues["locationType"])}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						>
							{locationTypeOptions.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</label>

					{locationType === "Apparatus" ? (
						<label className="space-y-2">
							<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Apparatus</span>
							<select
								value={apparatusId}
								onChange={(event) => setApparatusId(event.target.value)}
								className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
							>
								<option value="">Select apparatus</option>
								{apparatusOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.name}
									</option>
								))}
							</select>
						</label>
					) : null}

					{locationType === "Other" ? (
						<label className="space-y-2 md:col-span-2">
							<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Other Location</span>
							<input
								type="text"
								value={otherLocation}
								onChange={(event) => setOtherLocation(event.target.value)}
								className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
								placeholder="Building, shelf, or room"
							/>
						</label>
					) : null}

					<label className="space-y-2 md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Notes</span>
						<textarea
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							rows={3}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
							placeholder="Optional notes"
						/>
					</label>

					<label className="space-y-2 md:col-span-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Photo</span>
						<input
							type="file"
							accept="image/*"
							onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-zinc-200 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-red-500"
						/>
						{mode === "edit" && hasExistingPhoto ? (
							<label className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
								<input
									type="checkbox"
									checked={removePhoto}
									onChange={(event) => setRemovePhoto(event.target.checked)}
									className="h-4 w-4 rounded border-white/20 bg-[#0c0c0c] text-red-500 focus:ring-red-500"
								/>
								Remove existing photo
							</label>
						) : null}
					</label>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-5">
					<div className="flex flex-wrap gap-2">
						{mode === "edit" && canDelete && onDelete ? (
							<button
								type="button"
								onClick={onDelete}
								disabled={isSaving}
								className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Delete
							</button>
						) : null}
					</div>

					<div className="flex gap-3">
						<button
							type="button"
							onClick={onClose}
							disabled={isSaving}
							className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={isSaving}
							onClick={() => {
								const finalType =
									extinguisherType === "Other"
										? customExtinguisherType.trim()
										: extinguisherType.trim();

								onSave({
									extinguisherNumber: extinguisherNumber.trim(),
									extinguisherType: finalType,
									customExtinguisherType: customExtinguisherType.trim(),
									locationType,
									apparatusId: apparatusId.trim(),
									otherLocation: otherLocation.trim(),
									status,
									notes,
									photoFile,
									removePhoto,
								});
							}}
							className="rounded-xl border border-red-500/40 bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSaving ? "Saving..." : mode === "add" ? "Create Extinguisher" : "Save Changes"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
