import PageLayout from "@/components/layout/PageLayout";
import ThermalImagingCameraWorkspace from "@/components/inventory/ThermalImagingCameraWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type ThermalImagingCameraRecord = {
	id: string;
	department_id: string;
	camera_number: string;
	serial_number: string;
	manufacturer: string | null;
	model: string | null;
	camera_unit_id: string | null;
	status: "In Service" | "Unassigned" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string | null;
	created_at: string;
	updated_at: string;
};

function compareCameraNumbers(left: string | null | undefined, right: string | null | undefined) {
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

export default async function ThermalImagingCamerasInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;
	const canDeleteCamera = currentMember?.role === "administrator";

	let departmentName: string | null = null;
	let rows: ThermalImagingCameraRecord[] = [];
	let initialError: string | null = null;

	if (departmentId) {
		const { data: departmentData } = await supabase
			.from("departments")
			.select("name")
			.eq("id", departmentId)
			.maybeSingle();

		departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

		const { data, error } = await supabase
			.from("thermal_imaging_cameras")
			.select("id, department_id, camera_number, serial_number, manufacturer, model, camera_unit_id, status, notes, created_at, updated_at")
			.eq("department_id", departmentId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("[thermal-cameras] initial load failed", error);
			initialError = error.message || "Unable to load portable cameras.";
		}

		rows = [...((data ?? []) as ThermalImagingCameraRecord[])].sort((left, right) =>
			compareCameraNumbers(left.camera_number, right.camera_number),
		);
	}

	return (
		<PageLayout>
			<ThermalImagingCameraWorkspace
				departmentId={departmentId}
				departmentName={departmentName}
				initialRows={rows}
				initialError={initialError}
				canDeleteCamera={canDeleteCamera}
			/>
		</PageLayout>
	);
}
