import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type TestingSession = {
	id: string;
	test_date: string | null;
	tester: string | null;
	created_at: string | null;
};

type TestingResult = {
	testing_session_id: string | null;
	result: string | null;
};

type HoseRecord = {
	id: string;
	inventory_number: string | null;
	hose_size: number | string | null;
	hose_length: number | null;
	booster_reel: boolean | null;
};

type HoseTestingHistoryRecord = {
	testing_session_id: string | null;
	result: string | null;
	test_date: string | null;
	tester: string | null;
	inventory_number: string | null;
	hose_id: string | null;
};

interface FireHoseTestingHistoryPageProps {
	params: Promise<Record<string, never>>;
	searchParams: Promise<{
		hoseId?: string;
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

export default async function FireHoseTestingHistoryPage({
	searchParams,
}: FireHoseTestingHistoryPageProps) {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;

	const resolvedSearchParams = await searchParams;
	const hoseId = typeof resolvedSearchParams.hoseId === "string" ? resolvedSearchParams.hoseId.trim() : "";

	if (!departmentId) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-5xl space-y-6">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Testing History</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to determine your department.</p>
					</div>
				</div>
			</PageLayout>
		);
	}

	const { data: sessionRows, error: sessionError } = await supabase
		.from("fire_hose_testing_sessions")
		.select("id, test_date, tester, created_at")
		.eq("department_id", departmentId)
		.order("test_date", { ascending: false })
		.order("created_at", { ascending: false });

	if (hoseId) {
		const { data: hoseRow, error: hoseError } = await supabase
			.from("fire_hose")
			.select("id, inventory_number, hose_size, hose_length, booster_reel")
			.eq("department_id", departmentId)
			.eq("id", hoseId)
			.maybeSingle();

		const { data: hoseHistoryRows, error: hoseHistoryError } = await supabase
			.from("fire_hose_testing_results")
			.select("testing_session_id, result, test_date, tester, inventory_number, hose_id")
			.eq("department_id", departmentId)
			.eq("hose_id", hoseId)
			.order("test_date", { ascending: false })
			.order("created_at", { ascending: false });

		const { data: deficiencyRows } = await supabase
			.from("deficiencies")
			.select("id, deficiency_number, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
			.eq("fire_hose_id", hoseId);

		const hose = hoseRow as HoseRecord | null;
		const hoseHistory = (hoseHistoryRows ?? []) as HoseTestingHistoryRecord[];

		const deficiencyLabels = (deficiencyRows ?? []).map((row) => {
			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const statusName = statusInfo?.name ?? (statusInfo?.active ? "Active" : "Unknown");
			return `${row.deficiency_number ?? row.id} (${statusName})`;
		});

		const hoseSize = formatHoseSize(hose?.hose_size ?? null);
		const hoseLength = hose?.booster_reel ? "N/A (Booster Reel Hose)" : `${hose?.hose_length ?? "-"} ft`;

		return (
			<PageLayout>
				<div className="mx-auto max-w-6xl space-y-8">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
							<h1 className="mt-2 text-5xl font-black tracking-tight text-white">FIRE HOSE TESTING HISTORY</h1>
							<p className="mt-3 max-w-2xl text-lg text-neutral-400">
								Hose {hose?.inventory_number ?? hoseId}
								{hose ? ` • ${hoseSize} • ${hoseLength}` : ""}
							</p>
						</div>

						<Link
							href="/inventory/fire-hose/testing-history"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Back to All History
						</Link>
					</div>

					<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
						<div className="overflow-x-auto">
							<table className="min-w-full border-separate border-spacing-0 text-left">
								<thead>
									<tr>
										{[
											"Testing Date",
											"Tester",
											"Result",
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
									{hoseHistory.length === 0 ? (
										<tr>
											<td colSpan={4} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
												No hose testing records were found for this hose.
											</td>
										</tr>
									) : (
										hoseHistory.map((row, index) => (
											<tr key={`${row.testing_session_id ?? hoseId}-${index}`} className="transition hover:bg-white/5">
												<td className="border-b border-white/5 px-4 py-3 text-sm text-white">{formatDate(row.test_date)}</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.tester ?? "-"}</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.result === "pass" ? "border border-green-700/40 bg-green-900/20 text-green-200" : "border border-red-700/40 bg-red-900/20 text-red-200"}`}>
														{formatResult(row.result)}
													</span>
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{deficiencyLabels.length > 0 ? deficiencyLabels.join(", ") : "-"}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			</PageLayout>
		);
	}

	if (sessionError) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-5xl space-y-6">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Testing History</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to load testing history right now.</p>
					</div>
					<div className="rounded-2xl border border-red-900 bg-[#242424] p-6 text-sm text-red-200">
						{sessionError.message}
					</div>
				</div>
			</PageLayout>
		);
	}

	const sessions = (sessionRows ?? []) as TestingSession[];
	const sessionIds = sessions.map((session) => session.id).filter(Boolean);

	const { data: resultRows } = sessionIds.length
		? await supabase
			.from("fire_hose_testing_results")
			.select("testing_session_id, result")
			.eq("department_id", departmentId)
			.in("testing_session_id", sessionIds)
		: { data: [] as TestingResult[] };

	const countsBySessionId = new Map<
		string,
		{ total: number; passed: number; failed: number }
	>();

	for (const sessionId of sessionIds) {
		countsBySessionId.set(sessionId, { total: 0, passed: 0, failed: 0 });
	}

	for (const row of (resultRows ?? []) as TestingResult[]) {
		if (!row.testing_session_id) {
			continue;
		}

		const aggregate = countsBySessionId.get(row.testing_session_id) ?? { total: 0, passed: 0, failed: 0 };
		aggregate.total += 1;
		if ((row.result ?? "").trim().toLowerCase() === "pass") {
			aggregate.passed += 1;
		} else if ((row.result ?? "").trim().toLowerCase() === "fail") {
			aggregate.failed += 1;
		}
		countsBySessionId.set(row.testing_session_id, aggregate);
	}

	return (
		<PageLayout>
			<div className="mx-auto max-w-6xl space-y-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Fire Hose</p>
						<h1 className="mt-2 text-5xl font-black tracking-tight text-white">Testing History</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">
							Recent hose testing sessions recorded by the department.
						</p>
					</div>

					<Link
						href="/inventory/fire-hose"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Back to Fire Hose Inventory
					</Link>
				</div>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
					<div className="overflow-x-auto">
						<table className="min-w-full border-separate border-spacing-0 text-left">
							<thead>
								<tr>
									{[
										"Testing Date",
										"Tester",
										"Hoses Tested",
										"Passed",
										"Failed",
										"View",
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
								{sessions.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400"
										>
											<div className="space-y-2">
												<p className="text-lg font-bold text-white">No Hose Testing History</p>
												<p>Completed hose testing sessions will appear here.</p>
											</div>
										</td>
									</tr>
								) : (
									sessions.map((session) => {
										const counts = countsBySessionId.get(session.id) ?? { total: 0, passed: 0, failed: 0 };
										return (
											<tr key={session.id} className="transition hover:bg-white/5">
												<td className="border-b border-white/5 px-4 py-3 text-sm text-white">
													{formatDate(session.test_date)}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{session.tester ?? "-"}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													{counts.total}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-green-200">
													{counts.passed}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-red-200">
													{counts.failed}
												</td>
												<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
													<Link
														href={`/inventory/fire-hose/testing-history/${session.id}`}
														className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
													>
														View Session
													</Link>
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
