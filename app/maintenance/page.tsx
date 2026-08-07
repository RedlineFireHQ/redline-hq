"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { MAINTENANCE_TYPE_OPTIONS } from "@/lib/maintenance";
import { supabase } from "@/lib/supabase";

type MaintenanceRow = {
  id: string;
  maintenance_number: string | null;
  apparatus_id: string | null;
  deficiency_id: string | null;
  maintenance_type: string | null;
  completed_by: string | null;
  service_date: string | null;
  description: string | null;
  notes: string | null;
  cost: number | null;
};

type ApparatusOption = {
  id: string;
  name: string;
};

function normalizeMaintenanceType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "preventive") {
    return "Preventive Maintenance";
  }

  if (normalized === "inspection follow-up" || normalized === "inspection followup") {
    return "Inspection Follow-up";
  }

  if (normalized === "repair") {
    return "Repair";
  }

  if (normalized === "testing") {
    return "Testing";
  }

  if (normalized === "service") {
    return "Service";
  }

  if (normalized === "other") {
    return "Other";
  }

  return value.trim();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<MaintenanceRow[]>([]);
  const [apparatusOptions, setApparatusOptions] = useState<ApparatusOption[]>([]);
  const [apparatusNameById, setApparatusNameById] = useState<Record<string, string>>({});
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedApparatusId, setSelectedApparatusId] = useState("all");
  const [selectedMaintenanceType, setSelectedMaintenanceType] = useState("all");
  const [serviceDateFrom, setServiceDateFrom] = useState("");
  const [serviceDateTo, setServiceDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const linkedDeficiencyId = searchParams.get("deficiencyId");
  const shouldAutoOpenCreate = searchParams.get("create") === "1";

  function buildPerformMaintenanceHref() {
    const params = new URLSearchParams();

    if (linkedDeficiencyId) {
      params.set("deficiencyId", linkedDeficiencyId);
    }

    const query = params.toString();
    return query ? `/maintenance/perform?${query}` : "/maintenance/perform";
  }

  useEffect(() => {
    if (!shouldAutoOpenCreate) {
      return;
    }

    router.push(buildPerformMaintenanceHref());
  }, [shouldAutoOpenCreate, router, linkedDeficiencyId]);

  async function loadRecords() {
    setIsLoading(true);
    setErrorMessage(null);

    const [apparatusResult, membersResult] = await Promise.all([
      supabase.from("apparatus").select("id, name").order("name"),
      supabase.from("members").select("id, first_name, last_name"),
    ]);

    const normalizedApparatus = (apparatusResult.data ?? []).map((row) => {
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : String(record.id ?? "");
      const name = typeof record.name === "string" ? record.name : id;

      return { id, name };
    });

    const apparatusMap = normalizedApparatus.reduce<Record<string, string>>((acc, apparatus) => {
      acc[apparatus.id] = apparatus.name;
      return acc;
    }, {});

    const membersMap = (membersResult.data ?? []).reduce<Record<string, string>>((acc, row) => {
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";

      if (!id) {
        return acc;
      }

      const firstName = typeof record.first_name === "string" ? record.first_name.trim() : "";
      const lastName = typeof record.last_name === "string" ? record.last_name.trim() : "";
      const fullName = `${firstName} ${lastName}`.trim() || id;

      acc[id] = fullName;
      return acc;
    }, {});

    const recordsResult = await supabase
      .from("maintenance_records")
      .select("id, maintenance_number, apparatus_id, deficiency_id, maintenance_type, completed_by, service_date, description, notes, cost")
      .order("service_date", { ascending: false });

    const normalizedRecords = (recordsResult.data ?? []).map((row) => {
      const record = row as Record<string, unknown>;

      return {
        id: typeof record.id === "string" ? record.id : String(record.id ?? ""),
        maintenance_number:
          typeof record.maintenance_number === "string" ? record.maintenance_number : null,
        apparatus_id: typeof record.apparatus_id === "string" ? record.apparatus_id : null,
        deficiency_id: typeof record.deficiency_id === "string" ? record.deficiency_id : null,
        maintenance_type: normalizeMaintenanceType(
          typeof record.maintenance_type === "string" ? record.maintenance_type : null
        ),
        completed_by: typeof record.completed_by === "string" ? record.completed_by : null,
        service_date: typeof record.service_date === "string" ? record.service_date : null,
        description: typeof record.description === "string" ? record.description : null,
        notes: typeof record.notes === "string" ? record.notes : null,
        cost: typeof record.cost === "number" ? record.cost : null,
      } as MaintenanceRow;
    });

    setRecords(normalizedRecords);
    setApparatusOptions(normalizedApparatus);
    setApparatusNameById(apparatusMap);
    setMemberNameById(membersMap);

    if (apparatusResult.error || membersResult.error || recordsResult.error) {
      setErrorMessage(
        recordsResult.error?.message ||
          apparatusResult.error?.message ||
          membersResult.error?.message ||
          "Unable to load maintenance records."
      );
    }

    setIsLoading(false);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const maintenanceTypeOptions = MAINTENANCE_TYPE_OPTIONS;

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return records.filter((record) => {
      if (selectedApparatusId !== "all" && record.apparatus_id !== selectedApparatusId) {
        return false;
      }

      if (
        selectedMaintenanceType !== "all" &&
        (record.maintenance_type ?? "") !== selectedMaintenanceType
      ) {
        return false;
      }

      if (serviceDateFrom) {
        const fromDate = new Date(`${serviceDateFrom}T00:00:00`);
        const serviceDate = record.service_date ? new Date(record.service_date) : null;

        if (!serviceDate || serviceDate < fromDate) {
          return false;
        }
      }

      if (serviceDateTo) {
        const toDate = new Date(`${serviceDateTo}T23:59:59`);
        const serviceDate = record.service_date ? new Date(record.service_date) : null;

        if (!serviceDate || serviceDate > toDate) {
          return false;
        }
      }

      if (normalizedSearch) {
        const apparatusName = record.apparatus_id
          ? apparatusNameById[record.apparatus_id] ?? ""
          : "";
        const completedByName = record.completed_by
          ? memberNameById[record.completed_by] ?? ""
          : "";

        const searchableFields = [
          record.id,
          record.maintenance_number ?? "",
          apparatusName,
          record.description ?? "",
          record.notes ?? "",
          completedByName,
        ];

        const hasMatch = searchableFields.some((field) =>
          field.toLowerCase().includes(normalizedSearch)
        );

        if (!hasMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    records,
    selectedApparatusId,
    selectedMaintenanceType,
    serviceDateFrom,
    serviceDateTo,
    searchQuery,
    apparatusNameById,
    memberNameById,
  ]);

  return (
    <PageLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">Operations</p>
            <h1 className="mt-2 text-5xl font-black tracking-tight text-white">Maintenance</h1>
            <p className="mt-3 max-w-3xl text-lg text-neutral-400">
              Track completed service work tied to deficiencies, apparatus readiness, and ongoing fleet reliability.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(buildPerformMaintenanceHref())}
            className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(184,18,18,0.25)] transition hover:bg-red-500"
          >
            Perform Maintenance
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.25)]">
          <div className="mb-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Search Maintenance History
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by apparatus, record ID, description, notes, or completed by"
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Apparatus
              </span>
              <select
                value={selectedApparatusId}
                onChange={(event) => setSelectedApparatusId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              >
                {isLoading ? (
                  <option value="all">Loading apparatus...</option>
                ) : apparatusOptions.length === 0 ? (
                  <option value="all">No apparatus available</option>
                ) : (
                  <>
                    <option value="all">All Apparatus</option>
                    {apparatusOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Maintenance Type
              </span>
              <select
                value={selectedMaintenanceType}
                onChange={(event) => setSelectedMaintenanceType(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              >
                <option value="all">All Types</option>
                {maintenanceTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Service Date From
              </span>
              <input
                type="date"
                value={serviceDateFrom}
                onChange={(event) => setServiceDateFrom(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Service Date To
              </span>
              <input
                type="date"
                value={serviceDateTo}
                onChange={(event) => setServiceDateTo(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
              />
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">
              Maintenance History
            </h2>
          </div>

          {isLoading ? (
            <div className="px-6 py-10 text-sm text-zinc-400">Loading maintenance records...</div>
          ) : errorMessage ? (
            <div className="px-6 py-10 text-sm text-red-300">{errorMessage}</div>
          ) : filteredRecords.length === 0 ? (
            <div className="px-6 py-10 text-sm text-zinc-400">No maintenance records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-[#0d0d0d] text-left text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  <tr>
                    <th className="px-6 py-4">Record #</th>
                    <th className="px-6 py-4">Apparatus</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Service Date</th>
                    <th className="px-6 py-4">Completed By</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4">Description</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {filteredRecords.map((record) => {
                    const apparatusName =
                      (record.apparatus_id && apparatusNameById[record.apparatus_id]) || "Unknown";
                    const completedBy =
                      (record.completed_by && memberNameById[record.completed_by]) || "Unknown";

                    return (
                      <tr
                        key={record.id}
                        className="cursor-pointer transition hover:bg-white/[0.03]"
                        onClick={() => router.push(`/maintenance/${record.id}`)}
                      >
                        <td className="px-6 py-4 font-semibold text-white">
                          {record.maintenance_number ?? "Pending"}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">{apparatusName}</td>
                        <td className="px-6 py-4 text-zinc-300">{record.maintenance_type ?? "Unknown"}</td>
                        <td className="px-6 py-4 text-zinc-400">{formatDateTime(record.service_date)}</td>
                        <td className="px-6 py-4 text-zinc-300">{completedBy}</td>
                        <td className="px-6 py-4 text-zinc-300">{formatCurrency(record.cost)}</td>
                        <td className="px-6 py-4 text-zinc-300">
                          {record.description?.trim() ? record.description : "No description."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </PageLayout>
  );
}
