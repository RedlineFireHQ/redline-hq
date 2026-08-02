import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

type DeficiencyRelation = {
	name: string | null;
};

type DeficiencyDetail = {
	id: string;
	deficiency_number: string | null;
	description: string | null;
	location: string | null;
	reported_at: string | null;
	created_at: string | null;
	updated_at: string | null;
	reported_by: string | null;
	reported_by_member_id: string | null;
	apparatus: DeficiencyRelation | null;
	priority: DeficiencyRelation | null;
	status: DeficiencyRelation | null;
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

	return {
		id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
		deficiency_number:
			typeof row.deficiency_number === "string" ? row.deficiency_number : null,
		description: typeof row.description === "string" ? row.description : null,
		location: typeof row.location === "string" ? row.location : null,
		reported_at: typeof row.reported_at === "string" ? row.reported_at : null,
		created_at: typeof row.created_at === "string" ? row.created_at : null,
		updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
		reported_by: typeof row.reported_by === "string" ? row.reported_by : null,
		reported_by_member_id:
			typeof row.reported_by_member_id === "string" ? row.reported_by_member_id : null,
		apparatus: normalizeDeficiencyRelation(row.apparatus),
		priority: normalizeDeficiencyRelation(row.priority),
		status: normalizeDeficiencyRelation(row.status),
	};
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
	const reportedBy =
		deficiency.reported_by ?? deficiency.reported_by_member_id ?? "Unassigned";

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

					<div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
						<button
							type="button"
							className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
						>
							Assign Repair
						</button>
						<button
							type="button"
							className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
						>
							Edit
						</button>
						<button
							type="button"
							className="rounded-xl border border-emerald-500/30 bg-emerald-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
						>
							Resolve
						</button>
					</div>
				</div>
			</div>
		</PageLayout>
	);
}
