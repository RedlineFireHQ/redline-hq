import { notFound, redirect } from "next/navigation";
import TrainingEventDetailWorkspace from "@/components/training/TrainingEventDetailWorkspace";
import type { IsoTrainingFacilityOption, IsoPrePlanOption } from "@/components/training/IsoTrainingFields";
import { getCurrentMember } from "@/lib/current-member";
import { hasAssignedDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type TrainingCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  system_key: string | null;
  compliance_bucket: string | null;
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
  iso_classifications: string[];
  iso_classification: string | null;
  iso_facility_id: string | null;
  iso_pre_plan_id: string | null;
  iso_driver_operator_training_type: string | null;
  iso_qualifying_facility: boolean;
};

type TrainingAttendanceRow = {
  id: string;
  training_event_id: string;
  member_id: string;
  attendance_status: string;
  completion_status: string;
  hours_earned: number | null;
  notes: string | null;
};

type DepartmentMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  rank: string | null;
  role: string | null;
  active: boolean | null;
};

type DepartmentDocumentRow = {
  id: string;
  title: string;
  document_number: string | null;
  status: string | null;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

interface TrainingEventDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TrainingEventDetailPage({
  params,
}: TrainingEventDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const canManageTraining =
    (await hasAssignedDepartmentPermission(supabase, currentMember.departmentId, "training_program_management")) ||
    (await hasAssignedDepartmentPermission(supabase, currentMember.departmentId, "training_management"));

  const [
    { data: eventData, error: eventError },
    { data: categoriesData, error: categoriesError },
    { data: attendanceData, error: attendanceError },
    { data: membersData, error: membersError },
    { data: documentsData, error: documentsError },
    { data: emsCourseDefinitionsData, error: emsCourseDefinitionsError },
    { data: facilitiesData, error: facilitiesError },
    { data: prePlansData, error: prePlansError },
  ] = await Promise.all([
    supabase
      .from("training_events")
      .select(
        "id, title, category_id, topic, training_type, is_ems_training, ems_core_topic, ems_course_definition_id, ems_needs_review, ems_provider_name, description, location, instructor_name, starts_at, ends_at, duration_minutes, hours_credit, status, supporting_document_id, iso_classifications, iso_classification, iso_facility_id, iso_pre_plan_id, iso_driver_operator_training_type, iso_qualifying_facility",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("training_categories")
      .select("id, name, description, active, system_key, compliance_bucket")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("training_event_attendance")
      .select("id, training_event_id, member_id, attendance_status, completion_status, hours_earned, notes")
      .eq("department_id", currentMember.departmentId)
      .eq("training_event_id", id),
    supabase
      .from("members")
      .select("id, first_name, last_name, rank, role, active")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("documents")
      .select("id, title, document_number, status")
      .eq("department_id", currentMember.departmentId)
      .order("title", { ascending: true }),
    supabase
      .from("ems_course_definitions")
      .select("id, course_name, active")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("course_name", { ascending: true }),
    supabase
      .from("training_facilities")
      .select("id, name, facility_type, ownership_type, address, city, state, zip, tower_stories, yard_acres, purpose_built_live_fire, formal_agreement, agreement_reference, active")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("pre_plans")
      .select("id, business_name, address, city, state, iso_high_hazard, lifecycle_status")
      .eq("department_id", currentMember.departmentId)
      .eq("lifecycle_status", "active")
      .order("business_name", { ascending: true }),
  ]);

  if (eventError) {
    throw new Error(eventError.message || "Unable to load training event.");
  }

  if (!eventData) {
    notFound();
  }

  if (categoriesError) {
    throw new Error(categoriesError.message || "Unable to load training categories.");
  }

  if (attendanceError) {
    throw new Error(attendanceError.message || "Unable to load attendance rows.");
  }

  if (membersError) {
    throw new Error(membersError.message || "Unable to load members.");
  }

  if (documentsError) {
    throw new Error(documentsError.message || "Unable to load documents.");
  }

  if (emsCourseDefinitionsError) {
    throw new Error(emsCourseDefinitionsError.message || "Unable to load EMS course definitions.");
  }
  if (facilitiesError) throw new Error(facilitiesError.message || "Unable to load ISO training facilities.");
  if (prePlansError) throw new Error(prePlansError.message || "Unable to load pre-plans.");

  const trainingEvent: TrainingEventRow = {
    id: String(eventData.id),
    title: typeof eventData.title === "string" ? eventData.title : "Untitled Training",
    category_id: typeof eventData.category_id === "string" ? eventData.category_id : null,
    topic: typeof eventData.topic === "string" ? eventData.topic : null,
    training_type: typeof eventData.training_type === "string" ? eventData.training_type : null,
    is_ems_training: eventData.is_ems_training === true,
    ems_core_topic: typeof eventData.ems_core_topic === "string" ? eventData.ems_core_topic : null,
    ems_course_definition_id:
      typeof eventData.ems_course_definition_id === "string" ? eventData.ems_course_definition_id : null,
    ems_needs_review: eventData.ems_needs_review === true,
    ems_provider_name: typeof eventData.ems_provider_name === "string" ? eventData.ems_provider_name : null,
    description: typeof eventData.description === "string" ? eventData.description : null,
    location: typeof eventData.location === "string" ? eventData.location : null,
    instructor_name: typeof eventData.instructor_name === "string" ? eventData.instructor_name : null,
    starts_at: typeof eventData.starts_at === "string" ? eventData.starts_at : "",
    ends_at: typeof eventData.ends_at === "string" ? eventData.ends_at : null,
    duration_minutes:
      typeof eventData.duration_minutes === "number" && Number.isFinite(eventData.duration_minutes)
        ? eventData.duration_minutes
        : null,
    hours_credit:
      typeof eventData.hours_credit === "number" && Number.isFinite(eventData.hours_credit)
        ? eventData.hours_credit
        : null,
    status: typeof eventData.status === "string" ? eventData.status : "scheduled",
    supporting_document_id: typeof eventData.supporting_document_id === "string" ? eventData.supporting_document_id : null,
    iso_classifications: Array.isArray(eventData.iso_classifications) ? eventData.iso_classifications.filter((value): value is string => typeof value === "string") : eventData.iso_classification ? [eventData.iso_classification] : [],
    iso_classification: typeof eventData.iso_classification === "string" ? eventData.iso_classification : null,
    iso_facility_id: typeof eventData.iso_facility_id === "string" ? eventData.iso_facility_id : null,
    iso_pre_plan_id: typeof eventData.iso_pre_plan_id === "string" ? eventData.iso_pre_plan_id : null,
    iso_driver_operator_training_type: typeof eventData.iso_driver_operator_training_type === "string" ? eventData.iso_driver_operator_training_type : null,
    iso_qualifying_facility: eventData.iso_qualifying_facility === true,
  };

  const categories: TrainingCategoryRow[] = (categoriesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    system_key: typeof row.system_key === "string" ? row.system_key : null,
    compliance_bucket: typeof row.compliance_bucket === "string" ? row.compliance_bucket : null,
  }));

  const attendanceRows: TrainingAttendanceRow[] = (attendanceData ?? []).map((row) => ({
    id: String(row.id),
    training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : "",
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    attendance_status: typeof row.attendance_status === "string" ? row.attendance_status : "",
    completion_status: typeof row.completion_status === "string" ? row.completion_status : "",
    hours_earned: typeof row.hours_earned === "number" && Number.isFinite(row.hours_earned) ? row.hours_earned : null,
    notes: typeof row.notes === "string" ? row.notes : null,
  }));

  const members: DepartmentMemberRow[] = (membersData ?? []).map((row) => ({
    id: String(row.id),
    first_name: typeof row.first_name === "string" ? row.first_name : null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    rank: typeof row.rank === "string" ? row.rank : null,
    role: typeof row.role === "string" ? row.role : null,
    active: typeof row.active === "boolean" ? row.active : null,
  }));

  const documents: DepartmentDocumentRow[] = (documentsData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Untitled Document",
    document_number: typeof row.document_number === "string" ? row.document_number : null,
    status: typeof row.status === "string" ? row.status : null,
  }));

  const facilities: IsoTrainingFacilityOption[] = (facilitiesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    facility_type: typeof row.facility_type === "string" ? row.facility_type : "other",
    ownership_type: typeof row.ownership_type === "string" ? row.ownership_type : "department_owned",
    address: typeof row.address === "string" ? row.address : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    zip: typeof row.zip === "string" ? row.zip : null,
    tower_stories: typeof row.tower_stories === "number" ? row.tower_stories : null,
    yard_acres: typeof row.yard_acres === "number" ? row.yard_acres : null,
    purpose_built_live_fire: row.purpose_built_live_fire === true,
    formal_agreement: row.formal_agreement === true,
    agreement_reference: typeof row.agreement_reference === "string" ? row.agreement_reference : null,
    active: row.active === true,
  }));

  const prePlans: IsoPrePlanOption[] = (prePlansData ?? []).map((row) => ({
    id: String(row.id),
    business_name: typeof row.business_name === "string" ? row.business_name : "Untitled Property",
    address: typeof row.address === "string" ? row.address : "",
    city: typeof row.city === "string" ? row.city : "",
    state: typeof row.state === "string" ? row.state : "",
    iso_high_hazard: row.iso_high_hazard === true,
    lifecycle_status: typeof row.lifecycle_status === "string" ? row.lifecycle_status : "active",
  }));

  const emsCourseDefinitions: EmsCourseDefinitionRow[] = (emsCourseDefinitionsData ?? []).map((row) => ({
    id: String(row.id),
    course_name: typeof row.course_name === "string" ? row.course_name : "",
    active: row.active === true,
  }));

  return (
    <TrainingEventDetailWorkspace
      departmentId={currentMember.departmentId}
      currentMemberId={currentMember.id}
      currentMemberRole={currentMember.role}
      canManageTraining={canManageTraining}
      trainingEvent={trainingEvent}
      categories={categories}
      documents={documents}
      emsCourseDefinitions={emsCourseDefinitions}
      members={members}
      attendanceRows={attendanceRows}
      facilities={facilities}
      prePlans={prePlans}
    />
  );
}