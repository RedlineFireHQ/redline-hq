import PageLayout from "@/components/layout/PageLayout";
import Link from "next/link";
import type { ReactNode } from "react";

interface FireHoseDetailPageProps {
	params: Promise<{ inventoryNumber: string }>;
}

function formatInventoryNumber(value: string) {
	return decodeURIComponent(value).toUpperCase();
}

export default async function FireHoseDetailPage({ params }: FireHoseDetailPageProps) {
	const { inventoryNumber } = await params;
	const hoseId = formatInventoryNumber(inventoryNumber);

	const hose = {
		inventoryNumber: hoseId,
		hoseSize: '1¾"',
		length: "200'",
		manufacturer: "Mercedes Textiles",
		model: "DJ500",
		purchaseDate: "Jan 2024",
		inServiceDate: "Feb 2024",
		warrantyExpiration: "Jan 2029",
		status: "Ready",
		lastHoseTest: "Jan 2026",
		nextHoseTestDue: "Jan 2027",
	};

	const testingHistory = [
		{
			testDate: "Jan 15, 2026",
			testType: "Annual Hose Test",
			result: "Passed",
			inspector: "Lt. M. Daniels",
			notes: "No damage or pressure loss observed.",
		},
		{
			testDate: "Jan 10, 2025",
			testType: "Annual Hose Test",
			result: "Passed",
			inspector: "Capt. R. Ford",
			notes: "Couplings seated and locked correctly.",
		},
		{
			testDate: "Jan 12, 2024",
			testType: "In-Service Baseline Test",
			result: "Passed",
			inspector: "Eng. S. Lopez",
			notes: "Initial pressure certification completed.",
		},
	];

	const deficiencies = [
		{
			date: "May 04, 2026",
			status: "Open",
			description: "Jacket abrasion at 130-foot mark.",
			assignedTo: "FF T. Walker",
		},
		{
			date: "Mar 18, 2026",
			status: "Resolved",
			description: "Coupling thread wear identified during clean and inspect.",
			assignedTo: "Lt. M. Daniels",
		},
	];

	const serviceHistory = [
		"Added to inventory",
		"Passed annual hose test",
		"Coupling replaced",
		"Returned to service",
		"Marked out of service",
	];

	return (
		<PageLayout>
			<div className="space-y-8">
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Inventory</p>
						<h1 className="mt-2 text-5xl font-black tracking-tight text-white">{hose.inventoryNumber}</h1>
						<p className="mt-3 max-w-2xl text-lg text-neutral-400">
							{hose.hoseSize} • {hose.length}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex rounded-full border border-green-700/40 bg-green-900/20 px-3 py-1 text-xs font-semibold text-green-300">
							{hose.status}
						</span>
						<Link
							href="/inventory/fire-hose"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Back to Fire Hose Inventory
						</Link>
					</div>
				</div>

				<SectionShell title="General Information" subtitle="Inventory Profile">
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						<DetailField label="Inventory Number" value={hose.inventoryNumber} />
						<DetailField label="Hose Size" value={hose.hoseSize} />
						<DetailField label="Length" value={hose.length} />
						<DetailField label="Manufacturer" value={hose.manufacturer} />
						<DetailField label="Model" value={hose.model} />
						<DetailField label="Purchase Date" value={hose.purchaseDate} />
						<DetailField label="In Service Date" value={hose.inServiceDate} />
						<DetailField label="Warranty Expiration" value={hose.warrantyExpiration} />
						<DetailField label="Current Status" value={hose.status} />
					</div>
				</SectionShell>

				<SectionShell title="Testing" subtitle="Inspection Records">
					<div className="mb-4 grid gap-4 md:grid-cols-3">
						<DetailField label="Last Hose Test" value={hose.lastHoseTest} />
						<DetailField label="Next Hose Test Due" value={hose.nextHoseTestDue} />
						<div className="flex items-end">
							<button
								type="button"
								className="w-full rounded-lg border border-red-500/40 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
							>
								Log Hose Test
							</button>
						</div>
					</div>

					<SimpleTable
						columns={["Test Date", "Test Type", "Result", "Inspector", "Notes"]}
						rows={testingHistory.map((row) => [
							row.testDate,
							row.testType,
							row.result,
							row.inspector,
							row.notes,
						])}
					/>
				</SectionShell>

				<SectionShell title="Deficiencies" subtitle="Associated Deficiency Records">
					<div className="mb-4 flex justify-end">
						<Link
							href="/deficiencies/report"
							className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
						>
							Report Deficiency
						</Link>
					</div>

					<SimpleTable
						columns={["Date", "Status", "Description", "Assigned To"]}
						rows={deficiencies.map((row) => [
							row.date,
							row.status,
							row.description,
							row.assignedTo,
						])}
					/>
				</SectionShell>

				<SectionShell title="Service History" subtitle="Chronological Activity">
					<ul className="space-y-2">
						{serviceHistory.map((entry) => (
							<li
								key={entry}
								className="rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-200"
							>
								{entry}
							</li>
						))}
					</ul>
				</SectionShell>

				<SectionShell title="Documents" subtitle="Reference Files">
					<div className="rounded-xl border border-dashed border-white/15 bg-[#1b1b1b] px-4 py-6 text-sm text-neutral-400">
						Manufacturer documentation, warranty files, and department documents will appear here.
					</div>
				</SectionShell>

				<SectionShell title="Photos" subtitle="Hose Image Records">
					<div className="rounded-xl border border-dashed border-white/15 bg-[#1b1b1b] px-4 py-6 text-sm text-neutral-400">
						Photo records for this hose will appear here.
					</div>
				</SectionShell>

				<SectionShell title="Notes" subtitle="Operational Notes">
					<textarea
						rows={5}
						placeholder="Add operational notes for this hose item..."
						className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
					/>
				</SectionShell>
			</div>
		</PageLayout>
	);
}

function DetailField({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
			<p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</p>
			<p className="mt-2 text-sm font-semibold text-white">{value}</p>
		</div>
	);
}

function SectionShell({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle: string;
	children: ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
			<p className="text-xs uppercase tracking-[0.24em] text-neutral-500">{subtitle}</p>
			<h2 className="mt-2 text-2xl font-black tracking-tight text-white">{title}</h2>
			<div className="mt-4">{children}</div>
		</section>
	);
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
	return (
		<div className="overflow-x-auto">
			<table className="min-w-full border-separate border-spacing-0 text-left">
				<thead>
					<tr>
						{columns.map((column) => (
							<th
								key={column}
								scope="col"
								className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex} className="transition hover:bg-white/5">
							{row.map((cell, cellIndex) => (
								<td key={cellIndex} className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
