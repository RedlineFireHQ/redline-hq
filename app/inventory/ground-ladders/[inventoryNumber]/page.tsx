import GroundLadderWorkspace from "@/components/inventory/GroundLadderWorkspace";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";
import { loadGroundLadderInventoryData } from "../data";

export const dynamic = "force-dynamic";

interface GroundLadderDetailPageProps {
	params: Promise<{
		inventoryNumber: string;
	}>;
}

function normalizeLadderNumber(value: string) {
	return decodeURIComponent(value).trim().toUpperCase();
}

export default async function GroundLadderDetailPage({ params }: GroundLadderDetailPageProps) {
	const resolvedParams = await params;
	const selectedLadderNumber = normalizeLadderNumber(resolvedParams.inventoryNumber);
	const supabase = await createSupabaseServerClient();
	const member = await getCurrentMember(supabase);

	if (!member?.departmentId) {
		return (
			
				<div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8">
					<p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">Inventory</p>
					<h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Ground Ladders</h1>
					<p className="mt-4 text-neutral-400">You need an active department membership before you can open this inventory workspace.</p>
				</div>
			
		);
	}

	const data = await loadGroundLadderInventoryData(supabase, member.departmentId);

	return (
		
			<GroundLadderWorkspace
				departmentId={member.departmentId}
				departmentName={member.name ?? null}
				initialRows={data.ladders}
				initialAssignments={data.assignments}
				initialServiceTests={data.serviceTests}
				apparatusOptions={data.apparatusOptions}
				selectedLadderNumber={selectedLadderNumber}
				canDeleteLadder={member.role === "administrator" || member.role === "officer"}
			/>
		
	);
}
