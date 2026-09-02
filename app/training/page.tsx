import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import TrainingWorkspace from "@/components/training/TrainingWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type TrainingCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type TrainingEventRow = {
  id: string;
  title: string;
  category_id: string | null;
  topic: string | null;
  training_type: string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_course_definition_id: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  description: string | null;
  location: string | null;
  instructor_name: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  hours_credit: number | null;
  status: string;
  supporting_document_id: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingAttendanceRow = {
  id: string;
  training_event_id: string;
  member_id: string;
  attendance_status: string;
  completion_status: string;
};

type DepartmentMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

type DepartmentDocumentRow = {
  id: string;
  title: string;
  category: string | null;
  document_number: string | null;
  status: string | null;
};

type TrainingOutsideSubmissionRow = {
  id: string;
  member_id: string;
  title: string;
  category_id: string | null;
  training_date: string;
  hours: number | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_course_definition_id: string | null;
  ems_needs_review: boolean;
  ems_provider_name: string | null;
  description: string | null;
  notes: string | null;
  status: string;
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingOutsideEvidenceRow = {
  id: string;
  submission_id: string;
  member_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
};

type TrainingAssignmentRow = {
  id: string;
  title: string;
  category_id: string | null;
  description: string | null;
  due_at: string | null;
  hours_credit: number | null;
  is_required: boolean;
  review_required: boolean;
  status: string;
  external_video_url: string | null;
  external_audio_url: string | null;
  supporting_document_id: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingAssignmentMemberRow = {
  id: string;
  training_assignment_id: string;
  member_id: string;
  due_at: string | null;
  completion_status: string;
  completed_at: string | null;
  hours_earned: number | null;
  completion_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

type TrainingAssignmentEvidenceRow = {
  id: string;
  assignment_member_id: string;
  member_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

export default async function TrainingPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const [canManageTraining, canAssignHomework, canReviewTraining] = await Promise.all([
    hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_management"),
    hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "homework_assignment"),
    hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "training_review"),
  ]);
  const hasAnyManagementCapabilities =
    canManageTraining || canAssignHomework || canReviewTraining;

  if (!hasAnyManagementCapabilities && currentMember.role !== "firefighter") {
    redirect("/");
  }

  if (!hasAnyManagementCapabilities) {
    const [
      { data: categoriesData, error: categoriesError },
      { data: outsideSubmissionData, error: outsideSubmissionError },
      { data: outsideEvidenceData, error: outsideEvidenceError },
      { data: assignmentMemberData, error: assignmentMemberError },
      { data: assignmentEvidenceData, error: assignmentEvidenceError },
      { data: emsCourseDefinitionsData, error: emsCourseDefinitionsError },
    ] = await Promise.all([
      supabase
        .from("training_categories")
        .select("id, name, description, active")
        .eq("department_id", currentMember.departmentId)
        .order("name", { ascending: true }),
      supabase
        .from("training_outside_submissions")
        .select(
          "id, member_id, title, category_id, training_date, hours, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, notes, status, review_required, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .eq("department_id", currentMember.departmentId)
        .eq("member_id", currentMember.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("training_outside_submission_evidence")
        .select("id, submission_id, member_id, file_name, file_path, mime_type, created_at")
        .eq("department_id", currentMember.departmentId)
        .eq("member_id", currentMember.id),
      supabase
        .from("training_assignment_members")
        .select(
          "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
        )
        .eq("department_id", currentMember.departmentId)
        .eq("member_id", currentMember.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("training_assignment_member_evidence")
        .select("id, assignment_member_id, member_id, file_name, file_path, mime_type, created_at")
        .eq("department_id", currentMember.departmentId)
        .eq("member_id", currentMember.id),
      supabase
        .from("ems_course_definitions")
        .select("id, course_name, active")
        .eq("department_id", currentMember.departmentId)
        .eq("active", true)
        .order("course_name", { ascending: true }),
    ]);

    if (categoriesError) {
      throw new Error(categoriesError.message || "Unable to load training categories.");
    }

    if (outsideSubmissionError) {
      throw new Error(outsideSubmissionError.message || "Unable to load self-reported training submissions.");
    }

    if (outsideEvidenceError) {
      throw new Error(outsideEvidenceError.message || "Unable to load self-reported training evidence.");
    }

    if (assignmentMemberError) {
      throw new Error(assignmentMemberError.message || "Unable to load assigned training.");
    }

    if (assignmentEvidenceError) {
      throw new Error(assignmentEvidenceError.message || "Unable to load assigned training evidence.");
    }

    if (emsCourseDefinitionsError) {
      throw new Error(emsCourseDefinitionsError.message || "Unable to load EMS course definitions.");
    }

    const categories: TrainingCategoryRow[] = (categoriesData ?? []).map((row) => ({
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : "",
      description: typeof row.description === "string" ? row.description : null,
      active: typeof row.active === "boolean" ? row.active : true,
    }));

    const outsideSubmissions: TrainingOutsideSubmissionRow[] = (outsideSubmissionData ?? []).map((row) => ({
      id: String(row.id),
      member_id: typeof row.member_id === "string" ? row.member_id : "",
      title: typeof row.title === "string" ? row.title : "Self-Reported Training",
      category_id: typeof row.category_id === "string" ? row.category_id : null,
      training_date: typeof row.training_date === "string" ? row.training_date : "",
      hours:
        typeof row.hours === "number" && Number.isFinite(row.hours)
          ? row.hours
          : typeof row.hours === "string"
            ? Number.parseFloat(row.hours)
            : null,
      description: typeof row.description === "string" ? row.description : null,
      is_ems_training: row.is_ems_training === true,
      ems_core_topic: typeof row.ems_core_topic === "string" ? row.ems_core_topic : null,
      ems_course_definition_id:
        typeof row.ems_course_definition_id === "string" ? row.ems_course_definition_id : null,
      ems_needs_review: row.ems_needs_review === true,
      ems_provider_name: typeof row.ems_provider_name === "string" ? row.ems_provider_name : null,
      notes: typeof row.notes === "string" ? row.notes : null,
      status: typeof row.status === "string" ? row.status : "pending_review",
      review_required: typeof row.review_required === "boolean" ? row.review_required : true,
      reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
      reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
      review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const outsideEvidenceRows: TrainingOutsideEvidenceRow[] = (outsideEvidenceData ?? []).map((row) => ({
      id: String(row.id),
      submission_id: typeof row.submission_id === "string" ? row.submission_id : "",
      member_id: typeof row.member_id === "string" ? row.member_id : "",
      file_name: typeof row.file_name === "string" ? row.file_name : "Supporting Document",
      file_path: typeof row.file_path === "string" ? row.file_path : "",
      mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
    }));

    const assignmentMembers: TrainingAssignmentMemberRow[] = (assignmentMemberData ?? []).map((row) => ({
      id: String(row.id),
      training_assignment_id: typeof row.training_assignment_id === "string" ? row.training_assignment_id : "",
      member_id: typeof row.member_id === "string" ? row.member_id : currentMember.id,
      due_at: typeof row.due_at === "string" ? row.due_at : null,
      completion_status: typeof row.completion_status === "string" ? row.completion_status : "assigned",
      completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
      hours_earned: typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
      completion_notes: typeof row.completion_notes === "string" ? row.completion_notes : null,
      reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
      reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
      review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const assignmentEvidenceRows: TrainingAssignmentEvidenceRow[] = (assignmentEvidenceData ?? []).map((row) => ({
      id: String(row.id),
      assignment_member_id: typeof row.assignment_member_id === "string" ? row.assignment_member_id : "",
      member_id: typeof row.member_id === "string" ? row.member_id : currentMember.id,
      file_name: typeof row.file_name === "string" ? row.file_name : "Supporting Document",
      file_path: typeof row.file_path === "string" ? row.file_path : "",
      mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
    }));

    const emsCourseDefinitions: EmsCourseDefinitionRow[] = (emsCourseDefinitionsData ?? []).map((row) => ({
      id: String(row.id),
      course_name: typeof row.course_name === "string" ? row.course_name : "",
      active: row.active === true,
    }));

    const assignmentIds = Array.from(
      new Set(
        assignmentMembers
          .map((row) => row.training_assignment_id)
          .filter((id) => typeof id === "string" && id.length > 0),
      ),
    );

    const assignmentRowsResult = assignmentIds.length
      ? await supabase
          .from("training_assignments")
          .select(
            "id, title, category_id, description, due_at, hours_credit, is_required, review_required, status, external_video_url, external_audio_url, supporting_document_id, created_at, updated_at",
          )
          .eq("department_id", currentMember.departmentId)
          .in("id", assignmentIds)
          .order("created_at", { ascending: false })
      : { data: [] as unknown[], error: null };

    if (assignmentRowsResult.error) {
      throw new Error(assignmentRowsResult.error.message || "Unable to load assignment details.");
    }

    const assignmentRows = (assignmentRowsResult.data ?? []) as Array<{
      id: string | number | null;
      title: string | null;
      category_id: string | null;
      description: string | null;
      due_at: string | null;
      hours_credit: number | null;
      is_required: boolean | null;
      review_required: boolean | null;
      status: string | null;
      external_video_url: string | null;
      external_audio_url: string | null;
      supporting_document_id: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;

    const assignments: TrainingAssignmentRow[] = assignmentRows.map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : "Assigned Training",
      category_id: typeof row.category_id === "string" ? row.category_id : null,
      description: typeof row.description === "string" ? row.description : null,
      due_at: typeof row.due_at === "string" ? row.due_at : null,
      hours_credit: typeof row.hours_credit === "number" && Number.isFinite(row.hours_credit) ? row.hours_credit : null,
      is_required: typeof row.is_required === "boolean" ? row.is_required : true,
      review_required: typeof row.review_required === "boolean" ? row.review_required : false,
      status: typeof row.status === "string" ? row.status : "active",
      external_video_url: typeof row.external_video_url === "string" ? row.external_video_url : null,
      external_audio_url: typeof row.external_audio_url === "string" ? row.external_audio_url : null,
      supporting_document_id: typeof row.supporting_document_id === "string" ? row.supporting_document_id : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    }));

    const supportingDocumentIds = Array.from(
      new Set(
        assignments
          .map((row) => row.supporting_document_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    const documentsResult = supportingDocumentIds.length
      ? await supabase
          .from("documents")
          .select("id, title, category, document_number, status")
          .eq("department_id", currentMember.departmentId)
          .in("id", supportingDocumentIds)
      : { data: [] as unknown[], error: null };

    if (documentsResult.error) {
      throw new Error(documentsResult.error.message || "Unable to load supporting assigned training documents.");
    }

    const documentRows = (documentsResult.data ?? []) as Array<{
      id: string | number | null;
      title: string | null;
      category: string | null;
      document_number: string | null;
      status: string | null;
    }>;

    const documents: DepartmentDocumentRow[] = documentRows.map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : "Untitled Document",
      category: typeof row.category === "string" ? row.category : null,
      document_number: typeof row.document_number === "string" ? row.document_number : null,
      status: typeof row.status === "string" ? row.status : null,
    }));

    return (
      <PageLayout>
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
          members={[]}
          documents={documents}
          pendingReviews={0}
          outsideSubmissions={outsideSubmissions}
          outsideEvidenceRows={outsideEvidenceRows}
          assignments={assignments}
          assignmentMembers={assignmentMembers}
          assignmentEvidenceRows={assignmentEvidenceRows}
          emsCourseDefinitions={emsCourseDefinitions}
        />
      </PageLayout>
    );
  }

  const [
    { data: categoriesData, error: categoriesError },
    { data: eventsData, error: eventsError },
    { data: attendanceData, error: attendanceError },
    { data: membersData, error: membersError },
    { data: documentsData, error: documentsError },
    { count: pendingOutsideCount, error: pendingOutsideError },
    { count: pendingAssignmentCount, error: pendingAssignmentError },
    { count: pendingAttendanceCount, error: pendingAttendanceError },
    { data: outsideSubmissionData, error: outsideSubmissionError },
    { data: outsideEvidenceData, error: outsideEvidenceError },
    { data: assignmentsData, error: assignmentsError },
    { data: assignmentMemberData, error: assignmentMemberError },
    { data: assignmentEvidenceData, error: assignmentEvidenceError },
    { data: emsCourseDefinitionsData, error: emsCourseDefinitionsError },
  ] = await Promise.all([
    supabase
      .from("training_categories")
      .select("id, name, description, active")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("training_events")
      .select(
        "id, title, category_id, topic, training_type, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, location, instructor_name, starts_at, ends_at, duration_minutes, hours_credit, status, supporting_document_id, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .order("starts_at", { ascending: false }),
    supabase
      .from("training_event_attendance")
      .select("id, training_event_id, member_id, attendance_status, completion_status")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("members")
      .select("id, first_name, last_name, role")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("documents")
      .select("id, title, category, document_number, status")
      .eq("department_id", currentMember.departmentId)
      .order("title", { ascending: true }),
    supabase
      .from("training_outside_submissions")
      .select("id", { count: "exact", head: true })
      .eq("department_id", currentMember.departmentId)
      .eq("status", "pending_review"),
    supabase
      .from("training_assignment_members")
      .select("id", { count: "exact", head: true })
      .eq("department_id", currentMember.departmentId)
      .eq("completion_status", "pending_review"),
    supabase
      .from("training_event_attendance")
      .select("id", { count: "exact", head: true })
      .eq("department_id", currentMember.departmentId)
      .eq("completion_status", "pending_review"),
    supabase
      .from("training_outside_submissions")
      .select(
        "id, member_id, title, category_id, training_date, hours, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, notes, status, review_required, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
    supabase
      .from("training_outside_submission_evidence")
      .select("id, submission_id, member_id, file_name, file_path, mime_type, created_at")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("training_assignments")
      .select(
        "id, title, category_id, description, due_at, hours_credit, is_required, review_required, status, external_video_url, external_audio_url, supporting_document_id, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_assignment_members")
      .select(
        "id, training_assignment_id, member_id, due_at, completion_status, completed_at, hours_earned, completion_notes, reviewed_by, reviewed_at, review_notes, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_assignment_member_evidence")
      .select("id, assignment_member_id, member_id, file_name, file_path, mime_type, created_at")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("ems_course_definitions")
      .select("id, course_name, active")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("course_name", { ascending: true }),
  ]);

  if (categoriesError) {
    throw new Error(categoriesError.message || "Unable to load training categories.");
  }

  if (eventsError) {
    throw new Error(eventsError.message || "Unable to load training events.");
  }

  if (attendanceError) {
    throw new Error(attendanceError.message || "Unable to load training attendance.");
  }

  if (membersError) {
    throw new Error(membersError.message || "Unable to load department members.");
  }

  if (documentsError) {
    throw new Error(documentsError.message || "Unable to load documents.");
  }

  if (pendingOutsideError || pendingAssignmentError || pendingAttendanceError) {
    throw new Error("Unable to load pending review totals.");
  }

  if (outsideSubmissionError) {
    throw new Error(outsideSubmissionError.message || "Unable to load self-reported training review queue.");
  }

  if (outsideEvidenceError) {
    throw new Error(outsideEvidenceError.message || "Unable to load self-reported training evidence rows.");
  }

  if (assignmentsError) {
    throw new Error(assignmentsError.message || "Unable to load assignments.");
  }

  if (assignmentMemberError) {
    throw new Error(assignmentMemberError.message || "Unable to load assignment members.");
  }

  if (assignmentEvidenceError) {
    throw new Error(assignmentEvidenceError.message || "Unable to load assignment evidence rows.");
  }

  if (emsCourseDefinitionsError) {
    throw new Error(emsCourseDefinitionsError.message || "Unable to load EMS course definitions.");
  }

  const categories: TrainingCategoryRow[] = (categoriesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
  }));

  const events: TrainingEventRow[] = (eventsData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Untitled Training",
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    topic: typeof row.topic === "string" ? row.topic : null,
    training_type: typeof row.training_type === "string" ? row.training_type : null,
    is_ems_training: row.is_ems_training === true,
    ems_core_topic: typeof row.ems_core_topic === "string" ? row.ems_core_topic : null,
    ems_course_definition_id:
      typeof row.ems_course_definition_id === "string" ? row.ems_course_definition_id : null,
    ems_needs_review: row.ems_needs_review === true,
    ems_provider_name: typeof row.ems_provider_name === "string" ? row.ems_provider_name : null,
    description: typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    instructor_name: typeof row.instructor_name === "string" ? row.instructor_name : null,
    starts_at: typeof row.starts_at === "string" ? row.starts_at : "",
    ends_at: typeof row.ends_at === "string" ? row.ends_at : null,
    duration_minutes:
      typeof row.duration_minutes === "number" && Number.isFinite(row.duration_minutes)
        ? row.duration_minutes
        : null,
    hours_credit:
      typeof row.hours_credit === "number" && Number.isFinite(row.hours_credit)
        ? row.hours_credit
        : null,
    status: typeof row.status === "string" ? row.status : "scheduled",
    supporting_document_id: typeof row.supporting_document_id === "string" ? row.supporting_document_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const attendanceRows: TrainingAttendanceRow[] = (attendanceData ?? []).map((row) => ({
    id: String(row.id),
    training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : "",
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    attendance_status: typeof row.attendance_status === "string" ? row.attendance_status : "",
    completion_status: typeof row.completion_status === "string" ? row.completion_status : "",
  }));

  const members: DepartmentMemberRow[] = (membersData ?? []).map((row) => ({
    id: String(row.id),
    first_name: typeof row.first_name === "string" ? row.first_name : null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    role: typeof row.role === "string" ? row.role : null,
  }));

  const documents: DepartmentDocumentRow[] = (documentsData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Untitled Document",
    category: typeof row.category === "string" ? row.category : null,
    document_number: typeof row.document_number === "string" ? row.document_number : null,
    status: typeof row.status === "string" ? row.status : null,
  }));

  const outsideSubmissions: TrainingOutsideSubmissionRow[] = (outsideSubmissionData ?? []).map((row) => ({
    id: String(row.id),
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    title: typeof row.title === "string" ? row.title : "Self-Reported Training",
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    training_date: typeof row.training_date === "string" ? row.training_date : "",
    hours:
      typeof row.hours === "number" && Number.isFinite(row.hours)
        ? row.hours
        : typeof row.hours === "string"
          ? Number.parseFloat(row.hours)
          : null,
    is_ems_training: row.is_ems_training === true,
    ems_core_topic: typeof row.ems_core_topic === "string" ? row.ems_core_topic : null,
    ems_course_definition_id:
      typeof row.ems_course_definition_id === "string" ? row.ems_course_definition_id : null,
    ems_needs_review: row.ems_needs_review === true,
    ems_provider_name: typeof row.ems_provider_name === "string" ? row.ems_provider_name : null,
    description: typeof row.description === "string" ? row.description : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    status: typeof row.status === "string" ? row.status : "pending_review",
    review_required: typeof row.review_required === "boolean" ? row.review_required : true,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const outsideEvidenceRows: TrainingOutsideEvidenceRow[] = (outsideEvidenceData ?? []).map((row) => ({
    id: String(row.id),
    submission_id: typeof row.submission_id === "string" ? row.submission_id : "",
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    file_name: typeof row.file_name === "string" ? row.file_name : "Supporting Document",
    file_path: typeof row.file_path === "string" ? row.file_path : "",
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  }));

  const assignments: TrainingAssignmentRow[] = (assignmentsData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Assigned Training",
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    description: typeof row.description === "string" ? row.description : null,
    due_at: typeof row.due_at === "string" ? row.due_at : null,
    hours_credit: typeof row.hours_credit === "number" && Number.isFinite(row.hours_credit) ? row.hours_credit : null,
    is_required: typeof row.is_required === "boolean" ? row.is_required : true,
    review_required: typeof row.review_required === "boolean" ? row.review_required : false,
    status: typeof row.status === "string" ? row.status : "active",
    external_video_url: typeof row.external_video_url === "string" ? row.external_video_url : null,
    external_audio_url: typeof row.external_audio_url === "string" ? row.external_audio_url : null,
    supporting_document_id: typeof row.supporting_document_id === "string" ? row.supporting_document_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const assignmentMembers: TrainingAssignmentMemberRow[] = (assignmentMemberData ?? []).map((row) => ({
    id: String(row.id),
    training_assignment_id: typeof row.training_assignment_id === "string" ? row.training_assignment_id : "",
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    due_at: typeof row.due_at === "string" ? row.due_at : null,
    completion_status: typeof row.completion_status === "string" ? row.completion_status : "assigned",
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    hours_earned: typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
    completion_notes: typeof row.completion_notes === "string" ? row.completion_notes : null,
    reviewed_by: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const assignmentEvidenceRows: TrainingAssignmentEvidenceRow[] = (assignmentEvidenceData ?? []).map((row) => ({
    id: String(row.id),
    assignment_member_id: typeof row.assignment_member_id === "string" ? row.assignment_member_id : "",
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    file_name: typeof row.file_name === "string" ? row.file_name : "Supporting Document",
    file_path: typeof row.file_path === "string" ? row.file_path : "",
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  }));

  const emsCourseDefinitions: EmsCourseDefinitionRow[] = (emsCourseDefinitionsData ?? []).map((row) => ({
    id: String(row.id),
    course_name: typeof row.course_name === "string" ? row.course_name : "",
    active: row.active === true,
  }));

  const pendingReviews =
    (pendingOutsideCount ?? 0) +
    (pendingAssignmentCount ?? 0) +
    (pendingAttendanceCount ?? 0);

  return (
    <PageLayout>
      <TrainingWorkspace
        departmentId={currentMember.departmentId}
        currentMemberId={currentMember.id}
        currentMemberRole={currentMember.role}
        canManageTraining={canManageTraining}
        canAssignHomework={canAssignHomework}
        canReviewTraining={canReviewTraining}
        categories={categories}
        events={events}
        attendanceRows={attendanceRows}
        members={members}
        documents={documents}
        pendingReviews={pendingReviews}
        outsideSubmissions={outsideSubmissions}
        outsideEvidenceRows={outsideEvidenceRows}
        assignments={assignments}
        assignmentMembers={assignmentMembers}
        assignmentEvidenceRows={assignmentEvidenceRows}
        emsCourseDefinitions={emsCourseDefinitions}
      />
    </PageLayout>
  );
}
