import Link from "next/link";
import PrintScbaPackFlowTestRecordButton from "@/components/inventory/PrintScbaPackFlowTestRecordButton";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type ScbaPackRow = {
	id: string;
	pack_number: string | null;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
};

type FlowTestRow = {
	id: string;
	test_date: string | null;
	tester: string | null;
	result: string | null;
	notes: string | null;
	created_at: string | null;
};

interface ScbaPackFlowTestHistoryPageProps {
	searchParams: Promise<{
		packId?: string;
	}>;
}

function formatDate(value: string | null) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});
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

function resultBadgeClasses(value: string | null) {
	const normalized = (value ?? "").trim().toLowerCase();
	if (normalized === "pass") {
		return "border border-green-700/40 bg-green-900/20 text-green-200";
	}
	if (normalized === "fail") {
		return "border border-red-700/40 bg-red-900/20 text-red-200";
	}
	return "border border-white/15 bg-neutral-900 text-neutral-200";
}

export default async function ScbaPackFlowTestHistoryPage({
	searchParams,
}: ScbaPackFlowTestHistoryPageProps) {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const resolvedSearchParams = await searchParams;
	const packId = typeof resolvedSearchParams.packId === "string" ? resolvedSearchParams.packId.trim() : "";

	if (!departmentId) {
		return (
			
				<div className="mx-auto max-w-5xl space-y-6">
					<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">SCBA Packs</p>
					<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Flow Test History</h1>
					<p className="text-neutral-400">Unable to determine your department.</p>
				</div>
			
		);
	}

	if (!packId) {
		return (
			
				<div className="mx-auto max-w-5xl space-y-6">
					<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">SCBA Packs</p>
					<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Flow Test History</h1>
					<p className="text-neutral-400">No SCBA pack was selected.</p>
					<Link
						href="/inventory/scba-packs"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Back to SCBA Packs
					</Link>
				</div>
			
		);
	}

	const { data: packData, error: packError } = await supabase
		.from("scba_packs")
		.select("id, pack_number, manufacturer, model, serial_number")
		.eq("department_id", departmentId)
		.eq("id", packId)
		.maybeSingle();

	if (packError || !packData) {
		return (
			
				<div className="mx-auto max-w-5xl space-y-6">
					<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">SCBA Packs</p>
					<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Flow Test History</h1>
					<p className="text-neutral-400">SCBA pack not found.</p>
					<Link
						href="/inventory/scba-packs"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Back to SCBA Packs
					</Link>
				</div>
			
		);
	}

	const pack = packData as ScbaPackRow;

	const { data: flowTestRows } = await supabase
		.from("scba_pack_flow_tests")
		.select("id, test_date, tester, result, notes, created_at")
		.eq("department_id", departmentId)
		.eq("scba_pack_id", packId)
		.order("test_date", { ascending: false })
		.order("created_at", { ascending: false });

	const rows = (flowTestRows ?? []) as FlowTestRow[];
	const passCount = rows.filter((row) => (row.result ?? "").trim().toLowerCase() === "pass").length;
	const failCount = rows.filter((row) => (row.result ?? "").trim().toLowerCase() === "fail").length;
	const departmentName = currentMember?.name ?? "Department";

	return (
		
			<div className="mx-auto max-w-6xl space-y-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">SCBA Packs</p>
						<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">FLOW TEST HISTORY</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">
							Pack {pack.pack_number ?? pack.id}
							{[pack.manufacturer, pack.model, pack.serial_number].filter(Boolean).length > 0
								? ` • ${[pack.manufacturer, pack.model, pack.serial_number].filter(Boolean).join(" • ")}`
								: ""}
						</p>
					</div>

					<div className="flex flex-wrap gap-2">
						<PrintScbaPackFlowTestRecordButton
							departmentName={departmentName}
							packNumber={pack.pack_number ?? pack.id}
							totalTests={rows.length}
							passCount={passCount}
							failCount={failCount}
							rows={rows.map((row) => ({
								testDate: row.test_date,
								tester: row.tester,
								result: row.result,
								notes: row.notes,
							}))}
						/>
						<Link
							href="/inventory/scba-packs"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Back to SCBA Packs
						</Link>
					</div>
				</div>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
					<div className="overflow-x-auto">
						<table className="min-w-full border-separate border-spacing-0 text-left">
							<thead>
								<tr>
									{["Test Date", "Tester", "Result", "Notes"].map((label) => (
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
								{rows.length === 0 ? (
									<tr>
										<td colSpan={4} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
											No flow-test history has been recorded for this SCBA pack.
										</td>
									</tr>
								) : (
									rows.map((row) => (
										<tr key={row.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">{formatDate(row.test_date)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.tester ?? "-"}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${resultBadgeClasses(row.result)}`}>
													{formatResult(row.result)}
												</span>
											</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.notes ?? "-"}</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</section>
			</div>
		
	);
}
