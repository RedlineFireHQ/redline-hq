import Link from "next/link";
import type { ReadinessScoreState, ReadinessCoachItem, ReadinessFactor } from "@/lib/readiness/member-readiness";
import { formatAuthoritativeCoachAction } from "@/lib/readiness/authoritative-member-readiness";

type Certification = { id: string; name: string; status: string; expiresAt: string | null };
type HistoryItem = { id: string; title: string; detail: string; occurredAt: string };
type EmsTrack = { track: string; level: string; expiration: string | null };

function statusTone(status: string) {
  if (status === "current" || status === "complete") return "text-emerald-200 border-emerald-400/30 bg-emerald-500/10";
  if (status === "expiring_soon" || status === "missing") return "text-amber-200 border-amber-400/30 bg-amber-500/10";
  return "text-red-200 border-red-400/30 bg-red-500/10";
}

function FactorCard({ factor }: { factor: ReadinessFactor }) {
  return <div className="rounded-xl border border-white/10 bg-[#121315] p-4"><div className="flex items-start justify-between gap-3"><p className="font-bold text-white">{factor.title}</p><span className={`rounded-lg border px-2 py-1 text-xs font-black ${statusTone(factor.statusLabel.toLowerCase().replaceAll(" ", "_"))}`}>{factor.statusLabel}</span></div><p className="mt-2 text-sm leading-6 text-white/65">{factor.currentValue} / {factor.requiredValue}</p>{factor.actionNeeded ? <p className="mt-2 text-sm font-semibold text-amber-200">{factor.actionNeeded}</p> : null}</div>;
}

export default function MobileMyReadiness({
  readiness,
  coachItems,
  certifications,
  history,
  fireTrainingHours,
  emsTracks,
}: {
  readiness: ReadinessScoreState;
  coachItems: ReadinessCoachItem[];
  certifications: Certification[];
  history: HistoryItem[];
  fireTrainingHours: number;
  emsTracks: EmsTrack[];
}) {
  const currentCertifications = certifications.filter((item) => item.status === "current").length;
  const expiringCertifications = certifications.filter((item) => item.status === "expiring_soon").length;
  const expiredCertifications = certifications.filter((item) => item.status === "expired").length;
  const retiredCategoryFactorIds = new Set(
    readiness.factors
      .filter((factor) => factor.category === "qualification")
      .map((factor) => factor.id),
  );
  const attentionItems = coachItems
    .filter((item) => !retiredCategoryFactorIds.has(item.factorId))
    .slice(0, 4)
    .map((item) => {
      const factor = readiness.factors.find((candidate) => candidate.id === item.factorId);
      if (!factor) return item;

      const action = formatAuthoritativeCoachAction({ factor, readinessState: readiness, isSelf: true });
      const actionText = action.actionText
        .replace(/^Renew or add a current /, "Renew or add current ")
        .replace(/\.$/, "");
      const impact = action.gainPercent !== null && action.gainPercent > 0
        ? `, plus ${Number.isInteger(action.gainPercent) ? action.gainPercent : action.gainPercent.toFixed(1)}% readiness`
        : "";

      return { ...item, explanation: `${actionText}${impact}.` };
    });

  return <main className="min-h-screen bg-[#0b0c0e] px-4 pb-10 pt-4 text-white sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between gap-3"><Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">My Readiness</span></div><section className="mt-5 rounded-3xl border border-red-500/25 bg-[#141414] p-6 shadow-[0_18px_40px_rgba(0,0,0,.28)] sm:p-8"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">REDLINE READY™</p>{readiness.scorePercent === null ? <><h1 className="mt-4 text-3xl font-black uppercase text-amber-300">Readiness Not Scored</h1><p className="mt-3 text-base leading-7 text-white/70">Your readiness score is unavailable until required department setup is complete.</p></> : <div className="mt-3 flex flex-wrap items-end gap-4"><span className="text-7xl font-black leading-none text-white">{Math.round(readiness.scorePercent)}%</span><span className={`mb-1 rounded-xl border px-3 py-2 text-sm font-black uppercase ${readiness.scorePercent >= 80 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-amber-400/30 bg-amber-500/10 text-amber-200"}`}>{readiness.scorePercent >= 80 ? "Ready" : "Needs Attention"}</span></div>}</section>

    <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Readiness Coach</h2><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#ef2b2d]">{attentionItems.length} items</span></div>{attentionItems.length === 0 ? <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-base font-semibold text-emerald-100">No readiness actions need your attention right now.</p> : <div className="mt-4 space-y-3">{attentionItems.map((item) => <Link key={item.factorId} href={item.href ?? "#"} className="block min-h-16 rounded-xl border border-amber-400/25 bg-amber-500/10 p-4"><p className="font-black text-amber-100">{item.title}</p><p className="mt-1 text-sm leading-6 text-white/70">{item.explanation}</p></Link>)}</div>}</section>

    <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><h2 className="text-xl font-black">Certifications</h2><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-center"><p className="text-2xl font-black text-emerald-200">{currentCertifications}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/60">Current</p></div><div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-center"><p className="text-2xl font-black text-amber-200">{expiringCertifications}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/60">Expiring</p></div><div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-center"><p className="text-2xl font-black text-red-200">{expiredCertifications}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/60">Expired</p></div></div>{certifications.length > 0 ? <div className="mt-4 space-y-2">{certifications.map((cert) => <div key={cert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#121315] p-3"><span className="font-semibold">{cert.name}</span><span className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusTone(cert.status)}`}>{cert.status.replaceAll("_", " ")}</span></div>)}</div> : <p className="mt-4 text-white/60">No certifications recorded.</p>}</section>

    <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><h2 className="text-xl font-black">Training</h2><p className="mt-2 text-white/65">Approved fire training this year</p><p className="mt-1 text-3xl font-black text-white">{fireTrainingHours.toFixed(2)} hrs</p>{readiness.factors.filter((factor) => factor.category === "training").length > 0 ? <div className="mt-4 space-y-3">{readiness.factors.filter((factor) => factor.category === "training").map((factor) => <FactorCard key={factor.id} factor={factor} />)}</div> : <p className="mt-4 text-white/60">No training requirements configured.</p>}</section>

    {readiness.deficiencyImpactingCount > 0 ? <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><h2 className="text-xl font-black">Deficiencies</h2><p className="mt-3 text-sm leading-6 text-amber-200">{readiness.deficiencyImpactingCount} active issue(s) assigned to you are affecting readiness.</p><p className="mt-3 text-sm text-white/60">Penalty: {readiness.deficiencyPenaltyPercent.toFixed(1)}%</p></section> : null}

    {emsTracks.length > 0 ? <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5"><h2 className="text-xl font-black">EMS Continuing Education</h2><div className="mt-4 space-y-2">{emsTracks.map((track) => <div key={track.track} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#121315] p-3"><span className="font-semibold uppercase">{track.track} · {track.level}</span><span className="text-sm text-white/60">{track.expiration ? `Expires ${track.expiration}` : "No expiration"}</span></div>)}</div></section> : null}
    {history.length > 0 ? <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5"><h2 className="text-xl font-black">Readiness History</h2><div className="mt-4 space-y-2">{history.slice(0, 10).map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-[#121315] p-3"><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-white/60">{item.detail}</p></div>)}</div></section> : null}
  </div></main>;
}
