import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadMobileInventoryItem } from "@/lib/mobile-inventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ categoryKey: string; id: string }> };

export default async function MobileInventoryDetailPage({ params }: Props) {
  const { categoryKey, id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) return null;
  const item = await loadMobileInventoryItem(supabase, currentMember.departmentId, categoryKey, id);

  if (!item) {
    return <main className="min-h-screen bg-[#080808] px-4 py-5 text-white"><div className="mx-auto max-w-3xl"><Link href="/mobile/inventory" className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-white/65"><ArrowLeft className="h-4 w-4" /> Back to Inventory</Link><div className="mt-6 rounded-2xl border border-white/10 bg-[#121212] p-5 text-sm font-bold text-white/55">This inventory item could not be found in your department.</div></div></main>;
  }

  return <main className="min-h-screen bg-[#080808] px-4 py-5 text-white sm:px-6"><div className="mx-auto max-w-3xl space-y-5"><Link href="/mobile/inventory" className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-white/65"><ArrowLeft className="h-4 w-4" /> Back to Inventory</Link><header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">{item.category}</p><h1 className="mt-2 break-words text-3xl font-black">{item.name}</h1><p className="mt-2 text-sm font-bold text-white/55">Department inventory detail</p></header><section className="grid gap-3 sm:grid-cols-2">{[["Status", item.status], ["Location / Apparatus", item.location], ["Quantity", item.quantity], ["Identifier", item.identifier], ["Serial Number", item.serialNumber], ["Manufacturer", item.manufacturer], ["Model", item.model]].filter(([, value]) => value !== "-").map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#121212] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{label}</p><p className="mt-2 break-words text-base font-black text-white">{value}</p></div>)}</section>{item.deficiencyCount > 0 ? <section className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4"><p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4" />{item.deficiencyCount} open {item.deficiencyCount === 1 ? "deficiency" : "deficiencies"}</p><p className="mt-2 text-sm leading-6 text-amber-100/70">Use the existing Deficiencies workflow to review or report an issue for this item.</p><Link href="/mobile/deficiencies" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-amber-200/25 px-4 text-sm font-black uppercase text-amber-100">Open Deficiencies <ExternalLink className="h-4 w-4" /></Link></section> : null}{item.notes !== "-" ? <section className="rounded-2xl border border-white/10 bg-[#121212] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">Notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{item.notes}</p></section> : null}{item.relatedHref ? <Link href={item.relatedHref} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#ef2b2d] px-4 text-sm font-black uppercase tracking-wide text-white">Open Related Inspection / Testing Workflow <ExternalLink className="h-4 w-4" /></Link> : null}</div></main>;
}
