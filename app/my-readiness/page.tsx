import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { department } from "@/lib/department";
import { getCurrentMember } from "@/lib/current-member";
import {
  buildMemberReadinessScore,
  getCertificationStatus,
  parseHours,
  type CertificationStatus,
  type QualificationReadinessInput,
  type RequirementInput,
} from "@/lib/readiness/member-readiness";
import {
  getRoleRequirementComparison,
  type CatalogRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type DepartmentRoleRow = {
  id: string;
  name: string;
  active: boolean;
};

type MemberRoleAssignmentRow = {
  department_role_id: string | null;
};

type TrainingAttendanceRow = {
  training_event_id: string;
};

type TrainingEventRow = {
  id: string;
  title: string;
  category_id: string | null;
  starts_at: string;
  hours_credit: number | string | null;
};

type OutsideSubmissionRow = {
  id: string;
  title: string;
  category_id: string | null;
  training_date: string;
  hours: number | string | null;
  status: string;
  created_at: string;
};

type TrainingCategoryRow = {
  id: string;
  name: string;
};

type MemberCertificationRow = {
  id: string;
  certification_id: string;
  issued_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type CertificationTypeRow = {
  id: string;
  name: string;
};

type HistoryItem = {
  id: string;
  occurred_at: string;
  title: string;
  detail: string;
  source:
    | "department_training"
    | "self_submitted_training"
    | "certification"
    | "deficiency"
    | "maintenance"
    | "apparatus";
};

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

function certificationStatusLabel(status: CertificationStatus) {
  if (status === "expired") {
    return "Expired";
  }

  if (status === "expiring_soon") {
    return "Expiring Soon";
  }

  return "Current";
}

function certificationStatusClasses(status: CertificationStatus) {
  if (status === "expired") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (status === "expiring_soon") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function sourceLabel(source: HistoryItem["source"]) {
  if (source === "department_training") {
    return "Department Training";
  }

  if (source === "self_submitted_training") {
    return "Self-Submitted Training";
  }

  if (source === "certification") {
    return "Certification";
  }

  if (source === "deficiency") {
    return "Deficiency";
  }

  if (source === "maintenance") {
    return "Maintenance";
  }

  return "Apparatus";
}

export default async function MyReadinessPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const [
    { data: attendanceRows, error: attendanceError },
    { data: approvedOutsideRows, error: approvedOutsideError },
    { data: allOutsideRows, error: allOutsideError },
    { data: certificationsRows, error: certificationsError },
    { data: certificationTypesRows, error: certificationTypesError },
    { data: requirementsRows, error: requirementsError },
    { data: memberRoleRow, error: memberRoleError },
    { data: departmentRolesRows, error: departmentRolesError },
    { data: qualificationTypesRows, error: qualificationTypesError },
    { data: memberQualificationsRows, error: memberQualificationsError },
    { data: roleRequiredCertificationRows, error: roleRequiredCertificationError },
    { data: roleRequiredQualificationRows, error: roleRequiredQualificationError },
    { data: deficiencyHistoryRows, error: deficiencyHistoryError },
    { data: maintenanceRows, error: maintenanceError },
    { data: apparatusRows, error: apparatusError },
  ] = await Promise.all([
    supabase
      .from("training_event_attendance")
      .select("training_event_id")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .eq("attendance_status", "attending"),
    supabase
      .from("training_outside_submissions")
      .select("id, title, category_id, training_date, hours, status, created_at")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .eq("status", "approved")
      .order("training_date", { ascending: false }),
    supabase
      .from("training_outside_submissions")
      .select("id, title, category_id, training_date, hours, status, created_at")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("member_certifications")
      .select("id, certification_id, issued_at, expires_at, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .order("expires_at", { ascending: true }),
    supabase
      .from("certifications")
      .select("id, name")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("training_requirements")
      .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("members")
      .select("department_role_id")
      .eq("department_id", currentMember.departmentId)
      .eq("id", currentMember.id)
      .single(),
    supabase
      .from("department_roles")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("qualifications")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("member_qualifications")
      .select("qualification_id")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id),
    supabase
      .from("role_required_certifications")
      .select("department_role_id, certification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("role_required_qualifications")
      .select("department_role_id, qualification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("deficiency_history")
      .select("id, event_type, event_description, created_at")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("maintenance_records")
      .select("id, maintenance_number, maintenance_type, service_date, description")
      .eq("completed_by", currentMember.id)
      .order("service_date", { ascending: false })
      .limit(20),
    supabase
      .from("apparatus_inspections")
      .select("id, created_at, status")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (attendanceError) {
    throw new Error(attendanceError.message || "Unable to load department training attendance.");
  }

  if (approvedOutsideError || allOutsideError) {
    throw new Error(
      approvedOutsideError?.message || allOutsideError?.message || "Unable to load self-submitted training.",
    );
  }

  if (certificationsError || certificationTypesError) {
    throw new Error(certificationsError?.message || certificationTypesError?.message || "Unable to load certifications.");
  }

  if (requirementsError) {
    throw new Error(requirementsError.message || "Unable to load training requirements.");
  }

  if (
    memberRoleError ||
    departmentRolesError ||
    qualificationTypesError ||
    memberQualificationsError ||
    roleRequiredCertificationError ||
    roleRequiredQualificationError
  ) {
    throw new Error(
      memberRoleError?.message ||
        departmentRolesError?.message ||
        qualificationTypesError?.message ||
        memberQualificationsError?.message ||
        roleRequiredCertificationError?.message ||
        roleRequiredQualificationError?.message ||
        "Unable to load role requirement details.",
    );
  }

  if (deficiencyHistoryError || maintenanceError || apparatusError) {
    throw new Error(
      deficiencyHistoryError?.message ||
        maintenanceError?.message ||
        apparatusError?.message ||
        "Unable to load readiness history.",
    );
  }

  const attendance = (attendanceRows ?? []) as TrainingAttendanceRow[];
  const approvedOutside = (approvedOutsideRows ?? []) as OutsideSubmissionRow[];
  const allOutside = (allOutsideRows ?? []) as OutsideSubmissionRow[];
  const memberCertifications = (certificationsRows ?? []) as MemberCertificationRow[];
  const certificationTypes = (certificationTypesRows ?? []) as CertificationTypeRow[];
  const requirements = (requirementsRows ?? []) as RequirementInput[];
  const roleAssignment = (memberRoleRow ?? null) as MemberRoleAssignmentRow | null;
  const departmentRoles = ((departmentRolesRows ?? []) as DepartmentRoleRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
  const qualificationTypes: CatalogRow[] = ((qualificationTypesRows ?? []) as CatalogRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
  const memberQualifications = ((memberQualificationsRows ?? []) as Array<{ qualification_id: string }>).map((row) => ({
    qualification_id: row.qualification_id,
  }));
  const roleRequiredCertifications = ((roleRequiredCertificationRows ?? []) as RoleRequiredCertificationRow[]).map((row) => ({
    department_role_id: row.department_role_id,
    certification_id: row.certification_id,
  }));
  const roleRequiredQualifications = ((roleRequiredQualificationRows ?? []) as RoleRequiredQualificationRow[]).map((row) => ({
    department_role_id: row.department_role_id,
    qualification_id: row.qualification_id,
  }));

  const attendedEventIds = Array.from(
    new Set(attendance.map((row) => row.training_event_id).filter((id) => typeof id === "string" && id.length > 0)),
  );

  let attendedEvents: TrainingEventRow[] = [];
  if (attendedEventIds.length > 0) {
    const { data: eventsRows, error: eventsError } = await supabase
      .from("training_events")
      .select("id, title, category_id, starts_at, hours_credit")
      .eq("department_id", currentMember.departmentId)
      .in("id", attendedEventIds)
      .order("starts_at", { ascending: false });

    if (eventsError) {
      throw new Error(eventsError.message || "Unable to load attended training events.");
    }

    attendedEvents = (eventsRows ?? []) as TrainingEventRow[];
  }

  const categoryIds = Array.from(
    new Set(
      [...attendedEvents.map((row) => row.category_id), ...approvedOutside.map((row) => row.category_id)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  let categories: TrainingCategoryRow[] = [];
  if (categoryIds.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from("training_categories")
      .select("id, name")
      .eq("department_id", currentMember.departmentId)
      .in("id", categoryIds);

    if (categoryError) {
      throw new Error(categoryError.message || "Unable to load training categories.");
    }

    categories = (categoryRows ?? []) as TrainingCategoryRow[];
  }

  const categoryNameById = new Map(categories.map((row) => [row.id, row.name]));
  const certificationNameById = new Map(certificationTypes.map((row) => [row.id, row.name]));
  const departmentRoleById = new Map(departmentRoles.map((row) => [row.id, row]));
  const certificationCatalog: CatalogRow[] = certificationTypes.map((row) => ({
    id: row.id,
    name: row.name,
    active: true,
  }));

  const memberDepartmentRoleId = typeof roleAssignment?.department_role_id === "string" ? roleAssignment.department_role_id : null;
  const selectedDepartmentRole = memberDepartmentRoleId ? departmentRoleById.get(memberDepartmentRoleId) ?? null : null;
  const roleRequirementComparison = getRoleRequirementComparison({
    memberDepartmentRoleId,
    certificationTypes: certificationCatalog,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });
  const qualificationReadiness: QualificationReadinessInput = {
    hasAssignedRole: memberDepartmentRoleId !== null,
    roleName: selectedDepartmentRole?.name ?? null,
    requiredQualifications: roleRequirementComparison.requiredQualifications.map((item) => item.name),
    completedQualifications: roleRequirementComparison.requiredQualifications
      .filter((item) => item.isCurrent)
      .map((item) => item.name),
    missingQualifications: roleRequirementComparison.requiredQualifications
      .filter((item) => !item.isCurrent)
      .map((item) => item.name),
  };
  const departmentHours = attendedEvents.reduce((total, row) => total + parseHours(row.hours_credit), 0);
  const selfSubmittedApprovedHours = approvedOutside.reduce((total, row) => total + parseHours(row.hours), 0);
  const totalTrainingHours = departmentHours + selfSubmittedApprovedHours;

  const categoryHoursMap = new Map<string, { categoryId: string | null; name: string; hours: number }>();

  for (const event of attendedEvents) {
    const categoryName = event.category_id ? categoryNameById.get(event.category_id) ?? "Uncategorized" : "Uncategorized";
    const key = event.category_id || "uncategorized";
    const current = categoryHoursMap.get(key) ?? { categoryId: event.category_id, name: categoryName, hours: 0 };
    current.hours += parseHours(event.hours_credit);
    categoryHoursMap.set(key, current);
  }

  for (const submission of approvedOutside) {
    const categoryName = submission.category_id
      ? categoryNameById.get(submission.category_id) ?? "Uncategorized"
      : "Uncategorized";
    const key = submission.category_id || "uncategorized";
    const current = categoryHoursMap.get(key) ?? { categoryId: submission.category_id, name: categoryName, hours: 0 };
     current.hours += parseHours(submission.hours);
     categoryHoursMap.set(key, current);
   }

   const categoryBreakdown = Array.from(categoryHoursMap.values()).sort((a, b) => b.hours - a.hours);

   const certificationCards = memberCertifications.map((row) => {
     const status = getCertificationStatus(row.expires_at, department.settings.certificationWarningDays);
     return {
       id: row.id,
      certificationId: row.certification_id,
       name: certificationNameById.get(row.certification_id) ?? "Unknown Certification",
       expiresAt: row.expires_at,
       status,
       issuedAt: row.issued_at,
     };
   });

   const currentCertifications = certificationCards.filter((row) => row.status === "current").length;
   const expiringSoonCertifications = certificationCards.filter((row) => row.status === "expiring_soon").length;
   const expiredCertifications = certificationCards.filter((row) => row.status === "expired").length;

  const readinessScore = buildMemberReadinessScore({
    requirementRows: requirements,
    departmentHours,
    categoryHours: categoryBreakdown.map((row) => ({ categoryId: row.categoryId, categoryName: row.name, hours: row.hours })),
    categoryNameById,
    certificationStatuses: certificationCards.map((row) => ({
      certificationId: row.certificationId,
      certificationName: row.name,
      status: row.status,
    })),
    qualificationReadiness,
  });

  const readinessPercentDisplay = readinessScore.scorePercent ?? 0;
  const remainingPercentDisplay =
    readinessScore.remainingPercent ?? Math.max(0, 100 - readinessPercentDisplay);

   const historyItems: HistoryItem[] = [];

   for (const event of attendedEvents) {
     historyItems.push({
       id: `dept-${event.id}`,
       occurred_at: event.starts_at,
       title: event.title,
       detail: `${categoryNameById.get(event.category_id ?? "") ?? "Uncategorized"} • ${parseHours(event.hours_credit).toFixed(2)} hrs`,
       source: "department_training",
     });
   }

   for (const submission of allOutside) {
     historyItems.push({
       id: `self-${submission.id}`,
       occurred_at: submission.created_at,
       title: submission.title,
       detail: `${submission.status.replaceAll("_", " ")} • ${parseHours(submission.hours).toFixed(2)} hrs`,
       source: "self_submitted_training",
     });
   }

   for (const cert of memberCertifications) {
     historyItems.push({
       id: `cert-${cert.id}`,
       occurred_at: cert.updated_at || cert.created_at,
       title: certificationNameById.get(cert.certification_id) ?? "Certification Updated",
       detail: cert.expires_at ? `Expires ${formatDateOnly(cert.expires_at)}` : "No expiration date",
       source: "certification",
     });
   }

   for (const row of deficiencyHistoryRows ?? []) {
     historyItems.push({
       id: `defhist-${String(row.id)}`,
       occurred_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
       title: typeof row.event_type === "string" && row.event_type.trim() ? row.event_type : "Deficiency Activity",
       detail:
         typeof row.event_description === "string" && row.event_description.trim()
           ? row.event_description
           : "Deficiency activity recorded.",
       source: "deficiency",
     });
   }

   for (const row of maintenanceRows ?? []) {
     const title =
       typeof row.maintenance_number === "string" && row.maintenance_number.trim()
         ? row.maintenance_number
         : typeof row.maintenance_type === "string" && row.maintenance_type.trim()
           ? row.maintenance_type
           : "Maintenance Record";

     historyItems.push({
       id: `maint-${String(row.id)}`,
       occurred_at: typeof row.service_date === "string" ? row.service_date : new Date().toISOString(),
       title,
       detail:
         typeof row.description === "string" && row.description.trim()
           ? row.description
           : "Maintenance completed.",
       source: "maintenance",
     });
   }

   for (const row of apparatusRows ?? []) {
     historyItems.push({
       id: `app-${String(row.id)}`,
       occurred_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
       title: "Apparatus Inspection",
       detail: typeof row.status === "string" && row.status.trim() ? row.status : "Status unavailable",
       source: "apparatus",
     });
   }

   historyItems.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

   return (
     <PageLayout>
       <div className="space-y-8 pb-6">
         <div>
           <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">My Readiness</p>
           <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Personal Readiness</h1>
           <p className="mt-2 max-w-3xl text-neutral-400">
             See where you stand and what actions move you closer to full readiness.
           </p>
         </div>

         <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
           <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
             <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
               <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">My Readiness</p>
               {readinessScore.configured ? (
                 <div className="mt-2">
                   <p className="text-6xl font-black text-white">{readinessPercentDisplay}%</p>
                   <p className="mt-3 text-lg font-semibold text-white">You&apos;re {readinessPercentDisplay}% ready</p>
                   <p className="mt-1 text-sm text-neutral-300">{remainingPercentDisplay}% to go</p>
                 </div>
               ) : (
                 <div className="mt-2">
                   <p className="text-2xl font-black uppercase text-amber-300">Requirements Not Configured</p>
                   <p className="mt-2 text-sm text-neutral-300">{readinessScore.configurationMessage}</p>
                 </div>
               )}
             </div>

             <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
               <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">Readiness Model</p>
               <div className="mt-3 space-y-2 text-sm text-neutral-300">
                 <p>Department-defined requirements: {requirements.length}</p>
                 <p>Completed requirements: {readinessScore.completedRequirements}</p>
                 <p>Incomplete requirements: {readinessScore.incompleteRequirements}</p>
                <p>
                  Qualifications status: {readinessScore.qualificationsStatus === "complete"
                    ? "Complete"
                    : readinessScore.qualificationsStatus === "missing"
                      ? "Missing required qualification"
                      : readinessScore.qualificationsStatus === "not_configured"
                        ? "Not configured for role"
                        : "No role assigned"}
                </p>
                <p>
                  Qualifications bucket: {readinessScore.qualificationsScore === null
                    ? "Not scored"
                    : `${readinessScore.qualificationsScore.toFixed(1)} / ${readinessScore.qualificationsMaxScore.toFixed(1)}`}
                </p>
               </div>
             </div>
           </div>

           <div className="mt-5 rounded-xl border border-white/10 bg-[#131313] p-4">
             <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Get To 100%</h3>
             {!readinessScore.configured ? (
               <p className="mt-3 text-sm text-neutral-300">
                 Action prioritization becomes available once department readiness requirements are configured.
               </p>
             ) : readinessScore.coachItems.length === 0 ? (
               <p className="mt-3 text-sm text-emerald-300">All configured readiness requirements are complete.</p>
             ) : (
               <div className="mt-3 space-y-3">
                 {readinessScore.coachItems.slice(0, 5).map((item) => (
                   <div key={item.factorId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                     <div className="flex items-start justify-between gap-3">
                       <p className="text-sm font-semibold text-white">{item.title}</p>
                     </div>
                     <p className="mt-1 text-xs text-neutral-300">{item.explanation}</p>
                     <div className="mt-2 grid gap-1 text-xs text-neutral-400 md:grid-cols-2">
                       <p>Current: {item.currentValue}</p>
                       <p>Target: {item.targetValue}</p>
                       <p>Remaining: {item.remainingValue}</p>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </section>

         <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
           <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
             <div>
               <h2 className="text-2xl font-semibold text-white">Training</h2>
               <p className="mt-1 text-sm text-neutral-400">Completed training from department attendance and approved self-submissions.</p>
             </div>
             <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3">
               <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">Total Completed Hours</p>
               <p className="mt-1 text-2xl font-bold text-white">{totalTrainingHours.toFixed(2)}</p>
             </div>
           </div>

           <div className="mt-4 grid gap-3 md:grid-cols-3">
             <div className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
               <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Department Hours</p>
               <p className="mt-1 text-2xl font-semibold text-white">{departmentHours.toFixed(2)}</p>
             </div>
             <div className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
               <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Self-Submitted Approved</p>
               <p className="mt-1 text-2xl font-semibold text-white">{selfSubmittedApprovedHours.toFixed(2)}</p>
             </div>
             <div className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
               <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Requirements</p>
               <p className="mt-1 text-sm font-semibold text-white">
                 {readinessScore.configured
                   ? `${requirements.length} configured`
                   : readinessScore.configurationState === "model_incomplete"
                     ? "Model incomplete"
                     : "Not configured"}
               </p>
             </div>
           </div>

           {!readinessScore.configured ? (
             <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
               {readinessScore.configurationMessage}
             </div>
           ) : null}

           <div className="mt-5 grid gap-5 lg:grid-cols-2">
             <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
               <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Hours By Category</h3>
               {categoryBreakdown.length === 0 ? (
                 <p className="mt-3 text-sm text-neutral-400">No completed category hours yet.</p>
               ) : (
                 <div className="mt-3 space-y-2">
                   {categoryBreakdown.map((row) => (
                     <div key={row.name} className="flex items-center justify-between text-sm text-neutral-200">
                       <span>{row.name}</span>
                       <span className="font-semibold text-white">{row.hours.toFixed(2)} hrs</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
               <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Readiness Factors</h3>
               {!readinessScore.configured ? (
                 <p className="mt-3 text-sm text-neutral-400">No evaluated factors until requirements are configured.</p>
               ) : (
                 <div className="mt-3 space-y-3">
                   {readinessScore.factors.map((factor) => (
                     <div key={factor.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                       <div className="flex items-center justify-between gap-2">
                         <p className="text-sm font-semibold text-white">{factor.title}</p>
                         <span className="text-xs text-neutral-400">{factor.completionPercent}%</span>
                       </div>
                       <p className="mt-1 text-xs text-neutral-300">{factor.currentValue} / {factor.requiredValue}</p>
                       <p className="mt-1 text-xs text-neutral-500">{factor.actionNeeded}</p>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         </section>

         <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
           <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
             <div>
               <h2 className="text-2xl font-semibold text-white">Certifications</h2>
               <p className="mt-1 text-sm text-neutral-400">Current status from your certification records.</p>
             </div>
             <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-xs uppercase tracking-[0.14em] text-neutral-300">
               {currentCertifications} current • {expiringSoonCertifications} expiring • {expiredCertifications} expired
             </div>
           </div>

           {certificationCards.length === 0 ? (
             <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
               No certifications are currently on your record.
             </div>
           ) : (
             <div className="mt-4 space-y-3">
               {certificationCards.map((row) => (
                 <div key={row.id} className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
                   <div className="flex flex-wrap items-center justify-between gap-3">
                     <p className="text-base font-semibold text-white">{row.name}</p>
                     <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${certificationStatusClasses(row.status)}`}>
                       {certificationStatusLabel(row.status)}
                     </span>
                   </div>
                   <p className="mt-2 text-sm text-neutral-300">Expires: {row.expiresAt ? formatDateOnly(row.expiresAt) : "No expiration"}</p>
                 </div>
               ))}
             </div>
           )}
         </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="border-b border-neutral-800 pb-4">
            <h2 className="text-2xl font-semibold text-white">ROLE REQUIREMENTS</h2>
            <p className="mt-1 text-sm text-neutral-400">See what your assigned department role requires and what is currently missing.</p>
          </div>

          {!memberDepartmentRoleId ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
              No department role assigned.
            </div>
          ) : !selectedDepartmentRole ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
              The assigned department role could not be found.
            </div>
          ) : roleRequirementComparison.status.kind === "no_requirements" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#141414] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Department Role</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedDepartmentRole.name}</p>
                <p className="mt-2 text-xs text-neutral-400">
                  Qualifications: {readinessScore.qualificationsScore === null
                    ? "Not scored"
                    : `${readinessScore.qualificationsScore.toFixed(1)} / ${readinessScore.qualificationsMaxScore.toFixed(1)}`}
                </p>
                {readinessScore.missingQualifications.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-300">
                    Missing required qualification{readinessScore.missingQualifications.length > 1 ? "s" : ""}: {readinessScore.missingQualifications.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
                No role requirements configured.
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#141414] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Department Role</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedDepartmentRole.name}</p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Required Certifications</h3>
                  {roleRequirementComparison.requiredCertifications.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-400">No required certifications for this role.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {roleRequirementComparison.requiredCertifications.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${item.isCurrent ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
                            {item.isCurrent ? "Current" : "Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Required Qualifications</h3>
                  {roleRequirementComparison.requiredQualifications.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-400">No required qualifications for this role.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {roleRequirementComparison.requiredQualifications.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${item.isCurrent ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
                            {item.isCurrent ? "Current" : "Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

         <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
           <div className="border-b border-neutral-800 pb-4">
             <h2 className="text-2xl font-semibold text-white">History</h2>
             <p className="mt-1 text-sm text-neutral-400">Member-linked readiness activity recorded in existing systems.</p>
           </div>

           {historyItems.length === 0 ? (
             <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
               No member-linked readiness activity found yet.
             </div>
           ) : (
             <div className="mt-4 space-y-3">
               {historyItems.slice(0, 20).map((row) => (
                 <div key={row.id} className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
                   <div className="flex flex-wrap items-center justify-between gap-3">
                     <p className="text-sm font-semibold text-white">{row.title}</p>
                     <span className="text-xs uppercase tracking-[0.12em] text-neutral-400">{sourceLabel(row.source)}</span>
                   </div>
                   <p className="mt-1 text-sm text-neutral-300">{row.detail}</p>
                   <p className="mt-1 text-xs text-neutral-500">{formatDateOnly(row.occurred_at)}</p>
                 </div>
               ))}
             </div>
           )}

           <p className="mt-4 text-xs text-neutral-500">
             Apparatus inspections are shown only when actor attribution is present on records.
           </p>
         </section>
       </div>
     </PageLayout>
   );
 }
