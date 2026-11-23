import type { ReportColumn, ReportRow } from "./types";

function csvCell(value: string | number | null | undefined) {
	const text = String(value ?? "");
	const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
	return `"${safe.replace(/"/g, '""')}"`;
}

export function reportToCsv(columns: ReportColumn[], rows: ReportRow[]) {
	return [
		columns.map((column) => csvCell(column.label)).join(","),
		...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(",")),
	].join("\r\n");
}
