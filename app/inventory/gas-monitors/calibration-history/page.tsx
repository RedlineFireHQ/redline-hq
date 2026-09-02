import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type CalibrationRecord = {
	id: string;
	calibration_date: string | null;
	result: string | null;
	tester_mode: string | null;
	tester_member_id: string | null;
	external_tester_name: string | null;
	external_tester_company: string | null;
	notes: string | null;
	created_at: string | null;
};

type MonitorRecord = {
	id: string;
	monitor_number: string | null;
	serial_number: string | null;
	manufacturer: string | null;
	model: string | null;
};

interface GasMonitorCalibrationHistoryPageProps {
	searchParams: Promise<{
		monitorId?: string;
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
	if (normalized === "passed") {
		return "PASSED";
	}
	if (normalized === "failed") {
		return "FAILED";
	}
	return value ?? "-";
}

function formatTester(row: CalibrationRecord) {
	if (row.tester_mode === "Department Person" && row.tester_member_id) {
		return `Department Member (${row.tester_member_id})`;
	}
	if (row.tester_mode === "Name/Company") {
		return [row.external_tester_name, row.external_tester_company].filter(Boolean).join(" / ") || "-";
	}
	if (row.tester_mode === "External") {
		return row.external_tester_name || "-";
	}
	return row.external_tester_name || row.external_tester_company || "-";
}

export default async function GasMonitorCalibrationHistoryPage({
	searchParams,
}: GasMonitorCalibrationHistoryPageProps) {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const resolvedSearchParams = await searchParams;
	const monitorId = typeof resolvedSearchParams.monitorId === "string" ? resolvedSearchParams.monitorId.trim() : "";

	if (!departmentId) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-5xl space-y-6">
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Gas Monitors</p>
					<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Calibration History</h1>
					<p className="mt-3 max-w-2xl text-lg text-neutral-400">Unable to determine your department.</p>
				</div>
			</PageLayout>
		);
	}

	if (!monitorId) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-5xl space-y-6">
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Gas Monitors</p>
					<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Calibration History</h1>
					<p className="mt-3 max-w-2xl text-lg text-neutral-400">No gas monitor was selected.</p>
					<Link
						href="/inventory/gas-monitors"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Back to Gas Monitors
					</Link>
				</div>
			</PageLayout>
		);
	}

	const { data: monitorData, error: monitorError } = await supabase
		.from("gas_monitors")
		.select("id, monitor_number, serial_number, manufacturer, model")
		.eq("department_id", departmentId)
		.eq("id", monitorId)
		.maybeSingle();

	if (monitorError || !monitorData) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-5xl space-y-6">
					<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Gas Monitors</p>
					<h1 className="mt-2 text-4xl font-black tracking-tight text-white">Calibration History</h1>
					<p className="mt-3 max-w-2xl text-lg text-neutral-400">The selected gas monitor could not be found.</p>
					<Link
						href="/inventory/gas-monitors"
						className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
					>
						Back to Gas Monitors
					</Link>
				</div>
			</PageLayout>
		);
	}

	const monitor = monitorData as MonitorRecord;

	const { data: calibrationRows, error: calibrationError } = await supabase
		.from("gas_monitor_calibrations")
		.select("id, calibration_date, result, tester_mode, tester_member_id, external_tester_name, external_tester_company, notes, created_at")
		.eq("department_id", departmentId)
		.eq("gas_monitor_id", monitorId)
		.order("calibration_date", { ascending: false })
		.order("created_at", { ascending: false });

	const rows = ((calibrationRows ?? []) as CalibrationRecord[]).sort((left, right) => {
		const leftValue = left.calibration_date ?? "";
		const rightValue = right.calibration_date ?? "";
		return rightValue.localeCompare(leftValue);
	});

	return (
		<PageLayout>
			<div className="mx-auto max-w-6xl space-y-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Gas Monitors</p>
						<h1 className="mt-2 text-5xl font-black tracking-tight text-white">CALIBRATION HISTORY</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">
							Monitor {monitor.monitor_number ?? monitor.id}
							{monitor.serial_number ? ` • Serial ${monitor.serial_number}` : ""}
							{monitor.manufacturer || monitor.model ? ` • ${[monitor.manufacturer, monitor.model].filter(Boolean).join(" ")}` : ""}
						</p>
					</div>

					<div className="flex gap-2">
						<Link
							href="/inventory/gas-monitors"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Back to Gas Monitors
						</Link>
					</div>
				</div>

				<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
					<div className="overflow-x-auto">
						<table className="min-w-full border-separate border-spacing-0 text-left">
							<thead>
								<tr>
									{["Calibration Date", "Tester", "Result", "Notes"].map((label) => (
										<th key={label} scope="col" className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
											{label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.length === 0 ? (
									<tr>
										<td colSpan={4} className="border-b border-white/5 px-4 py-8 text-center text-sm text-neutral-400">
											No calibration history has been recorded for this gas monitor.
										</td>
									</tr>
								) : (
									rows.map((row) => (
										<tr key={row.id} className="transition hover:bg-white/5">
											<td className="border-b border-white/5 px-4 py-3 text-sm text-white">{formatDate(row.calibration_date)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatTester(row)}</td>
											<td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.result === "Passed" ? "border border-green-700/40 bg-green-900/20 text-green-200" : "border border-red-700/40 bg-red-900/20 text-red-200"}`}>
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
		</PageLayout>
	);
}
