import PageLayout from "@/components/layout/PageLayout";
import PerformMaintenanceButton from "@/components/maintenance/PerformMaintenanceButton";
import ApparatusHistoryCards from "@/components/apparatus/ApparatusHistoryCards";
import AssignedInventoryPanel from "@/components/apparatus/AssignedInventoryPanel";
import { getCurrentMember } from "@/lib/current-member";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import { getApparatusById } from "@/lib/database";
import { calculateApparatusReadinessForApparatusId } from "@/lib/readiness/apparatus-readiness-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";

type InspectionHistoryRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  notes: string | null;
  member_id: string | null;
};

type InspectionSessionRow = {
  id: string;
  completed_inspection_id: string | null;
};

type SessionHelperRow = {
  session_id: string;
  member_id: string;
};

type DeficiencyHistoryRow = {
  id: string;
  reported_at: string | null;
  description: string | null;
  reported_by: string | null;
  priority: string | null;
  status: string | null;
};

type MaintenanceHistoryRow = {
  id: string;
  maintenance_number: string | null;
  deficiency_id: string | null;
  maintenance_type: string | null;
  completed_by: string | null;
  service_date: string | null;
  description: string | null;
};

interface ApparatusPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ApparatusDetailPage({
  params,
}: ApparatusPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const truck = await getApparatusById(id, supabase);

  if (!truck) {
    notFound();
  }

  const apparatusImageUrl = getApparatusImagePath(truck.name);
  const currentMember = await getCurrentMember(supabase);
  const readinessEvaluation = await calculateApparatusReadinessForApparatusId(truck.id);
  const readiness = readinessEvaluation?.readiness ?? null;

  console.log("[apparatus-detail] deficiency history diagnostics", {
    routeApparatusId: id,
    databaseApparatusId: truck.id,
    currentMemberId: currentMember?.id ?? null,
    currentMemberName: currentMember?.name ?? null,
    currentMemberRole: currentMember?.role ?? null,
  });

  const { data: deficiencyMinimalData, error: deficiencyMinimalError } = await supabase
    .from("deficiencies")
    .select("id, apparatus_id, created_at")
    .eq("apparatus_id", truck.id)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("[apparatus-detail] deficiency minimal query result", {
    error: deficiencyMinimalError ?? null,
    length: deficiencyMinimalData?.length ?? 0,
    firstRecord: deficiencyMinimalData?.[0] ?? null,
  });

  const { data: deficiencyDiagnosticsData, error: deficiencyDiagnosticsError } = await supabase
    .from("deficiencies")
    .select("apparatus_id, department_id, status, priority, description, created_at")
    .eq("apparatus_id", truck.id)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("[apparatus-detail] deficiency diagnostics query", {
    table: "deficiencies",
    filters: ["apparatus_id = truck.id", "order created_at desc", "limit 1"],
    currentApparatusId: truck.id,
    returnedCount: deficiencyDiagnosticsData?.length ?? 0,
    firstReturnedRecord: deficiencyDiagnosticsData?.[0] ?? null,
    error: deficiencyDiagnosticsError ?? null,
  });

  const { data: newestDeficiencyData, error: newestDeficiencyError } = await supabase
    .from("deficiencies")
    .select("apparatus_id, department_id, status, priority, description, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("[apparatus-detail] newest deficiency comparison", {
    newestDeficiency: newestDeficiencyData?.[0] ?? null,
    error: newestDeficiencyError ?? null,
    matchesCurrentApparatus:
      (newestDeficiencyData?.[0] as Record<string, unknown> | undefined)?.apparatus_id === truck.id,
  });

  const { data: inspectionHistoryData } = await supabase
    .from("apparatus_inspections")
    .select("id, created_at, status, notes, member_id")
    .eq("apparatus_id", id)
    .order("created_at", { ascending: false });

  const inspectionHistory = (inspectionHistoryData ?? []) as InspectionHistoryRow[];
  const inspectionIds = Array.from(
    new Set(inspectionHistory.map((inspection) => inspection.id).filter((inspectionId) => Boolean(inspectionId))),
  );
  const inspectionOwnerMemberIds = Array.from(
    new Set(
      inspectionHistory
        .map((inspection) => inspection.member_id)
        .filter((memberId): memberId is string => Boolean(memberId))
    )
  );

  let inspectionHelperMemberIdsByInspectionId: Record<string, string[]> = {};
  let helperMemberIds: string[] = [];

  if (inspectionIds.length > 0) {
    const { data: inspectionSessionsRowsRaw } = await supabase
      .from("apparatus_check_sessions")
      .select("id, completed_inspection_id")
      .eq("apparatus_id", id)
      .in("completed_inspection_id", inspectionIds);

    const inspectionSessionsRows = (inspectionSessionsRowsRaw ?? []) as InspectionSessionRow[];
    const inspectionIdBySessionId = inspectionSessionsRows.reduce<Record<string, string>>((accumulator, row) => {
      if (!row.id || !row.completed_inspection_id) {
        return accumulator;
      }

      accumulator[row.id] = row.completed_inspection_id;
      return accumulator;
    }, {});
    const sessionIds = Object.keys(inspectionIdBySessionId);

    if (sessionIds.length > 0) {
      const { data: sessionHelperRowsRaw } = await supabase
        .from("apparatus_check_session_members")
        .select("session_id, member_id")
        .in("session_id", sessionIds);

      const sessionHelperRows = (sessionHelperRowsRaw ?? []) as SessionHelperRow[];
      const helperMap: Record<string, string[]> = {};

      for (const row of sessionHelperRows) {
        const inspectionIdForRow = inspectionIdBySessionId[row.session_id];
        if (!inspectionIdForRow) {
          continue;
        }

        const existing = helperMap[inspectionIdForRow] ?? [];
        existing.push(row.member_id);
        helperMap[inspectionIdForRow] = existing;
      }

      inspectionHelperMemberIdsByInspectionId = helperMap;
      helperMemberIds = Array.from(
        new Set(
          sessionHelperRows
            .map((row) => row.member_id)
            .filter((memberId): memberId is string => typeof memberId === "string" && memberId.length > 0),
        ),
      );
    }
  }

  const inspectionMemberIds = Array.from(new Set([...inspectionOwnerMemberIds, ...helperMemberIds]));

  let inspectionMemberNameById: Record<string, string> = {};

  if (inspectionMemberIds.length > 0) {
    const { data: inspectionMembersData } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", inspectionMemberIds);

    inspectionMemberNameById = (inspectionMembersData ?? []).reduce<Record<string, string>>(
      (accumulator, memberRow) => {
        const row = memberRow as Record<string, unknown>;
        const idValue = row.id;
        const memberId = typeof idValue === "string" ? idValue : "";

        if (!memberId) {
          return accumulator;
        }

        const firstName = typeof row.first_name === "string" ? row.first_name : "";
        const lastName = typeof row.last_name === "string" ? row.last_name : "";
        const fullName = `${firstName} ${lastName}`.trim();

        accumulator[memberId] = fullName;
        return accumulator;
      },
      {}
    );
  }

  const { data: deficiencyHistoryData, error: deficiencyHistoryError } = await supabase
    .from("deficiencies")
    .select(
      "id, apparatus_id, department_id, description, reported_at, created_at, reported_by, priority, status"
    )
    .eq("apparatus_id", truck.id)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("[apparatus-detail] deficiency history query result", {
    error: deficiencyHistoryError ?? null,
    data: deficiencyHistoryData ?? null,
    length: deficiencyHistoryData?.length ?? 0,
    apparatusIdFilter: truck.id,
  });

  const deficiencyHistory = (deficiencyHistoryData ?? []) as DeficiencyHistoryRow[];

  console.log("[apparatus-detail] deficiency history render source", {
    usesVariable: "deficiencyHistory",
    isArray: Array.isArray(deficiencyHistory),
    length: deficiencyHistory.length,
    willRenderEmptyState: deficiencyHistory.length === 0,
    willRenderTable: deficiencyHistory.length > 0,
    firstRecord: deficiencyHistory[0] ?? null,
  });

  const deficiencyPriorityIds = Array.from(
    new Set(
      deficiencyHistory
        .map((deficiency) => deficiency.priority)
        .filter((priorityId): priorityId is string => Boolean(priorityId))
    )
  );
  const deficiencyStatusIds = Array.from(
    new Set(
      deficiencyHistory
        .map((deficiency) => deficiency.status)
        .filter((statusId): statusId is string => Boolean(statusId))
    )
  );

  let deficiencyPriorityNameById: Record<string, string> = {};
  let deficiencyStatusNameById: Record<string, string> = {};

  const { data: maintenanceHistoryData } = await supabase
    .from("maintenance_records")
    .select(
      "id, maintenance_number, deficiency_id, maintenance_type, completed_by, service_date, description"
    )
    .eq("apparatus_id", truck.id)
    .order("service_date", { ascending: false })
    .limit(10);

  const maintenanceHistory = (maintenanceHistoryData ?? []) as MaintenanceHistoryRow[];
  const maintenanceMemberIds = Array.from(
    new Set(
      maintenanceHistory
        .map((maintenance) => maintenance.completed_by)
        .filter((memberId): memberId is string => Boolean(memberId))
    )
  );
  const maintenanceDeficiencyIds = Array.from(
    new Set(
      maintenanceHistory
        .map((maintenance) => maintenance.deficiency_id)
        .filter((deficiencyId): deficiencyId is string => Boolean(deficiencyId))
    )
  );

  let maintenanceMemberNameById: Record<string, string> = {};
  let maintenanceDeficiencyNumberById: Record<string, string> = {};

  if (maintenanceMemberIds.length > 0) {
    const { data: maintenanceMembersData } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", maintenanceMemberIds);

    maintenanceMemberNameById = (maintenanceMembersData ?? []).reduce<Record<string, string>>(
      (accumulator, memberRow) => {
        const row = memberRow as Record<string, unknown>;
        const memberId = typeof row.id === "string" ? row.id : "";

        if (!memberId) {
          return accumulator;
        }

        const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
        const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
        const fullName = `${firstName} ${lastName}`.trim() || memberId;

        accumulator[memberId] = fullName;
        return accumulator;
      },
      {}
    );
  }

  if (maintenanceDeficiencyIds.length > 0) {
    const { data: maintenanceDeficienciesData } = await supabase
      .from("deficiencies")
      .select("id, deficiency_number")
      .in("id", maintenanceDeficiencyIds);

    maintenanceDeficiencyNumberById = (maintenanceDeficienciesData ?? []).reduce<Record<string, string>>(
      (accumulator, deficiencyRow) => {
        const row = deficiencyRow as Record<string, unknown>;
        const deficiencyId = typeof row.id === "string" ? row.id : "";

        if (!deficiencyId) {
          return accumulator;
        }

        const deficiencyNumber =
          typeof row.deficiency_number === "string" && row.deficiency_number.trim()
            ? row.deficiency_number
            : deficiencyId;

        accumulator[deficiencyId] = deficiencyNumber;
        return accumulator;
      },
      {}
    );
  }

  if (deficiencyPriorityIds.length > 0) {
    const { data: deficiencyPriorityRows } = await supabase
      .from("deficiency_priorities")
      .select("id, name")
      .in("id", deficiencyPriorityIds);

    deficiencyPriorityNameById = (deficiencyPriorityRows ?? []).reduce<Record<string, string>>(
      (accumulator, row) => {
        const record = row as Record<string, unknown>;
        const priorityId = typeof record.id === "string" ? record.id : "";
        const priorityName = typeof record.name === "string" ? record.name : "";

        if (!priorityId) {
          return accumulator;
        }

        accumulator[priorityId] = priorityName;
        return accumulator;
      },
      {}
    );
  }

  if (deficiencyStatusIds.length > 0) {
    const { data: deficiencyStatusRows } = await supabase
      .from("deficiency_statuses")
      .select("id, name")
      .in("id", deficiencyStatusIds);

    deficiencyStatusNameById = (deficiencyStatusRows ?? []).reduce<Record<string, string>>(
      (accumulator, row) => {
        const record = row as Record<string, unknown>;
        const statusId = typeof record.id === "string" ? record.id : "";
        const statusName = typeof record.name === "string" ? record.name : "";

        if (!statusId) {
          return accumulator;
        }

        accumulator[statusId] = statusName;
        return accumulator;
      },
      {}
    );
  }

  const formatAssignedInventoryDate = (value: string | null | undefined) => {
    if (!value) {
      return "Not recorded";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const compareWithToday = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsed.getTime() < today.getTime()) {
      return "past";
    }

    if (parsed.getTime() === today.getTime()) {
      return "today";
    }

    return "future";
  };

  const statusClassForAssignedInventory = (status: string | null | undefined) => {
    if (status === "Current") {
      return "text-green-300";
    }

    if (status === "Due Today" || status === "No Service Test" || status === "Not Tracked") {
      return "text-amber-300";
    }

    if (status === "Needs Attention" || status === "Overdue") {
      return "text-red-300";
    }

    return "text-neutral-300";
  };

  const getDueDateInspectionStatus = (dueDate: string | null | undefined) => {
    if (!dueDate) {
      return "Not Tracked";
    }

    const comparison = compareWithToday(dueDate);
    if (comparison === "past") {
      return "Overdue";
    }

    if (comparison === "today") {
      return "Due Today";
    }

    return "Current";
  };

  const getGroundLadderInspectionStatus = (latestTest: { next_test_due_date?: string | null } | null | undefined) => {
    if (!latestTest || !latestTest.next_test_due_date) {
      return "No Service Test";
    }

    return getDueDateInspectionStatus(latestTest.next_test_due_date);
  };

  const getRopeInspectionStatus = (latestInspection: { result?: string | null; inspection_date?: string | null } | null | undefined) => {
    if (!latestInspection || !latestInspection.inspection_date) {
      return "Not Tracked";
    }

    const normalizedResult = typeof latestInspection.result === "string" ? latestInspection.result.trim().toLowerCase() : "";
    if (normalizedResult === "fail") {
      return "Needs Attention";
    }

    return "Current";
  };

  const getGasMonitorInspectionStatus = (latestCalibrationDate: string | null | undefined, calibrationIntervalMonths: number) => {
    if (!latestCalibrationDate) {
      return "Not Tracked";
    }

    const intervalMs = calibrationIntervalMonths * 30 * 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(`${latestCalibrationDate}T00:00:00`);
    dueDate.setTime(dueDate.getTime() + intervalMs);

    if (dueDate.getTime() < today.getTime()) {
      return "Overdue";
    }

    if (dueDate.getTime() === today.getTime()) {
      return "Due Today";
    }

    return "Current";
  };

  const [
    { data: assignedFireExtinguishersData },
    { data: assignedMiscEquipmentData },
    { data: assignedRopeData },
    { data: assignedGroundLadderAssignmentsData },
    { data: assignedPortableRadioAssignmentsData },
    { data: assignedGasMonitorAssignmentsData },
    { data: assignedBatteryAssignmentsData },
    { data: assignedThermalCameraAssignmentsData },
    { data: assignedPieAssignmentsData },
    { data: assignedFireHoseData },
  ] = await Promise.all([
    supabase
      .from("fire_extinguishers")
      .select("id, extinguisher_number, extinguisher_type, status, updated_at, created_at")
      .eq("apparatus_id", truck.id)
      .eq("location_type", "Apparatus"),
    supabase
      .from("misc_fire_equipment")
      .select("id, equipment_name, asset_number, status, updated_at, created_at")
      .eq("apparatus_id", truck.id)
      .eq("location_type", "Apparatus"),
    supabase
      .from("rope_items")
      .select("id, rope_name, rope_identifier, status, updated_at, created_at")
      .eq("apparatus_id", truck.id)
      .eq("location_type", "Apparatus"),
    supabase
      .from("ground_ladder_assignments")
      .select("ground_ladder_id")
      .eq("apparatus_id", truck.id)
      .is("ended_at", null),
    supabase
      .from("portable_radio_assignments")
      .select("portable_radio_id")
      .eq("apparatus_id", truck.id)
      .is("ended_at", null),
    supabase
      .from("gas_monitor_assignments")
      .select("gas_monitor_id")
      .eq("apparatus_id", truck.id)
      .is("ended_at", null),
    supabase
      .from("battery_assignments")
      .select("battery_id")
      .eq("apparatus_id", truck.id)
      .is("ended_at", null),
    supabase
      .from("thermal_imaging_camera_assignments")
      .select("thermal_imaging_camera_id")
      .eq("apparatus_id", truck.id)
      .is("ended_at", null),
    supabase
      .from("pie_equipment_assignments")
      .select("pie_equipment_id")
      .eq("apparatus_id", truck.id)
      .is("ended_at", null),
    supabase
      .from("fire_hose")
      .select("id, inventory_number, status, updated_at, created_at")
      .eq("apparatus_id", truck.id),
  ]);

  const groundLadderIds = Array.from(
    new Set(
      (assignedGroundLadderAssignmentsData ?? [])
        .map((row) => String((row as Record<string, unknown>).ground_ladder_id ?? ""))
        .filter(Boolean),
    ),
  );
  const portableRadioIds = Array.from(
    new Set(
      (assignedPortableRadioAssignmentsData ?? [])
        .map((row) => String((row as Record<string, unknown>).portable_radio_id ?? ""))
        .filter(Boolean),
    ),
  );
  const gasMonitorIds = Array.from(
    new Set(
      (assignedGasMonitorAssignmentsData ?? [])
        .map((row) => String((row as Record<string, unknown>).gas_monitor_id ?? ""))
        .filter(Boolean),
    ),
  );
  const batteryIds = Array.from(
    new Set(
      (assignedBatteryAssignmentsData ?? [])
        .map((row) => String((row as Record<string, unknown>).battery_id ?? ""))
        .filter(Boolean),
    ),
  );
  const thermalCameraIds = Array.from(
    new Set(
      (assignedThermalCameraAssignmentsData ?? [])
        .map((row) => String((row as Record<string, unknown>).thermal_imaging_camera_id ?? ""))
        .filter(Boolean),
    ),
  );
  const pieEquipmentIds = Array.from(
    new Set(
      (assignedPieAssignmentsData ?? [])
        .map((row) => String((row as Record<string, unknown>).pie_equipment_id ?? ""))
        .filter(Boolean),
    ),
  );

  const [
    { data: assignedGroundLadderData },
    { data: assignedPortableRadioData },
    { data: assignedGasMonitorData },
    { data: assignedBatteryData },
    { data: assignedThermalCameraData },
    { data: assignedPieData },
  ] = await Promise.all([
    groundLadderIds.length > 0
      ? supabase
          .from("ground_ladders")
          .select("id, ladder_number, status, updated_at, created_at")
          .in("id", groundLadderIds)
      : Promise.resolve({ data: [] }),
    portableRadioIds.length > 0
      ? supabase
          .from("portable_radios")
          .select("id, radio_number, status, updated_at, created_at")
          .in("id", portableRadioIds)
      : Promise.resolve({ data: [] }),
    gasMonitorIds.length > 0
      ? supabase
          .from("gas_monitors")
          .select("id, monitor_number, status, updated_at, created_at")
          .in("id", gasMonitorIds)
      : Promise.resolve({ data: [] }),
    batteryIds.length > 0
      ? supabase
          .from("batteries")
          .select("id, battery_number, status, updated_at, created_at")
          .in("id", batteryIds)
      : Promise.resolve({ data: [] }),
    thermalCameraIds.length > 0
      ? supabase
          .from("thermal_imaging_cameras")
          .select("id, camera_number, status, updated_at, created_at")
          .in("id", thermalCameraIds)
      : Promise.resolve({ data: [] }),
    pieEquipmentIds.length > 0
      ? supabase
          .from("pie_equipment")
          .select("id, equipment_number, status, updated_at, created_at")
          .in("id", pieEquipmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ropeIds = Array.from(
    new Set(
      ((assignedRopeData ?? []) as Array<Record<string, unknown>>)
        .map((row) => String(row.id ?? ""))
        .filter(Boolean),
    ),
  );

  const [
    { data: groundLadderServiceTestsData },
    { data: ropeInspectionData },
    { data: gasMonitorCalibrationRowsRaw },
    { data: gasMonitorSessionCalibrationRowsRaw },
  ] = await Promise.all([
    groundLadderIds.length > 0
      ? supabase
          .from("ground_ladder_service_tests")
          .select("ground_ladder_id, next_test_due_date, test_date, result")
          .in("ground_ladder_id", groundLadderIds)
          .order("test_date", { ascending: false })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ropeIds.length > 0
      ? supabase
          .from("rope_inspections")
          .select("rope_item_id, inspection_date, result")
          .in("rope_item_id", ropeIds)
          .order("inspection_date", { ascending: false })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    gasMonitorIds.length > 0
      ? supabase
          .from("gas_monitor_calibrations")
          .select("gas_monitor_id, calibration_date")
          .in("gas_monitor_id", gasMonitorIds)
          .order("calibration_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    gasMonitorIds.length > 0
      ? supabase
          .from("gas_monitor_calibration_session_results")
          .select("gas_monitor_id, calibration_date")
          .in("gas_monitor_id", gasMonitorIds)
          .order("calibration_date", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const latestGroundLadderServiceTestById = new Map<string, { next_test_due_date: string | null; test_date: string | null; result: string | null }>();
  for (const row of (groundLadderServiceTestsData ?? []) as Array<Record<string, unknown>>) {
    const ladderId = typeof row.ground_ladder_id === "string" ? row.ground_ladder_id : "";
    if (!ladderId) {
      continue;
    }

    const current = latestGroundLadderServiceTestById.get(ladderId);
    const nextDueDate = typeof row.next_test_due_date === "string" ? row.next_test_due_date : null;
    const testDate = typeof row.test_date === "string" ? row.test_date : null;
    const result = typeof row.result === "string" ? row.result : null;

    if (!current || (testDate && (!current.test_date || testDate > current.test_date))) {
      latestGroundLadderServiceTestById.set(ladderId, {
        next_test_due_date: nextDueDate,
        test_date: testDate,
        result,
      });
    }
  }

  const latestRopeInspectionById = new Map<string, { inspection_date: string | null; result: string | null }>();
  for (const row of (ropeInspectionData ?? []) as Array<Record<string, unknown>>) {
    const ropeId = typeof row.rope_item_id === "string" ? row.rope_item_id : "";
    if (!ropeId) {
      continue;
    }

    const current = latestRopeInspectionById.get(ropeId);
    const inspectionDate = typeof row.inspection_date === "string" ? row.inspection_date : null;
    const result = typeof row.result === "string" ? row.result : null;

    if (!current || (inspectionDate && (!current.inspection_date || inspectionDate > current.inspection_date))) {
      latestRopeInspectionById.set(ropeId, { inspection_date: inspectionDate, result });
    }
  }

  const latestCalibrationDateByGasMonitorId = new Map<string, string | null>();
  const calibrationRows = [
    ...((gasMonitorCalibrationRowsRaw ?? []) as Array<Record<string, unknown>>),
    ...((gasMonitorSessionCalibrationRowsRaw ?? []) as Array<Record<string, unknown>>),
  ];

  for (const row of calibrationRows) {
    const gasMonitorId = typeof row.gas_monitor_id === "string" ? row.gas_monitor_id : "";
    if (!gasMonitorId) {
      continue;
    }

    const calibrationDate = typeof row.calibration_date === "string" ? row.calibration_date : null;
    const current = latestCalibrationDateByGasMonitorId.get(gasMonitorId);
    if (!calibrationDate) {
      continue;
    }

    if (!current || (calibrationDate > current)) {
      latestCalibrationDateByGasMonitorId.set(gasMonitorId, calibrationDate);
    }
  }

  const assignedInventoryItems = [
    ...((assignedFireExtinguishersData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      name: typeof row.extinguisher_number === "string" && row.extinguisher_number.trim()
        ? row.extinguisher_number
        : typeof row.extinguisher_type === "string"
          ? row.extinguisher_type
          : "Fire Extinguisher",
      category: typeof row.extinguisher_type === "string" && row.extinguisher_type.trim()
        ? row.extinguisher_type
        : "Fire Extinguisher",
      location: `${truck.name} - Apparatus`,
      inspectionStatus: "Not Tracked",
      statusClass: statusClassForAssignedInventory("Not Tracked"),
      lastInspection: formatAssignedInventoryDate(typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : null),
      linkHref: null,
    })),
    ...((assignedMiscEquipmentData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      name: typeof row.equipment_name === "string" && row.equipment_name.trim()
        ? row.equipment_name
        : typeof row.asset_number === "string" && row.asset_number.trim()
          ? row.asset_number
          : "Misc Fire Equipment",
      category: "Misc Fire Equipment",
      location: `${truck.name} - Apparatus`,
      inspectionStatus: "Not Tracked",
      statusClass: statusClassForAssignedInventory("Not Tracked"),
      lastInspection: formatAssignedInventoryDate(typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : null),
      linkHref: null,
    })),
    ...((assignedRopeData ?? []) as Array<Record<string, unknown>>).map((row) => {
      const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
      const ropeId = id;
      const latestInspection = latestRopeInspectionById.get(ropeId) ?? null;
      const inspectionStatus = getRopeInspectionStatus(latestInspection);

      return {
        id,
        name: typeof row.rope_name === "string" && row.rope_name.trim()
          ? row.rope_name
          : typeof row.rope_identifier === "string" && row.rope_identifier.trim()
            ? row.rope_identifier
            : "Rope",
        category: "Rope",
        location: `${truck.name} - Apparatus`,
        inspectionStatus,
        statusClass: statusClassForAssignedInventory(inspectionStatus),
        lastInspection: latestInspection?.inspection_date
          ? formatAssignedInventoryDate(latestInspection.inspection_date)
          : "Not recorded",
        linkHref: null,
      };
    }),
    ...((assignedGroundLadderData ?? []) as Array<Record<string, unknown>>).map((row) => {
      const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
      const latestTest = latestGroundLadderServiceTestById.get(id) ?? null;
      const inspectionStatus = getGroundLadderInspectionStatus(latestTest);

      return {
        id,
        name: typeof row.ladder_number === "string" && row.ladder_number.trim() ? row.ladder_number : "Ground Ladder",
        category: "Ground Ladder",
        location: `${truck.name} - Apparatus`,
        inspectionStatus,
        statusClass: statusClassForAssignedInventory(inspectionStatus),
        lastInspection: latestTest?.test_date ? formatAssignedInventoryDate(latestTest.test_date) : "Not recorded",
        linkHref: null,
      };
    }),
    ...((assignedPortableRadioData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      name: typeof row.radio_number === "string" && row.radio_number.trim() ? row.radio_number : "Portable Radio",
      category: "Portable Radio",
      location: `${truck.name} - Apparatus`,
      inspectionStatus: "Not Tracked",
      statusClass: statusClassForAssignedInventory("Not Tracked"),
      lastInspection: formatAssignedInventoryDate(typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : null),
      linkHref: null,
    })),
    ...((assignedGasMonitorData ?? []) as Array<Record<string, unknown>>).map((row) => {
      const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
      const latestCalibrationDate = latestCalibrationDateByGasMonitorId.get(id) ?? null;
      const inspectionStatus = getGasMonitorInspectionStatus(latestCalibrationDate, 6);

      return {
        id,
        name: typeof row.monitor_number === "string" && row.monitor_number.trim() ? row.monitor_number : "Gas Monitor",
        category: "Gas Monitor",
        location: `${truck.name} - Apparatus`,
        inspectionStatus,
        statusClass: statusClassForAssignedInventory(inspectionStatus),
        lastInspection: latestCalibrationDate ? formatAssignedInventoryDate(latestCalibrationDate) : "Not recorded",
        linkHref: null,
      };
    }),
    ...((assignedBatteryData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      name: typeof row.battery_number === "string" && row.battery_number.trim() ? row.battery_number : "Battery",
      category: "Battery",
      location: `${truck.name} - Apparatus`,
      inspectionStatus: "Not Tracked",
      statusClass: statusClassForAssignedInventory("Not Tracked"),
      lastInspection: formatAssignedInventoryDate(typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : null),
      linkHref: null,
    })),
    ...((assignedThermalCameraData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      name: typeof row.camera_number === "string" && row.camera_number.trim() ? row.camera_number : "Thermal Imaging Camera",
      category: "Thermal Imaging Camera",
      location: `${truck.name} - Apparatus`,
      inspectionStatus: "Not Tracked",
      statusClass: statusClassForAssignedInventory("Not Tracked"),
      lastInspection: formatAssignedInventoryDate(typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : null),
      linkHref: null,
    })),
    ...((assignedPieData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      name: typeof row.equipment_number === "string" && row.equipment_number.trim() ? row.equipment_number : "PIE Equipment",
      category: "PIE Equipment",
      location: `${truck.name} - Apparatus`,
      inspectionStatus: "Not Tracked",
      statusClass: statusClassForAssignedInventory("Not Tracked"),
      lastInspection: formatAssignedInventoryDate(typeof row.updated_at === "string" ? row.updated_at : typeof row.created_at === "string" ? row.created_at : null),
      linkHref: null,
    })),
    ...((assignedFireHoseData ?? []) as Array<Record<string, unknown>>).map((row) => {
      const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
      const nextTestDate = typeof row.next_test_date === "string" ? row.next_test_date : null;
      const inspectionStatus = getDueDateInspectionStatus(nextTestDate);

      return {
        id,
        name: typeof row.inventory_number === "string" && row.inventory_number.trim() ? row.inventory_number : "Fire Hose",
        category: "Fire Hose",
        location: `${truck.name} - Apparatus`,
        inspectionStatus,
        statusClass: statusClassForAssignedInventory(inspectionStatus),
        lastInspection: nextTestDate ? formatAssignedInventoryDate(nextTestDate) : "Not recorded",
        linkHref: null,
      };
    }),
  ].filter((item) => Boolean(item.id));

  const readinessScore = readiness?.scorePercent ?? null;
  const readinessScoreLabel = readinessScore === null ? "NOT SCORED" : `${Math.round(readinessScore)}%`;
  const checksBucketScore = readiness?.bucketScores.apparatusChecks ?? null;
  const maintenanceBucketScore = readiness?.bucketScores.maintenanceService ?? null;
  const equipmentBucketScore = readiness?.bucketScores.requiredEquipment ?? null;
  const conditionCounts = readiness?.metadata.activeConditionCounts ?? {
    minor: 0,
    significant: 0,
    critical: 0,
  };
  const readinessBlockingGaps = readiness?.blockingGaps ?? [];

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/apparatuspageimage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="space-y-8">
        <div className="rounded-2xl border border-neutral-800 bg-[#1b1b1b] p-4 md:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="relative h-36 w-52 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#111111] shadow-inner">
              {apparatusImageUrl ? (
                <img
                  src={apparatusImageUrl}
                  alt={`${truck.name} photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-300">
                  Apparatus Photo
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
                Apparatus
              </p>

              <h1
                className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
                style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
              >
                {truck.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                <span className="font-medium text-neutral-300">{truck.type ?? "Apparatus"}</span>
                <span className="h-1 w-1 rounded-full bg-neutral-600" />
                <span>{truck.department_name ?? "Department"}</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 border-l border-white/10 pl-0 lg:pl-6">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
                    Apparatus Readiness
                  </p>

                  <ul className="mt-3 space-y-2 text-sm text-neutral-200">
                    <li>
                      {checksBucketScore === 20
                        ? "✓ Apparatus Check Current"
                        : checksBucketScore === null
                          ? "⚠ Apparatus Check configuration required"
                          : "⚠ Apparatus Check overdue"}
                    </li>
                    <li>
                      {conditionCounts.critical > 0
                        ? `⚠ ${conditionCounts.critical} Critical ${conditionCounts.critical === 1 ? "Condition" : "Conditions"} Active`
                        : conditionCounts.significant > 0 || conditionCounts.minor > 0
                          ? `⚠ ${conditionCounts.significant} Significant, ${conditionCounts.minor} Minor Active`
                          : "✓ No active condition deductions"}
                    </li>
                    <li>
                      {maintenanceBucketScore === null
                        ? "⚠ Maintenance requirement configuration required"
                        : maintenanceBucketScore === 20
                          ? "✓ Maintenance Current"
                          : "⚠ Maintenance requires attention"}
                    </li>
                    <li>
                      {equipmentBucketScore === null
                        ? "⚠ Required equipment configuration required"
                        : equipmentBucketScore === 20
                          ? "✓ Required equipment operational"
                          : "⚠ Required equipment has unavailable items"}
                    </li>
                    {readiness?.isOutOfService ? (
                      <li>{"⚠ Apparatus is Out of Service"}</li>
                    ) : null}
                  </ul>
                </div>

                {readinessBlockingGaps.length > 0 ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                    {readinessBlockingGaps.map((gap) => (
                      <p key={gap}>{`⚠ ${gap}`}</p>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/apparatus/${truck.id}/daily-check`}
                    className="rounded-lg border border-red-500/30 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    Start Apparatus Check
                  </Link>
                  <Link
                    href={`/deficiencies/report?apparatusId=${truck.id}`}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Report Deficiency
                  </Link>
                  <PerformMaintenanceButton
                    apparatusId={truck.id}
                    returnTo={`/apparatus/${id}`}
                  />
                  <Link
                    href={`/apparatus/${truck.id}/information`}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Apparatus Information
                  </Link>
                </div>
              </div>
            </div>

            <div className="w-full max-w-[220px] shrink-0 rounded-xl border border-white/10 bg-[#111111] px-4 py-3 lg:ml-auto">
              <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500">Readiness Score</p>
              <p className="mt-1 text-3xl font-black text-white">{readinessScoreLabel}</p>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${readinessScore ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <ApparatusHistoryCards
            apparatusName={truck.name}
            inspectionHistory={inspectionHistory}
            inspectionMemberNameById={inspectionMemberNameById}
            inspectionHelperMemberIdsByInspectionId={inspectionHelperMemberIdsByInspectionId}
            deficiencyHistory={deficiencyHistory}
            deficiencyPriorityNameById={deficiencyPriorityNameById}
            deficiencyStatusNameById={deficiencyStatusNameById}
            maintenanceHistory={maintenanceHistory}
            maintenanceMemberNameById={maintenanceMemberNameById}
            maintenanceDeficiencyNumberById={maintenanceDeficiencyNumberById}
          />

          <AssignedInventoryPanel items={assignedInventoryItems} apparatusId={truck.id} />
        </div>
      </div>
    </PageLayout>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
      <h2 className="text-lg font-bold text-white">
        {title}
      </h2>

      <div className="mt-5">{children}</div>
    </div>
  );
}