"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { supabase } from "@/lib/supabase";

type MemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ScbaCylinderRecord = {
  id: string;
  cylinder_number: string | null;
  cylinder_type: string | null;
  status: string | null;
  next_hydrostatic_test_due_date: string | null;
  service_life_end_date: string | null;
};

type ScbaPackRecord = {
  id: string;
  status: string | null;
  next_flow_test_due_date: string | null;
};

type DeficiencyLinkRow = {
  fire_hose_id: string | null;
  scba_cylinder_id: string | null;
  scba_pack_id: string | null;
  pie_equipment_id: string | null;
  ems_equipment_id: string | null;
  ppe_item_id: string | null;
  rope_item_id: string | null;
  gas_monitor_id: string | null;
  battery_id: string | null;
  thermal_imaging_camera_id: string | null;
  ground_ladder_id: string | null;
};

function isOnOrBeforeToday(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return parsed.getTime() <= today.getTime();
}

function getScbaCylinderRestoredStatus(cylinder: ScbaCylinderRecord) {
  if ((cylinder.status ?? "").trim() === "Retired") {
    return "Retired";
  }

  if (isOnOrBeforeToday(cylinder.service_life_end_date)) {
    return "Out of Service";
  }

  if (isOnOrBeforeToday(cylinder.next_hydrostatic_test_due_date)) {
    return "Testing Due";
  }

  return "Ready";
}

function getScbaPackRestoredStatus(pack: ScbaPackRecord) {
  if ((pack.status ?? "").trim() === "Retired") {
    return "Retired";
  }

  if (isOnOrBeforeToday(pack.next_flow_test_due_date)) {
    return "Flow Test Due";
  }

  return "Ready";
}

function getPieEquipmentRestoredStatus(
  equipment: { status?: string | null },
  activeAssignmentType?: string | null,
) {
  const statusValue = (equipment.status ?? "").trim();

  if (statusValue === "Retired" || statusValue === "Lost" || statusValue === "Stolen") {
    return statusValue;
  }

  if (activeAssignmentType && activeAssignmentType !== "Unassigned") {
    return "In Service";
  }

  return "Unassigned";
}

function getGasMonitorRestoredStatus(
  monitor: { status?: string | null },
  activeAssignmentType?: string | null,
) {
  const statusValue = (monitor.status ?? "").trim();

  if (statusValue === "Retired" || statusValue === "Lost" || statusValue === "Stolen") {
    return statusValue;
  }

  if (activeAssignmentType && activeAssignmentType !== "Unassigned") {
    return "In Service";
  }

  return "Unassigned";
}

function getThermalImagingCameraRestoredStatus(
  camera: { status?: string | null },
  activeAssignmentType?: string | null,
) {
  const statusValue = (camera.status ?? "").trim();

  if (statusValue === "Retired" || statusValue === "Lost" || statusValue === "Stolen") {
    return statusValue;
  }

  if (activeAssignmentType && activeAssignmentType !== "Unassigned") {
    return "In Service";
  }

  return "Unassigned";
}

function getBatteryRestoredStatus(
  battery: { status?: string | null },
  activeAssignmentType?: string | null,
) {
  const statusValue = (battery.status ?? "").trim();

  if (statusValue === "Retired" || statusValue === "Lost" || statusValue === "Stolen") {
    return statusValue;
  }

  if (activeAssignmentType && activeAssignmentType !== "Unassigned") {
    return "In Service";
  }

  return "Unassigned";
}

export default function ResolveDeficiencyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deficiencyId = params.id;

  const [repairNotes, setRepairNotes] = useState("");
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [selectedResolvedByMemberId, setSelectedResolvedByMemberId] = useState("");
  const [resolvedStatusId, setResolvedStatusId] = useState("");
  const [deficiencyApparatusId, setDeficiencyApparatusId] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createMaintenanceAfterResolve, setCreateMaintenanceAfterResolve] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadContext() {
      setIsLoadingContext(true);
      setErrorMessage(null);

      const [membersResult, statusesResult, deficiencyResult] = await Promise.all([
        supabase.from("members").select("id, first_name, last_name").order("last_name").order("first_name"),
        supabase.from("deficiency_statuses").select("id, name").order("display_order"),
        supabase.from("deficiencies").select("id, apparatus_id").eq("id", deficiencyId).maybeSingle(),
      ]);

      if (!isMounted) {
        return;
      }

      if (membersResult.error || statusesResult.error || deficiencyResult.error) {
        setErrorMessage(
          membersResult.error?.message ||
            statusesResult.error?.message ||
            deficiencyResult.error?.message ||
            "Unable to load resolve workflow context."
        );
        setIsLoadingContext(false);
        return;
      }

      const normalizedMembers: MemberOption[] = (membersResult.data ?? []).map((memberRow) => {
        const row = memberRow as Record<string, unknown>;
        return {
          id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
          first_name: typeof row.first_name === "string" ? row.first_name : null,
          last_name: typeof row.last_name === "string" ? row.last_name : null,
        };
      });

      const resolvedStatus = (statusesResult.data ?? []).find((statusRecord) => {
        const nameValue = (statusRecord as { name?: unknown }).name;
        return typeof nameValue === "string" && nameValue.trim().toLowerCase() === "resolved";
      });

      const statusIdValue = (resolvedStatus as { id?: unknown } | undefined)?.id;
      const resolvedId = typeof statusIdValue === "string" ? statusIdValue : "";

      const apparatusIdValue = (deficiencyResult.data as { apparatus_id?: unknown } | null)?.apparatus_id;
      const apparatusId = typeof apparatusIdValue === "string" ? apparatusIdValue : null;

      if (normalizedMembers.length === 0) {
        setErrorMessage("Unable to resolve deficiency: no members available.");
        setIsLoadingContext(false);
        return;
      }

      if (!resolvedId) {
        setErrorMessage("Unable to resolve deficiency: Resolved status is unavailable.");
        setIsLoadingContext(false);
        return;
      }

      setMemberOptions(normalizedMembers);
      setResolvedStatusId(resolvedId);
      setDeficiencyApparatusId(apparatusId);
      setIsLoadingContext(false);
    }

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [deficiencyId]);

  async function handleResolve() {
    if (!resolvedStatusId || !selectedResolvedByMemberId) {
      setErrorMessage("Select who resolved this deficiency.");
      return;
    }

    setIsResolving(true);
    setErrorMessage(null);

    const now = new Date().toISOString();
    const updatePayload = {
      status: resolvedStatusId,
      resolved_by: selectedResolvedByMemberId,
      resolved_at: now,
      repair_notes: repairNotes.trim() || null,
      updated_at: now,
    };

    const updateResult = await supabase.from("deficiencies").update(updatePayload).eq("id", deficiencyId);

    if (updateResult.error) {
      setErrorMessage(updateResult.error.message);
      setIsResolving(false);
      return;
    }

    await supabase.from("deficiency_history").insert({
      deficiency_id: deficiencyId,
      member_id: selectedResolvedByMemberId,
      event_type: "Resolved",
      event_description: `Resolved. ${repairNotes}`,
    });

    const { data: deficiencyLinkData, error: deficiencyLinkError } = await supabase
      .from("deficiencies")
      .select("fire_hose_id, scba_cylinder_id, scba_pack_id, pie_equipment_id, ems_equipment_id, ppe_item_id, rope_item_id, gas_monitor_id, battery_id, thermal_imaging_camera_id, ground_ladder_id")
      .eq("id", deficiencyId)
      .maybeSingle();

    const deficiencyLinkRow = deficiencyLinkData as DeficiencyLinkRow | null;

    if (deficiencyLinkError) {
      console.error("[fire-hose][deficiency-resolve] failed to read deficiency fire_hose_id link", {
        deficiencyId,
        error: deficiencyLinkError,
      });
      setErrorMessage(deficiencyLinkError.message || "Unable to verify linked fire hose.");
      setIsResolving(false);
      return;
    }

    if (deficiencyLinkRow?.fire_hose_id) {
      const linkedHoseId = deficiencyLinkRow.fire_hose_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .eq("fire_hose_id", linkedHoseId);

      if (linkedDeficienciesError) {
        console.error("[fire-hose][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedHoseId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked deficiencies.");
        setIsResolving(false);
        return;
      }

      if ((linkedDeficiencies ?? []).length > 0) {
        const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
          if (row.id === deficiencyId) {
            return count;
          }

          const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
          const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

          if (statusName === "resolved" || statusName === "closed") {
            return count;
          }

          if (statusInfo?.active === true) {
            return count + 1;
          }

          if (statusInfo?.active === false) {
            return count;
          }

          const isUnresolvedByName = statusName !== "resolved" && statusName !== "closed";
          return isUnresolvedByName ? count + 1 : count;
        }, 0);

        if (unresolvedCount === 0) {
          const { data: hoseUpdateRow, error: hoseUpdateError } = await supabase
            .from("fire_hose")
            .update({ status: "Ready" })
            .eq("id", linkedHoseId)
            .select("id, status")
            .single();

          if (hoseUpdateError || !hoseUpdateRow || hoseUpdateRow.id !== linkedHoseId) {
            console.error("[fire-hose][deficiency-resolve] fire_hose ready-status update mismatch", {
              expectedHoseId: linkedHoseId,
              actualRow: hoseUpdateRow ?? null,
              error: hoseUpdateError ?? null,
            });
            setErrorMessage(hoseUpdateError?.message || "Unable to update linked fire hose status.");
            setIsResolving(false);
            return;
          }
        }
      }
    }

    if (deficiencyLinkRow?.scba_cylinder_id) {
      const linkedCylinderId = deficiencyLinkRow.scba_cylinder_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
        .eq("scba_cylinder_id", linkedCylinderId);

      if (linkedDeficienciesError) {
        console.error("[scba-cylinders][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedCylinderId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked SCBA deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
        const isUnresolved = statusName !== "resolved" && statusName !== "closed";
        return isUnresolved ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: cylinderRow, error: cylinderError } = await supabase
          .from("scba_cylinders")
          .select(
            "id, cylinder_number, cylinder_type, status, next_hydrostatic_test_due_date, service_life_end_date",
          )
          .eq("id", linkedCylinderId)
          .maybeSingle();

        if (cylinderError || !cylinderRow) {
          console.error("[scba-cylinders][deficiency-resolve] failed to read linked cylinder", {
            deficiencyId,
            linkedCylinderId,
            error: cylinderError,
          });
          setErrorMessage(cylinderError?.message || "Unable to verify linked SCBA cylinder.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = getScbaCylinderRestoredStatus(cylinderRow as ScbaCylinderRecord);

        const { data: updatedCylinderRow, error: cylinderUpdateError } = await supabase
          .from("scba_cylinders")
          .update({ status: restoredStatus })
          .eq("id", linkedCylinderId)
          .select("id, status")
          .single();

        if (
          cylinderUpdateError ||
          !updatedCylinderRow ||
          updatedCylinderRow.id !== linkedCylinderId ||
          updatedCylinderRow.status !== restoredStatus
        ) {
          console.error("[scba-cylinders][deficiency-resolve] status update mismatch", {
            expectedCylinderId: linkedCylinderId,
            expectedStatus: restoredStatus,
            actualRow: updatedCylinderRow ?? null,
            error: cylinderUpdateError ?? null,
          });
          setErrorMessage(cylinderUpdateError?.message || "Unable to update linked SCBA cylinder status.");
          setIsResolving(false);
          return;
        }
      }
    }

    if (deficiencyLinkRow?.scba_pack_id) {
      const linkedPackId = deficiencyLinkRow.scba_pack_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .eq("scba_pack_id", linkedPackId);

      if (linkedDeficienciesError) {
        console.error("[scba-packs][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedPackId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked SCBA pack deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        if (row.id === deficiencyId) {
          return count;
        }

        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;

        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
        if (statusName === "resolved" || statusName === "closed") {
          return count;
        }

        if (statusInfo?.active === true) {
          return count + 1;
        }

        if (statusInfo?.active === false) {
          return count;
        }

        const isUnresolvedByName = statusName !== "resolved" && statusName !== "closed";
        return isUnresolvedByName ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: packRow, error: packError } = await supabase
          .from("scba_packs")
          .select("id, status, next_flow_test_due_date")
          .eq("id", linkedPackId)
          .maybeSingle();

        if (packError || !packRow) {
          console.error("[scba-packs][deficiency-resolve] failed to read linked pack", {
            deficiencyId,
            linkedPackId,
            error: packError,
          });
          setErrorMessage(packError?.message || "Unable to verify linked SCBA pack.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = getScbaPackRestoredStatus(packRow as ScbaPackRecord);

        const { data: updatedPackRow, error: packUpdateError } = await supabase
          .from("scba_packs")
          .update({ status: restoredStatus })
          .eq("id", linkedPackId)
          .select("id, status")
          .single();

        if (
          packUpdateError ||
          !updatedPackRow ||
          updatedPackRow.id !== linkedPackId ||
          updatedPackRow.status !== restoredStatus
        ) {
          console.error("[scba-packs][deficiency-resolve] status update mismatch", {
            expectedPackId: linkedPackId,
            expectedStatus: restoredStatus,
            actualRow: updatedPackRow ?? null,
            error: packUpdateError ?? null,
          });
          setErrorMessage(packUpdateError?.message || "Unable to update linked SCBA pack status.");
          setIsResolving(false);
          return;
        }
      }
    }

    if (deficiencyLinkRow?.pie_equipment_id) {
      const linkedPieId = deficiencyLinkRow.pie_equipment_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(name)")
        .eq("pie_equipment_id", linkedPieId);

      if (linkedDeficienciesError) {
        console.error("[pie][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedPieId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked PIE deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        if (row.id === deficiencyId) {
          return count;
        }

        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";
        const isUnresolved = statusName !== "resolved" && statusName !== "closed";
        return isUnresolved ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: activeAssignmentRow, error: assignmentQueryError } = await supabase
          .from("pie_equipment_assignments")
          .select("id, assignment_type")
          .eq("pie_equipment_id", linkedPieId)
          .is("ended_at", null)
          .maybeSingle();

        if (assignmentQueryError) {
          console.error("[pie][deficiency-resolve] failed to read active assignment", {
            deficiencyId,
            linkedPieId,
            error: assignmentQueryError,
          });
          setErrorMessage(assignmentQueryError.message || "Unable to verify PIE assignment state.");
          setIsResolving(false);
          return;
        }

        const activeAssignmentType =
          activeAssignmentRow && typeof activeAssignmentRow.assignment_type === "string"
            ? activeAssignmentRow.assignment_type
            : "Unassigned";

        const { data: equipmentRow, error: equipmentError } = await supabase
          .from("pie_equipment")
          .select("id, status, in_service_date")
          .eq("id", linkedPieId)
          .maybeSingle();

        if (equipmentError || !equipmentRow) {
          console.error("[pie][deficiency-resolve] failed to read linked PIE equipment", {
            deficiencyId,
            linkedPieId,
            error: equipmentError,
          });
          setErrorMessage(equipmentError?.message || "Unable to verify linked PIE equipment.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = getPieEquipmentRestoredStatus(
          equipmentRow as { status?: string | null },
          activeAssignmentType,
        );

        const { data: updatedPieRow, error: pieUpdateError } = await supabase
          .from("pie_equipment")
          .update({ status: restoredStatus })
          .eq("id", linkedPieId)
          .select("id, status, in_service_date")
          .single();

        if (
          pieUpdateError ||
          !updatedPieRow ||
          updatedPieRow.id !== linkedPieId ||
          updatedPieRow.status !== restoredStatus
        ) {
          console.error("[pie][deficiency-resolve] status update mismatch", {
            expectedPieId: linkedPieId,
            expectedStatus: restoredStatus,
            actualRow: updatedPieRow ?? null,
            error: pieUpdateError ?? null,
          });
          setErrorMessage(pieUpdateError?.message || "Unable to update linked PIE status.");
          setIsResolving(false);
          return;
        }
      }
    }

    if (deficiencyLinkRow?.gas_monitor_id) {
      const linkedMonitorId = deficiencyLinkRow.gas_monitor_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .eq("gas_monitor_id", linkedMonitorId);

      if (linkedDeficienciesError) {
        console.error("[gas-monitor][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedMonitorId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked Gas Monitor deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        if (row.id === deficiencyId) {
          return count;
        }

        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

        if (statusName === "resolved" || statusName === "closed") {
          return count;
        }

        if (statusInfo?.active === true) {
          return count + 1;
        }

        if (statusInfo?.active === false) {
          return count;
        }

        const isUnresolvedByName = statusName !== "resolved" && statusName !== "closed";
        return isUnresolvedByName ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: activeAssignmentRow, error: assignmentQueryError } = await supabase
          .from("gas_monitor_assignments")
          .select("id, assignment_type")
          .eq("gas_monitor_id", linkedMonitorId)
          .is("ended_at", null)
          .maybeSingle();

        if (assignmentQueryError) {
          console.error("[gas-monitor][deficiency-resolve] failed to read active assignment", {
            deficiencyId,
            linkedMonitorId,
            error: assignmentQueryError,
          });
          setErrorMessage(assignmentQueryError.message || "Unable to verify Gas Monitor assignment state.");
          setIsResolving(false);
          return;
        }

        const activeAssignmentType =
          activeAssignmentRow && typeof activeAssignmentRow.assignment_type === "string"
            ? activeAssignmentRow.assignment_type
            : "Unassigned";

        const { data: monitorRow, error: monitorError } = await supabase
          .from("gas_monitors")
          .select("id, status")
          .eq("id", linkedMonitorId)
          .maybeSingle();

        if (monitorError || !monitorRow) {
          console.error("[gas-monitor][deficiency-resolve] failed to read linked monitor", {
            deficiencyId,
            linkedMonitorId,
            error: monitorError,
          });
          setErrorMessage(monitorError?.message || "Unable to verify linked Gas Monitor.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = getGasMonitorRestoredStatus(
          monitorRow as { status?: string | null },
          activeAssignmentType,
        );

        const { data: updatedMonitorRow, error: monitorUpdateError } = await supabase
          .from("gas_monitors")
          .update({ status: restoredStatus })
          .eq("id", linkedMonitorId)
          .select("id, status")
          .single();

        if (
          monitorUpdateError ||
          !updatedMonitorRow ||
          updatedMonitorRow.id !== linkedMonitorId ||
          updatedMonitorRow.status !== restoredStatus
        ) {
          console.error("[gas-monitor][deficiency-resolve] status update mismatch", {
            expectedMonitorId: linkedMonitorId,
            expectedStatus: restoredStatus,
            actualRow: updatedMonitorRow ?? null,
            error: monitorUpdateError ?? null,
          });
          setErrorMessage(monitorUpdateError?.message || "Unable to update linked Gas Monitor status.");
          setIsResolving(false);
          return;
        }
      }
    }

    if (deficiencyLinkRow?.battery_id) {
      const linkedBatteryId = deficiencyLinkRow.battery_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .eq("battery_id", linkedBatteryId);

      if (linkedDeficienciesError) {
        console.error("[battery][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedBatteryId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked Battery deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        if (row.id === deficiencyId) {
          return count;
        }

        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

        if (statusName === "resolved" || statusName === "closed") {
          return count;
        }

        if (statusInfo?.active === true) {
          return count + 1;
        }

        if (statusInfo?.active === false) {
          return count;
        }

        const isUnresolvedByName = statusName !== "resolved" && statusName !== "closed";
        return isUnresolvedByName ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: activeAssignmentRow, error: assignmentQueryError } = await supabase
          .from("battery_assignments")
          .select("id, assignment_type")
          .eq("battery_id", linkedBatteryId)
          .is("ended_at", null)
          .maybeSingle();

        if (assignmentQueryError) {
          console.error("[battery][deficiency-resolve] failed to read active assignment", {
            deficiencyId,
            linkedBatteryId,
            error: assignmentQueryError,
          });
          setErrorMessage(assignmentQueryError.message || "Unable to verify Battery assignment state.");
          setIsResolving(false);
          return;
        }

        const activeAssignmentType =
          activeAssignmentRow && typeof activeAssignmentRow.assignment_type === "string"
            ? activeAssignmentRow.assignment_type
            : "Unassigned";

        const { data: batteryRow, error: batteryError } = await supabase
          .from("batteries")
          .select("id, status")
          .eq("id", linkedBatteryId)
          .maybeSingle();

        if (batteryError || !batteryRow) {
          console.error("[battery][deficiency-resolve] failed to read linked battery", {
            deficiencyId,
            linkedBatteryId,
            error: batteryError,
          });
          setErrorMessage(batteryError?.message || "Unable to verify linked Battery.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = getBatteryRestoredStatus(
          batteryRow as { status?: string | null },
          activeAssignmentType,
        );

        const { data: updatedBatteryRow, error: batteryUpdateError } = await supabase
          .from("batteries")
          .update({ status: restoredStatus })
          .eq("id", linkedBatteryId)
          .select("id, status")
          .single();

        if (
          batteryUpdateError ||
          !updatedBatteryRow ||
          updatedBatteryRow.id !== linkedBatteryId ||
          updatedBatteryRow.status !== restoredStatus
        ) {
          console.error("[battery][deficiency-resolve] status update mismatch", {
            expectedBatteryId: linkedBatteryId,
            expectedStatus: restoredStatus,
            actualRow: updatedBatteryRow ?? null,
            error: batteryUpdateError ?? null,
          });
          setErrorMessage(batteryUpdateError?.message || "Unable to update linked Battery status.");
          setIsResolving(false);
          return;
        }
      }
    }

    if (deficiencyLinkRow?.thermal_imaging_camera_id) {
      const linkedCameraId = deficiencyLinkRow.thermal_imaging_camera_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .eq("thermal_imaging_camera_id", linkedCameraId);

      if (linkedDeficienciesError) {
        console.error("[thermal-imaging-camera][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedCameraId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked TIC deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        if (row.id === deficiencyId) {
          return count;
        }

        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

        if (statusName === "resolved" || statusName === "closed") {
          return count;
        }

        if (statusInfo?.active === true) {
          return count + 1;
        }

        if (statusInfo?.active === false) {
          return count;
        }

        const isUnresolvedByName = statusName !== "resolved" && statusName !== "closed";
        return isUnresolvedByName ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: activeAssignmentRow, error: assignmentQueryError } = await supabase
          .from("thermal_imaging_camera_assignments")
          .select("id, assignment_type")
          .eq("thermal_imaging_camera_id", linkedCameraId)
          .is("ended_at", null)
          .maybeSingle();

        if (assignmentQueryError) {
          console.error("[thermal-imaging-camera][deficiency-resolve] failed to read active assignment", {
            deficiencyId,
            linkedCameraId,
            error: assignmentQueryError,
          });
          setErrorMessage(assignmentQueryError.message || "Unable to verify TIC assignment state.");
          setIsResolving(false);
          return;
        }

        const activeAssignmentType =
          activeAssignmentRow && typeof activeAssignmentRow.assignment_type === "string"
            ? activeAssignmentRow.assignment_type
            : "Unassigned";

        const { data: cameraRow, error: cameraError } = await supabase
          .from("thermal_imaging_cameras")
          .select("id, status")
          .eq("id", linkedCameraId)
          .maybeSingle();

        if (cameraError || !cameraRow) {
          console.error("[thermal-imaging-camera][deficiency-resolve] failed to read linked camera", {
            deficiencyId,
            linkedCameraId,
            error: cameraError,
          });
          setErrorMessage(cameraError?.message || "Unable to verify linked TIC.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = getThermalImagingCameraRestoredStatus(
          cameraRow as { status?: string | null },
          activeAssignmentType,
        );

        const { data: updatedCameraRow, error: cameraUpdateError } = await supabase
          .from("thermal_imaging_cameras")
          .update({ status: restoredStatus })
          .eq("id", linkedCameraId)
          .select("id, status")
          .single();

        if (
          cameraUpdateError ||
          !updatedCameraRow ||
          updatedCameraRow.id !== linkedCameraId ||
          updatedCameraRow.status !== restoredStatus
        ) {
          console.error("[thermal-imaging-camera][deficiency-resolve] status update mismatch", {
            expectedCameraId: linkedCameraId,
            expectedStatus: restoredStatus,
            actualRow: updatedCameraRow ?? null,
            error: cameraUpdateError ?? null,
          });
          setErrorMessage(cameraUpdateError?.message || "Unable to update linked TIC status.");
          setIsResolving(false);
          return;
        }
      }
    }

    if (deficiencyLinkRow?.ground_ladder_id) {
      const linkedLadderId = deficiencyLinkRow.ground_ladder_id;

      const { data: linkedDeficiencies, error: linkedDeficienciesError } = await supabase
        .from("deficiencies")
        .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
        .eq("ground_ladder_id", linkedLadderId);

      if (linkedDeficienciesError) {
        console.error("[ground-ladders][deficiency-resolve] failed to read linked deficiencies", {
          deficiencyId,
          linkedLadderId,
          error: linkedDeficienciesError,
        });
        setErrorMessage(linkedDeficienciesError.message || "Unable to verify linked Ground Ladder deficiencies.");
        setIsResolving(false);
        return;
      }

      const unresolvedCount = (linkedDeficiencies ?? []).reduce((count, row) => {
        if (row.id === deficiencyId) {
          return count;
        }

        const statusInfo = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
        const statusName = typeof statusInfo?.name === "string" ? statusInfo.name.trim().toLowerCase() : "";

        if (statusName === "resolved" || statusName === "closed") {
          return count;
        }

        if (statusInfo?.active === true) {
          return count + 1;
        }

        if (statusInfo?.active === false) {
          return count;
        }

        const isUnresolvedByName = statusName !== "resolved" && statusName !== "closed";
        return isUnresolvedByName ? count + 1 : count;
      }, 0);

      if (unresolvedCount === 0) {
        const { data: activeAssignmentRow, error: assignmentQueryError } = await supabase
          .from("ground_ladder_assignments")
          .select("id, assignment_type")
          .eq("ground_ladder_id", linkedLadderId)
          .is("ended_at", null)
          .maybeSingle();

        if (assignmentQueryError) {
          console.error("[ground-ladders][deficiency-resolve] failed to read active assignment", {
            deficiencyId,
            linkedLadderId,
            error: assignmentQueryError,
          });
          setErrorMessage(assignmentQueryError.message || "Unable to verify Ground Ladder assignment state.");
          setIsResolving(false);
          return;
        }

        const activeAssignmentType =
          activeAssignmentRow && typeof activeAssignmentRow.assignment_type === "string"
            ? activeAssignmentRow.assignment_type
            : "Unassigned";

        const { data: ladderRow, error: ladderError } = await supabase
          .from("ground_ladders")
          .select("id, status")
          .eq("id", linkedLadderId)
          .maybeSingle();

        if (ladderError || !ladderRow) {
          console.error("[ground-ladders][deficiency-resolve] failed to read linked ladder", {
            deficiencyId,
            linkedLadderId,
            error: ladderError,
          });
          setErrorMessage(ladderError?.message || "Unable to verify linked Ground Ladder.");
          setIsResolving(false);
          return;
        }

        const restoredStatus = activeAssignmentType && activeAssignmentType !== "Unassigned" ? "In Service" : "Unassigned";

        const { data: updatedLadderRow, error: ladderUpdateError } = await supabase
          .from("ground_ladders")
          .update({ status: restoredStatus })
          .eq("id", linkedLadderId)
          .select("id, status")
          .single();

        if (
          ladderUpdateError ||
          !updatedLadderRow ||
          updatedLadderRow.id !== linkedLadderId ||
          updatedLadderRow.status !== restoredStatus
        ) {
          console.error("[ground-ladders][deficiency-resolve] status update mismatch", {
            expectedLadderId: linkedLadderId,
            expectedStatus: restoredStatus,
            actualRow: updatedLadderRow ?? null,
            error: ladderUpdateError ?? null,
          });
          setErrorMessage(ladderUpdateError?.message || "Unable to update linked Ground Ladder status.");
          setIsResolving(false);
          return;
        }
      }
    }

    const { error: apparatusReconciliationError } = await supabase.rpc(
      "reconcile_apparatus_oos_after_deficiency_resolution",
      {
        p_deficiency_id: deficiencyId,
      },
    );

    if (apparatusReconciliationError) {
      setErrorMessage(
        apparatusReconciliationError.message || "Unable to reconcile apparatus out-of-service status.",
      );
      setIsResolving(false);
      return;
    }

    setIsResolving(false);

    if (createMaintenanceAfterResolve) {
      const query = new URLSearchParams({ deficiencyId });
      if (deficiencyApparatusId) {
        query.set("apparatusId", deficiencyApparatusId);
      }
      router.push(`/maintenance/perform?${query.toString()}`);
      return;
    }

    router.push(`/operations/deficiencies/${deficiencyId}`);
    router.refresh();
  }

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/operations/deficiencies/${deficiencyId}`}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Deficiency
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Deficiency Workflow</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Resolve Deficiency</h1>
          <p className="mt-2 text-zinc-400">Capture repair completion details and close this deficiency.</p>

          <div className="mt-8 space-y-6">
            {errorMessage ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMessage}</div>
            ) : null}

            {isLoadingContext ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400">Loading resolve details...</div>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Repair Notes</span>
                  <textarea
                    rows={5}
                    value={repairNotes}
                    onChange={(event) => setRepairNotes(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white"
                    placeholder="Describe what was repaired and any follow-up actions."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-200">Resolved By</span>
                  <select
                    value={selectedResolvedByMemberId}
                    onChange={(event) => setSelectedResolvedByMemberId(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-zinc-300"
                  >
                    <option value="">Select member</option>
                    {memberOptions.map((member) => {
                      const firstName = member.first_name ?? "";
                      const lastName = member.last_name ?? "";
                      const fullName = `${firstName} ${lastName}`.trim() || member.id;

                      return (
                        <option key={member.id} value={member.id}>{fullName}</option>
                      );
                    })}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#151515] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={createMaintenanceAfterResolve}
                    onChange={(event) => setCreateMaintenanceAfterResolve(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-[#121212] text-emerald-500"
                  />
                  <span className="text-sm text-zinc-200">Perform Maintenance after resolving</span>
                </label>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-white/10 pt-6">
            <Link
              href={`/operations/deficiencies/${deficiencyId}`}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleResolve}
              disabled={isResolving || isLoadingContext || !selectedResolvedByMemberId}
              className="rounded-xl border border-emerald-500/30 bg-emerald-600/80 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResolving ? "Resolving..." : "Resolve Deficiency"}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
