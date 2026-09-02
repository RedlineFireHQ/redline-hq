import GroundLadderWorkspace from "@/components/inventory/GroundLadderWorkspace";
import PageLayout from "@/components/layout/PageLayout";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";
import { loadGroundLadderInventoryData } from "./data";

export const dynamic = "force-dynamic";

export default async function GroundLaddersPage() {
	const supabase = await createSupabaseServerClient();
	const member = await getCurrentMember(supabase);

	if (!member?.departmentId) {
		return (
			<PageLayout>
				<div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
					<p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">Inventory</p>
					<h1 className="mt-2 text-4xl font-black">Ground Ladders</h1>
					<p className="mt-4 text-neutral-400">You need an active department membership before you can open this inventory workspace.</p>
				</div>
			</PageLayout>
		);
	}

	const data = await loadGroundLadderInventoryData(supabase, member.departmentId);

	return (
		<PageLayout>
			<GroundLadderWorkspace
				departmentId={member.departmentId}
				departmentName={member.name ?? null}
				initialRows={data.ladders}
				initialAssignments={data.assignments}
				initialServiceTests={data.serviceTests}
				initialMaintenanceSettings={data.maintenanceSettings}
				initialMaintenanceRecords={data.maintenanceRecords}
				initialMaintenanceItems={data.maintenanceItems}
				apparatusOptions={data.apparatusOptions}
				canDeleteLadder={member.role === "administrator" || member.role === "officer"}
			/>
		</PageLayout>
	);
}
