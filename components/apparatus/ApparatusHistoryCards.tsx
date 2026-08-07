"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type InspectionHistoryRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  notes: string | null;
  member_id: string | null;
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

interface ApparatusHistoryCardsProps {
  apparatusName: string;
  inspectionHistory: InspectionHistoryRow[];
  inspectionMemberNameById: Record<string, string>;
  deficiencyHistory: DeficiencyHistoryRow[];
  deficiencyPriorityNameById: Record<string, string>;
  deficiencyStatusNameById: Record<string, string>;
  maintenanceHistory: MaintenanceHistoryRow[];
  maintenanceMemberNameById: Record<string, string>;
  maintenanceDeficiencyNumberById: Record<string, string>;
}

function getInspectionStatusClasses(status: string | null): string {
  const normalizedStatus = (status ?? "").trim().toLowerCase();

  if (normalizedStatus === "ready") {
    return "border-green-500/30 bg-green-500/15 text-green-300";
  }

  if (normalizedStatus === "needs_attention" || normalizedStatus === "deficiency") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }

  if (normalizedStatus === "out_of_service") {
    return "border-red-500/35 bg-red-500/15 text-red-300";
  }

  return "border-white/10 bg-white/5 text-neutral-300";
}

function formatInspectionDateTime(value: string | null) {
  if (!value) {
    return { date: "—", time: "" };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: value, time: "" };
  }

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function formatDeficiencyDateTime(value: string | null) {
  return formatInspectionDateTime(value);
}

function getPriorityBadgeClasses(priority: string | null) {
  const normalizedPriority = (priority ?? "").trim().toLowerCase();

  if (normalizedPriority === "high") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }

  if (normalizedPriority === "medium") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }

  if (normalizedPriority === "low") {
    return "border-blue-500/30 bg-blue-500/15 text-blue-300";
  }

  return "border-white/10 bg-white/5 text-neutral-300";
}

function getDeficiencyStatusClasses(status: string | null) {
  const normalizedStatus = (status ?? "").trim().toLowerCase();

  if (normalizedStatus === "open") {
    return "border-red-500/30 bg-red-500/15 text-red-300";
  }

  if (normalizedStatus === "in progress") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }

  if (normalizedStatus === "closed") {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  }

  return "border-white/10 bg-white/5 text-neutral-300";
}

function formatDeficiencyStatusLabel(status: string | null) {
  const normalizedStatus = (status ?? "").trim().toLowerCase();

  if (normalizedStatus === "open") {
    return "Open";
  }

  if (normalizedStatus === "in progress") {
    return "In Progress";
  }

  if (normalizedStatus === "closed") {
    return "Closed";
  }

  return status ?? "Unknown";
}

function getTruncatedDescription(value: string | null) {
  if (!value) {
    return "—";
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length <= 80) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 77)}...`;
}

export default function ApparatusHistoryCards({
  apparatusName,
  inspectionHistory,
  inspectionMemberNameById,
  deficiencyHistory,
  deficiencyPriorityNameById,
  deficiencyStatusNameById,
  maintenanceHistory,
  maintenanceMemberNameById,
  maintenanceDeficiencyNumberById,
}: ApparatusHistoryCardsProps) {
  const router = useRouter();
  const [inspectionSearch, setInspectionSearch] = useState("");
  const [deficiencySearch, setDeficiencySearch] = useState("");
  const [maintenanceSearch, setMaintenanceSearch] = useState("");

  const normalizedApparatusName = apparatusName.trim();

  function toSearchText(values: Array<string | null | undefined>) {
    return values
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
      .toLowerCase();
  }

  const filteredInspectionHistory = useMemo(() => {
    const query = inspectionSearch.trim().toLowerCase();

    if (!query) {
      return inspectionHistory;
    }

    return inspectionHistory.filter((inspection) => {
      const inspectorName = inspection.member_id
        ? inspectionMemberNameById[inspection.member_id] ?? "Unknown"
        : "Unknown";
      const inspectionDateTime = formatInspectionDateTime(inspection.created_at);
      const renderedNotes = inspection.notes?.trim() ? inspection.notes : "—";
      const statusLabel =
        inspection.status === "ready"
          ? "Ready"
          : inspection.status === "needs_attention" || inspection.status === "deficiency"
            ? "Needs Attention"
            : inspection.status === "out_of_service"
              ? "Out of Service"
              : inspection.status ?? "Unknown";

      const searchableText = toSearchText([
        normalizedApparatusName,
        inspectionDateTime.date,
        inspectionDateTime.time,
        statusLabel,
        inspectorName,
        renderedNotes,
      ]);

      return searchableText.includes(query);
    });
  }, [inspectionHistory, inspectionMemberNameById, inspectionSearch, normalizedApparatusName]);

  const filteredDeficiencyHistory = useMemo(() => {
    const query = deficiencySearch.trim().toLowerCase();

    if (!query) {
      return deficiencyHistory;
    }

    return deficiencyHistory.filter((deficiency) => {
      const reportedBy = deficiency.reported_by?.trim() || "Unknown";
      const deficiencyDateTime = formatDeficiencyDateTime(deficiency.reported_at);
      const priorityName = deficiency.priority
        ? deficiencyPriorityNameById[deficiency.priority] ?? null
        : null;
      const statusName = deficiency.status
        ? deficiencyStatusNameById[deficiency.status] ?? null
        : null;
      const renderedDescription = getTruncatedDescription(deficiency.description);
      const renderedStatus = formatDeficiencyStatusLabel(statusName);

      const searchableText = toSearchText([
        normalizedApparatusName,
        deficiencyDateTime.date,
        deficiencyDateTime.time,
        deficiency.id,
        reportedBy,
        priorityName ?? "",
        renderedStatus,
        renderedDescription,
      ]);

      return searchableText.includes(query);
    });
  }, [
    deficiencyHistory,
    deficiencyPriorityNameById,
    deficiencySearch,
    deficiencyStatusNameById,
    normalizedApparatusName,
  ]);

  const filteredMaintenanceHistory = useMemo(() => {
    const query = maintenanceSearch.trim().toLowerCase();

    if (!query) {
      return maintenanceHistory;
    }

    return maintenanceHistory.filter((maintenance) => {
      const serviceDate = formatInspectionDateTime(maintenance.service_date);
      const completedBy = maintenance.completed_by
        ? maintenanceMemberNameById[maintenance.completed_by] ?? "Unknown"
        : "Unknown";
      const linkedDeficiency = maintenance.deficiency_id
        ? maintenanceDeficiencyNumberById[maintenance.deficiency_id] ?? maintenance.deficiency_id
        : "-";
      const renderedMaintenanceNumber = maintenance.maintenance_number ?? "Pending";
      const renderedMaintenanceType = maintenance.maintenance_type ?? "Unknown";
      const renderedDescription = getTruncatedDescription(maintenance.description);

      const searchableText = toSearchText([
        normalizedApparatusName,
        serviceDate.date,
        serviceDate.time,
        renderedMaintenanceNumber,
        renderedMaintenanceType,
        completedBy,
        linkedDeficiency,
        renderedDescription,
      ]);

      return searchableText.includes(query);
    });
  }, [
    maintenanceDeficiencyNumberById,
    maintenanceHistory,
    maintenanceMemberNameById,
    maintenanceSearch,
    normalizedApparatusName,
  ]);

  return (
    <>
      {/* Inspection History */}
      <div className="rounded-2xl border border-red-900 bg-[#242424] p-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Inspection History</h2>
          <p className="mt-2 text-neutral-400">
            Read-only history of completed apparatus inspections.
          </p>
        </div>

        <div className="mt-4">
          <input
            type="search"
            value={inspectionSearch}
            onChange={(event) => setInspectionSearch(event.target.value)}
            placeholder="Search inspection history"
            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
          />
        </div>

        <div className="mt-6 h-[28rem] overflow-x-auto overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b]">
          {filteredInspectionHistory.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-6 py-8 text-center text-neutral-400">
              No inspection history available.
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 border-b border-white/10 bg-[#1b1b1b] text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-4 py-3 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Inspector</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 text-neutral-300">
                {filteredInspectionHistory.map((inspection) => {
                  const inspectorName = inspection.member_id
                    ? inspectionMemberNameById[inspection.member_id] ?? "Unknown"
                    : "Unknown";
                  const inspectionDateTime = formatInspectionDateTime(inspection.created_at);
                  const statusLabel =
                    inspection.status === "ready"
                      ? "Ready"
                      : inspection.status === "needs_attention" || inspection.status === "deficiency"
                        ? "Needs Attention"
                        : inspection.status === "out_of_service"
                          ? "Out of Service"
                          : inspection.status ?? "Unknown";

                  return (
                    <tr
                      key={inspection.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Inspection history entry ${statusLabel} by ${inspectorName}`}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline-none"
                    >
                      <td className="px-4 py-4 align-top text-white">
                        <div className="space-y-1">
                          <div>{inspectionDateTime.date}</div>
                          {inspectionDateTime.time ? (
                            <div className="text-xs text-neutral-400">{inspectionDateTime.time}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-3.5 py-1.5 text-sm font-semibold ${getInspectionStatusClasses(
                            inspection.status
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-white">{inspectorName}</td>
                      <td className="px-4 py-4 align-top text-neutral-300">
                        {inspection.notes?.trim() ? inspection.notes : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Deficiency History */}
      <div className="rounded-2xl border border-red-900 bg-[#242424] p-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Deficiency History</h2>
          <p className="mt-2 text-neutral-400">
            Read-only history of reported deficiencies for this apparatus.
          </p>
        </div>

        <div className="mt-4">
          <input
            type="search"
            value={deficiencySearch}
            onChange={(event) => setDeficiencySearch(event.target.value)}
            placeholder="Search deficiency history"
            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
          />
        </div>

        <div className="mt-6 h-[28rem] overflow-x-auto overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b]">
          {filteredDeficiencyHistory.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-6 py-8 text-center text-neutral-400">
              No deficiencies have been reported for this apparatus.
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 border-b border-white/10 bg-[#1b1b1b] text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-4 py-3 font-semibold">Date Reported</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reported By</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 text-neutral-300">
                {filteredDeficiencyHistory.map((deficiency) => {
                  const reportedBy = deficiency.reported_by?.trim() || "Unknown";
                  const deficiencyDateTime = formatDeficiencyDateTime(deficiency.reported_at);
                  const priorityName = deficiency.priority
                    ? deficiencyPriorityNameById[deficiency.priority] ?? null
                    : null;
                  const statusName = deficiency.status
                    ? deficiencyStatusNameById[deficiency.status] ?? null
                    : null;

                  return (
                    <tr
                      key={deficiency.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Deficiency history entry ${formatDeficiencyStatusLabel(statusName)} reported by ${reportedBy}`}
                      onClick={() => router.push(`/operations/deficiencies/${deficiency.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/operations/deficiencies/${deficiency.id}`);
                        }
                      }}
                      className="group cursor-pointer transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:outline-none"
                    >
                      <td className="px-4 py-4 align-top text-white">
                        <div className="space-y-1">
                          <div>{deficiencyDateTime.date}</div>
                          {deficiencyDateTime.time ? (
                            <div className="text-xs text-neutral-400">{deficiencyDateTime.time}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-3.5 py-1.5 text-sm font-semibold ${getPriorityBadgeClasses(
                            priorityName
                          )}`}
                        >
                          {priorityName ? priorityName : "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-3.5 py-1.5 text-sm font-semibold ${getDeficiencyStatusClasses(
                            statusName
                          )}`}
                        >
                          {formatDeficiencyStatusLabel(statusName)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-white">{reportedBy}</td>
                      <td className="px-4 py-4 align-top text-neutral-300">
                        {getTruncatedDescription(deficiency.description)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Maintenance History */}
      <div className="rounded-2xl border border-red-900 bg-[#242424] p-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Maintenance History</h2>
          <p className="mt-2 text-neutral-400">
            Read-only history of maintenance records linked to this apparatus.
          </p>
        </div>

        <div className="mt-4">
          <input
            type="search"
            value={maintenanceSearch}
            onChange={(event) => setMaintenanceSearch(event.target.value)}
            placeholder="Search maintenance history"
            className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
          />
        </div>

        <div className="mt-6 h-[28rem] overflow-x-auto overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b]">
          {filteredMaintenanceHistory.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-6 py-8 text-center text-neutral-400">
              No maintenance records have been reported for this apparatus.
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 border-b border-white/10 bg-[#1b1b1b] text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                  <th className="px-4 py-3 font-semibold">Service Date</th>
                  <th className="px-4 py-3 font-semibold">Record #</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Completed By</th>
                  <th className="px-4 py-3 font-semibold">Linked Deficiency</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 text-neutral-300">
                {filteredMaintenanceHistory.map((maintenance) => {
                  const serviceDate = formatInspectionDateTime(maintenance.service_date);
                  const completedBy = maintenance.completed_by
                    ? maintenanceMemberNameById[maintenance.completed_by] ?? "Unknown"
                    : "Unknown";
                  const linkedDeficiency = maintenance.deficiency_id
                    ? maintenanceDeficiencyNumberById[maintenance.deficiency_id] ?? maintenance.deficiency_id
                    : "-";

                  return (
                    <tr key={maintenance.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-4 align-top text-white">
                        <div className="space-y-1">
                          <div>{serviceDate.date}</div>
                          {serviceDate.time ? (
                            <div className="text-xs text-neutral-400">{serviceDate.time}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-white">
                        <Link href={`/maintenance/${maintenance.id}`} className="underline decoration-zinc-700 hover:text-red-300">
                          {maintenance.maintenance_number ?? "Pending"}
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-300">
                        {maintenance.maintenance_type ?? "Unknown"}
                      </td>
                      <td className="px-4 py-4 align-top text-zinc-300">{completedBy}</td>
                      <td className="px-4 py-4 align-top text-zinc-300">{linkedDeficiency}</td>
                      <td className="px-4 py-4 align-top text-zinc-300">
                        {getTruncatedDescription(maintenance.description)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
