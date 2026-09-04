"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmsSupplyHistoryRow } from "@/lib/ems/supply-history";

type Option = {
  id: string;
  label: string;
};

type EmsSupplyHistoryWorkspaceProps = {
  departmentName: string | null;
  memberOptions: Option[];
  supplyOptions: Option[];
  initialRows: EmsSupplyHistoryRow[];
  initialError?: string | null;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatQuantity(value: number) {
  const hasDecimals = Math.abs(value % 1) > 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function quantityDeltaLabel(value: number) {
  const formatted = formatQuantity(Math.abs(value));
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
}

function buildDestinationLabel(row: EmsSupplyHistoryRow) {
  if (!row.destination) {
    return "-";
  }

  if (row.destinationType && row.destinationType !== row.destination) {
    return `${row.destinationType} - ${row.destination}`;
  }

  return row.destination;
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export default function EmsSupplyHistoryWorkspace({
  departmentName,
  memberOptions,
  supplyOptions,
  initialRows,
  initialError = null,
}: EmsSupplyHistoryWorkspaceProps) {
  const [rows, setRows] = useState<EmsSupplyHistoryRow[]>(initialRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [memberId, setMemberId] = useState("all");
  const [supplyItemId, setSupplyItemId] = useState("all");
  const [transactionType, setTransactionType] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [hasLoadError, setHasLoadError] = useState(Boolean(initialError));
  const isFirstRender = useRef(true);

  const loadRows = useCallback(
    async (nextFilters?: {
      dateFrom: string;
      dateTo: string;
      memberId: string;
      supplyItemId: string;
      transactionType: string;
    }) => {
      const filters = nextFilters ?? { dateFrom, dateTo, memberId, supplyItemId, transactionType };
      const params = new URLSearchParams();

      if (filters.dateFrom) {
        params.set("dateFrom", filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set("dateTo", filters.dateTo);
      }
      if (filters.memberId && filters.memberId !== "all") {
        params.set("memberId", filters.memberId);
      }
      if (filters.supplyItemId && filters.supplyItemId !== "all") {
        params.set("supplyItemId", filters.supplyItemId);
      }
      if (filters.transactionType && filters.transactionType !== "all") {
        params.set("transactionType", filters.transactionType);
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/ems/transactions/history?${params.toString()}`, {
          method: "GET",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          rows?: EmsSupplyHistoryRow[];
          error?: unknown;
        };

        if (!response.ok || !payload.ok) {
          const message = typeof payload.error === "string" && payload.error.trim()
            ? payload.error
            : "Unable to load EMS supply history.";
          setLoadError(message);
          setHasLoadError(true);
          setIsLoading(false);
          return;
        }

        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setLoadError(null);
        setHasLoadError(false);
      } catch {
        setLoadError("Unable to load EMS supply history.");
        setHasLoadError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [dateFrom, dateTo, memberId, supplyItemId, transactionType],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      [row.performedByName, row.supplyItemName]
        .some((value) => normalizeText(value).includes(normalizedSearch)),
    );
  }, [rows, searchTerm]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    memberId !== "all" ||
    supplyItemId !== "all" ||
    transactionType !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setMemberId("all");
    setSupplyItemId("all");
    setTransactionType("all");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>
          <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">EMS Supply History</h1>
          <p className="mt-3 max-w-3xl text-lg text-neutral-400">
            Department-wide transaction ledger for EMS supply accountability and troubleshooting.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {departmentName ? `${departmentName} Supply Management` : "Supply Management"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/inventory/ems-supplies"
            className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to EMS Supplies
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="block xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by member or supply item"
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Member
            </span>
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="all">All Members</option>
              {memberOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Supply Item
            </span>
            <select
              value={supplyItemId}
              onChange={(event) => setSupplyItemId(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="all">All Supplies</option>
              {supplyOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2 xl:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Transaction Type
            </span>
            <select
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="Checkout">Checkout</option>
              <option value="Restock">Restock</option>
              <option value="Return">Return</option>
              <option value="Correction">Correction</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-400">
            {isLoading ? "Loading history..." : `${filteredRows.length} transaction${filteredRows.length === 1 ? "" : "s"} shown`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void loadRows();
              }}
              className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        {hasLoadError ? (
          <div className="rounded-xl border border-red-500/30 bg-[#1b1b1b] px-6 py-10 text-center">
            <p className="text-lg font-bold text-red-100">EMS Supply History Could Not Be Loaded</p>
            <p className="mt-2 text-sm text-red-200/90">{loadError || "Unable to load EMS supply history."}</p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  void loadRows();
                }}
                className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Retry Load
              </button>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-6 py-10 text-center">
            <p className="text-lg font-bold text-white">
              {hasActiveFilters ? "No Matching Transactions" : "No EMS Supply History Recorded"}
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              {hasActiveFilters
                ? "No EMS supply transactions matched the current search or filters."
                : "No EMS supply transactions have been recorded for this department yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {[
                    "Date / Time",
                    "Member",
                    "Supply Item",
                    "Transaction Type",
                    "Quantity Change",
                    "Quantity Before",
                    "Quantity After",
                    "Destination",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/5">
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-white">{formatDateTime(row.occurredAt)}</td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.performedByName}</td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                      <div>{row.supplyItemName}</div>
                      {row.supplyItemCategory ? <div className="text-xs text-neutral-500">{row.supplyItemCategory}</div> : null}
                    </td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{row.transactionType}</td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">{quantityDeltaLabel(row.quantityChange)}</td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatQuantity(row.quantityBefore)}</td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{formatQuantity(row.quantityAfter)}</td>
                    <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">{buildDestinationLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}