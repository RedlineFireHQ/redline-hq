import type { SupabaseClient } from "@supabase/supabase-js";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildDepartmentEmsProgressRows,
  type DepartmentEmsAttendanceRow,
  type DepartmentEmsEventRow,
  type DepartmentEmsMember,
  type DepartmentEmsOutsideRow,
  type DepartmentEmsProgressRow,
  type DepartmentEmsTrackProfileRow,
} from "@/lib/ems/department-ems-progress";

// Access check for the EMS Continuing Education Progress report. Same rule as
// tracker management on the Personnel profile: the dedicated permission, broad
// EMS management, or an Administrator (built into hasDepartmentPermission).
export async function canViewEmsCeProgress(
  supabase: SupabaseClient,
  departmentId: string,
  role: unknown,
): Promise<boolean> {
  return (
    (await hasDepartmentPermission(supabase, departmentId, role, "ems_certification_tracking_management")) ||
    (await hasDepartmentPermission(supabase, departmentId, role, "ems_management"))
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

// Loads department-scoped EMS CE progress. Caller MUST have verified access
// with canViewEmsCeProgress first: queries run with the admin client (the same
// pattern as report execution) and every query is bound to the department.
export async function loadDepartmentEmsProgressRows(params: {
  departmentId: string;
  memberId?: string;
}): Promise<DepartmentEmsProgressRow[]> {
  const admin = createSupabaseAdminClient();
  const { departmentId } = params;

  let membersQuery = admin
    .from("members")
    .select("id, first_name, last_name")
    .eq("department_id", departmentId)
    .eq("active", true)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (params.memberId) {
    membersQuery = membersQuery.eq("id", params.memberId);
  }

  const [membersResult, profilesResult, eventsResult, attendanceResult, outsideResult] = await Promise.all([
    membersQuery,
    admin
      .from("ems_member_track_profiles")
      .select(
        "member_id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date",
      )
      .eq("department_id", departmentId)
      .order("effective_start_date", { ascending: false }),
    admin
      .from("training_events")
      .select("id, starts_at, hours_credit, is_ems_training, ems_core_topic, ems_needs_review")
      .eq("department_id", departmentId)
      .eq("is_ems_training", true),
    admin
      .from("training_event_attendance")
      .select("member_id, training_event_id")
      .eq("department_id", departmentId)
      .eq("attendance_status", "attending"),
    admin
      .from("training_outside_submissions")
      .select(
        "id, member_id, training_date, hours, is_ems_training, ems_core_topic, ems_needs_review, training_outside_submission_members(member_id)",
      )
      .eq("department_id", departmentId)
      .eq("status", "approved")
      .eq("is_ems_training", true),
  ]);

  const firstError =
    membersResult.error ?? profilesResult.error ?? eventsResult.error ?? attendanceResult.error ?? outsideResult.error;
  if (firstError) {
    throw new Error(firstError.message || "Unable to load EMS Continuing Education progress.");
  }

  const members: DepartmentEmsMember[] = (membersResult.data ?? []).map((row) => ({
    id: asString(row.id),
    name: `${asString(row.first_name)} ${asString(row.last_name)}`.trim() || "Unknown Member",
  }));

  const trackProfiles = (profilesResult.data ?? []) as unknown as DepartmentEmsTrackProfileRow[];
  const events = (eventsResult.data ?? []) as unknown as DepartmentEmsEventRow[];
  const attendance = (attendanceResult.data ?? []) as unknown as DepartmentEmsAttendanceRow[];

  const outsideSubmissions: DepartmentEmsOutsideRow[] = ((outsideResult.data ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      id: asString(row.id),
      member_id: asString(row.member_id),
      training_date: asString(row.training_date),
      hours: row.hours as number | string | null,
      is_ems_training: row.is_ems_training as boolean | null,
      ems_core_topic: (row.ems_core_topic as string | null) ?? null,
      ems_needs_review: (row.ems_needs_review as boolean | null) ?? null,
      participant_member_ids: Array.isArray(row.training_outside_submission_members)
        ? (row.training_outside_submission_members as Array<Record<string, unknown>>).map((member) => asString(member.member_id))
        : [],
    }),
  );

  return buildDepartmentEmsProgressRows({ members, trackProfiles, events, attendance, outsideSubmissions });
}
