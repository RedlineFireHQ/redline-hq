import type { ReportDatePresetKey } from "@/lib/reports/types";

export type DateRangePreset = {
	key: ReportDatePresetKey;
	label: string;
};

export const REPORT_DATE_PRESETS: DateRangePreset[] = [
	{ key: "all-time", label: "All Time" },
	{ key: "custom", label: "Custom" },
	{ key: "today", label: "Today" },
	{ key: "last-7-days", label: "Last 7 Days" },
	{ key: "last-30-days", label: "Last 30 Days" },
	{ key: "last-90-days", label: "Last 3 Months" },
	{ key: "last-180-days", label: "Last 6 Months" },
	{ key: "this-month", label: "This Month" },
	{ key: "last-month", label: "Last Month" },
	{ key: "this-year", label: "This Year" },
	{ key: "last-year", label: "Last Year" },
];

type DateParts = {
	year: number;
	month: number;
	day: number;
};

function pad2(value: number) {
	return String(value).padStart(2, "0");
}

function formatDateOnly(parts: DateParts): string {
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function startOfDayParts(date: Date): DateParts {
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
	};
}

function addDays(parts: DateParts, days: number): DateParts {
	const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
	return {
		year: value.getUTCFullYear(),
		month: value.getUTCMonth() + 1,
		day: value.getUTCDate(),
	};
}

function firstDayOfMonth(parts: DateParts): DateParts {
	return { year: parts.year, month: parts.month, day: 1 };
}

function lastDayOfMonth(parts: DateParts): DateParts {
	const value = new Date(Date.UTC(parts.year, parts.month, 0));
	return {
		year: value.getUTCFullYear(),
		month: value.getUTCMonth() + 1,
		day: value.getUTCDate(),
	};
}

export function parseDateOnly(value: string): DateParts | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	const [yearRaw, monthRaw, dayRaw] = value.split("-");
	const year = Number(yearRaw);
	const month = Number(monthRaw);
	const day = Number(dayRaw);

	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return null;
	}

	const parsed = new Date(Date.UTC(year, month - 1, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() + 1 !== month ||
		parsed.getUTCDate() !== day
	) {
		return null;
	}

	return { year, month, day };
}

export function compareDateOnly(left: DateParts, right: DateParts): number {
	const leftTime = Date.UTC(left.year, left.month - 1, left.day);
	const rightTime = Date.UTC(right.year, right.month - 1, right.day);
	if (leftTime === rightTime) {
		return 0;
	}
	return leftTime > rightTime ? 1 : -1;
}

export function buildDateRangeFromPreset(
	preset: ReportDatePresetKey,
	now: Date = new Date(),
): { from: string; to: string } {
	const today = startOfDayParts(now);

	if (preset === "all-time") {
		return {
			from: "2000-01-01",
			to: "2100-12-31",
		};
	}

	if (preset === "today") {
		const date = formatDateOnly(today);
		return { from: date, to: date };
	}

	if (preset === "last-7-days") {
		return {
			from: formatDateOnly(addDays(today, -6)),
			to: formatDateOnly(today),
		};
	}

	if (preset === "last-30-days") {
		return {
			from: formatDateOnly(addDays(today, -29)),
			to: formatDateOnly(today),
		};
	}

	if (preset === "last-90-days") {
		return {
			from: formatDateOnly(addDays(today, -89)),
			to: formatDateOnly(today),
		};
	}

	if (preset === "last-180-days") {
		return {
			from: formatDateOnly(addDays(today, -179)),
			to: formatDateOnly(today),
		};
	}

	if (preset === "this-month") {
		return {
			from: formatDateOnly(firstDayOfMonth(today)),
			to: formatDateOnly(today),
		};
	}

	if (preset === "last-month") {
		const lastMonthDay = addDays(firstDayOfMonth(today), -1);
		return {
			from: formatDateOnly(firstDayOfMonth(lastMonthDay)),
			to: formatDateOnly(lastDayOfMonth(lastMonthDay)),
		};
	}

	if (preset === "this-year") {
		return {
			from: `${today.year}-01-01`,
			to: formatDateOnly(today),
		};
	}

	if (preset === "last-year") {
		const year = today.year - 1;
		return {
			from: `${year}-01-01`,
			to: `${year}-12-31`,
		};
	}

	const date = formatDateOnly(today);
	return { from: date, to: date };
}

export function formatReportPeriodLabel(from: string, to: string) {
	const fromDate = new Date(`${from}T00:00:00Z`);
	const toDate = new Date(`${to}T00:00:00Z`);

	if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
		return `${from} to ${to}`;
	}

	const formatter = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	});

	return `${formatter.format(fromDate)} to ${formatter.format(toDate)}`;
}

export function buildUtcBoundsForDateRange(from: string, to: string) {
	const fromParts = parseDateOnly(from);
	const toParts = parseDateOnly(to);

	if (!fromParts || !toParts) {
		return null;
	}

	if (compareDateOnly(fromParts, toParts) > 0) {
		return null;
	}

	const fromUtc = new Date(Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day, 0, 0, 0, 0));
	const toExclusiveParts = addDays(toParts, 1);
	const toExclusiveUtc = new Date(
		Date.UTC(toExclusiveParts.year, toExclusiveParts.month - 1, toExclusiveParts.day, 0, 0, 0, 0),
	);

	return {
		fromIso: fromUtc.toISOString(),
		toExclusiveIso: toExclusiveUtc.toISOString(),
	};
}
