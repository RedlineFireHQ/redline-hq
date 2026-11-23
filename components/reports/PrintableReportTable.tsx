import type { ReportColumn, ReportRow } from "@/lib/reports/types";

export function PrintableReportTable({ columns, rows }: { columns: ReportColumn[]; rows: ReportRow[] }) {
	return (
		<table className="mt-4 w-full border-collapse text-left text-xs text-black">
			<thead>
				<tr>
					{columns.map((column) => (
						<th key={column.key} className="border border-black px-2 py-1 font-bold">
							{column.label}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, index) => (
					<tr key={`${index}-${row.id ?? "-"}`}>
						{columns.map((column) => (
							<td key={column.key} className="border border-black px-2 py-1">
								{row[column.key] ?? "-"}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
