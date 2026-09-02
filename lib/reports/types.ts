export type ReportCategoryKey =
	| "training"
	| "personnel"
	| "certifications"
	| "apparatus"
	| "deficiencies"
	| "inventory"
	| "maintenance"
	| "pre-plans"
	| "ems"
	| "inspections"
	| "activity";

export type ReportDatePresetKey =
	| "all-time"
	| "today"
	| "last-7-days"
	| "last-30-days"
	| "last-90-days"
	| "last-180-days"
	| "this-month"
	| "last-month"
	| "this-year"
	| "last-year"
	| "custom";

export type ReportFilterType = "select" | "text";

export type ReportFilterOption = {
	value: string;
	label: string;
};

export type ReportFilterDefinition = {
	key: string;
	label: string;
	type: ReportFilterType;
	placeholder?: string;
	options?: ReportFilterOption[];
};

export type ReportColumn = {
	key: string;
	label: string;
	align?: "left" | "right";
};

export type ReportRow = Record<string, string | number | null>;

export type ReportSourceAvailability = "available" | "coming-soon";

export type ReportSourceConfig = {
	key: ReportCategoryKey;
	name: string;
	description: string;
	availability: ReportSourceAvailability;
	filters: ReportFilterDefinition[];
	columns: ReportColumn[];
};

export type ReportDateRangeInput = {
	preset: ReportDatePresetKey;
	from: string;
	to: string;
};

export type ReportRunRequest = {
	category: ReportCategoryKey;
	searchTerm: string;
	dateRange: ReportDateRangeInput;
	filters: Record<string, string>;
	page?: number;
	pageSize?: number;
};

export type AppliedReportFilter = {
	label: string;
	value: string;
};

export type ReportPeriod = {
	from: string;
	to: string;
	label: string;
	basisLabel: string;
};

export type ReportSummaryItem = {
	label: string;
	value: string;
};

export type ReportResultPayload = {
	ok: true;
	comingSoon: boolean;
	source: {
		key: ReportCategoryKey;
		name: string;
		description: string;
	};
	departmentName: string | null;
	generatedAt: string;
	period: ReportPeriod;
	filtersApplied: AppliedReportFilter[];
	summary?: ReportSummaryItem[];
	columns: ReportColumn[];
	rows: ReportRow[];
	totalRows: number;
	page: number;
	pageSize: number;
	message?: string;
};

export type ReportErrorCode =
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "INVALID_INPUT"
	| "INVALID_DATE_RANGE"
	| "SOURCE_NOT_FOUND"
	| "QUERY_ERROR"
	| "UNKNOWN_ERROR";

export type ReportErrorPayload = {
	ok: false;
	errorCode: ReportErrorCode;
	error: string;
};

export type ReportRunResponse = ReportResultPayload | ReportErrorPayload;
