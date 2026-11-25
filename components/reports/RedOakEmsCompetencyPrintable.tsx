import {
  RED_OAK_EMS_COMPETENCY_SKILLS,
  type RedOakCompetencySkillResult,
} from "@/lib/red-oak-ems-competency";
import type { ReportRow } from "@/lib/reports/types";

function value(row: ReportRow, key: string) {
  const item = row[key];
  return typeof item === "string" || typeof item === "number" ? String(item) : "";
}

function skillResults(row: ReportRow): RedOakCompetencySkillResult[] {
  try {
    const parsed: unknown = JSON.parse(value(row, "skill_results_json"));
    return Array.isArray(parsed) ? parsed as RedOakCompetencySkillResult[] : [];
  } catch {
    return [];
  }
}

export default function RedOakEmsCompetencyPrintable({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="text-black">
      {rows.map((row, rowIndex) => {
        const results = skillResults(row);
        const getSkill = (key: string) => results.find((item) => item.skill_key === key);
        return <article key={rowIndex} className="mx-auto max-w-[8.5in] bg-white p-6 text-[10pt] text-black" style={{ pageBreakAfter: rowIndex < rows.length - 1 ? "always" : "auto" }}>
          <header className="text-center">
            <h1 className="text-xl font-bold">RED OAK FIRE DEPARTMENT</h1>
            <h2 className="text-lg font-bold">EMS SKILLS COMPETENCY VERIFICATION</h2>
            <p className="mt-2 italic">CQI Policy – Section D: Skill Maintenance</p>
          </header>
          <div className="mt-4 grid grid-cols-2 border border-black">
            {[
              ["Member Name", value(row, "member_name")],
              ["Certification Level", value(row, "certification_level")],
              ["Verification Year", value(row, "verification_year")],
              ["Evaluator", value(row, "evaluator")],
            ].map(([label, content]) => <div key={label} className="flex min-h-9 border-b border-r border-black px-2 py-1"><strong className="w-36 shrink-0">{label}</strong><span>{content}</span></div>)}
          </div>
          <p className="mt-3"><strong>Purpose:</strong> Document completion of the EMS skill competencies required by the Red Oak Fire Department CQI Policy. All competencies listed below are identified in Section D as annual (A) practice requirements. Competency must be demonstrated within the member’s authorized Scope of Practice.</p>
          <p className="mt-2"><strong>Verification:</strong> □ Competent&nbsp;&nbsp; □ Remediation Required&nbsp;&nbsp; □ N/A&nbsp;&nbsp;&nbsp; <strong>Frequency:</strong> A = Annually</p>
          {(["Basic Skills", "Advanced Skills"] as const).map((section) => (
            <section key={section} className="mt-3">
              <h3 className="mb-1 font-bold uppercase">{section}</h3>
              <table className="w-full border-collapse text-[9pt]">
                <thead><tr>{["#", "CQI Skill / Competency", "Frequency", "Competent", "Remediation", "Evaluator / Date"].map((label) => <th key={label} className="border border-black px-1 py-1 text-left">{label}</th>)}</tr></thead>
                <tbody>{RED_OAK_EMS_COMPETENCY_SKILLS.filter((skill) => skill.section === section).map((skill, index) => {
                  const result = getSkill(skill.key);
                  return <tr key={skill.key}>
                    <td className="border border-black px-1 py-1">{index + 1}</td>
                    <td className="border border-black px-1 py-1">{skill.label}</td>
                    <td className="border border-black px-1 py-1">Annual</td>
                    <td className="border border-black px-1 py-1 text-center">{result?.status === "Competent" ? "☒" : "□"}</td>
                    <td className="border border-black px-1 py-1 text-center">{result?.status === "Remediation Required" ? "☒" : result?.status === "N/A" ? "N/A" : "□"}</td>
                    <td className="border border-black px-1 py-1">{[result?.evaluator, result?.date].filter(Boolean).join(" / ")}</td>
                  </tr>;
                })}</tbody>
              </table>
            </section>
          ))}
          <section className="mt-3">
            <h3 className="font-bold uppercase">Remediation / Follow-Up</h3>
            <table className="mt-1 w-full border-collapse text-[9pt]">
              <tbody>
                {[
                  ["Skill(s) Requiring Remediation", value(row, "remediation_skills")],
                  ["Remediation / Training Completed", value(row, "remediation_training_completed")],
                  ["Re-Verification Date / Outcome", [value(row, "re_verification_date"), value(row, "re_verification_outcome")].filter(Boolean).join(" / ")],
                ].map(([label, content]) => <tr key={label}><td className="w-1/2 border border-black px-2 py-1">{label}</td><td className="border border-black px-2 py-1">{content}</td></tr>)}
              </tbody>
            </table>
          </section>
          <section className="mt-4">
            <h3 className="font-bold uppercase">Final Verification</h3>
            <table className="mt-1 w-full border-collapse text-[9pt]">
              <tbody>
                <tr><td className="border border-black px-2 py-1 font-semibold">Overall Status</td><td colSpan={3} className="border border-black px-2 py-1">{value(row, "overall_status")}</td></tr>
                {[
                  ["Member Signature", "member_signature", "member_signature_date"],
                  ["Evaluator Signature", "evaluator_signature", "evaluator_signature_date"],
                  ["CQI / Service Director Review", "cqi_service_director_review", "cqi_service_director_review_date"],
                ].map(([label, nameKey, dateKey]) => <tr key={label}>
                  <td className="border border-black px-2 py-1">{label}</td>
                  <td className="border border-black px-2 py-1">{value(row, nameKey)}</td>
                  <td className="border border-black px-2 py-1">Date</td>
                  <td className="border border-black px-2 py-1">{value(row, dateKey)}</td>
                </tr>)}
              </tbody>
            </table>
          </section>
          <p className="mt-5 text-center text-[8pt] italic">Source: Red Oak Fire Department / Montgomery County EMS Affiliate Program CQI Policy, Section D – Skill Maintenance.</p>
          <footer className="mt-8 text-center text-[8pt]">Red Oak Fire Department | EMS Skills Competency Verification</footer>
        </article>;
      })}
    </div>
  );
}
