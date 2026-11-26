import Link from "next/link";
import { redirect } from "next/navigation";
import EmsExpirationWorkspace from "@/components/inventory/EmsExpirationWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function EmsExpirationsPage() {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) redirect("/login");
  const [{ data: supplies, error }, { data: department }] = await Promise.all([
    supabase.from("ems_supply_items").select("id,item_name,unit_of_measure,custom_unit_of_measure").eq("department_id", member.departmentId).eq("status", "Active").order("item_name"),
    supabase.from("departments").select("name").eq("id", member.departmentId).maybeSingle(),
  ]);
  const canManage = await hasInventoryPermission(supabase, member.departmentId, member.role, "ems_supply_management");
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/inventory/ems-supplies" className="text-sm font-semibold text-red-400">← Back to EMS Supplies</Link><p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{department?.name ?? "EMS Inventory"}</p><h1 className="mt-1 text-2xl font-black text-white">EMS Expiration Tracking</h1><p className="mt-1 text-sm text-neutral-400">Track multiple batches of the same supply and see the earliest and latest expiration dates.</p></div></div>
    {error ? <p className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">Unable to load EMS supplies: {error.message}</p> : <EmsExpirationWorkspace supplies={supplies ?? []} canManage={canManage}/>}
  </main>;
}
