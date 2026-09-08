import { redirect } from "next/navigation";
import ReportsWorkspace from "@/components/reports/ReportsWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ReportMemberOption = {
  id: string;
  name: string;
  station?: string | null;
  shift?: string | null;
  status?: string | null;
  active?: boolean | null;
  departmentRoleId?: string | null;
};

type ReportTrainingCategoryOption = {
  id: string;
  name: string;
};

type ReportCertificationOption = {
  id: string;
  name: string;
};

type ReportApparatusOption = {
  id: string;
  name: string;
};

type ReportDepartmentRoleOption = {
  id: string;
  name: string;
};

type ReportInspectionItemOption = {
  id: string;
  name: string;
};

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const hasReportsAccess = await hasDepartmentPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
    "reports_management",
  );

  if (!hasReportsAccess) {
    redirect("/");
  }

  let departmentName: string | null = null;
  let members: ReportMemberOption[] = [];
  let trainingCategories: ReportTrainingCategoryOption[] = [];
  let certifications: ReportCertificationOption[] = [];
  let apparatuses: ReportApparatusOption[] = [];
  let apparatusCheckMembers: ReportMemberOption[] = [];
  let departmentRoles: ReportDepartmentRoleOption[] = [];
  let inspectionFireHose: ReportInspectionItemOption[] = [];
  let inspectionScbaCylinders: ReportInspectionItemOption[] = [];
  let inspectionScbaPacks: ReportInspectionItemOption[] = [];
  let inspectionGasMonitors: ReportInspectionItemOption[] = [];
  let inspectionRopeItems: ReportInspectionItemOption[] = [];
  let inspectionGroundLadders: ReportInspectionItemOption[] = [];
  let emsEquipment: Array<{ id: string; name: string; equipment_number?: string | null; equipment_type?: string | null; status?: string | null; location?: string | null }> = [];
  let emsSupplies: Array<{ id: string; name: string; item_category?: string | null; status?: string | null; location?: string | null }> = [];
  let initialLookupError: string | null = null;
  if (currentMember?.departmentId) {
    const [departmentResult, membersResult, categoriesResult, certificationsResult, apparatusResult, inspectionMembersResult, departmentRoleResult, emsEquipmentResult, emsSuppliesResult, fireHoseResult, scbaCylindersResult, scbaPacksResult, gasMonitorsResult, ropeItemsResult, groundLaddersResult] = await Promise.all([
      supabase
        .from("departments")
        .select("name")
        .eq("id", currentMember.departmentId)
        .maybeSingle(),
      supabase
        .from("members")
        .select("id, first_name, last_name, station, shift, rank, role, active, status, department_role_id")
        .eq("department_id", currentMember.departmentId)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
      supabase
        .from("training_categories")
        .select("id, name")
        .eq("department_id", currentMember.departmentId)
        .order("name", { ascending: true }),
      supabase
        .from("certifications")
        .select("id, name")
        .eq("department_id", currentMember.departmentId)
        .order("name", { ascending: true }),
      supabase
        .from("apparatus")
        .select("id, name")
        .eq("department_id", currentMember.departmentId)
        .eq("lifecycle_status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("apparatus_inspections")
        .select("member_id")
        .eq("department_id", currentMember.departmentId)
        .order("member_id", { ascending: true }),
      supabase
        .from("department_roles")
        .select("id, name")
        .eq("department_id", currentMember.departmentId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("ems_equipment")
        .select("id, equipment_name, equipment_number, equipment_type, status, location")
        .eq("department_id", currentMember.departmentId)
        .order("equipment_name", { ascending: true }),
      supabase
        .from("ems_supply_items")
        .select("id, item_name, item_category, status, location")
        .eq("department_id", currentMember.departmentId)
        .order("item_name", { ascending: true }),
      supabase
        .from("fire_hose")
        .select("id, inventory_number")
        .eq("department_id", currentMember.departmentId)
        .order("inventory_number", { ascending: true }),
      supabase
        .from("scba_cylinders")
        .select("id, cylinder_number")
        .eq("department_id", currentMember.departmentId)
        .order("cylinder_number", { ascending: true }),
      supabase
        .from("scba_packs")
        .select("id, pack_number")
        .eq("department_id", currentMember.departmentId)
        .order("pack_number", { ascending: true }),
      supabase
        .from("gas_monitors")
        .select("id, monitor_number")
        .eq("department_id", currentMember.departmentId)
        .order("monitor_number", { ascending: true }),
      supabase
        .from("rope_items")
        .select("id, rope_name, rope_identifier")
        .eq("department_id", currentMember.departmentId)
        .order("rope_name", { ascending: true }),
      supabase
        .from("ground_ladders")
        .select("id, ladder_number")
        .eq("department_id", currentMember.departmentId)
        .order("ladder_number", { ascending: true }),
    ]);

    const lookupErrors = [
      { label: "the department name", error: departmentResult.error },
      { label: "department members", error: membersResult.error },
      { label: "training categories", error: categoriesResult.error },
      { label: "certification list", error: certificationsResult.error },
      { label: "apparatus data", error: apparatusResult.error },
      { label: "apparatus check members", error: inspectionMembersResult.error },
      { label: "department roles", error: departmentRoleResult.error },
      { label: "EMS equipment", error: emsEquipmentResult.error },
      { label: "EMS supplies", error: emsSuppliesResult.error },
      { label: "fire hose inspection items", error: fireHoseResult.error },
      { label: "SCBA cylinder inspection items", error: scbaCylindersResult.error },
      { label: "SCBA pack inspection items", error: scbaPacksResult.error },
      { label: "gas monitor inspection items", error: gasMonitorsResult.error },
      { label: "rope inspection items", error: ropeItemsResult.error },
      { label: "ground ladder inspection items", error: groundLaddersResult.error },
    ];
    const failedLookup = lookupErrors.find((item) => item.error);
    if (failedLookup) {
      console.error("[reports] initial lookup failed", failedLookup.error);
      initialLookupError = `Unable to load ${failedLookup.label}. Please try again.`;
    }

    departmentName = typeof departmentResult.data?.name === "string" ? departmentResult.data.name : null;

    members = (membersResult.data ?? [])
      .map((row) => {
        const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
        const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
        const fullName = `${firstName} ${lastName}`.trim();
        return {
          id: String(row.id),
          name: fullName || "Unknown Member",
          station: typeof row.station === "string" ? row.station.trim() : null,
          shift: typeof row.shift === "string" ? row.shift.trim() : null,
          status: typeof row.status === "string" ? row.status.trim() : null,
          active: typeof row.active === "boolean" ? row.active : null,
          departmentRoleId: typeof row.department_role_id === "string" ? row.department_role_id : null,
        };
      })
      .filter((row) => row.id.length > 0);

    trainingCategories = (categoriesResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    certifications = (certificationsResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    apparatuses = (apparatusResult.data ?? [])
      .map((row) => ({
        id: row.id,
        name: typeof row.name === "string" ? row.name : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    departmentRoles = (departmentRoleResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    emsEquipment = (emsEquipmentResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.equipment_name === "string" ? row.equipment_name.trim() : "",
        equipment_number: typeof row.equipment_number === "string" ? row.equipment_number.trim() : null,
        equipment_type: typeof row.equipment_type === "string" ? row.equipment_type.trim() : null,
        status: typeof row.status === "string" ? row.status.trim() : null,
        location: typeof row.location === "string" ? row.location.trim() : null,
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

    emsSupplies = (emsSuppliesResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.item_name === "string" ? row.item_name.trim() : "",
        item_category: typeof row.item_category === "string" ? row.item_category.trim() : null,
        status: typeof row.status === "string" ? row.status.trim() : null,
        location: typeof row.location === "string" ? row.location.trim() : null,
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

    inspectionFireHose = (fireHoseResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.inventory_number === "string" ? row.inventory_number.trim() : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    inspectionScbaCylinders = (scbaCylindersResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.cylinder_number === "string" ? row.cylinder_number.trim() : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    inspectionScbaPacks = (scbaPacksResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.pack_number === "string" ? row.pack_number.trim() : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    inspectionGasMonitors = (gasMonitorsResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.monitor_number === "string" ? row.monitor_number.trim() : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    inspectionRopeItems = (ropeItemsResult.data ?? [])
      .map((row) => {
        const ropeName = typeof row.rope_name === "string" ? row.rope_name.trim() : "";
        const ropeIdentifier = typeof row.rope_identifier === "string" ? row.rope_identifier.trim() : "";
        return {
          id: String(row.id),
          name: ropeName || ropeIdentifier,
        };
      })
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    inspectionGroundLadders = (groundLaddersResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        name: typeof row.ladder_number === "string" ? row.ladder_number.trim() : "",
      }))
      .filter((row) => row.id.length > 0 && row.name.length > 0);

    const inspectionMemberIds = new Set(
      (inspectionMembersResult.data ?? [])
        .map((row) => (typeof row.member_id === "string" ? row.member_id : ""))
        .filter((memberId) => memberId.length > 0),
    );

    apparatusCheckMembers = (membersResult.data ?? [])
      .map((row) => {
        const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
        const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
        const fullName = `${firstName} ${lastName}`.trim();

        return {
          id: String(row.id),
          name: fullName || "Unknown Member",
        };
      })
      .filter((row) => row.id.length > 0 && inspectionMemberIds.has(row.id))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  }

  return (
    <ReportsWorkspace
      isAuthenticated={Boolean(currentMember?.departmentId)}
      departmentName={departmentName}
      members={members}
      trainingCategories={trainingCategories}
      certifications={certifications}
      apparatuses={apparatuses}
      apparatusCheckMembers={apparatusCheckMembers}
      departmentRoles={departmentRoles}
      inspectionFireHose={inspectionFireHose}
      inspectionScbaCylinders={inspectionScbaCylinders}
      inspectionScbaPacks={inspectionScbaPacks}
      inspectionGasMonitors={inspectionGasMonitors}
      inspectionRopeItems={inspectionRopeItems}
      inspectionGroundLadders={inspectionGroundLadders}
      emsEquipment={emsEquipment}
      emsSupplies={emsSupplies}
      initialError={initialLookupError}
    />
  );
}
