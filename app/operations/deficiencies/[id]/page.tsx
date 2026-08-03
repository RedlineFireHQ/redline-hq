import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import AssignRepairButton from "@/components/deficiencies/AssignRepairButton";
import EditDeficiencyButton from "@/components/deficiencies/EditDeficiencyButton";
import ResolveDeficiencyButton from "@/components/deficiencies/ResolveDeficiencyButton";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type DeficiencyRelation = {
	name: string | null;
};

type DeficiencyDetail = {
	id: string;
	deficiency_number: string | null;
	description: string | null;
	location: string | null;
	photo_path: string | null;
	reported_at: string | null;
	created_at: string | null;
	updated_at: string | null;
	reported_by: string | null;
	reported_by_member_id: string | null;
	assigned_to: string | null;
	category_id: string | null;
	priority_id: string | null;
	status_id: string | null;
	apparatus_id: string | null;
	apparatus: DeficiencyRelation | null;
	priority: DeficiencyRelation | null;
	status: DeficiencyRelation | null;
};

type AssignedMember = {
	first_name: string | null;
	last_name: string | null;
};

type DeficiencyHistoryEntry = {
	id: string;
	event_type: string | null;
	event_description: string | null;
	created_at: string | null;
	member_id: string | null;
};

interface DeficiencyDetailPageProps {
	params: Promise<{
		id: string;
	}>;
}

function normalizeDeficiencyRelation(value: unknown): DeficiencyRelation | null {
	if (Array.isArray(value)) {
		const first = value[0] as Record<string, unknown> | undefined;
		if (!first) {
			return null;
		}

		const nameValue = first.name;
		return {
			name: typeof nameValue === "string" ? nameValue : null,
		};
	}

	if (value && typeof value === "object") {
		const relation = value as Record<string, unknown>;
		const nameValue = relation.name;

		return {
			name: typeof nameValue === "string" ? nameValue : null,
		};
	}

	return null;
}

function normalizeDeficiencyDetail(data: unknown): DeficiencyDetail {
	const row = (data ?? {}) as Record<string, unknown>;
	const priorityValue = row.priority;
	const statusValue = row.status;
	const categoryValue = row.category_id;
	const apparatusIdValue = row.apparatus_id;

	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		deficiency_number:
			typeof row.deficiency_number === "string" ? row.deficiency_number : null,
		description: typeof row.description === "string" ? row.description : null,
		location: typeof row.location === "string" ? row.location : null,
		photo_path: typeof row.photo_path === "string" ? row.photo_path : null,
		reported_at: typeof row.reported_at === "string" ? row.reported_at : null,
		created_at: typeof row.created_at === "string" ? row.created_at : null,
		updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
		reported_by: typeof row.reported_by === "string" ? row.reported_by : null,
		reported_by_member_id:
			typeof row.reported_by_member_id === "string" ? row.reported_by_member_id : null,
		assigned_to: typeof row.assigned_to === "string" ? row.assigned_to : null,
		category_id: typeof categoryValue === "string" ? categoryValue : null,
		priority_id: typeof priorityValue === "string" ? priorityValue : null,
		status_id: typeof statusValue === "string" ? statusValue : null,
		apparatus_id: typeof apparatusIdValue === "string" ? apparatusIdValue : null,
		apparatus: normalizeDeficiencyRelation(row.apparatus),
		priority: normalizeDeficiencyRelation(row.priority),
		status: normalizeDeficiencyRelation(row.status),
	};
}

function normalizeAssignedMember(data: unknown): AssignedMember | null {
	if (!data || typeof data !== "object") {
		return null;
	}

	const row = data as Record<string, unknown>;
	const firstNameValue = row.first_name;
	const lastNameValue = row.last_name;

	return {
		first_name: typeof firstNameValue === "string" ? firstNameValue : null,
		last_name: typeof lastNameValue === "string" ? lastNameValue : null,
	};
}

function normalizeDeficiencyHistory(data: unknown[] | null): DeficiencyHistoryEntry[] {
	return (data ?? []).map((record) => {
		const row = record as Record<string, unknown>;
		const idValue = row.id;

		return {
			id: typeof idValue === "string" ? idValue : String(idValue ?? ""),
			event_type: typeof row.event_type === "string" ? row.event_type : null,
			event_description:
				typeof row.event_description === "string" ? row.event_description : null,
			created_at: typeof row.created_at === "string" ? row.created_at : null,
			member_id: typeof row.member_id === "string" ? row.member_id : null,
		};
	});
}

function formatDateTime(value: string | null) {
	if (!value) {
		return "Not available";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function getStatusBadgeClasses(status: string) {
	const normalizedStatus = status.trim().toLowerCase();

	if (normalizedStatus === "open") {
		return "bg-red-500/20 text-red-200";
	}

	if (normalizedStatus === "in progress") {
		return "bg-amber-400/25 text-amber-100";
	}

	if (normalizedStatus === "resolved") {
		return "bg-emerald-500/20 text-emerald-200";
	}

	return "bg-zinc-500/20 text-zinc-200";
}

function getPriorityBadgeClasses(priority: string) {
	const normalizedPriority = priority.trim().toLowerCase();

	if (normalizedPriority === "critical") {
		return "bg-red-500/20 text-red-200";
	}

	if (normalizedPriority === "high") {
		return "bg-orange-500/20 text-orange-200";
	}

	if (normalizedPriority === "medium") {
		return "bg-amber-400/25 text-amber-100";
	}

	if (normalizedPriority === "low") {
		return "bg-blue-500/20 text-blue-200";
	}

	if (normalizedPriority === "informational") {
		return "bg-zinc-500/20 text-zinc-200";
	}

	return "bg-zinc-500/20 text-zinc-200";
}

export default async function DeficiencyDetailPage({
	params,
}: DeficiencyDetailPageProps) {
	const supabase = await createSupabaseServerClient();
	const { id } = await params;

	const { data, error } = await supabase
		.from("deficiencies")
		.select(
			"*, priority:deficiency_priorities!fk_deficiencies_priority(name), status:deficiency_statuses!fk_deficiencies_status(name), apparatus:apparatus!fk_deficiencies_apparatus(name)"
		)
		.eq("id", id)
		.maybeSingle();

	if (error) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-4xl space-y-6">
					<Link
						href="/deficiencies"
						className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
					>
						Back to Active Log
					</Link>

					<div className="rounded-2xl border border-red-500/20 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
						<p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
							Unable to load deficiency
						</p>
						<h1 className="mt-3 text-3xl font-black tracking-tight text-white">
							Deficiency not found
						</h1>
						<p className="mt-3 text-zinc-400">
							We could not retrieve this deficiency record. It may have been removed or the link may be invalid.
						</p>
					</div>
				</div>
			</PageLayout>
		);
	}

	if (!data) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-4xl space-y-6">
					<Link
						href="/deficiencies"
						className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
					>
						Back to Active Log
					</Link>

					<div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
						<p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">
							Deficiency Details
						</p>
						<h1 className="mt-3 text-3xl font-black tracking-tight text-white">
							Deficiency not found
						</h1>
						<p className="mt-3 text-zinc-400">
							The requested deficiency could not be found. Verify the link or return to the active log.
						</p>
					</div>
				</div>
			</PageLayout>
		);
	}

	const deficiency = normalizeDeficiencyDetail(data);
	const statusName = deficiency.status?.name ?? "Unknown";
	const priorityName = deficiency.priority?.name ?? "Not set";
	const isResolved = statusName.trim().toLowerCase() === "resolved";
	const reportedBy =
		deficiency.reported_by ?? deficiency.reported_by_member_id ?? "Unassigned";

	let assignedMember: AssignedMember | null = null;

	if (deficiency.assigned_to) {
		const { data: assignedMemberData } = await supabase
			.from("members")
			.select("first_name, last_name")
			.eq("id", deficiency.assigned_to)
			.maybeSingle();

		assignedMember = normalizeAssignedMember(assignedMemberData);
	}

	const assignedToLabel = assignedMember
		? `${assignedMember.first_name ?? ""} ${assignedMember.last_name ?? ""}`.trim() ||
			"Unassigned"
		: "Unassigned";

	const photoUrl = deficiency.photo_path
		? supabase.storage.from("deficiency-photos").getPublicUrl(deficiency.photo_path).data
				.publicUrl
		: null;

	const { data: historyData, error: historyError } = await supabase
		.from("deficiency_history")
		.select("id, event_type, event_description, created_at, member_id")
		.eq("deficiency_id", deficiency.id)
		.order("created_at", { ascending: true });

	const historyEntries = normalizeDeficiencyHistory(historyData as unknown[] | null);
	const historyMemberIds = Array.from(
		new Set(
			historyEntries
				.map((entry) => entry.member_id)
				.filter((memberId): memberId is string => Boolean(memberId))
		)
	);

	let historyMemberNameById: Record<string, string> = {};

	if (historyMemberIds.length > 0) {
		const { data: historyMembersData } = await supabase
			.from("members")
			.select("id, first_name, last_name")
			.in("id", historyMemberIds);

		historyMemberNameById = (historyMembersData ?? []).reduce<Record<string, string>>(
			(accumulator, memberRow) => {
				const row = memberRow as Record<string, unknown>;
				const idValue = row.id;
				const memberId = typeof idValue === "string" ? idValue : "";

				if (!memberId) {
					return accumulator;
				}

				const firstName = typeof row.first_name === "string" ? row.first_name : "";
				const lastName = typeof row.last_name === "string" ? row.last_name : "";
				const fullName = `${firstName} ${lastName}`.trim() || memberId;

				accumulator[memberId] = fullName;
				return accumulator;
			},
			{}
		);
	}

	return (
		<PageLayout>
			<div className="mx-auto max-w-5xl space-y-8">
				<Link
					href="/deficiencies"
					className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
				>
					Back to Active Log
				</Link>

				<div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
					<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">
								Deficiency Details
							</p>
							<h1 className="mt-2 text-4xl font-black tracking-tight text-white">
								{deficiency.deficiency_number ?? "Unassigned"}
							</h1>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<span
								className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusBadgeClasses(
									statusName
								)}`}
							>
								{statusName}
							</span>
							<span
								className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${getPriorityBadgeClasses(
									priorityName
								)}`}
							>
								{priorityName}
							</span>
						</div>
					</div>

					<div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Apparatus</p>
							<p className="mt-2 text-sm font-semibold text-white">
								{deficiency.apparatus?.name ?? "Unknown Apparatus"}
							</p>
						</div>

						<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Reported By</p>
							<p className="mt-2 text-sm font-semibold text-white">{reportedBy}</p>
						</div>

						<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Assigned To</p>
							<p className="mt-2 text-sm font-semibold text-white">{assignedToLabel}</p>
						</div>

						<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Reported Date</p>
							<p className="mt-2 text-sm font-semibold text-white">
								{formatDateTime(deficiency.reported_at)}
							</p>
						</div>

						<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Created Date</p>
							<p className="mt-2 text-sm font-semibold text-white">
								{formatDateTime(deficiency.created_at)}
							</p>
						</div>

						<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Updated Date</p>
							<p className="mt-2 text-sm font-semibold text-white">
								{formatDateTime(deficiency.updated_at)}
							</p>
						</div>
					</div>

					<div className="mt-6 rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
						<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Description</p>
						<p className="mt-3 text-sm leading-6 text-zinc-200">
							{deficiency.description ?? "No description provided."}
						</p>
					</div>

					<div className="mt-4 rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
						<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Location</p>
						<p className="mt-3 text-sm leading-6 text-zinc-200">
							{deficiency.location ?? "Location not provided."}
						</p>
					</div>

					{photoUrl ? (
						<div className="mt-4 rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
							<p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Photo</p>
							<a
								href={photoUrl}
								target="_blank"
								rel="noreferrer"
								className="mt-3 inline-block overflow-hidden rounded-lg border border-white/10 transition hover:border-red-500/40"
							>
								<img
									src={photoUrl}
									alt="Deficiency photo"
									className="h-40 w-auto max-w-full object-cover"
								/>
							</a>
							<p className="mt-2 text-xs text-zinc-500">Click image to open full size.</p>
						</div>
					) : null}

					<div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
						<AssignRepairButton deficiencyId={deficiency.id} />
						<EditDeficiencyButton
							deficiencyId={deficiency.id}
							initialApparatusId={deficiency.apparatus_id}
							initialDescription={deficiency.description}
							initialLocation={deficiency.location}
							initialCategoryId={deficiency.category_id}
							initialPriorityId={deficiency.priority_id}
							initialStatusId={deficiency.status_id}
						/>
						<ResolveDeficiencyButton deficiencyId={deficiency.id} isResolved={isResolved} />
					</div>
				</div>

				<div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">
							History
						</h2>
					</div>

					{historyError ? (
						<div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
							Unable to load deficiency history.
						</div>
					) : historyEntries.length === 0 ? (
						<div className="mt-5 rounded-xl border border-white/10 bg-[#0d0d0d] px-4 py-4 text-sm text-zinc-400">
							No history records yet.
						</div>
					) : (
						<div className="mt-6 space-y-4">
							{historyEntries.map((entry, index) => {
								const memberName = entry.member_id
									? historyMemberNameById[entry.member_id] ?? "Unknown member"
									: null;

								return (
									<div key={entry.id || `${entry.created_at}-${index}`} className="relative pl-8">
										{index < historyEntries.length - 1 ? (
											<div className="absolute left-[9px] top-6 h-[calc(100%+12px)] w-px bg-white/10" />
										) : null}
										<div className="absolute left-0 top-2.5 h-[18px] w-[18px] rounded-full border border-red-500/40 bg-red-500/20" />

										<div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
											<div className="flex flex-wrap items-center justify-between gap-3">
												<p className="text-sm font-semibold text-white">
													{entry.event_type ?? "Unknown event"}
												</p>
												<p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
													{formatDateTime(entry.created_at)}
												</p>
											</div>
											<p className="mt-2 text-sm text-zinc-300">
												{entry.event_description ?? "No description provided."}
											</p>
											<p className="mt-3 text-xs text-zinc-500">
												Member: {memberName ?? "System"}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</PageLayout>
	);
}
