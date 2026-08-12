import PageLayout from "@/components/layout/PageLayout";
import ScbaPackWorkspace from "@/components/inventory/ScbaPackWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type ScbaPackRecord = {
	id: string;
	department_id: string;
	pack_number: string;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
	in_service_date: string | null;
	last_flow_test_date: string | null;
	next_flow_test_due_date: string | null;
	status: string;
	notes: string | null;
	created_at: string;
};

function comparePackNumbers(left: string | null | undefined, right: string | null | undefined) {
	const leftValue = typeof left === "string" ? left.trim() : "";
	const rightValue = typeof right === "string" ? right.trim() : "";

	if (!leftValue && !rightValue) {
		return 0;
	}

	if (!leftValue) {
		return 1;
	}

	if (!rightValue) {
		return -1;
	}

	return leftValue.localeCompare(rightValue, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export default async function ScbaPacksInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canDeletePack = currentMember?.role === "administrator";

	let departmentName: string | null = null;
	let rows: ScbaPackRecord[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", departmentId)
			.maybeSingle();

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		const { data, error } = await supabase
			.from("scba_packs")
			.select(
				"id, department_id, pack_number, manufacturer, model, serial_number, in_service_date, last_flow_test_date, next_flow_test_due_date, status, notes, created_at",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[scba-packs] initial load failed", error);
			initialError = error.message || "Unable to load SCBA packs.";
		}

		rows = [...((data ?? []) as ScbaPackRecord[])].sort((left, right) =>
			comparePackNumbers(left.pack_number, right.pack_number),
		);
	}

	return (
		<PageLayout>
			<ScbaPackWorkspace
				departmentId={departmentId}
				departmentName={departmentName}
				initialRows={rows}
				initialError={initialError}
				canDeletePack={canDeletePack}
			/>
		</PageLayout>
	);
}
