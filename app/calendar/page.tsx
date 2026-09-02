import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import CalendarWorkspace from "@/components/calendar/CalendarWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const [{ data: activityRows, error: activitiesError }, { data: memberRows, error: membersError }] = await Promise.all([
    supabase
      .from("department_calendar_activities")
      .select(
        "id, title, activity_type, description, start_at, end_at, all_day, location, assigned_member_id, created_by, status, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .order("start_at", { ascending: true }),
    supabase
      .from("members")
      .select("id, first_name, last_name, role")
      .eq("department_id", currentMember.departmentId)
      .order("first_name", { ascending: true }),
  ]);

  if (activitiesError) {
    throw new Error(activitiesError.message || "Unable to load calendar activities.");
  }

  if (membersError) {
    throw new Error(membersError.message || "Unable to load department members.");
  }

  const memberOptions = (memberRows ?? []).map((member) => {
    const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
    const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      id: String(member.id),
      name: fullName || "Unknown user",
      role: typeof member.role === "string" ? member.role.trim().toLowerCase() : "firefighter",
    };
  });

  const memberNameById = new Map(memberOptions.map((member) => [member.id, member.name]));

  const activities = (activityRows ?? []).map((activity) => ({
    id: String(activity.id),
    title: typeof activity.title === "string" ? activity.title : "Untitled activity",
    activityType: typeof activity.activity_type === "string" ? activity.activity_type : "Other",
    description: typeof activity.description === "string" ? activity.description : null,
    startAt: typeof activity.start_at === "string" ? activity.start_at : "",
    endAt: typeof activity.end_at === "string" ? activity.end_at : null,
    allDay: Boolean(activity.all_day),
    location: typeof activity.location === "string" ? activity.location : null,
    assignedMemberId: typeof activity.assigned_member_id === "string" ? activity.assigned_member_id : null,
    assignedMemberName:
      typeof activity.assigned_member_id === "string"
        ? memberNameById.get(activity.assigned_member_id) ?? null
        : null,
    createdBy: typeof activity.created_by === "string" ? activity.created_by : null,
    status: typeof activity.status === "string" ? activity.status : "Scheduled",
    createdAt: typeof activity.created_at === "string" ? activity.created_at : null,
    updatedAt: typeof activity.updated_at === "string" ? activity.updated_at : null,
  }));

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/calendarpage.png"
      environmentBackgroundPosition="left center"
    >
      <CalendarWorkspace
        currentMember={{
          id: currentMember.id,
          departmentId: currentMember.departmentId,
          role: currentMember.role,
          name: currentMember.name,
        }}
        initialActivities={activities}
        memberOptions={memberOptions}
      />
    </PageLayout>
  );
}
