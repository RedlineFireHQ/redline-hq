import Link from "next/link";
import EmsContainerContentsWorkspace from "@/components/inventory/EmsContainerContentsWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function EmsContainerContentsPage() {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  const departmentId = member?.departmentId;
  if (!departmentId) return <p className="p-6 text-sm text-neutral-300">Sign in to manage EMS container contents.</p>;
  const allowed = await hasDepartmentPermission(supabase, departmentId, member?.role, "inventory_management");
  if (!allowed) return <p className="p-6 text-sm text-neutral-300">You do not have permission to manage EMS inventory.</p>;

  const [{ data: bags }, { data: boxes }, { data: supplies }, { data: existing, error }] = await Promise.all([
    supabase.from("pediatric_bags").select("id, bag_label").eq("department_id", departmentId).eq("is_active", true).order("bag_label"),
    supabase.from("drug_boxes").select("id, squad_number").eq("department_id", departmentId).eq("is_active", true).order("squad_number"),
    supabase.from("ems_supply_items").select("id, item_name, unit_of_measure").eq("department_id", departmentId).eq("status", "active").order("item_name"),
    supabase.from("ems_supply_container_contents").select("id, container_type, container_id, template_item_key, supply_item_id, quantity_on_hand, notes").eq("department_id", departmentId),
  ]);
  if (error) console.error("[ems-container-contents] load failed", error);
  const containers = [
    ...((bags ?? []) as Array<{id:string;bag_label:string}>).map((bag) => ({ id: bag.id, label: `Pediatric Bag ${bag.bag_label}`, type: "pediatric_bag" as const })),
    ...((boxes ?? []) as Array<{id:string;squad_number:string}>).map((box) => ({ id: box.id, label: `Drug Box — Squad ${box.squad_number}`, type: "drug_box" as const })),
  ];
  return <div className="mx-auto max-w-5xl space-y-4 p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-red-400">EMS Inventory</p><h1 className="mt-1 text-2xl font-black text-white">Bag &amp; Drug Box Contents</h1><p className="mt-1 text-sm text-neutral-400">Connect checklist items to your EMS supply inventory.</p></div><Link href="/inventory/ems-supplies" className="text-sm font-semibold text-red-300">Back to Supplies</Link></div>
    <EmsContainerContentsWorkspace departmentId={departmentId} containers={containers} supplies={(supplies ?? []) as Array<{id:string;item_name:string;unit_of_measure:string}>} existing={(existing ?? []) as never[]} />
  </div>;
}
