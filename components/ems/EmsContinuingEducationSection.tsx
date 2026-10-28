import type { EmsReadinessResult } from "@/lib/ems/calculation";
import type { EmsTrackProfileAuthorityRow } from "@/lib/ems/authoritative-certifications";

function formatDateOnly(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEmsTopicLabel(topic: string) {
  if (topic === "airway_respirations_ventilations") {
    return "Airway, Respirations, Ventilations";
  }

  if (topic === "cardiology") {
    return "Cardiology";
  }

  if (topic === "trauma") {
    return "Trauma";
  }

  if (topic === "medical") {
    return "Medical";
  }

  if (topic === "operations") {
    return "Operations";
  }

  return "Other";
}

function formatEmsProgressStatus(status: string) {
  if (status === "complete") {
    return "Complete";
  }

  if (status === "on_track") {
    return "On Track";
  }

  if (status === "needs_attention") {
    return "Needs Attention";
  }

  if (status === "not_maintained") {
    return "Not Maintained";
  }

  return "Not Configured";
}

function emsProgressStatusClasses(status: string) {
  if (status === "complete") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "on_track") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  }

  if (status === "needs_attention") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-neutral-600/40 bg-neutral-700/20 text-neutral-300";
}

type EmsContinuingEducationSectionProps = {
  emsRecordsCounted: number;
  iowaProfile: EmsTrackProfileAuthorityRow | null;
  nremtProfile: EmsTrackProfileAuthorityRow | null;
  emsReadiness: EmsReadinessResult;
  warnings: string[];
  unclassifiedCount: number;
  emptyMessage: string;
};

// Read-only display shared by My Readiness and the Personnel profile.
export default function EmsContinuingEducationSection({
  emsRecordsCounted,
  iowaProfile,
  nremtProfile,
  emsReadiness,
  warnings,
  unclassifiedCount,
  emptyMessage,
}: EmsContinuingEducationSectionProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/70 p-6">
     <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
       <div>
         <h2 className="text-2xl font-semibold text-white">EMS Continuing Education</h2>
         <p className="mt-1 text-sm text-neutral-400">Certification-cycle CE tracking for Iowa and National Registry is separate from calendar-year training totals.</p>
       </div>
       <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-xs uppercase tracking-[0.14em] text-neutral-300">
         EMS records counted: {emsRecordsCounted}
       </div>
     </div>

     {iowaProfile === null && nremtProfile === null ? (
       <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
         {emptyMessage}
       </div>
     ) : (
       <>
         <div className="mt-4 grid gap-4 lg:grid-cols-2">
           <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
             <div className="flex items-center justify-between gap-2">
               <p className="text-base font-semibold text-white">Iowa EMS</p>
               <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${emsProgressStatusClasses(emsReadiness.iowa.status)}`}>
                 {formatEmsProgressStatus(emsReadiness.iowa.status)}
               </span>
             </div>
             <p className="mt-2 text-sm text-neutral-300">
               {emsReadiness.iowa.totalCompleted.toFixed(2)} / {emsReadiness.iowa.totalRequired.toFixed(2)} hours
             </p>
             <p className="mt-1 text-xs text-neutral-400">
               Level: {iowaProfile?.certification_level?.toUpperCase() ?? "-"} • Number: {iowaProfile?.certification_number || "-"}
             </p>
             <p className="mt-1 text-xs text-neutral-400">Expiration: {iowaProfile?.expiration_date ? formatDateOnly(iowaProfile.expiration_date) : "No expiration"}</p>
             <p className="mt-1 text-xs text-neutral-400">Remaining: {emsReadiness.iowa.totalRemaining.toFixed(2)} hours</p>
             <div className="mt-3 space-y-2">
               {emsReadiness.iowa.topics.map((topic) => (
                 <div key={topic.topic} className="flex items-center justify-between text-xs text-neutral-300">
                   <span>{formatEmsTopicLabel(topic.topic)}</span>
                   <span>{topic.completed.toFixed(2)} / {topic.required.toFixed(2)} hrs</span>
                 </div>
               ))}
             </div>
           </div>

           <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
             <div className="flex items-center justify-between gap-2">
               <p className="text-base font-semibold text-white">National Registry</p>
               <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${emsProgressStatusClasses(emsReadiness.nremt.status)}`}>
                 {formatEmsProgressStatus(emsReadiness.nremt.status)}
               </span>
             </div>
             <p className="mt-2 text-sm text-neutral-300">
               {emsReadiness.nremt.totalCompleted.toFixed(2)} / {emsReadiness.nremt.totalRequired.toFixed(2)} hours
             </p>
             <p className="mt-1 text-xs text-neutral-400">
               Level: {nremtProfile?.certification_level?.toUpperCase() ?? "-"} • Number: {nremtProfile?.certification_number || "-"}
             </p>
             <p className="mt-1 text-xs text-neutral-400">
               Maintain Track: {nremtProfile?.maintain_track === true ? "Yes" : "No"} • Expiration: {nremtProfile?.expiration_date ? formatDateOnly(nremtProfile.expiration_date) : "No expiration"}
             </p>
             <p className="mt-1 text-xs text-neutral-400">National Component: {emsReadiness.nremt.nationalComponentCompleted.toFixed(2)} / {emsReadiness.nremt.nationalComponentRequired.toFixed(2)} hrs</p>
             <div className="mt-3 space-y-2">
               {emsReadiness.nremt.nationalTopics.map((topic) => (
                 <div key={topic.topic} className="flex items-center justify-between text-xs text-neutral-300">
                   <span>{formatEmsTopicLabel(topic.topic)}</span>
                   <span>{topic.completed.toFixed(2)} / {topic.required.toFixed(2)} hrs</span>
                 </div>
               ))}
             </div>
           </div>
         </div>

         {warnings.length > 0 ? (
           <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
             {warnings.map((warning) => (
               <p key={warning}>{warning}</p>
             ))}
           </div>
         ) : null}

         {unclassifiedCount > 0 ? (
           <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
             {unclassifiedCount} EMS record(s) are unclassified and marked for review.
           </div>
         ) : null}
       </>
     )}
    </section>
  );
}
