import PageLayout from "@/components/layout/PageLayout";
import InventoryCategoryWorkspace from "@/components/inventory/InventoryCategoryWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

const quickActions = [
	{ label: "+ Add Hose", tone: "primary" as const },
	{ label: "Report Deficiency", href: "/deficiencies/report", tone: "danger" as const },
];

const columns = [
	{ key: "inventoryNumber", label: "Inventory Number" },
	{ key: "hoseSize", label: "Hose Size" },
	{ key: "length", label: "Length" },
	{ key: "inServiceDate", label: "In Service Date" },
	{ key: "nextTestDate", label: "Next Test Date" },
	{ key: "status", label: "Status" },
];

function formatMonthYear(value: string | null) {
	if (!value) {
		return "-";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatNextTestDate(value: string | null) {
	if (!value) {
		return "Pending";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (parsed.getTime() < today.getTime()) {
		return "Overdue";
	}

	return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatHoseSize(value: number | string | null) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return `${value}"`;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return "-";
		}

		const parsed = Number.parseFloat(trimmed.replace(/"/g, ""));
		if (Number.isFinite(parsed)) {
			return `${parsed}"`;
		}

		return trimmed.endsWith('"') ? trimmed : `${trimmed}"`;
	}

	return "-";
}

export default async function FireHoseInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canDeleteHose = currentMember?.role === "administrator";
	console.log("[fire-hose][trace] departmentId", departmentId);
	let departmentName: string | null = null;

	let rows: Array<Record<string, string>> = [];
	let initialError: string | null = null;
	let testsDueCount = 0;
	let openDeficienciesCount = 0;
	let outOfServiceCount = 0;
	let readinessScore = 100;

	if (departmentId) {
		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", departmentId)
			.maybeSingle();

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		const { data, error } = await supabase
			.from("fire_hose")
			.select(
				"id, inventory_number, hose_size, hose_length, booster_reel, in_service_date, next_test_date, status",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		console.log("[fire-hose][trace] supabase response", { data, error });
		console.log("[fire-hose][trace] data.length", Array.isArray(data) ? data.length : null);
		console.log(
			"[fire-hose][trace] raw next_test_date values",
			JSON.stringify(
				Array.isArray(data)
					? data.map((row) => ({
						id: row.id,
						inventory_number: row.inventory_number,
						next_test_date: row.next_test_date,
					}))
					: null,
			),
		);

		if (error) {
			console.error("[fire-hose] initial load failed", {
				message: error?.message,
				details: error?.details,
				hint: error?.hint,
				code: error?.code,
				error,
			});
			initialError = error.message || "Unable to load fire hose records.";
		}

		const hoseIds = (data ?? [])
			.filter((row) => row.status !== "Retired")
			.map((row) => row.id)
			.filter((id): id is string => typeof id === "string" && id.length > 0);

		const hasActiveDeficiencyByHoseId: Record<string, boolean> = {};
		const linkedDeficiencyCountByHoseId: Record<string, number> = {};
		const activeDeficiencyCountByHoseId: Record<string, number> = {};

		if (hoseIds.length > 0) {
			const { data: deficiencyRows, error: deficiencyRowsError } = await supabase
				.from("deficiencies")
				.select("id, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active)")
				.in("fire_hose_id", hoseIds);

			if (deficiencyRowsError) {
				console.error("[fire-hose] failed to load deficiency rows by fire_hose_id", {
					table: "deficiencies",
					select: "id, fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active)",
					filter: { fire_hose_id: hoseIds },
					error: {
						code: deficiencyRowsError.code ?? null,
						message: deficiencyRowsError.message ?? null,
						details: deficiencyRowsError.details ?? null,
						hint: deficiencyRowsError.hint ?? null,
					},
				});
			} else {
				for (const deficiencyRow of deficiencyRows ?? []) {
					const fireHoseId = deficiencyRow.fire_hose_id;
					if (typeof fireHoseId !== "string" || fireHoseId.length === 0) {
						continue;
					}

					linkedDeficiencyCountByHoseId[fireHoseId] =
						(linkedDeficiencyCountByHoseId[fireHoseId] ?? 0) + 1;

					const statusInfo = Array.isArray(deficiencyRow.status_info)
						? deficiencyRow.status_info[0]
						: deficiencyRow.status_info;
					const isActive = statusInfo?.active === true;

					if (isActive) {
						activeDeficiencyCountByHoseId[fireHoseId] =
							(activeDeficiencyCountByHoseId[fireHoseId] ?? 0) + 1;
						hasActiveDeficiencyByHoseId[fireHoseId] = true;
						openDeficienciesCount += 1;
					}
				}
			}
		}

		rows = (data ?? []).map((row) => {
			const hasActiveDeficiency = hasActiveDeficiencyByHoseId[row.id] === true;
			return {
				id: row.id,
				inventoryNumber: row.inventory_number,
				hoseSize: formatHoseSize(row.hose_size),
				length: row.booster_reel ? "N/A (Booster Reel Hose)" : `${row.hose_length ?? "-"} ft`,
				inServiceDateRaw: row.in_service_date ?? "",
				inServiceDate: formatMonthYear(row.in_service_date),
				nextTestDate: formatNextTestDate(row.next_test_date),
				deficiencyStatus: hasActiveDeficiency ? "Active" : "None",
				hasActiveDeficiency: hasActiveDeficiency ? "true" : "false",
				status: row.status,
			};
		});

		const activeRows = rows.filter((row) => row.status !== "Retired");

		testsDueCount = activeRows.filter(
			(row) => row.status === "Testing Due" || row.nextTestDate === "Overdue",
		).length;
		outOfServiceCount = activeRows.filter((row) => row.status === "Out of Service").length;

		const readyCount = activeRows.filter((row) => row.status === "Ready").length;
		const activeCount = activeRows.length;
		readinessScore = activeCount > 0 ? Math.round((readyCount / activeCount) * 100) : 100;

		for (const row of rows) {
			console.log("[fire-hose][deficiency-state]", {
				inventoryNumber: row.inventoryNumber,
				fireHoseId: row.id,
				linkedDeficiencyCount: linkedDeficiencyCountByHoseId[row.id] ?? 0,
				activeDeficiencyCount: activeDeficiencyCountByHoseId[row.id] ?? 0,
				hasActiveDeficiency: row.hasActiveDeficiency === "true",
			});
		}

		console.log("[fire-hose][trace] mapped rows", rows);
		console.log(
			"[fire-hose][trace] mapped nextTestDate values",
			JSON.stringify(
				rows.map((row) => ({
					id: row.id,
					inventoryNumber: row.inventoryNumber,
					nextTestDate: row.nextTestDate,
				})),
			),
		);
	}

	const readinessItems = [
		{
			label: `• ${testsDueCount} Hose Tests Due`,
			filter: "tests-due" as const,
			tone: "warning" as const,
		},
		{
			label: `• ${openDeficienciesCount} Open Deficiencies`,
			filter: "deficiencies" as const,
			tone: "warning" as const,
		},
		{
			label: `• ${outOfServiceCount} Out of Service`,
			filter: "out-of-service" as const,
			tone: "danger" as const,
		},
	];

	return (
		<PageLayout>
			<InventoryCategoryWorkspace
				title="Fire Hose"
				subtitle="Manage department fire hose inventory."
				readinessScore={readinessScore}
				readinessLabel="READY"
				readinessMessage="Fire hose inventory is operational."
				readinessItems={readinessItems}
				searchPlaceholder="Search by inventory number, hose size, or length..."
				filters={["Status", "Hose Size", "Testing Status"]}
				actions={quickActions}
				columns={columns}
				rows={rows}
				departmentId={departmentId}
				departmentName={departmentName}
				canDeleteHose={canDeleteHose}
				searchKeys={["inventoryNumber", "hoseSize", "length"]}
				initialError={initialError}
			/>
		</PageLayout>
	);
}