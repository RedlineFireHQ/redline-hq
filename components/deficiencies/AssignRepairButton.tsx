"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MemberOption = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

type AssignRepairButtonProps = {
	deficiencyId: string;
};

function normalizeMemberOption(record: Record<string, unknown>): MemberOption {
	const idValue = record.id;
	const id = typeof idValue === "string" ? idValue : String(idValue ?? "");
	const firstNameValue = record.first_name;
	const lastNameValue = record.last_name;

	return {
		id,
		first_name: typeof firstNameValue === "string" ? firstNameValue : null,
		last_name: typeof lastNameValue === "string" ? lastNameValue : null,
	};
}

function getMemberDisplayName(member: MemberOption): string {
	const firstName = member.first_name?.trim() ?? "";
	const lastName = member.last_name?.trim() ?? "";
	const fullName = `${firstName} ${lastName}`.trim();
	return fullName || "Unnamed Member";
}

export default function AssignRepairButton({
	deficiencyId,
}: AssignRepairButtonProps) {
	const router = useRouter();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [members, setMembers] = useState<MemberOption[]>([]);
	const [isLoadingMembers, setIsLoadingMembers] = useState(false);
	const [membersError, setMembersError] = useState<string | null>(null);
	const [selectedMemberId, setSelectedMemberId] = useState("");
	const [isAssigning, setIsAssigning] = useState(false);
	const [assignError, setAssignError] = useState<string | null>(null);

	useEffect(() => {
		if (!isModalOpen) {
			return;
		}

		let isMounted = true;

		async function loadMembers() {
			setIsLoadingMembers(true);
			setMembersError(null);

			const { data, error } = await supabase
				.from("members")
				.select("id, first_name, last_name")
				.order("last_name", { ascending: true })
				.order("first_name", { ascending: true });

			if (!isMounted) {
				return;
			}

			if (error) {
				setMembersError("Unable to load members right now.");
				setMembers([]);
				setIsLoadingMembers(false);
				return;
			}

			setMembers(
				(data ?? []).map((record) =>
					normalizeMemberOption(record as Record<string, unknown>)
				)
			);
			setIsLoadingMembers(false);
		}

		loadMembers();

		return () => {
			isMounted = false;
		};
	}, [isModalOpen]);

	function openModal() {
		setAssignError(null);
		setMembersError(null);
		setSelectedMemberId("");
		setIsModalOpen(true);
	}

	function closeModal() {
		if (isAssigning) {
			return;
		}

		setIsModalOpen(false);
		setAssignError(null);
		setMembersError(null);
		setSelectedMemberId("");
	}

	async function handleAssign() {
		if (!selectedMemberId) {
			setAssignError("Select a member before assigning.");
			return;
		}

		console.log("Assign Repair deficiency id:", deficiencyId);
		console.log("Assign Repair selected member id:", selectedMemberId);

		setIsAssigning(true);
		setAssignError(null);

		const updateResult = await supabase
			.from("deficiencies")
			.update({ assigned_to: selectedMemberId })
			.eq("id", deficiencyId)
			.select("id, assigned_to");

		console.log("Assign Repair update result:", updateResult.data);
		console.log("Assign Repair update error:", updateResult.error);

		if (updateResult.error) {
			console.error("Assign Repair Supabase update error:", updateResult.error);
			setAssignError("Unable to assign repair right now.");
			setIsAssigning(false);
			return;
		}

		const selectedMemberName =
			members.find((member) => member.id === selectedMemberId)
				? getMemberDisplayName(
						members.find((member) => member.id === selectedMemberId) as MemberOption
				  )
				: "Unknown member";

		const { error: historyError } = await supabase
			.from("deficiency_history")
			.insert({
				deficiency_id: deficiencyId,
				member_id: selectedMemberId,
				event_type: "Assigned",
				event_description: `Assigned to ${selectedMemberName}.`,
			});

		if (historyError) {
			console.error("Assign Repair history insert error:", historyError);
		}

		setIsAssigning(false);
		setIsModalOpen(false);
		router.refresh();
	}

	return (
		<>
			<button
				type="button"
				onClick={openModal}
				className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
			>
				Assign Repair
			</button>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-10 backdrop-blur-sm">
					<div
						role="dialog"
						aria-modal="true"
						className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0f0f0f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
					>
						<div className="border-b border-white/10 px-6 py-5">
							<h2 className="text-2xl font-black tracking-tight text-white">Assign Repair</h2>
							<p className="mt-2 text-sm text-zinc-400">
								Select the firefighter responsible for this repair.
							</p>
						</div>

						<div className="space-y-5 px-6 py-6">
							{membersError ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{membersError}
								</div>
							) : null}

							{assignError ? (
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
									{assignError}
								</div>
							) : null}

							{isLoadingMembers ? (
								<div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">
									Loading members...
								</div>
							) : (
								<label className="block">
									<span className="mb-2 block text-sm font-semibold text-zinc-200">Member</span>
									<select
										value={selectedMemberId}
										onChange={(event) => setSelectedMemberId(event.target.value)}
										className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
									>
										<option value="">Select firefighter</option>
										{members.map((member) => (
											<option key={member.id} value={member.id}>
												{getMemberDisplayName(member)}
											</option>
										))}
									</select>
								</label>
							)}
						</div>

						<div className="flex justify-end gap-3 border-t border-white/10 px-6 py-5">
							<button
								type="button"
								onClick={closeModal}
								disabled={isAssigning}
								className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleAssign}
								disabled={isAssigning || isLoadingMembers}
								className="rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isAssigning ? "Assigning..." : "Assign"}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
