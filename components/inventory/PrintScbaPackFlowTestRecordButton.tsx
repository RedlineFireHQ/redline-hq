"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type PrintScbaPackFlowRow = {
	testDate: string | null;
	tester: string | null;
	result: string | null;
	notes: string | null;
};

interface PrintScbaPackFlowTestRecordButtonProps {
	departmentName: string;
	packNumber: string;
	totalTests: number;
	passCount: number;
	failCount: number;
	rows: PrintScbaPackFlowRow[];
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

export default function PrintScbaPackFlowTestRecordButton({
	departmentName,
	packNumber,
	totalTests,
	passCount,
	failCount,
	rows,
}: PrintScbaPackFlowTestRecordButtonProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const onPrint = () => {
		window.print();
	};

	return (
		<>
			<button
				type="button"
				onClick={onPrint}
				className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
			>
				Print Flow Test Record
			</button>

			{mounted
				? createPortal(
					<>
						<div className="print-testing-record hidden bg-white text-black print:block">
							<div className="mx-auto max-w-5xl px-8 py-8">
								<div className="border-b border-black pb-4">
									<p className="text-sm font-bold tracking-[0.25em] text-black">REDLINE HQ</p>
									<p className="mt-2 text-base font-semibold text-black">{departmentName}</p>
									<h1 className="mt-6 text-3xl font-black tracking-tight text-black">SCBA PACK FLOW TEST HISTORY</h1>
									<p className="mt-2 text-sm text-black">Pack {packNumber}</p>
								</div>

								<div className="mt-6 grid gap-3 sm:grid-cols-3">
									{[
										{ label: "Total Tests", value: String(totalTests) },
										{ label: "Pass", value: String(passCount) },
										{ label: "Fail", value: String(failCount) },
									].map((item) => (
										<div key={item.label} className="rounded border border-black px-4 py-3">
											<p className="text-xs font-semibold uppercase tracking-[0.18em] text-black">{item.label}</p>
											<p className="mt-2 text-sm font-medium text-black">{item.value}</p>
										</div>
									))}
								</div>

								<div className="mt-8">
									<table className="w-full border-collapse text-left">
										<thead>
											<tr>
												{["Test Date", "Tester", "Result", "Notes"].map((label) => (
													<th key={label} className="border-b border-black px-3 py-3 text-xs font-bold uppercase tracking-[0.16em] text-black">
														{label}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{rows.map((row, index) => (
												<tr key={`${row.testDate ?? "flow"}-${index}`}>
													<td className="border-b border-black px-3 py-3 text-sm text-black">{formatDate(row.testDate)}</td>
													<td className="border-b border-black px-3 py-3 text-sm text-black">{row.tester ?? "-"}</td>
													<td className="border-b border-black px-3 py-3 text-sm font-semibold text-black">{formatResult(row.result)}</td>
													<td className="border-b border-black px-3 py-3 text-sm text-black">{row.notes ?? "-"}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>

						<style jsx global>{`
							@media print {
								body {
									background: #ffffff !important;
									color: #000000 !important;
								}

								body > *:not(.print-testing-record) {
									display: none !important;
								}

								.print-testing-record {
									display: block !important;
									position: static !important;
									color: #000000 !important;
								}

								.print-testing-record * {
									color: #000000 !important;
									background: transparent !important;
									box-shadow: none !important;
								}

								.print-testing-record table,
								.print-testing-record th,
								.print-testing-record td {
									border-color: #000000 !important;
								}
							}
						`}</style>
					</>,
					document.body,
				)
				: null}
		</>
	);
}
