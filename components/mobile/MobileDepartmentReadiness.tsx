"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronRight, ShieldAlert, X } from "lucide-react";
import type { DepartmentReadinessResult } from "@/lib/readiness/department-readiness";

type Props = { result: DepartmentReadinessResult };

function percent(value: number | null) {
  return value === null ? "--" : `${value.toFixed(2)}%`;
}

function statusLabel(status: DepartmentReadinessResult["status"]) {
  if (status === "redline_ready") return "REDLINE READY";
  if (status === "not_redline_ready") return "NOT REDLINE READY";
  if (status === "needs_attention") return "NEEDS ATTENTION";
  return "NOT YET RATED";
}

function mobileCoachDestination(action: DepartmentReadinessResult["topCoachActions"][number]) {
  if (action.href === "/training") return "/mobile/training/new";
  if (action.href === "/my-readiness") return "/mobile/my-readiness";
  if (action.category === "apparatus") return "/mobile/apparatus-checks";
  return null;
}

export default function MobileDepartmentReadiness({ result }: Props) {
  const factors = [
    ["Department", percent(result.departmentScore)],
    ["Personnel", percent(result.personnelScore)],
    ["Apparatus", percent(result.apparatusScore)],
    ["Scored Members", `${result.scoredMemberCount} / ${result.activeMemberCount}`],
  ];
  const actions = [...result.topCoachActions, ...result.remainingCoachActions];
  const [desktopOnlyAction, setDesktopOnlyAction] = useState<DepartmentReadinessResult["topCoachActions"][number] | null>(null);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5 pb-6">
        <Link href="/mobile" className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-white/65">
          <ArrowLeft className="h-4 w-4" /> Back to Field Actions
        </Link>
        <header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Command Center</p>
          <h1 className="mt-2 text-3xl font-black">Department Readiness</h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/65">{result.statusMessage}</p>
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-200">Overall readiness</p>
            <p className="mt-1 text-4xl font-black text-white">{percent(result.departmentScore)}</p>
            <p className="mt-2 text-sm font-black uppercase tracking-wide text-red-100">{statusLabel(result.status)}</p>
          </div>
        </header>
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-black uppercase tracking-[0.2em] text-white/45">Readiness Factors</h2>
          <div className="grid grid-cols-2 gap-2">{factors.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#121212] p-4"><p className="text-xs font-black uppercase tracking-wide text-white/40">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>)}</div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#121212] p-5">
          <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ef2b2d]" /><div><h2 className="text-lg font-black">REDLINE READINESS COACH™</h2><p className="mt-2 text-sm leading-6 text-white/60">See what is affecting your department’s readiness and what you can do to improve it.</p></div></div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1"><h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/45">What Needs Attention</h2><span className="text-xs font-bold text-white/40">{actions.length}</span></div>
          {actions.length === 0 ? <p className="rounded-2xl border border-white/10 bg-[#121212] p-4 text-sm leading-6 text-white/55">No actionable readiness gaps are currently available.</p> : actions.map((action) => {
            const destination = mobileCoachDestination(action);
            const content = <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef2b2d]">{action.category}</p><h3 className="mt-1 text-base font-black text-white">{action.title}</h3></div><ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35" /></div><p className="mt-2 text-sm leading-6 text-white/60">{action.description}</p>{action.potentialDepartmentImpactPercent !== null ? <p className="mt-3 text-sm font-black text-emerald-300">+{action.potentialDepartmentImpactPercent.toFixed(2)}% Department Readiness</p> : null}</>;
            return destination ? <Link key={action.id} href={destination} className="block rounded-2xl border border-white/10 bg-[#121212] p-4">{content}</Link> : <button key={action.id} type="button" onClick={() => setDesktopOnlyAction(action)} className="block w-full rounded-2xl border border-white/10 bg-[#121212] p-4 text-left">{content}</button>;
          })}
        </section>
        {desktopOnlyAction ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="desktop-only-title" className="w-full max-w-md rounded-[24px] border border-white/12 bg-[#111111] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">Readiness Coach</p><h2 id="desktop-only-title" className="mt-2 text-2xl font-black">Personnel Management</h2></div><button type="button" onClick={() => setDesktopOnlyAction(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/15 text-white/70" aria-label="Close"><X className="h-5 w-5" /></button></div><p className="mt-4 text-sm leading-6 text-white/70">Personnel readiness items need to be addressed from the Redline HQ desktop application.</p><button type="button" onClick={() => setDesktopOnlyAction(null)} className="mt-6 min-h-12 w-full rounded-2xl bg-[#ef2b2d] px-4 text-sm font-black uppercase tracking-wide text-white">Close</button></section></div> : null}
      </div>
    </main>
  );
}
