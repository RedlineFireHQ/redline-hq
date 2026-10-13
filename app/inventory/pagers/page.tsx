import { redirect } from "next/navigation";
import PagersWorkspace from "@/components/inventory/PagersWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PagerRecord = {
	id: string;
	department_id: string;
	pager_number: string;
	serial_number: string | null;
	manufacturer: string | null;
	model: string | null;
	pager_type: string | null;
	location: string | null;
	assigned_member_id: string | null;
	status: "In Service" | "Out of Service" | "Lost" | "Stolen" | "Retired";
	notes: string | null;
	created_at: string | null;
	updated_at: string | null;
};

type MemberOption = {
	id: string;
	first_name: string | null;
	last_name: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PagersInventoryPage() {
	const supabase = await createSupabaseServerClient();
	const currentMember = await getCurrentMember(supabase);
	const departmentId = currentMember?.departmentId ?? null;

	if (!departmentId) {
		redirect("/login");
	}

	const canManagePagers = await hasInventoryPermission(
		supabase,
		departmentId,
		currentMember?.role,
		"pager_management",
	);

	const [{ data: departmentData }, { data, error }] = await Promise.all([
		supabase.from("departments").select("name").eq("id", departmentId).maybeSingle(),
		supabase
			.from("pagers")
			.select("id, department_id, pager_number, serial_number, manufacturer, model, pager_type, location, assigned_member_id, status, notes, created_at, updated_at")
			.eq("department_id", departmentId)
			.order("pager_number", { ascending: true }),
	]);

	let memberOptions: MemberOption[] = [];
	let membersError: string | null = null;
	const membersResult = await supabase
		.from("members")
		.select("id, first_name, last_name")
		.eq("department_id", departmentId)
		.eq("active", true)
		.order("last_name", { ascending: true });

	if (membersResult.error) {
		const fallback = await supabase
			.from("members")
			.select("id, first_name, last_name")
			.eq("department_id", departmentId)
			.order("last_name", { ascending: true });
		if (fallback.error) {
			membersError = fallback.error.message || "Unable to load department members.";
		} else {
			memberOptions = (fallback.data ?? []) as MemberOption[];
		}
	} else {
		memberOptions = (membersResult.data ?? []) as MemberOption[];
	}

	return (
		<PagersWorkspace
			departmentId={departmentId}
			departmentName={typeof departmentData?.name === "string" ? departmentData.name : null}
			initialPagers={(data ?? []) as PagerRecord[]}
			memberOptions={memberOptions}
			membersError={membersError}
			initialError={error?.message ?? null}
			canManagePagers={canManagePagers}
		/>
	);
}
