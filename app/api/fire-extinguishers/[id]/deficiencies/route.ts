import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
	params: Promise<{
		id: string;
	}>;
};

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json",
		},
	});
}

function normalizeStatusName(value: unknown) {
	return typeof value === "string" && value.trim() ? value : null;
}

export async function GET(_: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const supabase = await createSupabaseServerClient();
		const currentMember = await getCurrentMember(supabase);

		if (!currentMember?.departmentId) {
			return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
		}

		const { data: item, error: itemError } = await supabase
			.from("fire_extinguishers")
			.select("id")
			.eq("id", id)
			.eq("department_id", currentMember.departmentId)
			.maybeSingle();

		if (itemError) {
			return jsonResponse({ ok: false, error: itemError.message || "Unable to load fire extinguisher deficiencies." }, 400);
		}

		if (!item) {
			return jsonResponse({ ok: false, error: "Fire extinguisher not found." }, 404);
		}

		const { data, error } = await supabase
			.from("deficiencies")
			.select("id, deficiency_number, description, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name), priority_info:deficiency_priorities!fk_deficiencies_priority(name)")
			.eq("fire_extinguisher_id", id)
			.order("reported_at", { ascending: false });

		if (error) {
			return jsonResponse({ ok: false, error: error.message || "Unable to load fire extinguisher deficiencies." }, 400);
		}

		const rows = (data ?? []).map((row) => {
			const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
			const priorityInfo = Array.isArray(row.priority_info) ? row.priority_info[0] : row.priority_info;
			return {
				id: row.id,
				deficiency_number: row.deficiency_number,
				description: row.description,
				reported_at: row.reported_at,
				priority_name: normalizeStatusName(priorityInfo?.name),
				status_name: normalizeStatusName(statusInfo?.name),
			};
		});

		return jsonResponse({ ok: true, rows });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to load fire extinguisher deficiencies.";
		return jsonResponse({ ok: false, error: message }, 400);
	}
}
