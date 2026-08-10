import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import PrintTestingRecordButton from "@/components/inventory/PrintTestingRecordButton";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type TestingSession = {
	id: string;
	test_date: string | null;
	tester: string | null;
	created_at: string | null;
};

type HoseResultRow = {
	testing_session_id: string | null;
	hose_id: string | null;
	inventory_number: string | null;
	test_date: string | null;
	tester: string | null;
	result: string | null;
};

type FireHoseRow = {
	id: string;
	inventory_number: string | null;
	hose_size: number | string | null;
};

type DeficiencyRow = {
	id: string;
	deficiency_number: string | null;
	fire_hose_id: string | null;
	status_info: { active: boolean | null; name: string | null } | { active: boolean | null; name: string | null }[] | null;
};

interface FireHoseTestingHistorySessionPageProps {
	params: Promise<{
		sessionId: string;
	}>;
}

function formatDate(value: string | null) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
}

function formatHoseSize(value: number | string | null) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return `${value}\"`;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return "-";
		}

		const parsed = Number.parseFloat(trimmed.replace(/"/g, ""));
		if (Number.isFinite(parsed)) {
			return `${parsed}\"`;
		}

		return trimmed.endsWith('"') ? trimmed : `${trimmed}\"`;
	}

	return "-";
}

function formatResult(value: string | null) {
	const normalized = (value ?? "").trim().toLowerCase();
	if (normalized === "pass") {
		return "PASS";
	}
	if (normalized === "fail") {
		return "FAIL";
	}
	return value ?? "-";
}

function getResultBadgeClasses(result: string) {
	const normalized = result.trim().toLowerCase();
	if (normalized === "pass") {
		return "border border-green-700/40 bg-green-900/20 text-green-200";
	}
	if (normalized === "fail") {
		return "border border-red-700/40 bg-red-900/20 text-red-200";
	}
	return "border border-white/15 bg-neutral-900 text-neutral-200";
}

function getDeficiencySummary(deficiencies: string[]) {
	if (deficiencies.length === 0) {
		return "None";
	}

	return deficiencies.join(", ");
}

export default async function FireHoseTestingHistorySessionPage({
	params,
}: FireHoseTestingHistorySessionPageProps) {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const { sessionId } = await params;

	if (!departmentId) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-6xl space-y-6">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Testing Session</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to determine your department.</p>
					</div>
				</div>
			</PageLayout>
		);
	}

	const { data: sessionData, error: sessionError } = await supabase
		.from("fire_hose_testing_sessions")
		.select("id, test_date, tester, created_at")
		.eq("id", sessionId)
		.eq("department_id", departmentId)
		.maybeSingle();

	if (sessionError || !sessionData) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-6xl space-y-6">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Testing Session</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">Testing session not found.</p>
					</div>
					<div className="rounded-2xl border border-red-900 bg-[#242424] p-6 text-sm text-red-200">
						{sessionError?.message ?? "No testing session matched this record."}
					</div>
					<Link
						href="/inventory/fire-hose/testing-history"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Back to Testing History
					</Link>
				</div>
			</PageLayout>
		);
	}

	const session = sessionData as TestingSession;

	const { data: resultRows } = await supabase
		.from("fire_hose_testing_results")
		.select("testing_session_id, hose_id, inventory_number, test_date, tester, result")
		.eq("testing_session_id", session.id)
		.eq("department_id", departmentId)
		.order("inventory_number", { ascending: true });

	const results = (resultRows ?? []) as HoseResultRow[];
	const hoseIds = results.map((row) => row.hose_id).filter((id): id is string => typeof id === "string" && id.length > 0);

	const { data: hoseRows } = hoseIds.length
		? await supabase
			.from("fire_hose")
			.select("id, inventory_number, hose_size")
			.eq("department_id", departmentId)
			.in("id", hoseIds)
		: { data: [] as FireHoseRow[] };

	const { data: deficiencyRows } = hoseIds.length
		? await supabase
			.from("deficiencies")
			.select("id, deficiency_number, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
			.in("fire_hose_id", hoseIds)
		: { data: [] as DeficiencyRow[] };

	const hoseById = new Map<string, FireHoseRow>();
	for (const hose of (hoseRows ?? []) as FireHoseRow[]) {
		hoseById.set(hose.id, hose);
	}

	const deficiencySummaryByHoseId = new Map<string, string[]>();
	for (const row of (deficiencyRows ?? []) as DeficiencyRow[]) {
		if (!row.fire_hose_id) {
			continue;
		}

		const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
		const statusName = statusInfo?.name ?? (statusInfo?.active ? "Active" : "Unknown");
		const deficiencyLabel = `${row.deficiency_number ?? row.id} (${statusName})`;
		const existing = deficiencySummaryByHoseId.get(row.fire_hose_id) ?? [];
		existing.push(deficiencyLabel);
		deficiencySummaryByHoseId.set(row.fire_hose_id, existing);
	}

	const passedCount = results.filter((row) => (row.result ?? "").trim().toLowerCase() === "pass").length;
	const failedCount = results.filter((row) => (row.result ?? "").trim().toLowerCase() === "fail").length;
	const departmentName = "Elliott Volunteer Fire Department";
	const printRows = results.map((row) => ({
		inventoryNumber: row.inventory_number ?? hoseById.get(row.hose_id ?? "")?.inventory_number ?? row.hose_id ?? null,
		hoseSize: row.hose_id ? formatHoseSize(hoseById.get(row.hose_id)?.hose_size ?? null) : "-",
		result: row.result,
	relatedDeficiencies:
			row.hose_id && deficiencySummaryByHoseId.has(row.hose_id)
				? (deficiencySummaryByHoseId.get(row.hose_id) ?? []).map((entry) => entry.split(" (")[0])
				: [],
	}));

	return (
		<PageLayout>
			<div className="mx-auto max-w-6xl space-y-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h1 className="mt-2 text-5xl font-black tracking-tight text-white">Testing Session</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">
							{formatDate(session.test_date)} • {session.tester ?? "-"}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex rounded-full border border-white/15 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-200">
							{results.length} Hoses Tested
						</span>
						<Link
							href="/inventory/fire-hose/testing-history"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Back to Testing History
						</Link>
						<PrintTestingRecordButton
							departmentName={departmentName}
							testDate={session.test_date}
							tester={session.tester}
							totalHoses={results.length}
							passedCount={passedCount}
							failedCount={failedCount}
							rows={printRows}
						/>
					</div>
				</div>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
					<div className="grid gap-3 md:grid-cols-4">
						<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Testing Date</p>
							<p className="mt-2 text-sm font-semibold text-white">{formatDate(session.test_date)}</p>
						</div>
						<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Tester</p>
							<p className="mt-2 text-sm font-semibold text-white">{session.tester ?? "-"}</p>
						</div>
						<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Passed</p>
							<p className="mt-2 text-sm font-semibold text-green-200">{passedCount}</p>
						</div>
						<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
							<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Failed</p>
							<p className="mt-2 text-sm font-semibold text-red-200">{failedCount}</p>
						</div>
					</div>
				</section>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
					<div className="overflow-x-auto">
						<table className="min-w-full border-separate border-spacing-0 text-left">
							<thead>
								<tr>
									{[
										"Inventory #",
										"Hose Size",
										"Result",
										"Testing Date",
										"Tester",
										"Related Deficiency",
									].map((label) => (
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
								{results.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400"
										>
											No hose results were saved for this testing session.
										</td>
									</tr>
								) : (
									results.map((row) => {
										const hose = row.hose_id ? hoseById.get(row.hose_id) ?? null : null;
										const deficiencySummary = row.hose_id
											? deficiencySummaryByHoseId.get(row.hose_id) ?? []
											: [];
										return (
											<tr key={`${session.id}-${row.hose_id ?? row.inventory_number ?? row.test_date ?? Math.random()}`} className="transition hover:bg-white/5">
												<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
													{row.inventory_number ?? hose?.inventory_number ?? row.hose_id ?? "-"}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{formatHoseSize(hose?.hose_size ?? null)}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getResultBadgeClasses(row.result ?? "")}`}>
														{formatResult(row.result)}
													</span>
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{formatDate(row.test_date ?? session.test_date)}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{row.tester ?? session.tester ?? "-"}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{getDeficiencySummary(deficiencySummary)}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</section>
			</div>
		</PageLayout>
	);
}
