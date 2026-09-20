import { redirect } from "next/navigation";
import MobileMyReadiness from "@/components/mobile/MobileMyReadiness";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildCertificationTypeMetaById } from "@/lib/ems/authoritative-certifications";
import { computeAuthoritativeMemberReadiness } from "@/lib/readiness/authoritative-member-readiness";
import type { EmsTrackProfileAuthorityRow } from "@/lib/ems/authoritative-certifications";
import { buildCanonicalMemberCertificationRows, type CatalogRow, type RoleRequiredCertificationRow, type RoleRequiredQualificationRow } from "@/lib/role-requirements";
import type { RequirementInput, TrainingAssignmentInput, TrainingAssignmentMemberInput } from "@/lib/readiness/member-readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = Record<string, unknown>;
type Track = { track: string; level: string; expiration: string | null };

function stringValue(value: unknown) { return typeof value === "string" ? value : null; }
function numberValue(value: unknown) { return typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : 0; }

export default async function MobileMyReadinessPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");
  const departmentId = currentMember.departmentId;

  const [attendanceResult, outsideResult, certResult, certTypeResult, requirementResult, memberResult, roleResult, qualificationResult, memberQualificationResult, roleCertResult, roleQualificationResult, deficiencyResult, assignmentMemberResult, emsProfileResult] = await Promise.all([
    supabase.from("training_event_attendance").select("training_event_id").eq("department_id", departmentId).eq("member_id", currentMember.id).eq("attendance_status", "attending"),
    supabase.rpc("get_member_training_outside_submissions", { p_department_id: departmentId, p_member_id: currentMember.id }).then((result) => ({
      data: ((result.data ?? []) as Row[]).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))),
      error: result.error,
    })),
    supabase.from("member_certifications").select("id, certification_id, certificate_number, issued_at, expires_at, supporting_document_id, created_at, updated_at").eq("department_id", departmentId).eq("member_id", currentMember.id),
    supabase.from("certifications").select("id, name, ems_authority, ems_certification_level").eq("department_id", departmentId),
    supabase.from("training_requirements").select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json").eq("department_id", departmentId).eq("active", true).order("sort_order"),
    supabase.from("members").select("department_role_id, hire_start_date, created_at").eq("department_id", departmentId).eq("id", currentMember.id).single(),
    supabase.from("department_roles").select("id, name, active").eq("department_id", departmentId),
    supabase.from("qualifications").select("id, name, active").eq("department_id", departmentId),
    supabase.from("member_qualifications").select("qualification_id").eq("department_id", departmentId).eq("member_id", currentMember.id),
    supabase.from("role_required_certifications").select("department_role_id, certification_id").eq("department_id", departmentId),
    supabase.from("role_required_qualifications").select("department_role_id, qualification_id").eq("department_id", departmentId),
    supabase.from("deficiencies").select("id, deficiency_number, description, assigned_to, created_at, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name)").eq("assigned_to", currentMember.id),
    supabase.from("training_assignment_members").select("id, training_assignment_id, completion_status, due_at, completed_at, hours_earned, completion_notes, created_at, updated_at").eq("department_id", departmentId).eq("member_id", currentMember.id),
    supabase.from("ems_member_track_profiles").select("id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date").eq("department_id", departmentId).eq("member_id", currentMember.id),
  ]);

  const attendanceIds = ((attendanceResult.data ?? []) as Array<{ training_event_id: string }>).map((row) => row.training_event_id);
  const { data: eventRows } = attendanceIds.length > 0 ? await supabase.from("training_events").select("id, title, category_id, starts_at, hours_credit, is_ems_training, ems_core_topic, ems_needs_review").eq("department_id", departmentId).in("id", attendanceIds) : { data: [] };
  const events = (eventRows ?? []) as Row[];
  const outside = (outsideResult.data ?? []) as Row[];
  const categoryIds = Array.from(new Set([...events.map((row) => stringValue(row.category_id)), ...outside.map((row) => stringValue(row.category_id))].filter((value): value is string => Boolean(value))));
  const { data: categoryRows } = categoryIds.length > 0 ? await supabase.from("training_categories").select("id, name, active").eq("department_id", departmentId).in("id", categoryIds) : { data: [] };
  const categoryNameById = new Map(((categoryRows ?? []) as Row[]).map((row) => [String(row.id), String(row.name ?? "Uncategorized")]));
  const categoryHoursMap = new Map<string, { categoryId: string | null; categoryName: string; hours: number }>();
  for (const row of [...events, ...outside.filter((item) => item.status === "approved")]) {
    const categoryId = stringValue(row.category_id); const key = categoryId ?? "uncategorized";
    const current = categoryHoursMap.get(key) ?? { categoryId, categoryName: categoryId ? categoryNameById.get(categoryId) ?? "Uncategorized" : "Uncategorized", hours: 0 };
    current.hours += numberValue(row.hours_credit ?? row.hours); categoryHoursMap.set(key, current);
  }
  const categories = ((categoryRows ?? []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.name ?? ""), active: row.active !== false } satisfies CatalogRow));
  const certTypes = (certTypeResult.data ?? []) as Row[];
  const canonicalCertifications = buildCanonicalMemberCertificationRows({ certificationTypes: certTypes.map((row) => ({ id: String(row.id), name: String(row.name ?? ""), active: true })), qualificationTypes: ((qualificationResult.data ?? []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.name ?? ""), active: true })), memberCertifications: (certResult.data ?? []) as never[], memberQualifications: (memberQualificationResult.data ?? []) as Array<{ qualification_id: string }> }).map((row) => ({ certification_id: row.certification_id, certificate_number: row.certificate_number ?? null, issued_at: row.issued_at ?? "", expires_at: row.expires_at, id: row.id }));
  const certificationNameById = new Map(certTypes.map((row) => [String(row.id), String(row.name ?? "Certification")]));
  const readiness = computeAuthoritativeMemberReadiness({
    currentMemberId: currentMember.id,
    memberStartDate: stringValue(memberResult.data?.hire_start_date) ?? stringValue(memberResult.data?.created_at),
    memberDepartmentRoleId: stringValue(memberResult.data?.department_role_id),
    roleName: ((roleResult.data ?? []) as Row[]).find((row) => row.id === memberResult.data?.department_role_id)?.name as string | null ?? null,
    canonicalMemberCertifications: canonicalCertifications,
    certificationNameById,
    certificationTypeById: buildCertificationTypeMetaById(certTypes.map((row) => ({ id: String(row.id), ems_authority: row.ems_authority as never, ems_certification_level: row.ems_certification_level as never }))),
    emsTrackProfiles: (emsProfileResult.data ?? []) as unknown as EmsTrackProfileAuthorityRow[],
    roleRequiredCertifications: (roleCertResult.data ?? []) as RoleRequiredCertificationRow[],
    certificationCatalog: certTypes.map((row) => ({ id: String(row.id), name: String(row.name ?? ""), active: true } satisfies CatalogRow)),
    qualificationCatalog: ((qualificationResult.data ?? []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.name ?? ""), active: true })),
    roleRequiredQualifications: (roleQualificationResult.data ?? []) as RoleRequiredQualificationRow[],
    memberQualifications: (memberQualificationResult.data ?? []) as Array<{ qualification_id: string }>,
    requirements: (requirementResult.data ?? []) as RequirementInput[],
    categoryNameById,
    fireAnnualComplianceRows: [...events, ...outside.filter((row) => row.status === "approved")].map((row) => ({ categoryId: stringValue(row.category_id), hours: (row.hours_credit ?? row.hours) as number | string | null })),
    categoryHours: Array.from(categoryHoursMap.values()),
    trainingAssignments: [] as TrainingAssignmentInput[],
    assignmentMembers: (assignmentMemberResult.data ?? []) as TrainingAssignmentMemberInput[],
    deficiencyItems: (deficiencyResult.data ?? []) as never[],
  });

  const certifications = readiness.certificationStatuses.map((row) => ({ id: row.certificationId, name: row.certificationName, status: row.status, expiresAt: row.expiresAt }));
  const history = [...outside.map((row) => ({ id: `training-${row.id}`, title: String(row.title), detail: `${String(row.status).replaceAll("_", " ")} • ${numberValue(row.hours).toFixed(2)} hrs`, occurredAt: String(row.created_at) }))];
  const tracks = (emsProfileResult.data ?? []).map((row) => ({ track: String(row.track), level: String(row.certification_level), expiration: stringValue(row.expiration_date) }));

  return <MobileMyReadiness readiness={readiness.readiness} coachItems={readiness.readiness.coachItems} certifications={certifications} history={history} fireTrainingHours={readiness.fireAnnualTrainingHours} emsTracks={tracks} />;
}
