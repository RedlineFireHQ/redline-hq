import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ packId?: string }> };
export default async function ScbaInspectionHistoryPage({ searchParams }: Props) {
  const { packId } = await searchParams;
  if (!packId) notFound();
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) redirect("/login");
  const [{ data: pack }, { data: records, error }] = await Promise.all([
    supabase.from("scba_packs").select("id, pack_number, manufacturer, model, serial_number").eq("id", packId).eq("department_id", member.departmentId).maybeSingle(),
    supabase.from("scba_inspection_results").select("id, result, notes, created_at, session:session_id(inspection_type, inspected_at, inspected_by, notes, inspector:inspected_by(first_name,last_name))").eq("department_id", member.departmentId).eq("scba_pack_id", packId).order("created_at", { ascending: false }),
  ]);
  if (!pack) notFound();
  return <main className="min-h-screen bg-[#0b0c0e] px-4 py-6 text-white sm:px-8"><div className="mx-auto max-w-4xl">
    <Link href="/inventory/scba-packs" className="inline-flex min-h-12 items-center text-sm font-bold text-white/60">Back to SCBA Packs</Link>
    <header className="mt-4 border-b border-white/10 pb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ef2b2d]">Inspection History</p><h1 className="mt-2 text-3xl font-black">Pack {pack.pack_number}</h1><p className="mt-1 text-sm text-white/55">{[pack.manufacturer,pack.model,pack.serial_number ? `Serial ${pack.serial_number}` : null].filter(Boolean).join(" · ")}</p></header>
    {error ? <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error.message}</p> : null}
    <section className="mt-5 space-y-3">{(records ?? []).length ? (records ?? []).map(record => { const session = Array.isArray(record.session) ? record.session[0] : record.session; return <article key={record.id} className="rounded-2xl border border-white/10 bg-[#17181b] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">{session?.inspection_type ?? "SCBA Inspection"}</h2><p className="mt-1 text-sm text-white/55">{session?.inspected_at ? new Date(session.inspected_at).toLocaleString() : new Date(record.created_at).toLocaleString()}</p><p className="mt-1 text-xs text-white/45">Inspected by: {((Array.isArray(session?.inspector) ? session.inspector[0] : session?.inspector)?.first_name && (Array.isArray(session?.inspector) ? session.inspector[0] : session?.inspector)?.last_name ? `${(Array.isArray(session?.inspector) ? session.inspector[0] : session?.inspector)?.first_name} ${(Array.isArray(session?.inspector) ? session.inspector[0] : session?.inspector)?.last_name}` : session?.inspected_by) ?? "—"}</p></div><span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">{record.result}</span></div>{record.notes || session?.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-white/75">{record.notes ?? session?.notes}</p> : null}</article>; }) : <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/55">No SCBA inspections have been recorded for this pack.</p>}</section>
  </div></main>;
}
