import PageLayout from "@/components/layout/PageLayout";
import ScbaCylinderWorkspace from "@/components/inventory/ScbaCylinderWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type ScbaCylinderRecord = {
	id: string;
	department_id: string;
	cylinder_number: string;
	cylinder_type: "Composite" | "Steel" | string;
	in_service_date: string;
	last_hydrostatic_test_date: string | null;
	next_hydrostatic_test_due_date: string | null;
	service_life_end_date: string | null;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
	status: string;
	notes: string | null;
	created_at: string;
};

function compareCylinderNumbers(left: string | null | undefined, right: string | null | undefined) {
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

export default async function ScbaCylindersInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canDeleteCylinder = currentMember?.role === "administrator";

	let departmentName: string | null = null;
	let rows: ScbaCylinderRecord[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", departmentId)
			.maybeSingle();

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		const { data, error } = await supabase
			.from("scba_cylinders")
			.select(
				"id, department_id, cylinder_number, cylinder_type, in_service_date, last_hydrostatic_test_date, next_hydrostatic_test_due_date, service_life_end_date, manufacturer, model, serial_number, status, notes, created_at",
			)
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[scba-cylinders] initial load failed", error);
			initialError = error.message || "Unable to load SCBA cylinders.";
		}

		rows = [...((data ?? []) as ScbaCylinderRecord[])].sort((left, right) =>
			compareCylinderNumbers(left.cylinder_number, right.cylinder_number),
		);
	}

	return (
		<PageLayout>
			<ScbaCylinderWorkspace
				departmentId={departmentId}
				departmentName={departmentName}
				initialRows={rows}
				initialError={initialError}
				canDeleteCylinder={canDeleteCylinder}
			/>
		</PageLayout>
	);
}
