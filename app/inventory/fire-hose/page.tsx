import PageLayout from "@/components/layout/PageLayout";
import InventoryCategoryWorkspace from "@/components/inventory/InventoryCategoryWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

const readinessItems = [
	{
		label: "• 9 Hose Tests Due",
		filter: "tests-due" as const,
		tone: "warning" as const,
	},
	{
		label: "• 2 Open Deficiencies",
		filter: "deficiencies" as const,
		tone: "warning" as const,
	},
	{ label: "• 1 Out of Service", filter: "out-of-service" as const, tone: "danger" as const },
];

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

	let rows: Array<Record<string, string>> = [];
	let initialError: string | null = null;

	if (departmentId) {
		const { data, error } = await supabase
			.from("fire_hose")
			.select("id, inventory_number, hose_size, hose_length, booster_reel, in_service_date, status")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[fire-hose] initial load failed", error);
			initialError = error.message || "Unable to load fire hose records.";
		}

		rows = (data ?? []).map((row) => ({
			id: row.id,
			inventoryNumber: row.inventory_number,
			hoseSize: formatHoseSize(row.hose_size),
			length: row.booster_reel ? "N/A (Booster Reel Hose)" : `${row.hose_length ?? "-"} ft`,
			inServiceDate: formatMonthYear(row.in_service_date),
			nextTestDate: "Pending",
			deficiencyStatus: "None",
			status: row.status,
		}));
	}

	return (
		<PageLayout>
			<InventoryCategoryWorkspace
				title="Fire Hose"
				subtitle="Manage department fire hose inventory."
				readinessScore={96}
				readinessLabel="READY"
				readinessMessage="Fire hose inventory is operational."
				readinessItems={readinessItems}
				searchPlaceholder="Search by inventory number, hose size, or length..."
				filters={["Status", "Hose Size", "Testing Status"]}
				actions={quickActions}
				columns={columns}
				rows={rows}
				departmentId={departmentId}
				searchKeys={["inventoryNumber", "hoseSize", "length"]}
				initialError={initialError}
			/>
		</PageLayout>
	);
}