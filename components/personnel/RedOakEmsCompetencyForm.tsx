"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  RED_OAK_EMS_COMPETENCY_SKILLS,
  type RedOakCompetencySkillResult,
  type RedOakCompetencySkillStatus,
  type RedOakCompetencyVerification,
} from "@/lib/red-oak-ems-competency";

type Member = { id: string; name: string };
type Props = { members: Member[]; verifications: RedOakCompetencyVerification[] };

const field = "mt-1 w-full rounded-lg border border-white/15 bg-neutral-950 px-3 py-2 text-white";
const blankSkills = (): RedOakCompetencySkillResult[] => RED_OAK_EMS_COMPETENCY_SKILLS.map((skill) => ({
  skill_key: skill.key, status: "", evaluator: "", date: "",
}));

export default function RedOakEmsCompetencyForm({ members, verifications }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [certificationLevel, setCertificationLevel] = useState("");
  const [evaluator, setEvaluator] = useState("");
  const [skills, setSkills] = useState<RedOakCompetencySkillResult[]>(blankSkills());
  const [remediationSkills, setRemediationSkills] = useState("");
  const [remediationTraining, setRemediationTraining] = useState("");
  const [reverificationDate, setReverificationDate] = useState("");
  const [reverificationOutcome, setReverificationOutcome] = useState("");
  const [overallStatus, setOverallStatus] = useState<"Competent" | "Remediation Required" | "Incomplete">("Incomplete");
  const [memberSignature, setMemberSignature] = useState("");
  const [memberSignatureDate, setMemberSignatureDate] = useState("");
  const [evaluatorSignature, setEvaluatorSignature] = useState("");
  const [evaluatorSignatureDate, setEvaluatorSignatureDate] = useState("");
  const [cqiReview, setCqiReview] = useState("");
  const [cqiReviewDate, setCqiReviewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const memberName = useMemo(() => members.find((member) => member.id === memberId)?.name ?? "", [members, memberId]);

  function reset() {
    setSelectedId(""); setMemberId(""); setYear(String(new Date().getFullYear()));
    setCertificationLevel(""); setEvaluator(""); setSkills(blankSkills());
    setRemediationSkills(""); setRemediationTraining(""); setReverificationDate("");
    setReverificationOutcome(""); setOverallStatus("Incomplete"); setMemberSignature("");
    setMemberSignatureDate(""); setEvaluatorSignature(""); setEvaluatorSignatureDate("");
    setCqiReview(""); setCqiReviewDate(""); setMessage("");
  }

  function load(row: RedOakCompetencyVerification) {
    setSelectedId(row.id); setMemberId(row.member_id); setYear(String(row.verification_year));
    setCertificationLevel(row.certification_level); setEvaluator(row.evaluator);
    setSkills(RED_OAK_EMS_COMPETENCY_SKILLS.map((skill) =>
      row.skill_results.find((result) => result.skill_key === skill.key) ?? {
        skill_key: skill.key, status: "", evaluator: "", date: "",
      }));
    setRemediationSkills(row.remediation_skills ?? "");
    setRemediationTraining(row.remediation_training_completed ?? "");
    setReverificationDate(row.re_verification_date ?? "");
    setReverificationOutcome(row.re_verification_outcome ?? "");
    setOverallStatus(row.overall_status); setMemberSignature(row.member_signature ?? "");
    setMemberSignatureDate(row.member_signature_date ?? "");
    setEvaluatorSignature(row.evaluator_signature ?? "");
    setEvaluatorSignatureDate(row.evaluator_signature_date ?? "");
    setCqiReview(row.cqi_service_director_review ?? "");
    setCqiReviewDate(row.cqi_service_director_review_date ?? "");
    setMessage("");
  }

  function updateSkill(key: string, changes: Partial<RedOakCompetencySkillResult>) {
    setSkills((current) => current.map((item) => item.skill_key === key ? { ...item, ...changes } : item));
  }

  async function save() {
    if (!memberId || !year || !certificationLevel.trim() || !evaluator.trim()) {
      setMessage("Complete the member, verification year, certification level, and evaluator first.");
      return;
    }
    if (skills.some((skill) => !skill.status || !skill.evaluator.trim() || !skill.date)) {
      setMessage("Each skill needs an evaluator and verification date.");
      return;
    }
    setSaving(true); setMessage("");
    const payload = {
      id: selectedId || undefined, member_id: memberId, verification_year: Number(year),
      certification_level: certificationLevel.trim(), evaluator: evaluator.trim(),
      skill_results: skills, remediation_skills: remediationSkills,
      remediation_training_completed: remediationTraining,
      re_verification_date: reverificationDate || null,
      re_verification_outcome: reverificationOutcome, overall_status: overallStatus,
      member_signature: memberSignature, member_signature_date: memberSignatureDate || null,
      evaluator_signature: evaluatorSignature, evaluator_signature_date: evaluatorSignatureDate || null,
      cqi_service_director_review: cqiReview, cqi_service_director_review_date: cqiReviewDate || null,
    };
    const { error } = await supabase.rpc("save_red_oak_ems_competency_verification", { p_payload: payload });
    setSaving(false);
    if (error) { setMessage("Unable to save verification: " + error.message); return; }
    setMessage("Verification saved. Refresh this page to see the updated saved-record list.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Saved Verifications</h2><p className="text-sm text-neutral-400">Select a member’s existing year to review or update it.</p></div>
          <button type="button" onClick={reset} className="rounded-lg border border-white/20 px-3 py-2 text-sm">New Verification</button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {verifications.map((row) => (
            <button key={row.id} type="button" onClick={() => load(row)} className={`rounded-xl border p-3 text-left ${selectedId === row.id ? "border-red-500 bg-red-950/30" : "border-white/10 bg-neutral-950 hover:border-white/30"}`}>
              <span className="block font-semibold">{members.find((member) => member.id === row.member_id)?.name ?? "Member"}</span>
              <span className="text-sm text-neutral-400">{row.verification_year} · {row.overall_status}</span>
            </button>
          ))}
          {verifications.length === 0 ? <p className="text-sm text-neutral-400">No competency verifications have been saved yet.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold">EMS Skills Competency Verification</h2>
        <p className="mt-1 text-sm text-neutral-400">CQI Policy – Section D: Skill Maintenance · Frequency: Annually</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">Member Name<select className={field} disabled={Boolean(selectedId)} value={memberId} onChange={(e) => setMemberId(e.target.value)}><option value="">Select member</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="text-sm">Certification Level<input className={field} value={certificationLevel} onChange={(e) => setCertificationLevel(e.target.value)} placeholder="e.g. EMT, AEMT, Paramedic" /></label>
          <label className="text-sm">Verification Year<input className={field} disabled={Boolean(selectedId)} type="number" min="2000" max="2200" value={year} onChange={(e) => setYear(e.target.value)} /></label>
          <label className="text-sm">Evaluator<input className={field} value={evaluator} onChange={(e) => setEvaluator(e.target.value)} /></label>
        </div>

        {(["Basic Skills", "Advanced Skills"] as const).map((section) => (
          <div key={section} className="mt-6">
            <h3 className="mb-3 border-b border-white/10 pb-2 text-lg font-bold">{section}</h3>
            <div className="space-y-3">
              {RED_OAK_EMS_COMPETENCY_SKILLS.filter((skill) => skill.section === section).map((skill, index) => {
                const result = skills.find((item) => item.skill_key === skill.key)!;
                return <div key={skill.key} className="rounded-xl border border-white/10 p-3">
                  <p className="font-medium">{index + 1}. {skill.label}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs text-neutral-400">Verification<select className={field} value={result.status} onChange={(e) => updateSkill(skill.key, { status: e.target.value as RedOakCompetencySkillStatus | "" })}><option value="">Select</option><option>Competent</option><option>Remediation Required</option><option>N/A</option></select></label>
                    <label className="text-xs text-neutral-400">Evaluator<input className={field} value={result.evaluator} onChange={(e) => updateSkill(skill.key, { evaluator: e.target.value })} /></label>
                    <label className="text-xs text-neutral-400">Date<input className={field} type="date" value={result.date} onChange={(e) => updateSkill(skill.key, { date: e.target.value })} /></label>
                  </div>
                </div>;
              })}
            </div>
          </div>
        ))}

        <h3 className="mt-6 border-b border-white/10 pb-2 text-lg font-bold">Remediation / Follow-Up</h3>
        <div className="mt-3 grid gap-3">
          <label className="text-sm">Skill(s) Requiring Remediation<textarea className={field} rows={2} value={remediationSkills} onChange={(e) => setRemediationSkills(e.target.value)} /></label>
          <label className="text-sm">Remediation / Training Completed<textarea className={field} rows={2} value={remediationTraining} onChange={(e) => setRemediationTraining(e.target.value)} /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Re-Verification Date<input className={field} type="date" value={reverificationDate} onChange={(e) => setReverificationDate(e.target.value)} /></label>
            <label className="text-sm">Re-Verification Outcome<input className={field} value={reverificationOutcome} onChange={(e) => setReverificationOutcome(e.target.value)} /></label>
          </div>
        </div>

        <h3 className="mt-6 border-b border-white/10 pb-2 text-lg font-bold">Final Verification</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Overall Status<select className={field} value={overallStatus} onChange={(e) => setOverallStatus(e.target.value as typeof overallStatus)}><option>Competent</option><option>Remediation Required</option><option>Incomplete</option></select></label>
          <label className="text-sm">Member Signature (type name)<input className={field} value={memberSignature} onChange={(e) => setMemberSignature(e.target.value)} /></label>
          <label className="text-sm">Member Signature Date<input className={field} type="date" value={memberSignatureDate} onChange={(e) => setMemberSignatureDate(e.target.value)} /></label>
          <label className="text-sm">Evaluator Signature (type name)<input className={field} value={evaluatorSignature} onChange={(e) => setEvaluatorSignature(e.target.value)} /></label>
          <label className="text-sm">Evaluator Signature Date<input className={field} type="date" value={evaluatorSignatureDate} onChange={(e) => setEvaluatorSignatureDate(e.target.value)} /></label>
          <label className="text-sm">CQI / Service Director Review<input className={field} value={cqiReview} onChange={(e) => setCqiReview(e.target.value)} /></label>
          <label className="text-sm">CQI / Service Director Review Date<input className={field} type="date" value={cqiReviewDate} onChange={(e) => setCqiReviewDate(e.target.value)} /></label>
        </div>
        <p className="mt-4 text-xs text-neutral-400">Competency must be demonstrated within the member’s authorized Scope of Practice.</p>
        {message ? <p role="status" className="mt-4 text-sm text-red-300">{message}</p> : null}
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 rounded-xl bg-red-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Verification"}</button>
        {memberName ? <span className="ml-3 text-sm text-neutral-400">Editing: {memberName}</span> : null}
      </section>
    </div>
  );
}
