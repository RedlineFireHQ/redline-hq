import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { runReport } from "@/lib/reports/server-runner";
import type { ReportRunRequest } from "@/lib/reports/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json",
		},
	});
}

function asObject(value: unknown) {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function toRequestPayload(input: unknown): ReportRunRequest | null {
	const root = asObject(input);
	if (!root) {
		return null;
	}

	const category = typeof root.category === "string" ? root.category : "";
	const searchTerm = typeof root.searchTerm === "string" ? root.searchTerm : "";
	const page = typeof root.page === "number" ? root.page : 1;
	const pageSize = typeof root.pageSize === "number" ? root.pageSize : 50;

	const dateRangeRaw = asObject(root.dateRange);
	const filtersRaw = asObject(root.filters) ?? {};

	if (!category || !dateRangeRaw) {
		return null;
	}

	const preset = typeof dateRangeRaw.preset === "string" ? dateRangeRaw.preset : "custom";
	const from = typeof dateRangeRaw.from === "string" ? dateRangeRaw.from : "";
	const to = typeof dateRangeRaw.to === "string" ? dateRangeRaw.to : "";

	const filters = Object.fromEntries(
		Object.entries(filtersRaw).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
	);

	return {
		category: category as ReportRunRequest["category"],
		searchTerm,
		dateRange: {
			preset: preset as ReportRunRequest["dateRange"]["preset"],
			from,
			to,
		},
		filters,
		page,
		pageSize,
	};
}

export async function POST(request: Request) {
	try {
		const supabase = await createSupabaseServerClient();
		const currentMember = await getCurrentMember(supabase);

		if (!currentMember?.departmentId) {
			return jsonResponse(
				{ ok: false, errorCode: "UNAUTHORIZED", error: "You must be signed in to run reports." },
				401,
			);
		}

		const hasReportsAccess = await hasDepartmentPermission(
			supabase,
			currentMember.departmentId,
			currentMember.role,
			"reports_management",
		);

		if (!hasReportsAccess) {
			return jsonResponse(
				{ ok: false, errorCode: "FORBIDDEN", error: "You do not have permission to run reports." },
				403,
			);
		}

		const payload = toRequestPayload(await request.json().catch(() => null));
		if (!payload) {
			return jsonResponse(
				{ ok: false, errorCode: "INVALID_INPUT", error: "Invalid report request payload." },
				400,
			);
		}

		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", currentMember.departmentId)
			.maybeSingle();

		const result = await runReport(payload, {
			supabase,
			departmentId: currentMember.departmentId,
			departmentName: typeof departmentData?.name === "string" ? departmentData.name : null,
			memberRole: currentMember.role,
		});

		if (!result.ok) {
			const status =
				result.errorCode === "UNAUTHORIZED"
					? 401
					: result.errorCode === "FORBIDDEN"
						? 403
						: result.errorCode === "INVALID_INPUT" || result.errorCode === "INVALID_DATE_RANGE"
							? 400
							: result.errorCode === "SOURCE_NOT_FOUND"
								? 404
								: 500;

			return jsonResponse(result, status);
		}

		return jsonResponse(result, 200);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to run report.";
		return jsonResponse({ ok: false, errorCode: "UNKNOWN_ERROR", error: message }, 500);
	}
}
