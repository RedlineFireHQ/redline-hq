"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type PrintTestingRecordRow = {
	inventoryNumber: string | null;
	hoseSize: string | null;
	length?: string | null;
	result: string | null;
	relatedDeficiencies: string[];
};

interface PrintTestingRecordButtonProps {
	departmentName: string;
	testDate: string | null;
	tester: string | null;
	totalHoses: number;
	passedCount: number;
	failedCount: number;
	rows: PrintTestingRecordRow[];
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

export default function PrintTestingRecordButton({
	departmentName,
	testDate,
	tester,
	totalHoses,
	passedCount,
	failedCount,
	rows,
}: PrintTestingRecordButtonProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const hasLengthColumn = useMemo(() => rows.some((row) => typeof row.length === "string" && row.length.trim().length > 0), [rows]);

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
				Print Testing Record
			</button>

			{mounted
				? createPortal(
					<>
						<div className="print-testing-record hidden bg-white text-black print:block">
							<div className="mx-auto max-w-5xl px-8 py-8">
								<div className="border-b border-black pb-4">
									<p className="text-sm font-bold tracking-[0.25em] text-black">REDLINE HQ</p>
									<p className="mt-2 text-base font-semibold text-black">{departmentName}</p>
									<h1 className="mt-6 text-3xl font-black tracking-tight text-black">FIRE HOSE TESTING RECORD</h1>
								</div>

								<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
									{[
										{ label: "Testing Date", value: testDate ?? "-" },
										{ label: "Tester", value: tester ?? "-" },
										{ label: "Total Hoses Tested", value: String(totalHoses) },
										{ label: "Passed", value: String(passedCount) },
										{ label: "Failed", value: String(failedCount) },
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
												{[
													"Inventory Number",
													"Hose Size",
													...(hasLengthColumn ? ["Length"] : []),
													"Result",
													"Related Deficiency Number",
												].map((label) => (
													<th key={label} className="border-b border-black px-3 py-3 text-xs font-bold uppercase tracking-[0.16em] text-black">
														{label}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{rows.map((row, index) => (
												<tr key={`${row.inventoryNumber ?? "hose"}-${index}`}>
													<td className="border-b border-black px-3 py-3 text-sm text-black">{row.inventoryNumber ?? "-"}</td>
													<td className="border-b border-black px-3 py-3 text-sm text-black">{row.hoseSize ?? "-"}</td>
													{hasLengthColumn ? (
														<td className="border-b border-black px-3 py-3 text-sm text-black">{row.length ?? "-"}</td>
													) : null}
													<td className="border-b border-black px-3 py-3 text-sm font-semibold text-black">{formatResult(row.result)}</td>
													<td className="border-b border-black px-3 py-3 text-sm text-black">
														{row.relatedDeficiencies.length > 0 ? row.relatedDeficiencies.join(", ") : "-"}
													</td>
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

								.print-testing-record h1,
								.print-testing-record p {
									margin: 0;
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