import CommandCenter from "@/components/command-center-v3/CommandCenterLayout";
import PageLayout from "@/components/layout/PageLayout";
import TrainingWorkspace from "@/components/training/TrainingWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import PublicHomepage from "@/components/public/PublicHomepage";

type TrainingCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type DepartmentMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return <PublicHomepage />;
    }

    return (
      <PageLayout>
        <CommandCenter />
      </PageLayout>
    );
  }

  const [canManageTraining, canAssignHomework, canReviewTraining] = await Promise.all([
    hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_program_management")
      || hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_management"),
    hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_assignment_management")
      || hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "homework_assignment")
      || hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_management"),
    hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_review_management")
      || hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_review")
      || hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_management"),
  ]);

  const hasAnyManagementCapabilities = canManageTraining || canAssignHomework || canReviewTraining;

  const [categoriesResult, membersResult, emsCourseDefinitionsResult] = await Promise.all([
    supabase
      .from("training_categories")
      .select("id, name, description, active")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("members")
      .select("id, first_name, last_name, role")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("ems_course_definitions")
      .select("id, course_name, active")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("course_name", { ascending: true }),
  ]);

  const categories: TrainingCategoryRow[] = (categoriesResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: row.active === true,
  }));

  const members: DepartmentMemberRow[] = (membersResult.data ?? []).map((row) => ({
    id: String(row.id),
    first_name: typeof row.first_name === "string" ? row.first_name : null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    role: typeof row.role === "string" ? row.role : null,
  }));

  const emsCourseDefinitions: EmsCourseDefinitionRow[] = (emsCourseDefinitionsResult.data ?? []).map((row) => ({
    id: String(row.id),
    course_name: typeof row.course_name === "string" ? row.course_name : "",
    active: row.active === true,
  }));

  return (
    <PageLayout>
      <CommandCenter />

      {hasAnyManagementCapabilities ? (
        <div className="hidden" aria-hidden="true">
          <TrainingWorkspace
            departmentId={currentMember.departmentId}
            currentMemberId={currentMember.id}
            currentMemberRole={currentMember.role}
            canManageTraining={canManageTraining}
            canAssignHomework={canAssignHomework}
            canReviewTraining={canReviewTraining}
            categories={categories}
            events={[]}
            attendanceRows={[]}
            members={members}
            documents={[]}
            pendingReviews={0}
            outsideSubmissions={[]}
            outsideEvidenceRows={[]}
            assignments={[]}
            assignmentMembers={[]}
            assignmentEvidenceRows={[]}
            emsCourseDefinitions={emsCourseDefinitions}
            departmentTrainingHoursThisYear={0}
          />
        </div>
      ) : null}
    </PageLayout>
  );
}