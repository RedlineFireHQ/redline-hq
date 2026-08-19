import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  type ApparatusMaintenanceRequirementEvaluation,
  type ApparatusReadinessResult,
  calculateOverallApparatusReadiness,
} from "@/lib/readiness/apparatus-readiness";

type ApparatusRow = {
  id: string;
  department_id: string;
  name: string;
  type: string | null;
  status: string | null;
  last_inspection_at: string | null;
  mileage: number | null;
  engine_hours: number | null;
};

type DeficiencyRow = {
  id: string;
  priority: string | null;
  status: string | null;
  asset_id: string | null;
  fire_hose_id: string | null;
  scba_cylinder_id: string | null;
  scba_pack_id: string | null;
  pie_equipment_id: string | null;
  gas_monitor_id: string | null;
  battery_id: string | null;
  thermal_imaging_camera_id: string | null;
  ground_ladder_id: string | null;
  portable_radio_id: string | null;
  portable_radio_mic_id: string | null;
};

type RequirementRow = {
  id: string;
  name: string;
  maintenance_type: string | null;
};

type ApparatusCheckRequirementRow = {
  score_profile: "daily" | "monthly";
  interval_days: number;
  effective_start_at: string | null;
  effective_end_at: string | null;
};

type DepartmentCheckDefaultRow = {
  interval_days: number;
  effective_start_at: string | null;
  effective_end_at: string | null;
};

type RequirementMethodRow = {
  apparatus_maintenance_requirement_id: string;
  method_type: "time_days" | "mileage" | "engine_hours";
  interval_value: number;
  due_soon_threshold_value: number;
  early_overdue_threshold_value: number;
  moderate_overdue_threshold_value: number;
};

type MaintenanceRecordRow = {
  maintenance_type: string | null;
  service_date: string | null;
  mileage: number | null;
  engine_hours: number | null;
};

type EquipmentRequirementRow = {
  id: string;
  equipment_source:
    | "asset"
    | "fire_hose"
    | "scba_cylinder"
    | "scba_pack"
    | "pie_equipment"
    | "gas_monitor"
    | "battery"
    | "thermal_imaging_camera"
    | "ground_ladder"
    | "portable_radio"
    | "portable_radio_mic";
  equipment_id: string;
  is_required: boolean;
  is_critical: boolean;
};

type EquipmentOperationalMap = Record<string, boolean>;

const DEFICIENCY_FIELD_BY_SOURCE: Record<EquipmentRequirementRow["equipment_source"], keyof DeficiencyRow> = {
  asset: "asset_id",
  fire_hose: "fire_hose_id",
  scba_cylinder: "scba_cylinder_id",
  scba_pack: "scba_pack_id",
  pie_equipment: "pie_equipment_id",
  gas_monitor: "gas_monitor_id",
  battery: "battery_id",
  thermal_imaging_camera: "thermal_imaging_camera_id",
  ground_ladder: "ground_ladder_id",
  portable_radio: "portable_radio_id",
  portable_radio_mic: "portable_radio_mic_id",
};

function unresolvedStatus(statusName: string | null) {
  const normalized = (statusName ?? "").trim().toLowerCase();
  return normalized !== "resolved" && normalized !== "closed";
}

function normalizeEquipmentStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function keyForEquipment(source: string, equipmentId: string) {
  return `${source}:${equipmentId}`;
}

function statusIsOperational(statusValue: string | null | undefined) {
  const normalized = normalizeEquipmentStatus(statusValue);

  if (!normalized) {
    return false;
  }

  if (
    normalized === "out_of_service" ||
    normalized === "retired" ||
    normalized === "lost" ||
    normalized === "stolen" ||
    normalized === "testing_due" ||
    normalized === "flow_test_due"
  ) {
    return false;
  }

  return normalized === "ready" || normalized === "in_service" || normalized === "available";
}

async function getPriorityNameById(priorityIds: string[]) {
  if (priorityIds.length === 0) {
    return {} as Record<string, string>;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("deficiency_priorities")
    .select("id, name")
    .in("id", priorityIds);

  return (data ?? []).reduce<Record<string, string>>((accumulator, row) => {
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const name = typeof record.name === "string" ? record.name : "";

    if (!id) {
      return accumulator;
    }

    accumulator[id] = name;
    return accumulator;
  }, {});
}

async function getStatusNameById(statusIds: string[]) {
  if (statusIds.length === 0) {
    return {} as Record<string, string>;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("deficiency_statuses")
    .select("id, name")
    .in("id", statusIds);

  return (data ?? []).reduce<Record<string, string>>((accumulator, row) => {
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const name = typeof record.name === "string" ? record.name : "";

    if (!id) {
      return accumulator;
    }

    accumulator[id] = name;
    return accumulator;
  }, {});
}

async function buildEquipmentOperationalMap(requirements: EquipmentRequirementRow[]) {
  const supabase = await createSupabaseServerClient();
  const equipmentOperational: EquipmentOperationalMap = {};

  const bySource = requirements.reduce<Record<string, string[]>>((accumulator, requirement) => {
    const source = requirement.equipment_source;
    if (!accumulator[source]) {
      accumulator[source] = [];
    }
    accumulator[source].push(requirement.equipment_id);
    return accumulator;
  }, {});

  async function hydrateFromStatusTable(
    source: EquipmentRequirementRow["equipment_source"],
    tableName: string
  ) {
    const equipmentIds = bySource[source] ?? [];
    if (equipmentIds.length === 0) {
      return;
    }

    const { data } = await supabase
      .from(tableName)
      .select("id, status")
      .in("id", equipmentIds);

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const status = typeof record.status === "string" ? record.status : null;

      if (!id) {
        continue;
      }

      equipmentOperational[keyForEquipment(source, id)] = statusIsOperational(status);
    }
  }

  const assetIds = bySource.asset ?? [];
  if (assetIds.length > 0) {
    const { data } = await supabase
      .from("assets")
      .select("id, in_service")
      .in("id", assetIds);

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const inService = record.in_service === true;
      if (!id) {
        continue;
      }
      equipmentOperational[keyForEquipment("asset", id)] = inService;
    }
  }

  await hydrateFromStatusTable("fire_hose", "fire_hose");
  await hydrateFromStatusTable("scba_cylinder", "scba_cylinders");
  await hydrateFromStatusTable("scba_pack", "scba_packs");
  await hydrateFromStatusTable("pie_equipment", "pie_equipment");
  await hydrateFromStatusTable("gas_monitor", "gas_monitors");
  await hydrateFromStatusTable("battery", "batteries");
  await hydrateFromStatusTable("thermal_imaging_camera", "thermal_imaging_cameras");
  await hydrateFromStatusTable("ground_ladder", "ground_ladders");
  await hydrateFromStatusTable("portable_radio", "portable_radios");
  await hydrateFromStatusTable("portable_radio_mic", "portable_radio_mics");

  return equipmentOperational;
}

function findLatestRecordByType(records: MaintenanceRecordRow[], maintenanceType: string | null) {
  if (!maintenanceType) {
    return records[0] ?? null;
  }

  const normalizedType = maintenanceType.trim().toLowerCase();
  for (const record of records) {
    const recordType = (record.maintenance_type ?? "").trim().toLowerCase();
    if (recordType === normalizedType) {
      return record;
    }
  }

  return null;
}

function statusFromResult(result: ApparatusReadinessResult) {
  if (result.status === "out_of_service") {
    return "Out of Service" as const;
  }

  if (result.status === "not_scored") {
    return "Configuration Required" as const;
  }

  if (result.status === "ready") {
    return "Ready" as const;
  }

  return "Checks Due" as const;
}

function isEffectiveNow(
  now: Date,
  effectiveStartAt: string | null,
  effectiveEndAt: string | null
) {
  const start = effectiveStartAt ? new Date(effectiveStartAt) : null;
  const end = effectiveEndAt ? new Date(effectiveEndAt) : null;

  if (start && !Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
    return false;
  }

  if (end && !Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
    return false;
  }

  return true;
}

export async function calculateApparatusReadinessForApparatusId(apparatusId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: apparatusRowData } = await supabase
    .from("apparatus")
    .select("id, department_id, name, type, status, last_inspection_at, mileage, engine_hours")
    .eq("id", apparatusId)
    .maybeSingle();

  if (!apparatusRowData) {
    return null;
  }

  const apparatus = apparatusRowData as ApparatusRow;
  const evaluationNow = new Date();

  const { data: apparatusCheckRequirementRowsData } = await supabase
    .from("apparatus_check_requirements")
    .select("score_profile, interval_days, effective_start_at, effective_end_at")
    .eq("apparatus_id", apparatus.id)
    .eq("is_active", true)
    .order("effective_start_at", { ascending: false });

  const apparatusCheckRequirementRows =
    (apparatusCheckRequirementRowsData ?? []) as ApparatusCheckRequirementRow[];
  const activeApparatusCheckRequirement = apparatusCheckRequirementRows.find((row) =>
    isEffectiveNow(evaluationNow, row.effective_start_at, row.effective_end_at)
  );

  const { data: departmentCheckDefaultRowsData } = await supabase
    .from("apparatus_check_department_defaults")
    .select("interval_days, effective_start_at, effective_end_at")
    .eq("department_id", apparatus.department_id)
    .eq("is_active", true)
    .order("effective_start_at", { ascending: false });

  const departmentCheckDefaultRows =
    (departmentCheckDefaultRowsData ?? []) as DepartmentCheckDefaultRow[];
  const activeDepartmentCheckDefault = departmentCheckDefaultRows.find((row) =>
    isEffectiveNow(evaluationNow, row.effective_start_at, row.effective_end_at)
  );

  const { data: inspectionData } = await supabase
    .from("apparatus_inspections")
    .select("created_at, mileage, engine_hours")
    .eq("apparatus_id", apparatus.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: deficienciesData } = await supabase
    .from("deficiencies")
    .select(
      "id, priority, status, asset_id, fire_hose_id, scba_cylinder_id, scba_pack_id, pie_equipment_id, gas_monitor_id, battery_id, thermal_imaging_camera_id, ground_ladder_id, portable_radio_id, portable_radio_mic_id"
    )
    .eq("apparatus_id", apparatus.id)
    .order("created_at", { ascending: false });

  const deficiencies = (deficienciesData ?? []) as DeficiencyRow[];
  const priorityIds = Array.from(
    new Set(
      deficiencies
        .map((row) => row.priority)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
  const statusIds = Array.from(
    new Set(
      deficiencies
        .map((row) => row.status)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const [priorityNameById, statusNameById] = await Promise.all([
    getPriorityNameById(priorityIds),
    getStatusNameById(statusIds),
  ]);

  const unresolvedDeficiencies = deficiencies.filter((row) => {
    const statusName = row.status ? statusNameById[row.status] ?? null : null;
    return unresolvedStatus(statusName);
  });

  const { data: maintenanceRequirementRowsData } = await supabase
    .from("apparatus_maintenance_requirements")
    .select("id, name, maintenance_type")
    .eq("apparatus_id", apparatus.id)
    .eq("is_active", true);

  const maintenanceRequirementRows = (maintenanceRequirementRowsData ?? []) as RequirementRow[];

  const maintenanceRequirementIds = maintenanceRequirementRows.map((row) => row.id);
  const { data: maintenanceMethodRowsData } = maintenanceRequirementIds.length
    ? await supabase
        .from("apparatus_maintenance_requirement_methods")
        .select(
          "apparatus_maintenance_requirement_id, method_type, interval_value, due_soon_threshold_value, early_overdue_threshold_value, moderate_overdue_threshold_value"
        )
        .in("apparatus_maintenance_requirement_id", maintenanceRequirementIds)
    : { data: [] as unknown[] };

  const maintenanceMethodRows = (maintenanceMethodRowsData ?? []) as RequirementMethodRow[];

  const { data: maintenanceRecordsData } = await supabase
    .from("maintenance_records")
    .select("maintenance_type, service_date, mileage, engine_hours")
    .eq("apparatus_id", apparatus.id)
    .order("service_date", { ascending: false });

  const maintenanceRecords = (maintenanceRecordsData ?? []) as MaintenanceRecordRow[];

  const { data: equipmentRequirementRowsData } = await supabase
    .from("apparatus_equipment_requirements")
    .select("id, equipment_source, equipment_id, is_required, is_critical")
    .eq("apparatus_id", apparatus.id)
    .eq("is_active", true);

  const equipmentRequirementRows = (equipmentRequirementRowsData ?? []) as EquipmentRequirementRow[];

  const equipmentOperationalByKey = await buildEquipmentOperationalMap(equipmentRequirementRows);

  const unresolvedDeficiencyEquipmentKeys = new Set<string>();
  for (const deficiency of unresolvedDeficiencies) {
    for (const [source, fieldName] of Object.entries(DEFICIENCY_FIELD_BY_SOURCE)) {
      const equipmentId = deficiency[fieldName as keyof DeficiencyRow];
      if (typeof equipmentId === "string" && equipmentId.length > 0) {
        unresolvedDeficiencyEquipmentKeys.add(keyForEquipment(source, equipmentId));
      }
    }
  }

  const requiredEquipmentKeySet = new Set(
    equipmentRequirementRows
      .filter((row) => row.is_required)
      .map((row) => keyForEquipment(row.equipment_source, row.equipment_id))
  );

  const maintenanceRequirementEvaluations: ApparatusMaintenanceRequirementEvaluation[] = maintenanceRequirementRows.map(
    (requirement) => {
      const latestRecord = findLatestRecordByType(maintenanceRecords, requirement.maintenance_type);
      const serviceDate = latestRecord?.service_date ? new Date(latestRecord.service_date) : null;
      const now = new Date();
      const elapsedDays =
        serviceDate && !Number.isNaN(serviceDate.getTime())
          ? Math.max(0, Math.floor((now.getTime() - serviceDate.getTime()) / (24 * 60 * 60 * 1000)))
          : null;

      const latestInspectionMileage =
        typeof inspectionData?.mileage === "number" ? inspectionData.mileage : null;
      const latestInspectionEngineHours =
        typeof inspectionData?.engine_hours === "number" ? Number(inspectionData.engine_hours) : null;

      const currentMileage =
        typeof apparatus.mileage === "number"
          ? apparatus.mileage
          : latestInspectionMileage ??
            (typeof maintenanceRecords[0]?.mileage === "number" ? maintenanceRecords[0].mileage : null);

      const currentEngineHours =
        typeof apparatus.engine_hours === "number"
          ? Number(apparatus.engine_hours)
          : latestInspectionEngineHours ??
            (typeof maintenanceRecords[0]?.engine_hours === "number"
              ? Number(maintenanceRecords[0].engine_hours)
              : null);

      const methods = maintenanceMethodRows
        .filter((method) => method.apparatus_maintenance_requirement_id === requirement.id)
        .map((method) => {
          let elapsedSinceService: number | null = null;

          if (method.method_type === "time_days") {
            elapsedSinceService = elapsedDays;
          }

          if (method.method_type === "mileage") {
            const baseMileage = typeof latestRecord?.mileage === "number" ? latestRecord.mileage : null;
            elapsedSinceService =
              baseMileage !== null && currentMileage !== null
                ? Math.max(0, currentMileage - baseMileage)
                : null;
          }

          if (method.method_type === "engine_hours") {
            const baseHours =
              typeof latestRecord?.engine_hours === "number" ? Number(latestRecord.engine_hours) : null;
            elapsedSinceService =
              baseHours !== null && currentEngineHours !== null
                ? Math.max(0, currentEngineHours - baseHours)
                : null;
          }

          return {
            methodType: method.method_type,
            intervalValue: Number(method.interval_value),
            dueSoonThresholdValue: Number(method.due_soon_threshold_value),
            earlyOverdueThresholdValue: Number(method.early_overdue_threshold_value),
            moderateOverdueThresholdValue: Number(method.moderate_overdue_threshold_value),
            elapsedSinceService,
          };
        });

      return {
        requirementId: requirement.id,
        name: requirement.name,
        methods,
      };
    }
  );

  const readinessResult = calculateOverallApparatusReadiness({
    now: evaluationNow,
    explicitOutOfService: (apparatus.status ?? "").trim().toLowerCase() === "out_of_service",
    apparatusCheck: {
      lastCompletedAt: inspectionData?.created_at ?? apparatus.last_inspection_at,
      intervalDays:
        typeof activeApparatusCheckRequirement?.interval_days === "number"
          ? activeApparatusCheckRequirement.interval_days
          : typeof activeDepartmentCheckDefault?.interval_days === "number"
            ? activeDepartmentCheckDefault.interval_days
          : null,
      scoreProfile:
        activeApparatusCheckRequirement?.score_profile === "daily" ||
        activeApparatusCheckRequirement?.score_profile === "monthly"
          ? activeApparatusCheckRequirement.score_profile
          : activeDepartmentCheckDefault
            ? activeDepartmentCheckDefault.interval_days >= 30
              ? "monthly"
              : "daily"
          : null,
    },
    conditionDeficiencies: unresolvedDeficiencies.map((row) => {
      const priorityName = row.priority ? priorityNameById[row.priority] ?? "" : "";
      const isCritical = priorityName.trim().toLowerCase() === "critical";

      const linkedRequiredEquipmentKeys: string[] = [];
      for (const [source, fieldName] of Object.entries(DEFICIENCY_FIELD_BY_SOURCE)) {
        const equipmentId = row[fieldName as keyof DeficiencyRow];
        if (typeof equipmentId === "string" && equipmentId.length > 0) {
          const key = keyForEquipment(source, equipmentId);
          if (requiredEquipmentKeySet.has(key)) {
            linkedRequiredEquipmentKeys.push(key);
          }
        }
      }

      return {
        id: row.id,
        priorityName,
        isActive: true,
        // Critical always wins and must never be suppressed by equipment dedupe.
        // For non-critical, avoid double-counting equipment-linked deficiencies across buckets.
        countInCondition: isCritical || linkedRequiredEquipmentKeys.length === 0,
      };
    }),
    maintenanceRequirements: maintenanceRequirementEvaluations,
    equipmentRequirements: equipmentRequirementRows.map((row) => {
      const equipmentKey = keyForEquipment(row.equipment_source, row.equipment_id);
      const hasOpenDeficiency = unresolvedDeficiencyEquipmentKeys.has(equipmentKey);
      const baseOperational = equipmentOperationalByKey[equipmentKey] ?? false;

      return {
        requirementId: row.id,
        equipmentSource: row.equipment_source,
        equipmentId: row.equipment_id,
        isRequired: row.is_required,
        isCritical: row.is_critical,
        isOperational: baseOperational && !hasOpenDeficiency,
      };
    }),
  });

  return {
    apparatus,
    readiness: readinessResult,
  };
}

export async function getApparatusReadinessList() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("apparatus")
    .select("id, department_id, name, type, status, last_inspection_at, mileage, engine_hours")
    .order("name");

  const apparatusRows = (data ?? []) as ApparatusRow[];

  const readinessRows = await Promise.all(
    apparatusRows.map(async (row) => {
      const evaluated = await calculateApparatusReadinessForApparatusId(row.id);
      return evaluated;
    })
  );

  return readinessRows.filter((row): row is NonNullable<typeof row> => row !== null);
}

export function getStatusLabelForReadiness(result: ApparatusReadinessResult) {
  return statusFromResult(result);
}
