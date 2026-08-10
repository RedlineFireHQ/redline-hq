"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ResolveDeficiencyButtonProps = {
	deficiencyId: string;
	isResolved: boolean;
};

type MemberOption = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

export default function ResolveDeficiencyButton({
	deficiencyId,
	isResolved,
}: ResolveDeficiencyButtonProps) {
	const router = useRouter();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [repairNotes, setRepairNotes] = useState("");
	const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
	const [selectedResolvedByMemberId, setSelectedResolvedByMemberId] = useState("");
	const [resolvedStatusId, setResolvedStatusId] = useState("");
	const [isLoadingContext, setIsLoadingContext] = useState(false);
	const [isResolving, setIsResolving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isResolvedState, setIsResolvedState] = useState(isResolved);
	const [createMaintenanceAfterResolve, setCreateMaintenanceAfterResolve] = useState(false);

	async function openModal() {
		setIsLoadingContext(true);
		setErrorMessage(null);
		setRepairNotes("");
		setSelectedResolvedByMemberId("");
		setCreateMaintenanceAfterResolve(false);
		setIsModalOpen(true);

		const [{ data: members, error: membersError }, { data: statuses, error: statusesError }] =
			await Promise.all([
				supabase
					.from("members")
					.select("id, first_name, last_name")
					.order("last_name")
					.order("first_name"),
				supabase
					.from("deficiency_statuses")
					.select("id, name")
					.order("display_order"),
			]);

		if (membersError) {
			setErrorMessage(membersError.message);
			setIsLoadingContext(false);
			return;
		}

		if (statusesError) {
			setErrorMessage(statusesError.message);
			setIsLoadingContext(false);
			return;
		}

		const normalizedMembers: MemberOption[] = (members ?? []).map((memberRow) => {
			const row = memberRow as Record<string, unknown>;
			const idValue = row.id;

			return {
				id: typeof idValue === "string" ? idValue : String(idValue ?? ""),
				first_name: typeof row.first_name === "string" ? row.first_name : null,
				last_name: typeof row.last_name === "string" ? row.last_name : null,
			};
		});

		const resolvedStatus = (statuses ?? []).find((statusRecord) => {
			const nameValue = (statusRecord as { name?: unknown }).name;
			return typeof nameValue === "string" && nameValue.trim().toLowerCase() === "resolved";
		});
		const statusIdValue = (resolvedStatus as { id?: unknown } | undefined)?.id;
		const statusId = typeof statusIdValue === "string" ? statusIdValue : "";

		if (normalizedMembers.length === 0) {
			setErrorMessage("Unable to resolve deficiency: no members available.");
			setIsLoadingContext(false);
			return;
		}

		if (!statusId) {
			setErrorMessage("Unable to resolve deficiency: Resolved status is unavailable.");
			setIsLoadingContext(false);
			return;
		}

		setMemberOptions(normalizedMembers);
		setResolvedStatusId(statusId);
		setIsLoadingContext(false);
	}

	function closeModal() {
		if (isResolving) {
			return;
		}

		setIsModalOpen(false);
		setErrorMessage(null);
	}

	async function handleResolve() {
		if (!resolvedStatusId || !selectedResolvedByMemberId) {
			setErrorMessage("Unable to resolve deficiency right now.");
			return;
		}

		setIsResolving(true);
		setErrorMessage(null);

		const now = new Date().toISOString();
		const resolvedByMemberId = selectedResolvedByMemberId;
		const updatePayload = {
			status: resolvedStatusId,
			resolved_by: resolvedByMemberId,
			resolved_at: now,
			repair_notes: repairNotes.trim() || null,
			updated_at: now,
		};

		console.log("resolve deficiency deficiencyId:", deficiencyId);
		console.log("resolve deficiency resolvedByMemberId:", resolvedByMemberId);
		console.log("resolve deficiency resolvedStatusId:", resolvedStatusId);
		console.log("resolve deficiency repairNotes:", repairNotes);
		console.log("resolve deficiency updatePayload:", updatePayload);

		const updateResult = await supabase
			.from("deficiencies")
			.update(updatePayload)
			.eq("id", deficiencyId);

		const updateError = updateResult.error;
		console.log("resolve deficiency updateResult:", updateResult);
		console.log("resolve deficiency updateError:", updateError);

		if (updateError) {
			setErrorMessage(updateError.message);
			setIsResolving(false);
			return;
		}

		const { error: historyError } = await supabase
			.from("deficiency_history")
			.insert({
				deficiency_id: deficiencyId,
				member_id: resolvedByMemberId,
				event_type: "Resolved",
				event_description: `Resolved. ${repairNotes}`,
			});

		if (historyError) {
			console.error("Resolve Deficiency history insert error:", historyError);
		}

		setIsResolving(false);
		setIsResolvedState(true);
		setIsModalOpen(false);

		if (createMaintenanceAfterResolve) {
			router.push(`/maintenance?create=1&deficiencyId=${deficiencyId}`);
			return;
		}

		router.refresh();
	}

	return (
		<>
			<button
				type="button"
				onClick={openModal}
				disabled={isResolvedState}
				className="rounded-xl border border-emerald-500/30 bg-emerald-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
			>
				Resolve
			</button>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-10 backdrop-blur-sm">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
					>
						<div className="border-b border-white/10 px-6 py-5">
							<h2 className="text-2xl font-black tracking-tight text-white">Resolve Deficiency</h2>
							<p className="mt-2 text-sm text-zinc-400">
								Capture repair completion details and mark this deficiency resolved.
							</p>
						</div>

						<div className="space-y-6 px-6 py-6">
							{errorMessage ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{errorMessage}
								</div>
							) : null}

							{isLoadingContext ? (
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
									Loading resolve details...
								</div>
							) : (
								<>
									<label className="block">
										<span className="mb-2 block text-sm font-semibold text-zinc-200">
											Repair Notes
										</span>
										<textarea
											rows={5}
											value={repairNotes}
											onChange={(event) => setRepairNotes(event.target.value)}
											className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50"
											placeholder="Describe what was repaired and any follow-up actions."
										/>
									</label>

									<label className="block">
										<span className="mb-2 block text-sm font-semibold text-zinc-200">
											Resolved By
										</span>
										<select
											value={selectedResolvedByMemberId}
											onChange={(event) => setSelectedResolvedByMemberId(event.target.value)}
											className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-300 outline-none"
										>
											<option value="">Select member</option>
											{memberOptions.map((member) => {
												const firstName = member.first_name ?? "";
												const lastName = member.last_name ?? "";
												const fullName = `${firstName} ${lastName}`.trim() || member.id;

												return (
													<option key={member.id} value={member.id}>
														{fullName}
													</option>
												);
											})}
										</select>
									</label>

									<label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#151515] px-4 py-3">
										<input
											type="checkbox"
											checked={createMaintenanceAfterResolve}
											onChange={(event) =>
												setCreateMaintenanceAfterResolve(event.target.checked)
											}
											className="h-4 w-4 rounded border-white/20 bg-[#121212] text-emerald-500"
										/>
										<span className="text-sm text-zinc-200">
											Perform Maintenance after resolving
										</span>
									</label>
								</>
							)}
						</div>

						<div className="flex justify-end gap-3 border-t border-white/10 px-6 py-5">
							<button
								type="button"
								onClick={closeModal}
								disabled={isResolving}
								className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleResolve}
								disabled={isResolving || isLoadingContext || isResolvedState || !selectedResolvedByMemberId}
								className="rounded-xl border border-emerald-500/30 bg-emerald-600/80 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isResolving ? "Resolving..." : "Resolve"}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
