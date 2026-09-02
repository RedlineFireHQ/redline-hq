"use client";

import { useState } from "react";

export type MiscFireEquipmentApparatusOption = {
	id: string;
	name: string;
};

export type MiscFireEquipmentFormValues = {
	equipmentName: string;
	assetNumber: string;
	locationType: "Apparatus" | "Station Storage" | "Other";
	apparatusId: string;
	otherLocation: string;
	status: "Active" | "Inactive" | "Out of Service";
	datePlacedInService: string;
	manufacturer: string;
	model: string;
	notes: string;
	photoFile: File | null;
	removePhoto: boolean;
};

type MiscFireEquipmentFormModalProps = {
	isOpen: boolean;
	mode: "add" | "edit";
	initialValues?: MiscFireEquipmentFormValues;
	apparatusOptions: MiscFireEquipmentApparatusOption[];
	canDelete: boolean;
	isSaving: boolean;
	onClose: () => void;
	onSave: (values: MiscFireEquipmentFormValues) => void;
	onDelete?: () => void;
	hasExistingPhoto?: boolean;
};

const locationTypeOptions = ["Apparatus", "Station Storage", "Other"] as const;
const statusOptions = ["Active", "Inactive", "Out of Service"] as const;

function getTodayDate() {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export default function MiscFireEquipmentFormModal({
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
}: MiscFireEquipmentFormModalProps) {
	const [equipmentName, setEquipmentName] = useState(initialValues?.equipmentName ?? "");
	const [assetNumber, setAssetNumber] = useState(initialValues?.assetNumber ?? "");
	const [locationType, setLocationType] = useState<MiscFireEquipmentFormValues["locationType"]>(initialValues?.locationType ?? "Station Storage");
	const [apparatusId, setApparatusId] = useState(initialValues?.apparatusId ?? "");
	const [otherLocation, setOtherLocation] = useState(initialValues?.otherLocation ?? "");
	const [status, setStatus] = useState<MiscFireEquipmentFormValues["status"]>(initialValues?.status ?? "Active");
	const [datePlacedInService, setDatePlacedInService] = useState(initialValues?.datePlacedInService ?? (mode === "add" ? getTodayDate() : ""));
	const [manufacturer, setManufacturer] = useState(initialValues?.manufacturer ?? "");
	const [model, setModel] = useState(initialValues?.model ?? "");
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
							{mode === "add" ? "New Equipment" : "Edit Equipment"}
						</p>
						<h2 className="mt-1 text-2xl font-black tracking-tight text-white">
							{mode === "add" ? "Add miscellaneous fire equipment" : equipmentName || "Update equipment"}
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
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Equipment Name</span>
						<input
							type="text"
							value={equipmentName}
							onChange={(event) => setEquipmentName(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
							placeholder="Halligan"
						/>
					</label>

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Status</span>
						<select
							value={status}
							onChange={(event) => setStatus(event.target.value as MiscFireEquipmentFormValues["status"])}
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
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Equipment ID / Asset Number</span>
						<input
							type="text"
							value={assetNumber}
							onChange={(event) => setAssetNumber(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
							placeholder="Optional"
						/>
					</label>

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Date Placed in Service</span>
						<input
							type="date"
							value={datePlacedInService}
							onChange={(event) => setDatePlacedInService(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Location</span>
						<select
							value={locationType}
							onChange={(event) => setLocationType(event.target.value as MiscFireEquipmentFormValues["locationType"])}
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
								placeholder="Shelf, room, or storage area"
							/>
						</label>
					) : null}

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Manufacturer</span>
						<input
							type="text"
							value={manufacturer}
							onChange={(event) => setManufacturer(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
						/>
					</label>

					<label className="space-y-2">
						<span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Model</span>
						<input
							type="text"
							value={model}
							onChange={(event) => setModel(event.target.value)}
							className="w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-red-500/50 focus:outline-none"
						/>
					</label>

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
								onSave({
									equipmentName: equipmentName.trim(),
									assetNumber: assetNumber.trim(),
									locationType,
									apparatusId: apparatusId.trim(),
									otherLocation: otherLocation.trim(),
									status,
									datePlacedInService,
									manufacturer: manufacturer.trim(),
									model: model.trim(),
									notes,
									photoFile,
									removePhoto,
								});
							}}
							className="rounded-xl border border-red-500/40 bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSaving ? "Saving..." : mode === "add" ? "Create Equipment" : "Save Changes"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
