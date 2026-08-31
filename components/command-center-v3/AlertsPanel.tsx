"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

type NameRelation = { name: string | null };
type FireHoseRelation = { inventory_number: string | null };
type ScbaCylinderRelation = { cylinder_number: string | null };
type ScbaPackRelation = { pack_number: string | null };
type PieEquipmentRelation = { equipment_number: string | null };
type EmsEquipmentRelation = { equipment_name: string | null };
type PpeItemRelation = { item_name: string | null };
type RopeItemRelation = { rope_name: string | null; rope_identifier: string | null };
type FireExtinguisherRelation = { extinguisher_number: string | null; extinguisher_type: string | null };
type MiscFireEquipmentRelation = { equipment_name: string | null; asset_number: string | null };

type DeficiencyRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  reported_at: string | null;
  created_at: string | null;
  status_code: string | null;
  status: NameRelation | NameRelation[] | null;
  priority: NameRelation | NameRelation[] | null;
  apparatus: NameRelation | NameRelation[] | null;
  fire_hose: FireHoseRelation | FireHoseRelation[] | null;
  scba_cylinder: ScbaCylinderRelation | ScbaCylinderRelation[] | null;
  scba_pack: ScbaPackRelation | ScbaPackRelation[] | null;
  pie_equipment: PieEquipmentRelation | PieEquipmentRelation[] | null;
  ems_equipment: EmsEquipmentRelation | EmsEquipmentRelation[] | null;
  ppe_item: PpeItemRelation | PpeItemRelation[] | null;
  rope_item: RopeItemRelation | RopeItemRelation[] | null;
  fire_extinguisher: FireExtinguisherRelation | FireExtinguisherRelation[] | null;
  misc_fire_equipment: MiscFireEquipmentRelation | MiscFireEquipmentRelation[] | null;
};

type DeficiencyHistoryRow = {
  deficiency_id: string;
  created_at: string | null;
};

type DeficiencyStatusRow = {
  id: string;
  name: string | null;
};

function relationFirst<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function parseTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getStatusName(row: DeficiencyRow) {
  return (relationFirst(row.status)?.name ?? "").trim();
}

function getPriorityName(row: DeficiencyRow) {
  return (relationFirst(row.priority)?.name ?? "").trim();
}

function getAssociationLabel(row: DeficiencyRow) {
  const apparatusName = relationFirst(row.apparatus)?.name;
  if (apparatusName) {
    return apparatusName;
  }

  const fireHose = relationFirst(row.fire_hose)?.inventory_number;
  if (fireHose) {
    return `Hose ${fireHose}`;
  }

  const scbaCylinder = relationFirst(row.scba_cylinder)?.cylinder_number;
  if (scbaCylinder) {
    return `SCBA Cylinder ${scbaCylinder}`;
  }

  const scbaPack = relationFirst(row.scba_pack)?.pack_number;
  if (scbaPack) {
    return `SCBA Pack ${scbaPack}`;
  }

  const pieEquipment = relationFirst(row.pie_equipment)?.equipment_number;
  if (pieEquipment) {
    return `PIE ${pieEquipment}`;
  }

  const emsEquipment = relationFirst(row.ems_equipment)?.equipment_name;
  if (emsEquipment) {
    return emsEquipment;
  }

  const ppeItem = relationFirst(row.ppe_item)?.item_name;
  if (ppeItem) {
    return ppeItem;
  }

  const ropeItem = relationFirst(row.rope_item);
  if (ropeItem?.rope_identifier || ropeItem?.rope_name) {
    return ropeItem.rope_identifier || ropeItem.rope_name || "Rope";
  }

  const extinguisher = relationFirst(row.fire_extinguisher);
  if (extinguisher?.extinguisher_number) {
    return `Extinguisher ${extinguisher.extinguisher_number}`;
  }

  const miscEquipment = relationFirst(row.misc_fire_equipment);
  if (miscEquipment?.equipment_name || miscEquipment?.asset_number) {
    return miscEquipment.equipment_name || miscEquipment.asset_number || "Equipment";
  }

  return row.deficiency_number || "Deficiency";
}

function getPriorityClasses(priorityName: string) {
  const normalized = priorityName.toLowerCase();
  if (normalized === "critical") {
    return {
      bar: "bg-red-500",
      iconWrap: "bg-red-500/10",
      icon: "text-red-400",
      label: "text-red-300",
    };
  }

  if (normalized === "high") {
    return {
      bar: "bg-orange-500",
      iconWrap: "bg-orange-500/10",
      icon: "text-orange-300",
      label: "text-orange-300",
    };
  }

  return {
    bar: "bg-amber-400",
    iconWrap: "bg-amber-500/10",
    icon: "text-amber-300",
    label: "text-amber-300",
  };
}

function formatActivityLabel(activityAt: string | null) {
  if (!activityAt) {
    return "No activity timestamp";
  }

  const date = new Date(activityAt);
  if (Number.isNaN(date.getTime())) {
    return activityAt;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AlertsPanel() {
  const { member } = useAuth();
  const departmentId = typeof member?.department_id === "string" ? member.department_id : "";

  const [rows, setRows] = useState<DeficiencyRow[]>([]);
  const [activityById, setActivityById] = useState<Map<string, string | null>>(new Map());
  const [activeStatusIds, setActiveStatusIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDeficiencies() {
      const [deficienciesResult, statusesResult] = await Promise.all([
        supabase
          .from("deficiencies")
          .select(
            "id, deficiency_number, description, reported_at, created_at, status_code:status, status:deficiency_statuses!fk_deficiencies_status(name), priority:deficiency_priorities!fk_deficiencies_priority(name), apparatus:apparatus!fk_deficiencies_apparatus(name), fire_hose:fire_hose_id(inventory_number), scba_cylinder:scba_cylinder_id(cylinder_number), scba_pack:scba_pack_id(pack_number), pie_equipment:pie_equipment_id(equipment_number), ems_equipment:ems_equipment_id(equipment_name), ppe_item:ppe_item_id(item_name), rope_item:rope_item_id(rope_name, rope_identifier), fire_extinguisher:fire_extinguisher_id(extinguisher_number, extinguisher_type), misc_fire_equipment:misc_fire_equipment_id(equipment_name, asset_number)"
          ),
        supabase
          .from("deficiency_statuses")
          .select("id, name"),
      ]);

      const data = deficienciesResult.data;
      const error = deficienciesResult.error;
      const statusRows = (statusesResult.data ?? []) as DeficiencyStatusRow[];

      const nextActiveStatusIds = new Set(
        statusRows
          .filter((row) => {
            const normalized = (row.name ?? "").trim().toLowerCase();
            return normalized === "open" || normalized === "in progress";
          })
          .map((row) => row.id),
      );

      if (error) {
        if (isMounted) {
          setRows([]);
          setActivityById(new Map());
          setActiveStatusIds(nextActiveStatusIds);
          setIsLoading(false);
        }
        return;
      }

      const deficiencyRows = (data ?? []) as DeficiencyRow[];
      const activeDeficiencyIds = deficiencyRows
        .filter((row) => {
          if (row.status_code && nextActiveStatusIds.has(row.status_code)) {
            return true;
          }

          const normalizedStatusName = getStatusName(row).toLowerCase();
          return normalizedStatusName === "open" || normalizedStatusName === "in progress";
        })
        .map((row) => row.id)
        .filter((id) => typeof id === "string" && id.length > 0);

      let historyRows: DeficiencyHistoryRow[] = [];
      if (activeDeficiencyIds.length > 0) {
        const { data: historyData } = await supabase
          .from("deficiency_history")
          .select("deficiency_id, created_at")
          .in("deficiency_id", activeDeficiencyIds)
          .order("created_at", { ascending: false });

        historyRows = (historyData ?? []) as DeficiencyHistoryRow[];
      }

      const newestByDeficiency = new Map<string, string>();
      for (const historyRow of historyRows) {
        if (!historyRow.deficiency_id || !historyRow.created_at) {
          continue;
        }

        if (!newestByDeficiency.has(historyRow.deficiency_id)) {
          newestByDeficiency.set(historyRow.deficiency_id, historyRow.created_at);
        }
      }

      const nextActivityById = new Map<string, string | null>();
      for (const row of deficiencyRows) {
        const latestHistoryAt = newestByDeficiency.get(row.id) ?? null;
        const reportedAtTs = parseTimestamp(row.reported_at);
        const createdAtTs = parseTimestamp(row.created_at);
        const historyAtTs = parseTimestamp(latestHistoryAt);

        let activityAt = row.reported_at;
        if (createdAtTs > reportedAtTs) {
          activityAt = row.created_at;
        }

        if (historyAtTs > Math.max(reportedAtTs, createdAtTs)) {
          activityAt = latestHistoryAt;
        }

        nextActivityById.set(row.id, activityAt ?? null);
      }

      if (isMounted) {
        setRows(deficiencyRows);
        setActivityById(nextActivityById);
        setActiveStatusIds(nextActiveStatusIds);
        setIsLoading(false);
      }
    }

    void loadDeficiencies();

    return () => {
      isMounted = false;
    };
  }, [departmentId]);

  const activeRows = useMemo(() => {
    return rows.filter((row) => {
      if (row.status_code && activeStatusIds.has(row.status_code)) {
        return true;
      }

      const normalizedStatusName = getStatusName(row).toLowerCase();
      return normalizedStatusName === "open" || normalizedStatusName === "in progress";
    });
  }, [activeStatusIds, rows]);

  const recentActiveRows = useMemo(() => {
    const copy = [...activeRows];
    copy.sort((left, right) => {
      const leftTs = parseTimestamp(activityById.get(left.id) ?? null);
      const rightTs = parseTimestamp(activityById.get(right.id) ?? null);
      return rightTs - leftTs;
    });
    return copy;
  }, [activeRows, activityById]);

  return (
 <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#101010] pb-[25px] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#171717] via-[#121212] to-[#171717]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_35%,rgba(180,0,0,.08),transparent_55%)]" />

      <div className="relative z-10 flex h-full flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">

          <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">
            DEFICIENCIES
          </h2>

          <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">

            <div className="h-2 w-2 rounded-full bg-red-500" />

            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-red-400">
              {activeRows.length} Active
            </span>

          </div>

        </div>

        {/* Alert List */}
        <div className="min-h-0 flex-1 px-5 pb-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">Loading deficiencies...</div>
          ) : recentActiveRows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">No active deficiencies.</div>
          ) : (
            <div className="h-[140px] overflow-y-auto overscroll-contain pr-1">
              {recentActiveRows.map((row) => {
                const priorityName = getPriorityName(row);
                const statusName = getStatusName(row) || "Open";
                const style = getPriorityClasses(priorityName);
                const description = (row.description ?? "No description provided").trim();
                const activityAt = activityById.get(row.id) ?? null;
                const associationLabel = getAssociationLabel(row);

                return (
                  <div
                    key={row.id}
                    className="group relative flex w-full items-center gap-3 border-b border-white/10 py-2.5 text-left"
                  >
                    <div
                      className={`absolute left-0 top-1/2 h-4 -translate-y-1/2 w-[3px] rounded-full ${style.bar}`}
                    />

                    <div
                      className={`ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${style.iconWrap}`}
                    >
                      <AlertTriangle
                        size={16}
                        className={style.icon}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                        {associationLabel}
                      </div>

                      <div className="mt-0.5 truncate text-[14px] font-semibold text-white">
                        {description}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                        <span className={`font-medium uppercase tracking-[0.08em] ${style.label}`}>{priorityName || "Low"}</span>
                        <span className="text-neutral-500">•</span>
                        <span className="font-medium text-neutral-300">{statusName}</span>
                        <span className="text-neutral-500">•</span>
                        <span className="inline-flex items-center gap-1 text-neutral-400">
                          <Clock3 size={11} />
                          {formatActivityLabel(activityAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-white/10 px-5 py-2">
          <Link
            href="/deficiencies"
            className="group inline-flex h-9 w-full translate-y-[10px] items-center justify-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#131313] px-4 text-[13px] font-semibold text-white transition-all duration-300 hover:border-[#5A5A5A] hover:bg-[#171717] hover:shadow-[0_0_0_1px_rgba(239,43,45,0.25)]"
          >
            View All Deficiencies
            <ArrowRight size={15} className="text-[#EF2B2D] transition-colors duration-300 group-hover:text-[#ff6b6b]" />
          </Link>
        </div>

      </div>

      {/* Accent */}
      <div className="pointer-events-none absolute left-0 top-16 h-[160px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />

      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />

      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

    </section>
  );
}