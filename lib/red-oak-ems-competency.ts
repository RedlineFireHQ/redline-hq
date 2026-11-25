export const RED_OAK_FIRE_DEPARTMENT_ID = "82f50d14-216a-4dd1-80f4-58459dc97b97";

export const RED_OAK_EMS_COMPETENCY_SKILLS = [
  { key: "vital-signs", section: "Basic Skills", label: "Assessment: vital signs for all ages" },
  { key: "airway-basic", section: "Basic Skills", label: "Adult & pediatric airway: BVM, suctioning, oral & nasal, and/or per protocol" },
  { key: "cpr-aed", section: "Basic Skills", label: "Cardiac arrest management: CPR, AED for all age groups" },
  { key: "medication-administration", section: "Basic Skills", label: "Medication administration: over-the-counter, patient assisted, and/or per protocol" },
  { key: "immobilization", section: "Basic Skills", label: "Immobilization devices: cervical collars, long and short boards, extremity splints including traction" },
  { key: "airway-advanced", section: "Advanced Skills", label: "Adult & pediatric airway: bridge, double-lumen, endotracheal" },
  { key: "iv-io-access", section: "Advanced Skills", label: "Adult & pediatric IV/IO access" },
  { key: "needle-cricothyrotomy", section: "Advanced Skills", label: "Needle cricothyrotomy" },
  { key: "needle-thoracostomy", section: "Advanced Skills", label: "Needle thoracostomy" },
] as const;

export type RedOakCompetencySkillKey = typeof RED_OAK_EMS_COMPETENCY_SKILLS[number]["key"];
export type RedOakCompetencySkillStatus = "Competent" | "Remediation Required" | "N/A";
export type RedOakCompetencySkillResult = {
  skill_key: RedOakCompetencySkillKey;
  status: RedOakCompetencySkillStatus | "";
  evaluator: string;
  date: string;
};

export type RedOakCompetencyVerification = {
  id: string;
  member_id: string;
  verification_year: number;
  certification_level: string;
  evaluator: string;
  skill_results: RedOakCompetencySkillResult[];
  remediation_skills: string;
  remediation_training_completed: string;
  re_verification_date: string | null;
  re_verification_outcome: string;
  overall_status: "Competent" | "Remediation Required" | "Incomplete";
  member_signature: string;
  member_signature_date: string | null;
  evaluator_signature: string;
  evaluator_signature_date: string | null;
  cqi_service_director_review: string;
  cqi_service_director_review_date: string | null;
  created_at: string;
};
